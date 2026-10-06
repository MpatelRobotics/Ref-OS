import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Email notifications are permanently disabled. This function delivers web push only.
// The former Resend email path has been removed, so no request can reach the email
// provider whatever an event's saved notification_delivery setting says.
// Legacy notification_delivery values are read as:
//   push only / push + email ("both") -> push
//   email only                       -> no delivery
//   missing setting                  -> push (unchanged default)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Missing authorization" }, 401);

    const { requestId } = await request.json();
    if (!requestId) return json({ error: "Missing requestId" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // The caller must be able to read this real request through normal event RLS.
    const { data: eventRequest, error: requestError } = await userClient
      .from("field_log")
      .select("id,event_id,kind,note")
      .eq("id", requestId)
      .single();
    if (requestError || !eventRequest || !["role_code_request", "help_request", "feedback"].includes(eventRequest.kind)) return json({ error: "Request not found" }, 404);

    const { error: claimError } = await serviceClient.from("push_dispatches").insert({
      request_id: eventRequest.id,
      event_id: eventRequest.event_id,
    });
    if (claimError?.code === "23505") return json({ sent: 0, duplicate: true });
    if (claimError) throw claimError;

    const { data: deliverySetting, error: deliveryError } = await serviceClient
      .from("event_settings")
      .select("value")
      .eq("event_id", eventRequest.event_id)
      .eq("key", "notification_delivery")
      .maybeSingle();
    if (deliveryError) throw deliveryError;
    const isFeedback = eventRequest.kind === "feedback";
    const pushEnabled = isFeedback || pushDeliveryEnabled(deliverySetting?.value);

    let subscriptionQuery = serviceClient.from("push_subscriptions").select("endpoint,user_id,p256dh,auth");
    let memberQuery = serviceClient.from("event_members").select("user_id");
    if (isFeedback) memberQuery = memberQuery.eq("role", "admin").eq("developer", true);
    else { subscriptionQuery = subscriptionQuery.eq("event_id", eventRequest.event_id); memberQuery = memberQuery.eq("event_id", eventRequest.event_id); }
    const {data:members,error:memberError} = await memberQuery;
    if(memberError) throw memberError;
    const memberIds = [...new Set((members || []).map(member=>member.user_id))];
    const {data:subscriptions,error:subscriptionError} = memberIds.length ? await subscriptionQuery.in("user_id",memberIds) : {data:[],error:null};
    if(subscriptionError) throw subscriptionError;
    const memberSubscriptions = subscriptions || [];

    if (pushEnabled) {
      const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
      if (!publicKey || !privateKey) throw new Error("VAPID secrets are not configured");
      webpush.setVapidDetails(subject, publicKey, privateKey);
    }

    let details: { role?: string; requester?: string; category?: string; location?: string; details?: string } = {};
    try { details = JSON.parse(eventRequest.note || "{}"); } catch { /* use defaults */ }
    const labels: Record<string, string> = { ref: "Referee", judge: "Judge Advisor", emcee: "Emcee" };
    const role = labels[details.role || ""] || "Volunteer";
    const requester = String(details.requester || "A volunteer").slice(0, 80);
    const isHelp = eventRequest.kind === "help_request";
    const category = String(details.category || "Need an Admin").slice(0, 80);
    const location = String(details.location || "Location not provided").slice(0, 80);
    const extra = String(details.details || "").trim().slice(0, 140);
    const payload = JSON.stringify(isFeedback ? {
      title: "Ref OS · New feedback",
      body: "New feedback was submitted. Open Universal Feedback to review it.",
      tag: `refos-feedback-${eventRequest.id}`,
      url: "/?open=universal-feedback",
    } : isHelp ? {
      title: `Ref OS help request · ${category}`,
      body: `${location} · ${requester}${extra ? `: ${extra}` : " requested assistance."}`,
      tag: `refos-help-${eventRequest.id}`,
      url: `/?event=${encodeURIComponent(eventRequest.event_id)}&open=help-request`,
    } : {
      title: "Ref OS code request",
      body: `${requester} requested a new ${role} join code.`,
      tag: `refos-code-request-${details.role || "volunteer"}`,
      url: `/?event=${encodeURIComponent(eventRequest.event_id)}&open=code-requests&role=${encodeURIComponent(details.role || "")}`,
    });

    let sent = 0;
    const expired: string[] = [];
    await Promise.all((pushEnabled ? memberSubscriptions : []).map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 3600, urgency: "high" });
        sent += 1;
      } catch (error) {
        const status = Number((error as { statusCode?: number }).statusCode || 0);
        if (status === 404 || status === 410) expired.push(subscription.endpoint);
        else console.error("Push delivery failed", status, (error as Error).message);
      }
    }));

    if (expired.length) await serviceClient.from("push_subscriptions").delete().in("endpoint", expired);
    // Email columns stay in push_dispatches for history; new rows always record zero email.
    await serviceClient.from("push_dispatches").update({
      sent_count: sent,
      push_count: sent,
      email_count: 0,
      email_failed_count: 0,
    }).eq("request_id", eventRequest.id);
    return json({ sent, expired: expired.length, emailSent: 0, emailFailed: 0, emailDisabled: true, delivery: { push: pushEnabled, email: false } });
  } catch (error) {
    console.error(error);
    return json({ error: (error as Error).message || "Push delivery failed" }, 500);
  }
});

// Reads a stored notification_delivery value. Email is never enabled; only whether push is
// allowed is decided here. Accepts the object form ({ push, email }) and plain mode strings.
function pushDeliveryEnabled(value: unknown): boolean {
  if (value == null) return true;
  const mode = typeof value === "string" ? value : (value as { mode?: unknown })?.mode;
  if (typeof mode === "string") {
    const m = mode.trim().toLowerCase();
    if (m === "email" || m === "email_only" || m === "none" || m === "off") return false;
    return true; // "push", "both", "push_email", or anything unrecognised
  }
  if (typeof value === "object") return (value as { push?: unknown }).push !== false;
  return true;
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
