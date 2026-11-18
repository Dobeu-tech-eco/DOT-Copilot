-- Forward-only authorization repair for both the full historical schema and
-- the July baseline. Restrictive policies intersect with every old permissive
-- policy; this deliberately does not assume the two histories have equal catalogs.

create or replace function public.app_identity_is_active()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  );
$$;
revoke all on function public.app_identity_is_active() from public, anon, authenticated;
grant execute on function public.app_identity_is_active() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'fleets', 'locations', 'profiles', 'compliance_requirements',
    'training_programs', 'modules', 'lessons', 'assignments',
    'completion_records', 'driver_compliance', 'driver_documents',
    'vehicles', 'notifications', 'driver_stats', 'push_subscriptions',
    'audit_logs', 'btw_sessions', 'quiz_questions', 'quiz_responses',
    'webhooks', 'webhook_deliveries'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format(
        'create policy foundation_active_identity on public.%I as restrictive
         for all to authenticated
         using ((select public.app_identity_is_active()))
         with check ((select public.app_identity_is_active()))', t
      );
    end if;
  end loop;
end;
$$;

-- Profile presentation/preferences remain editable through existing RLS. The
-- authority-bearing columns require a server service_role connection, including
-- when the caller is a platform admin. Database owners retain migration access.
create or replace function public.guard_profile_authority()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') and (
    new.id is distinct from old.id or
    new.role is distinct from old.role or
    new.fleet_id is distinct from old.fleet_id or
    new.is_platform_admin is distinct from old.is_platform_admin or
    new.is_active is distinct from old.is_active
  ) then
    raise exception 'Profile authority changes require the server service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_authority() from public, anon, authenticated;
create trigger foundation_guard_profile_authority
before update on public.profiles
for each row execute function public.guard_profile_authority();
-- Remove retired browser INSERT policies as well as their grant. The full
-- history contains a self-referential admin INSERT policy that otherwise fails
-- during policy rewriting before PostgreSQL reaches the permission check.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end;
$$;
revoke insert, delete on public.profiles from public, anon, authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Completion evidence (including passed and quiz_score) is server authoritative.
-- Revocation is the primary boundary; restrictive denials also prevent legacy
-- permissive policies from authorizing writes if table grants drift later.
revoke insert, update, delete on public.completion_records from public, anon, authenticated;
grant select, insert, update, delete on public.completion_records to service_role;
create policy foundation_completion_insert_server_only
on public.completion_records as restrictive for insert to authenticated
with check (false);
create policy foundation_completion_update_server_only
on public.completion_records as restrictive for update to authenticated
using (false) with check (false);
create policy foundation_completion_delete_server_only
on public.completion_records as restrictive for delete to authenticated
using (false);

-- Hide historically mis-associated completion rows. Fine-grained lesson,
-- assessment and assignment validation belongs to the server completion writer;
-- browser writes are denied entirely above.
create policy foundation_completion_consistency
on public.completion_records as restrictive for select to authenticated
using (
  (public.app_is_platform_admin() or (
    fleet_id = public.app_fleet() and (
      user_id = auth.uid() or
      public.app_role() in ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'DRIVER_COACH')
    )
  ))
  and exists (
    select 1 from public.profiles owner
    where owner.id = completion_records.user_id
      and owner.fleet_id = completion_records.fleet_id
  )
);

-- Reservations are written by the provisioning server before the Auth invite.
-- No browser role can create, read, modify or consume them, regardless of RLS.
create table public.fleet_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email <> '' and email = lower(btrim(email))),
  fleet_id uuid not null references public.fleets(id) on delete cascade,
  role text not null check (role in ('DRIVER', 'DRIVER_COACH', 'SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  -- GoTrue may INSERT the identity before setting invited_at in the same
  -- transaction. These private markers distinguish that creation from a later
  -- invitation of an existing identity; neither marker is client writable.
  pending_user_id uuid references auth.users(id) on delete cascade,
  auth_creation_xid xid8,
  created_at timestamptz not null default now()
);
alter table public.fleet_invitations enable row level security;
revoke all on public.fleet_invitations from public, anon, authenticated;
grant select, insert, update, delete on public.fleet_invitations to service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare reservation public.fleet_invitations%rowtype;
begin
  -- User-supplied metadata is never an authorization source. Only an actual
  -- Auth invite may atomically consume a server-owned, unexpired reservation.
  if new.invited_at is not null then
    delete from public.fleet_invitations
    where email = lower(btrim(new.email)) and expires_at > now()
    returning * into reservation;
  end if;

  insert into public.profiles (id, email, name, role, fleet_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(reservation.role, 'DRIVER'),
    reservation.fleet_id
  );

  if new.invited_at is null then
    update public.fleet_invitations
    set pending_user_id = new.id, auth_creation_xid = pg_current_xact_id()
    where email = lower(btrim(new.email)) and expires_at > now()
      and pending_user_id is null;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.attach_new_invited_user()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  reservation public.fleet_invitations%rowtype;
  attached boolean;
begin
  -- Auth owns invited_at. A metadata change or a subsequent re-invite cannot
  -- attach an existing profile: this must complete the original INSERT's
  -- transaction, and the original default profile must still be untouched.
  if old.invited_at is null and new.invited_at is not null then
    select * into reservation from public.fleet_invitations
    where email = lower(btrim(new.email)) and expires_at > now()
      and pending_user_id = new.id
      and auth_creation_xid = pg_current_xact_id()
    for update;

    if found then
      update public.profiles
      set role = reservation.role, fleet_id = reservation.fleet_id
      where id = new.id and email = new.email
        and role = 'DRIVER' and fleet_id is null
        and not is_platform_admin and is_active
      returning true into attached;

      if coalesce(attached, false) then
        delete from public.fleet_invitations where id = reservation.id;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.attach_new_invited_user() from public, anon, authenticated;
create trigger foundation_attach_new_invited_user
after update of invited_at on auth.users
for each row
when (old.invited_at is null and new.invited_at is not null)
execute function public.attach_new_invited_user();
