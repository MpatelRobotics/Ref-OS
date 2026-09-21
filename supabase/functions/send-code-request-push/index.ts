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

    const { data: deliverySetting, error: deliveryError } = await serviceClient
      .from("event_settings")
      .select("value")
      .eq("event_id", eventRequest.event_id)
      .eq("key", "notification_delivery")
      .maybeSingle();
    if (deliveryError) throw deliveryError;
    const delivery = deliverySetting?.value || { push: true, email: true };
    const pushEnabled = delivery.push !== false;
    const emailEnabled = delivery.email !== false;

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

    const emailSubject = isHelp
      ? `Ref OS help request: ${category}`
      : `Ref OS code request: ${role}`;
    const emailText = isHelp
      ? `REF OS HELP\n\nCategory: ${category}\nLocation: ${location}\nRequested by: ${requester}${extra ? `\nDetails: ${extra}` : ""}`
      : `REF OS CODE REQUEST\n\n${requester} requested a new ${role} join code.`;

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
    const email = emailEnabled ? await sendAdminEmail(emailSubject, emailText) : { sent: 0, failed: 0 };
    await serviceClient.from("push_dispatches").update({ sent_count: sent + email.sent }).eq("request_id", eventRequest.id);
    return json({ sent, expired: expired.length, emailSent: email.sent, emailFailed: email.failed, delivery });
  } catch (error) {
    console.error(error);
    return json({ error: (error as Error).message || "Push delivery failed" }, 500);
  }
});

async function sendAdminEmail(subject: string, text: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "";
  const recipients = (Deno.env.get("ADMIN_ALERT_EMAILS") || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!apiKey || !from || recipients.length === 0) {
    console.log("Resend email is not configured; web push delivery will continue.");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  await Promise.all(recipients.map(async (to) => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
          html: renderEmail(subject, text),
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        console.error("Resend email delivery failed", response.status, detail.slice(0, 500));
        failed += 1;
        return;
      }
      sent += 1;
    } catch (error) {
      console.error("Resend email delivery failed", (error as Error).message);
      failed += 1;
    }
  }));
  return { sent, failed };
}

function renderEmail(subject: string, text: string) {
  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(text).replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#111827"><div style="max-width:620px;margin:24px auto;padding:28px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb"><div style="font-size:13px;font-weight:700;letter-spacing:.08em;color:#b83232">REF OS</div><h1 style="font-size:24px;margin:10px 0 20px">${safeSubject}</h1><div style="font-size:16px;line-height:1.6">${safeBody}</div><p style="margin-top:24px;font-size:13px;color:#6b7280">This operational alert was sent to a configured Highlander Summit administrator.</p></div></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character] || character));
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
