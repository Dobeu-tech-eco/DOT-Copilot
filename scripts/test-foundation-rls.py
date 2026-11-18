#!/usr/bin/env python3
"""Local-only migration replay and authorization acceptance. Never accepts a DB URL.
Start a fresh isolated Supabase project, then pass its Docker DB container name.
--historical-only proves the denial suite fails before the forward repair.
"""
import argparse
import hashlib
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('container')
parser.add_argument('--historical-only', action='store_true')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if not args.container.startswith('supabase_db_dot-foundation-replay-'):
    raise SystemExit('Refusing target outside disposable foundation replay namespace')
args.output.mkdir(parents=True, exist_ok=True)

def run(command, source=None):
    return subprocess.run(['docker', 'exec', '-i', args.container, *command],
                          input=source, text=True, capture_output=True, check=False)

def query(db, source, admin=False):
    return run(['psql', '-X', '-q', '-At', '-U', 'supabase_admin' if admin else 'postgres',
                '-d', db, '-v', 'ON_ERROR_STOP=1', '-f', '-'], source)

def checked(db, source, admin=False):
    result = query(db, source, admin)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

snapshot = run(['pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only', '--no-owner'])
if snapshot.returncode:
    raise SystemExit(snapshot.stderr)
# The source must be an empty local platform schema, not an existing application.
if checked('postgres', "SELECT to_regclass('public.profiles') IS NULL;") != 't':
    raise SystemExit('Refusing nonempty application source schema')
all_files = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
base_name = '20260726003000_init_schema.sql'
repair_name = '20261118000000_foundation_authorization.sql'
history = [p for p in all_files if p.name < repair_name]
repairs = [] if args.historical_only else [ROOT / 'supabase/migrations' / repair_name]
report = {'container': args.container, 'historical_only': args.historical_only,
          'server': checked('postgres', 'SELECT version();'), 'cases': {},
          'migration_hashes': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                               for p in history + repairs]}
A = '10000000-0000-0000-0000-000000000001'
B = '10000000-0000-0000-0000-000000000002'
U = '20000000-0000-0000-0000-000000000001'
V = '20000000-0000-0000-0000-000000000002'
I = '20000000-0000-0000-0000-000000000003'
J = '20000000-0000-0000-0000-000000000004'
context = f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{U}';"
seed = f"""
INSERT INTO public.fleets(id,company_name) VALUES ('{A}','Fixture A'),('{B}','Fixture B');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('{U}','driver-a@example.invalid','{{"name":"A"}}'),
 ('{V}','driver-b@example.invalid','{{"name":"B"}}');
UPDATE public.profiles SET fleet_id='{A}' WHERE id='{U}';
UPDATE public.profiles SET fleet_id='{B}' WHERE id='{V}';
INSERT INTO public.training_programs(program_name,fleet_id) VALUES ('A','{A}'),('B','{B}');
"""
# True result is the exact expected denial/positive behavior. Only SQLSTATE 42501
# counts as a permission denial; syntax errors and unrelated failures fail tests.
def denied(statement):
    return "DO $test$ BEGIN BEGIN " + statement + "; EXCEPTION WHEN insufficient_privilege THEN RETURN; END; RAISE EXCEPTION 'operation unexpectedly allowed'; END $test$; SELECT true;"

