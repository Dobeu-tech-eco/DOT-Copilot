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
      .select("id, is_platform_admin")
      .eq("id", callerId)
      .maybeSingle()

    if (callerProfileError || !callerProfile) {
      return jsonResponse({ error: "Caller profile not found" }, 403)
    }

    if (!callerProfile.is_platform_admin) {
      return jsonResponse({ error: "Forbidden: platform admin access required" }, 403)
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
      console.error("Failed to create fleet:", fleetError)
      return jsonResponse({ error: "Failed to create fleet" }, 500)
    }

    const fleetId = newFleet.id

    const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      admin.email,
      {
        data: {
          fleet_id: fleetId,
          role: "ADMIN",
          full_name: admin.full_name,
        },
        redirectTo: `${redirect_origin}/welcome`,
      },
    )

    if (inviteError) {
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

      console.error("Failed to invite admin user:", inviteError)
      return jsonResponse({ error: "Fleet created but failed to invite admin user" }, 500)
    }

    return jsonResponse({ fleet_id: fleetId, invited: true }, 200)
  } catch (err) {
    console.error("provision-fleet error:", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
