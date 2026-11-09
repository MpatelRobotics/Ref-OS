import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Ref OS Developer (Super Admin) access.
//
// Handles developer sign-in, verified event creation and first-join admin setup.
// The expected credential exists ONLY in the REFOS_SUPER_ADMIN_CODE secret of this function;
// it is never returned, logged, stored, or compared in the browser or the database.
//
// On success the caller's own Supabase session (the same anonymous device session normal
// logins use) receives an ordinary Admin sign-in for this one event, flagged developer = true
// by the service-role-only claim_developer_event_access() SQL function. Everything after that
// is the existing Admin session model.
//
// Responses never distinguish a wrong event code from a wrong Developer code:
//   { ok: true }                         Developer Admin sign-in created for this event
//   { ok: false, reason: "invalid" }     not accepted
//   { ok: false, reason: "locked" }      too many failed attempts (shared lockout)
//   { ok: false, reason: "archived" }    event is archived (same refusal as a normal login)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_RE = /^[0-9][A-Z][0-9][0-9]$/;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, reason: "invalid" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ ok: false, reason: "invalid" }, 401);

    let body: { eventId?: unknown; credential?: unknown; action?: unknown; name?: unknown; format?: unknown } = {};
    try { body = await request.json(); } catch { return json({ ok: false, reason: "invalid" }, 400); }
    const eventId = String(body.eventId ?? "").trim().toLowerCase();
    if (body.action !== undefined && !["restore", "create", "setup_admin"].includes(String(body.action))) return json({ ok: false, reason: "invalid" }, 400);
    const submitted = String(body.credential ?? "").trim().toUpperCase();
    if (body.action !== "create" && !UUID_RE.test(eventId)) return json({ ok: false, reason: "invalid" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // The caller's own session: the sign-in is granted to exactly this device session.
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (userError || !userId) return json({ ok: false, reason: "invalid" }, 401);

    // Creation always checks the developer secret before any code can be stored.
    const secret = String(Deno.env.get("REFOS_SUPER_ADMIN_CODE") || "").trim().toUpperCase();
    const valid = CODE_RE.test(submitted) && CODE_RE.test(secret) && await sameSecret(submitted, secret);
    if (body.action === "create") {
      if (!CODE_RE.test(secret)) return json({ok:false,error:"Event creation is temporarily unavailable."},503);
      const name = String(body.name || "").trim();
      const format = String(body.format || "tournament");
      if (name.length < 3 || name.length > 300 || !CODE_RE.test(submitted) || !["tournament", "league"].includes(format)) return json({ok:false, error:"Check the event name, format and access code."},400);
      const {data, error} = valid
        ? await serviceClient.rpc("create_deferred_admin_event", {p_name:name,p_user:userId,p_format:format})
        : await userClient.rpc("create_refos_vex_event_with_format", {p_name:name,p_admin_credential:submitted,p_format:format});
      if (error) throw error;
      return json({ok:true,event:Array.isArray(data)?data[0]:data});
    }

    const { data: event, error: eventError } = await serviceClient
      .from("events")
      .select("id,archived_at")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return json({ ok: false, reason: "invalid" });

    // Shared lockout (same table and rules as restore/delete).
    const { data: locked, error: lockError } = await serviceClient.rpc("refos_access_locked", { p_event: eventId, p_user: userId });
    if (lockError) throw lockError;
    if (locked) return json({ ok: false, reason: "locked" });

    if (body.action === "setup_admin") {
      if (!CODE_RE.test(submitted) || valid) return json({ok:false,error:"Choose a new event admin code in number-letter-number-number format."},400);
      const {error} = await serviceClient.rpc("complete_initial_admin_setup", {p_event:eventId,p_user:userId,p_code:submitted});
      if (error) return json({ok:false,error:error.message},409);
      return json({ok:true});
    }

    // Restore is separate from login: verify either credential without granting membership.
    if (body.action === "restore") {
      const { data: result, error: restoreError } = valid
        ? await serviceClient.rpc("restore_refos_event_as_developer", { p_event: eventId, p_user: userId })
        : await userClient.rpc("restore_refos_event", { p_event: eventId, p_admin_credential: submitted });
      if (restoreError) throw restoreError;
      return json({ ok: result === "restored" || result === "active", result });
    }

    if (!valid) {
      const { data: outcome, error: attemptError } = await serviceClient.rpc("refos_access_attempt", { p_event: eventId, p_user: userId, p_ok: false });
      if (attemptError) throw attemptError;
      return json({ ok: false, reason: outcome === "locked" ? "locked" : "invalid" });
    }

    // Existing lifecycle: archived events refuse sign-ins, and nothing here restores them.
    if (event.archived_at) return json({ ok: false, reason: "archived" });

    const { error: claimError } = await serviceClient.rpc("claim_developer_event_access", { p_event: eventId, p_user: userId });
    if (claimError) {
      if (/archived/i.test(String(claimError.message || ""))) return json({ ok: false, reason: "archived" });
      throw claimError;
    }
    await serviceClient.rpc("refos_access_attempt", { p_event: eventId, p_user: userId, p_ok: true });
    return json({ ok: true });
  } catch (error) {
    // Never include submitted values in logs.
    console.error("Developer access check failed", (error as { code?: string })?.code || "error");
    return json({ ok: false, reason: "invalid", error: "unavailable" }, 500);
  }
});

// Constant-time comparison of two short strings via their SHA-256 digests.
async function sameSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