tests = {
    'deny_self_platform_admin': context + denied(f"UPDATE public.profiles SET is_platform_admin=true WHERE id='{U}'"),
    'deny_self_role': context + denied(f"UPDATE public.profiles SET role='ADMIN' WHERE id='{U}'"),
    'deny_self_fleet': context + denied(f"UPDATE public.profiles SET fleet_id='{B}' WHERE id='{U}'"),
    'deny_self_activation': context + denied(f"UPDATE public.profiles SET is_active=false WHERE id='{U}'"),
    'deny_cross_fleet_completion': context + denied(f"INSERT INTO public.completion_records(user_id,fleet_id,passed,quiz_score) VALUES ('{U}','{B}',true,100)"),
    'deny_self_scored_completion': context + denied(f"INSERT INTO public.completion_records(user_id,fleet_id,passed,quiz_score) VALUES ('{U}','{A}',true,100)"),
    'deny_inactive_training': f"UPDATE public.profiles SET is_active=false WHERE id='{U}';" + context + "SELECT count(*)=0 FROM public.training_programs;",
    'deny_inactive_profile_update': f"UPDATE public.profiles SET is_active=false WHERE id='{U}';" + context + f"WITH changed AS (UPDATE public.profiles SET name='forbidden' WHERE id='{U}' RETURNING id) SELECT count(*)=0 FROM changed;",
    'deny_completion_update': context + denied("UPDATE public.completion_records SET passed=true,quiz_score=100"),
    'deny_completion_delete': context + denied("DELETE FROM public.completion_records"),
    'deny_profile_insert': context + denied(f"INSERT INTO public.profiles(id,email,role,is_platform_admin) VALUES ('{J}','forged@example.invalid','ADMIN',true)"),
    'deny_profile_delete': context + denied(f"DELETE FROM public.profiles WHERE id='{U}'"),
    'allow_own_server_completion_read': f"INSERT INTO public.completion_records(user_id,fleet_id,passed,quiz_score) VALUES ('{U}','{A}',true,100);" + context + f"SELECT count(*)=1 FROM public.completion_records WHERE user_id='{U}';",
    'deny_malformed_completion_read': f"INSERT INTO public.completion_records(user_id,fleet_id,passed,quiz_score) VALUES ('{U}','{B}',true,100);" + context + f"SELECT count(*)=0 FROM public.completion_records WHERE user_id='{U}';",
    'deny_direct_other_fleet_read': context + f"SELECT count(*)=0 FROM public.training_programs WHERE fleet_id='{B}';",
    'allow_active_own_fleet_read': context + f"SELECT count(*)=1 FROM public.training_programs WHERE fleet_id='{A}';",
    'allow_safe_profile_edit': context + f"UPDATE public.profiles SET name='Updated' WHERE id='{U}'; SELECT name='Updated' FROM public.profiles WHERE id='{U}';",
    'deny_raw_metadata_privileges': f"INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('{J}','spoof@example.invalid','{{\"role\":\"ADMIN\",\"fleet_id\":\"{A}\",\"is_platform_admin\":true}}'); SELECT role='DRIVER' AND fleet_id IS NULL AND NOT is_platform_admin FROM public.profiles WHERE id='{J}';",
    'allow_service_role_management': f"SET LOCAL ROLE service_role; UPDATE public.profiles SET role='ADMIN' WHERE id='{U}'; SELECT role='ADMIN' FROM public.profiles WHERE id='{U}';",
    'allow_server_completion': f"SET LOCAL ROLE service_role; INSERT INTO public.completion_records(user_id,fleet_id,passed,quiz_score) VALUES ('{U}','{A}',true,100); SELECT count(*)=1 FROM public.completion_records WHERE user_id='{U}';",
}
if not args.historical_only:
    tests.update({
        'allow_two_step_auth_invite': f"INSERT INTO public.fleet_invitations(email,fleet_id,role) VALUES ('two-step@example.invalid','{A}','ADMIN'); INSERT INTO auth.users(id,email) VALUES ('{I}','two-step@example.invalid'); UPDATE auth.users SET invited_at=now() WHERE id='{I}'; SELECT role='ADMIN' AND fleet_id='{A}' FROM public.profiles WHERE id='{I}'; SELECT count(*)=0 FROM public.fleet_invitations WHERE email='two-step@example.invalid';",
        'deny_existing_identity_invite_reassignment': f"INSERT INTO public.fleet_invitations(email,fleet_id,role) VALUES ('driver-a@example.invalid','{B}','ADMIN'); UPDATE auth.users SET invited_at=now() WHERE id='{U}'; SELECT role='DRIVER' AND fleet_id='{A}' FROM public.profiles WHERE id='{U}'; SELECT count(*)=1 FROM public.fleet_invitations WHERE email='driver-a@example.invalid';",
        'deny_driver_invitation_reservation': context + denied(f"INSERT INTO public.fleet_invitations(email,fleet_id,role) VALUES ('bad@example.invalid','{A}','ADMIN')"),
        'allow_trusted_invite_attachment': f"SET LOCAL ROLE service_role; INSERT INTO public.fleet_invitations(email,fleet_id,role,expires_at) VALUES ('invite@example.invalid','{A}','ADMIN',now()+interval '1 hour'); RESET ROLE; INSERT INTO auth.users(id,email,invited_at,raw_user_meta_data) VALUES ('{I}','invite@example.invalid',now(),'{{\"role\":\"DRIVER\",\"fleet_id\":\"{B}\"}}'); SELECT role='ADMIN' AND fleet_id='{A}' FROM public.profiles WHERE id='{I}'; SELECT count(*)=0 FROM public.fleet_invitations WHERE email='invite@example.invalid';",
        'deny_expired_invite_attachment': f"INSERT INTO public.fleet_invitations(email,fleet_id,role,expires_at) VALUES ('expired@example.invalid','{A}','ADMIN',now()-interval '1 hour'); INSERT INTO auth.users(id,email,invited_at) VALUES ('{I}','expired@example.invalid',now()); SELECT role='DRIVER' AND fleet_id IS NULL FROM public.profiles WHERE id='{I}';",
        'deny_signup_consuming_invite': f"INSERT INTO public.fleet_invitations(email,fleet_id,role) VALUES ('signup@example.invalid','{A}','ADMIN'); INSERT INTO auth.users(id,email) VALUES ('{I}','signup@example.invalid'); SELECT role='DRIVER' AND fleet_id IS NULL FROM public.profiles WHERE id='{I}'; SELECT count(*)=1 FROM public.fleet_invitations WHERE email='signup@example.invalid';",
        'deny_invite_without_reservation': f"INSERT INTO auth.users(id,email,invited_at,raw_user_meta_data) VALUES ('{I}','unreserved@example.invalid',now(),'{{\"role\":\"ADMIN\",\"fleet_id\":\"{A}\"}}'); SELECT role='DRIVER' AND fleet_id IS NULL FROM public.profiles WHERE id='{I}';",
    })
