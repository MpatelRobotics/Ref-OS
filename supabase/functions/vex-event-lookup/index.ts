import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupEvent, normalizeCode, searchEvents } from "./lookup.js";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
// Small, bounded per-instance cache and request limiter. No token or user data is cached.
const cache = new Map();
const requests = new Map();
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Sign in before looking up an event." }, 401);
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return json({ error: "Sign in before looking up an event." }, 401);
    const now = Date.now();
    for (const [key,value] of requests) if (value.until < now) requests.delete(key);
    const usage = requests.get(data.user.id) || { count: 0, until: now + 60000 };
    if (usage.count >= 10 || requests.size >= 10000) return json({ error: "Too many lookups. Try again in a minute." }, 429);
    usage.count++; requests.set(data.user.id, usage);
    const raw = await request.text();
    if (raw.length > 1000) return json({ error: "Request too large." }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
    if (body?.action === "search") {
      const results = await searchEvents(body, Deno.env.get("VEX_EVENTS_API_TOKEN") || "");
      return json(results);
    }
    let code;
    try { code = normalizeCode(body?.code); } catch (e) { return json({ error: e instanceof Error ? e.message : "Invalid event code." }, 400); }
    for (const [key,value] of cache) if (value.until < now) cache.delete(key);
    const cached = cache.get(code);
    if (cached) return json({ event: cached.event });
    const token = Deno.env.get("VEX_EVENTS_API_TOKEN") || "";
    const event = await lookupEvent(code, token);
    if (cache.size >= 300) cache.delete(cache.keys().next().value);
    cache.set(code, { event, until: now + 300000 });
    return json({ event });
  } catch (error) {
    // No raw upstream responses, headers, tokens or stack traces reach the client/logs.
    const message = error instanceof Error && /^(VEX|Enter|Could not retrieve|No unique|Too many|Sign in)/.test(error.message) ? error.message : "Event lookup failed or timed out. Try again.";
    return json({ error: message }, 502);
  }
});

