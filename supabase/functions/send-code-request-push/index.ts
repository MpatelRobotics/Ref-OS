import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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
    if (requestError || !eventRequest || !["role_code_request", "help_request"].includes(eventRequest.kind)) return json({ error: "Request not found" }, 404);

    const { error: claimError } = await serviceClient.from("push_dispatches").insert({
      request_id: eventRequest.id,
      event_id: eventRequest.event_id,
    });
    if (claimError?.code === "23505") return json({ sent: 0, duplicate: true });
    if (claimError) throw claimError;

    const { data: subscriptions, error: subscriptionError } = await serviceClient
      .from("push_subscriptions")
      .select("endpoint,user_id,p256dh,auth")
      .eq("event_id", eventRequest.event_id);
    if (subscriptionError) throw subscriptionError;
    const { data: members, error: memberError } = await serviceClient
      .from("event_members")
      .select("user_id")
      .eq("event_id", eventRequest.event_id);
    if (memberError) throw memberError;
    const memberIds = new Set((members || []).map((member) => member.user_id));
    const memberSubscriptions = (subscriptions || []).filter((subscription) => memberIds.has(subscription.user_id));

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!publicKey || !privateKey) throw new Error("VAPID secrets are not configured");
    webpush.setVapidDetails(subject, publicKey, privateKey);

    let details: { role?: string; requester?: string; category?: string; location?: string; details?: string } = {};
    try { details = JSON.parse(eventRequest.note || "{}"); } catch { /* use defaults */ }
    const labels: Record<string, string> = { ref: "Referee", judge: "Judge Advisor", emcee: "Emcee" };
    const role = labels[details.role || ""] || "Volunteer";
    const requester = String(details.requester || "A volunteer").slice(0, 80);
    const isHelp = eventRequest.kind === "help_request";
    const category = String(details.category || "Need an Admin").slice(0, 80);
    const location = String(details.location || "Location not provided").slice(0, 80);
    const extra = String(details.details || "").trim().slice(0, 140);
    const payload = JSON.stringify(isHelp ? {
      title: `Ref OS help request · ${category}`,
      body: `${location} · ${requester}${extra ? `: ${extra}` : " requested assistance."}`,
      tag: `refos-help-${eventRequest.id}`,
      url: "/?open=help-request",
    } : {
      title: "Ref OS code request",
      body: `${requester} requested a new ${role} join code.`,
      tag: `refos-code-request-${details.role || "volunteer"}`,
      url: `/?open=code-requests&role=${encodeURIComponent(details.role || "")}`,
    });

    const smsBody = isHelp
      ? limitSms(`REF OS HELP: ${category} at ${location}. From ${requester}.${extra ? ` ${extra}` : ""}`)
      : limitSms(`REF OS CODE REQUEST: ${requester} requested a new ${role} join code.`);

    let sent = 0;
    const expired: string[] = [];
    await Promise.all(memberSubscriptions.map(async (subscription) => {
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
    const sms = await sendAdminSms(smsBody);
    await serviceClient.from("push_dispatches").update({ sent_count: sent + sms.sent }).eq("request_id", eventRequest.id);
    return json({ sent, expired: expired.length, smsSent: sms.sent, smsFailed: sms.failed });
  } catch (error) {
    console.error(error);
    return json({ error: (error as Error).message || "Push delivery failed" }, 500);
  }
});

function limitSms(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= 155 ? clean : `${clean.slice(0, 152)}...`;
}

async function sendAdminSms(body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const from = Deno.env.get("TWILIO_FROM_NUMBER") || "";
  const recipients = (Deno.env.get("ADMIN_SMS_NUMBERS") || "")
    .split(",")
    .map((number) => number.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!accountSid || !authToken || !from || recipients.length === 0) {
    console.log("Twilio SMS is not configured; web push delivery will continue.");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const authorization = btoa(`${accountSid}:${authToken}`);
  await Promise.all(recipients.map(async (to) => {
    try {
      const form = new URLSearchParams({ To: to, From: from, Body: body });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
      if (!response.ok) {
        const detail = await response.text();
        console.error("Twilio SMS delivery failed", response.status, detail.slice(0, 500));
        failed += 1;
        return;
      }
      sent += 1;
    } catch (error) {
      console.error("Twilio SMS delivery failed", (error as Error).message);
      failed += 1;
    }
  }));
  return { sent, failed };
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
