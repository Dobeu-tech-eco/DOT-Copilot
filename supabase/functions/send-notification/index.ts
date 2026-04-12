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

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

async function buildVapidAuthorizationHeader(
  endpoint: string,
  vapidPrivateKeyB64: string,
  vapidSubject: string,
): Promise<string> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 12 * 3600

  const header = { typ: "JWT", alg: "ES256" }
  const claims = { aud: audience, exp, sub: vapidSubject }

  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  const encodedClaims = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  const signingInput = `${encodedHeader}.${encodedClaims}`

  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKeyB64)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const jwt = `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`
  return `vapid t=${jwt}`
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  vapidSubject: string,
): Promise<boolean> {
  try {
    const authHeader = await buildVapidAuthorizationHeader(endpoint, vapidPrivateKey, vapidSubject)

    const serverPublicKey = base64UrlToUint8Array(vapidPublicKey)
    const clientPublicKey = base64UrlToUint8Array(p256dh)
    const clientAuth = base64UrlToUint8Array(auth)

    const serverKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"],
    )
    const serverPublicKeyRaw = new Uint8Array(
      await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
    )

    const clientCryptoKey = await crypto.subtle.importKey(
      "raw",
      clientPublicKey,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    )

    const sharedSecret = await crypto.subtle.deriveKey(
      { name: "ECDH", public: clientCryptoKey },
      serverKeyPair.privateKey,
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new Uint8Array(0) },
      false,
      ["deriveKey"],
    )

    const ikm = await crypto.subtle.exportKey("raw", sharedSecret)

    const prk = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(ikm),
      { name: "HKDF" },
      false,
      ["deriveBits"],
    )

    const salt = crypto.getRandomValues(new Uint8Array(16))

    const authInfo = new TextEncoder().encode("Content-Encoding: auth\0")
    const keyInfo = new TextEncoder().encode("Content-Encoding: aesgcm\0")
    const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0")

    const context = new Uint8Array([
      ...new TextEncoder().encode("P-256\0"),
      0, 65,
      ...clientPublicKey,
      0, 65,
      ...serverPublicKeyRaw,
    ])

    const prk2 = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: clientAuth, info: authInfo },
      prk,
      256,
    )

    const ikm2 = await crypto.subtle.importKey("raw", prk2, { name: "HKDF" }, false, ["deriveBits"])

    const [contentEncryptionKeyBits, nonceBits] = await Promise.all([
      crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: new Uint8Array([...keyInfo, ...context]) }, ikm2, 128),
      crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: new Uint8Array([...nonceInfo, ...context]) }, ikm2, 96),
    ])

    const contentEncryptionKey = await crypto.subtle.importKey(
      "raw",
      contentEncryptionKeyBits,
      "AES-GCM",
      false,
      ["encrypt"],
    )

    const nonce = new Uint8Array(nonceBits)
    const plaintextBytes = new TextEncoder().encode(payload)
    const padded = new Uint8Array([0, 0, ...plaintextBytes])
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, contentEncryptionKey, padded)

    const body = new Uint8Array(encrypted)

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Crypto-Key": `dh=${uint8ArrayToBase64Url(serverPublicKeyRaw)};p256ecdsa=${vapidPublicKey}`,
        "Content-Encoding": "aesgcm",
        "Content-Type": "application/octet-stream",
        Encryption: `salt=${uint8ArrayToBase64Url(salt)}`,
        TTL: "86400",
      },
      body,
    })

    return res.ok || res.status === 201
  } catch (e) {
    console.error("Web push error:", e)
    return false
  }
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
          sendError = "Delivery failed"
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
          const smsBody = new URLSearchParams({
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
              body: smsBody.toString(),
            },
          )
          sent = res.ok
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            sendError = errBody.message || "SMS send failed"
          }
        } catch (e) {
          sendError = "Delivery failed"
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
      const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || Deno.env.get("VITE_VAPID_PUBLIC_KEY")
      const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@dotcopilot.app"

      if (subData && VAPID_PRIVATE_KEY && VAPID_PUBLIC_KEY) {
        const pushPayload = JSON.stringify({ title, body: message, data: { action_url, notification_type } })
        sent = await sendWebPush(
          subData.endpoint,
          subData.p256dh_key,
          subData.auth_key,
          pushPayload,
          VAPID_PRIVATE_KEY,
          VAPID_PUBLIC_KEY,
          VAPID_SUBJECT,
        )
        if (!sent) sendError = "Web push delivery failed"
      } else if (!subData) {
        sendError = "No push subscription found for user"
      } else {
        sendError = "VAPID keys not configured"
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
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
