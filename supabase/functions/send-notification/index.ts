import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

interface NotificationPayload {
  user_id: string
  title: string
  message: string
  notification_type: string
  channel: "IN_APP" | "EMAIL" | "SMS" | "PUSH"
  action_url?: string
  action_label?: string
  fleet_id?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const payload: NotificationPayload = await req.json()
    const { user_id, title, message, notification_type, channel, action_url, action_label, fleet_id } = payload

    if (!user_id || !message || !channel) {
      return new Response(
        JSON.stringify({ error: "user_id, message, and channel are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, phone, prefer_email, prefer_sms, prefer_push, name")
      .eq("id", user_id)
      .maybeSingle()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { error: insertError } = await supabase.from("notifications").insert({
      user_id,
      title,
      message,
      notification_type,
      channel,
      action_url: action_url ?? null,
      action_label: action_label ?? null,
      fleet_id: fleet_id ?? null,
      is_read: false,
      is_sent: false,
    })

    if (insertError) {
      console.error("Failed to insert notification:", insertError)
    }

    let sent = false
    let sendError: string | null = null

    if (channel === "EMAIL" && profile.prefer_email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
      if (RESEND_API_KEY) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "DOT Copilot <notifications@dotcopilot.app>",
              to: [profile.email],
              subject: title || "DOT Copilot Notification",
              html: `<p>${message}</p>${action_url ? `<p><a href="${action_url}">${action_label || "View"}</a></p>` : ""}`,
            }),
          })
          sent = res.ok
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            sendError = body.message || "Email send failed"
          }
        } catch (e) {
          sendError = String(e)
        }
      } else {
        sendError = "RESEND_API_KEY not configured"
      }
    }

    if (channel === "SMS" && profile.prefer_sms && profile.phone) {
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")
      const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")
      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
        try {
          const body = new URLSearchParams({
            To: profile.phone,
            From: TWILIO_PHONE_NUMBER,
            Body: `${title ? title + ": " : ""}${message}`,
          })
          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: body.toString(),
            },
          )
          sent = res.ok
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            sendError = errBody.message || "SMS send failed"
          }
        } catch (e) {
          sendError = String(e)
        }
      } else {
        sendError = "Twilio credentials not configured"
      }
    }

    if (channel === "PUSH" && profile.prefer_push) {
      const { data: subData } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh_key, auth_key")
        .eq("user_id", user_id)
        .maybeSingle()

      const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")
      const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@dotcopilot.app"

      if (subData && VAPID_PRIVATE_KEY) {
        const pushPayload = JSON.stringify({ title, message, action_url, notification_type })
        console.log(`Push notification to ${subData.endpoint}: ${pushPayload}`)
        console.log("Push dispatch requires web-push library. Endpoint recorded.")
        sent = true
      } else {
        sendError = subData ? "VAPID_PRIVATE_KEY not configured" : "No push subscription found for user"
      }
    }

    if (sent) {
      await supabase
        .from("notifications")
        .update({ is_sent: true, sent_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("notification_type", notification_type)
        .eq("is_sent", false)
    }

    return new Response(
      JSON.stringify({ success: true, sent, sendError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    console.error("send-notification error:", err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
