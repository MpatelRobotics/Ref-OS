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
    const { data: codeRequest, error: requestError } = await userClient
      .from("field_log")
      .select("id,event_id,kind,note")
      .eq("id", requestId)
      .eq("kind", "role_code_request")
      .single();
    if (requestError || !codeRequest) return json({ error: "Request not found" }, 404);

    const { error: claimError } = await serviceClient.from("push_dispatches").insert({
      request_id: codeRequest.id,
      event_id: codeRequest.event_id,
    });
    if (claimError?.code === "23505") return json({ sent: 0, duplicate: true });
    if (claimError) throw claimError;

    const { data: subscriptions, error: subscriptionError } = await serviceClient
      .from("push_subscriptions")
      .select("endpoint,user_id,p256dh,auth")
      .eq("event_id", codeRequest.event_id);
    if (subscriptionError) throw subscriptionError;
    const { data: admins, error: adminError } = await serviceClient
      .from("event_members")
      .select("user_id")
      .eq("event_id", codeRequest.event_id)
      .eq("role", "admin");
    if (adminError) throw adminError;
    const adminIds = new Set((admins || []).map((admin) => admin.user_id));
    const adminSubscriptions = (subscriptions || []).filter((subscription) => adminIds.has(subscription.user_id));

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!publicKey || !privateKey) throw new Error("VAPID secrets are not configured");
    webpush.setVapidDetails(subject, publicKey, privateKey);

    let details: { role?: string; requester?: string } = {};
    try { details = JSON.parse(codeRequest.note || "{}"); } catch { /* use defaults */ }
    const labels: Record<string, string> = { ref: "Referee", judge: "Judge Advisor", emcee: "Emcee" };
    const role = labels[details.role || ""] || "Volunteer";
    const requester = String(details.requester || "A volunteer").slice(0, 80);
    const payload = JSON.stringify({
      title: "Ref OS code request",
      body: `${requester} requested a new ${role} join code.`,
      tag: `refos-code-request-${details.role || "volunteer"}`,
      url: `/?open=code-requests&role=${encodeURIComponent(details.role || "")}`,
    });

    let sent = 0;
    const expired: string[] = [];
    await Promise.all(adminSubscriptions.map(async (subscription) => {
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
    await serviceClient.from("push_dispatches").update({ sent_count: sent }).eq("request_id", codeRequest.id);
    return json({ sent, expired: expired.length });
  } catch (error) {
    console.error(error);
    return json({ error: (error as Error).message || "Push delivery failed" }, 500);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