else:
    tests['trusted_invite_historical_failure'] = f"INSERT INTO auth.users(id,email,invited_at,raw_user_meta_data) VALUES ('{I}','invite@example.invalid',now(),'{{\"role\":\"ADMIN\",\"fleet_id\":\"{A}\"}}'); SELECT role='ADMIN' AND fleet_id='{A}' FROM public.profiles WHERE id='{I}';"

stamp = str(time.time_ns())
for label, files in [('full', history + repairs), ('baseline', [ROOT/'supabase/migrations'/base_name] + repairs)]:
    db = f'dot_accept_{label}_{stamp}'
    created = run(['createdb', '-U', 'postgres', db])
    if created.returncode:
        raise SystemExit(created.stderr)
    checked(db, 'BEGIN;\n' + snapshot.stdout + '\nCOMMIT;', admin=True)
    entry = {'database': db, 'migrations': [], 'tests': {}}
    report['cases'][label] = entry
    for path in files:
        r = query(db, 'BEGIN;\n' + path.read_text() + '\nCOMMIT;')
        (args.output / (label+'-'+path.name+'.log')).write_text(r.stdout+r.stderr)
        entry['migrations'].append({'file': path.name, 'exit': r.returncode})
        if r.returncode:
            raise RuntimeError(r.stderr)
    checked(db, 'BEGIN;'+seed+'COMMIT;')
    for name, source in tests.items():
        observations = []
        for _ in range(2):
            r = query(db, 'BEGIN;'+source+'ROLLBACK;')
            values = [s for s in r.stdout.splitlines() if s]
            observations.append({'pass': r.returncode == 0 and bool(values) and all(s == 't' for s in values),
                                 'exit': r.returncode, 'output': r.stdout.strip(), 'error': r.stderr.strip()})
        entry['tests'][name] = observations
        print(label, name, 'PASS' if all(x['pass'] for x in observations) else 'FAIL', flush=True)
    entry['role'] = checked(db, "SET ROLE authenticated; SELECT current_user || ':' || rolsuper || ':' || rolbypassrls FROM pg_roles WHERE rolname=current_user;")
(args.output/'results.json').write_text(json.dumps(report, indent=2)+'\n')
passed = all(x['pass'] for case in report['cases'].values() for runs in case['tests'].values() for x in runs)
raise SystemExit(0 if passed else 1)
