import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

import { parseProvisionPayload } from './payload.ts'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export function createProvisionHandler(clientFactory = createClient, env = Deno.env.get) {
return async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401)
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "")

    // Anon client scoped to the caller's JWT — used only to verify identity.
    const anonClient = clientFactory(
      env("SUPABASE_URL")!,
      env("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    )

    const { data: userData, error: userError } = await anonClient.auth.getUser(jwt)
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401)
    }

    const callerId = userData.user.id

    const { data: callerProfile, error: callerProfileError } = await anonClient
      .from("profiles")
      .select("id, is_platform_admin, is_active")
      .eq("id", callerId)
      .maybeSingle()

    if (callerProfileError || !callerProfile) {
      return jsonResponse({ error: "Caller profile not found" }, 403)
    }

    if (!callerProfile.is_active || !callerProfile.is_platform_admin) {
      return jsonResponse({ error: "Forbidden: active platform admin access required" }, 403)
    }

    let payload
    try {
      payload = parseProvisionPayload(await req.json())
    } catch {
      return jsonResponse({ error: "Invalid provisioning request" }, 400)
    }
    const { fleet, admin, redirect_origin } = payload

    // Service-role client — bypasses RLS, used only after the platform-admin
    // check above has already authorized the caller.
    const serviceClient = clientFactory(
      env("SUPABASE_URL")!,
      env("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: newFleet, error: fleetError } = await serviceClient
      .from("fleets")
      .insert({
        company_name: fleet.name,
        locations: fleet.address ?? null,
      })
      .select("id")
      .single()

    if (fleetError || !newFleet) {
      console.error("Failed to create fleet")
      return jsonResponse({ error: "Failed to create fleet" }, 500)
    }

    const fleetId = newFleet.id

    // Reserve authority before Auth creates the user. The signup trigger trusts
    // this service-only row, never the caller-editable Auth user metadata.
    const invitationEmail = admin.email.trim().toLowerCase()
    const { data: reservation, error: reservationError } = await serviceClient
      .from("fleet_invitations")
      .insert({
        email: invitationEmail,
        fleet_id: fleetId,
        role: "ADMIN",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single()

    if (reservationError || !reservation) {
      console.error("Failed to reserve fleet invitation")
      return jsonResponse({ error: "Fleet created but failed to reserve admin invitation", fleet_id: fleetId }, 500)
    }

    const removeReservation = async (): Promise<boolean> => {
      const { error } = await serviceClient
        .from("fleet_invitations")
        .delete()
        .eq("id", reservation.id)
      if (error) console.error("Failed to remove fleet invitation reservation")
      return !error
    }

    let inviteError
    let invitedUserId: string | undefined
    try {
      const result = await serviceClient.auth.admin.inviteUserByEmail(
        invitationEmail,
        {
          data: { full_name: admin.full_name },
          redirectTo: `${redirect_origin}/welcome`,
        },
      )
      inviteError = result.error
      invitedUserId = result.data.user?.id
    } catch {
      if (!await removeReservation()) {
        return jsonResponse({ error: "Fleet created; invitation failed and reservation cleanup requires server attention", fleet_id: fleetId }, 500)
      }
      return jsonResponse({ error: "Fleet created but failed to invite admin user", fleet_id: fleetId }, 500)
    }

    if (inviteError) {
      // Delete only this request's reservation; an email-based cleanup could
      // remove a newer invitation created by another server request.
      if (!await removeReservation()) {
        return jsonResponse({ error: "Fleet created; invitation failed and reservation cleanup requires server attention", fleet_id: fleetId }, 500)
      }
      const alreadyExists =
        inviteError.status === 422 ||
        /already been registered|already exists/i.test(inviteError.message ?? "")

      if (alreadyExists) {
        return jsonResponse(
          {
            error: `A user with email ${admin.email} already exists. Provisioning cannot invite an existing user; add them to the fleet manually instead.`,
            fleet_id: fleetId,
          },
          409,
        )
      }

      console.error("Failed to invite admin user")
      return jsonResponse({ error: "Fleet created but failed to invite admin user" }, 500)
    }

    // Re-inviting an existing unconfirmed account need not INSERT auth.users.
    // Never report successful provisioning unless the trusted trigger attached it.
    const { data: attachedProfile, error: attachmentError } = invitedUserId
      ? await serviceClient.from("profiles").select("id")
        .eq("id", invitedUserId).eq("fleet_id", fleetId)
        .eq("role", "ADMIN").eq("is_active", true).maybeSingle()
      : { data: null, error: null }
    if (attachmentError || !attachedProfile) {
      await removeReservation()
      return jsonResponse({ error: "Invitation did not attach the administrator; server attention required", fleet_id: fleetId }, 409)
    }

    return jsonResponse({ fleet_id: fleetId, invited: true }, 200)
  } catch {
    console.error("provision-fleet request failed")
    return jsonResponse({ error: "Internal server error" }, 500)
  }
}
}
