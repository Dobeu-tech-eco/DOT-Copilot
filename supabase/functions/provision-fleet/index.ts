import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

interface ProvisionFleetPayload {
  fleet: {
    name: string
    dot_number?: string
    address?: string
    phone?: string
  }
  admin: {
    email: string
    full_name: string
  }
  redirect_origin: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
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
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
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

    const payload: ProvisionFleetPayload = await req.json()
    const { fleet, admin, redirect_origin } = payload

    if (!fleet?.name || !admin?.email || !admin?.full_name || !redirect_origin) {
      return jsonResponse(
        { error: "fleet.name, admin.email, admin.full_name, and redirect_origin are required" },
        400,
      )
    }

    // Service-role client — bypasses RLS, used only after the platform-admin
    // check above has already authorized the caller.
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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
})
