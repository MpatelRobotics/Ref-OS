import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createTokenProvider } from './token.js';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const getToken = createTokenProvider({ clientId: Deno.env.get('TM_CLIENT_ID'), clientSecret: Deno.env.get('TM_CLIENT_SECRET') });
const usage = new Map<string, { count: number; until: number }>();
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return reply({ error: 'Sign in before connecting TM.' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return reply({ error: 'Sign in before connecting TM.' }, 401);
    const raw = await request.text();
    if (raw.length > 200) return reply({ error: 'Request too large.' }, 400);
    const { eventId } = JSON.parse(raw);
    if (typeof eventId !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(eventId)) return reply({ error: 'Choose an event.' }, 400);
    const access = await client.rpc('has_event_role', { p_event: eventId, p_roles: ['admin'] });
    if (access.error || access.data !== true) return reply({ error: 'Event administrator access is required.' }, 403);
    const now = Date.now();
    for (const [key, value] of usage) if (value.until <= now) usage.delete(key);
    const limit = usage.get(data.user.id) || { count: 0, until: now + 60000 };
    if (limit.count >= 20 || usage.size >= 10000) return reply({ error: 'Too many TM connection attempts. Wait a minute.' }, 429);
    limit.count++; usage.set(data.user.id, limit);
    return reply(await getToken());
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('TM ') ? error.message : 'TM connection could not be authorized. Try again.';
    return reply({ error: message }, 502);
  }
});
