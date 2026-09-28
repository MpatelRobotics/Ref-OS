// purge-deleted-event-photos
//
// Deletes cloud photo objects (robot photos and violation evidence) for Ref OS events that were
// PERMANENTLY DELETED. SQL cannot delete Supabase Storage files, so delete_archived_refos_event()
// records each deleted event in public.refos_storage_purge_queue; this function empties that queue.
//
// Safety:
// - Uses the service role ONLY here, server-side. No service-role key is ever sent to the browser.
// - Only purges events that are in the queue (written only by the permanent-delete function) AND no
//   longer exist in public.events. It can never delete a live or archived event's photos.
// - Only removes objects under "<deleted-event-id>/" in the robot-photos bucket.
// - A queue entry is removed only after its prefix is verified empty, so failures retry next time.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "robot-photos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!request.headers.get("Authorization")) return json({ error: "Missing authorization" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: queue, error: queueError } = await service
      .from("refos_storage_purge_queue")
      .select("purged_event_id")
      .order("requested_at", { ascending: true })
      .limit(10);
    if (queueError) throw queueError;

    const purged: { eventId: string; objects: number }[] = [];
    const pending: string[] = [];
    for (const row of queue || []) {
      const eventId = String(row.purged_event_id || "");
      if (!UUID.test(eventId)) continue;

      // Never touch storage for an event that still exists (active or archived).
      const { data: stillExists, error: existsError } = await service.from("events").select("id").eq("id", eventId).maybeSingle();
      if (existsError) throw existsError;
      if (stillExists) { pending.push(eventId); continue; }

      const paths = await listAll(service, eventId, 0);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await service.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (error) throw error;
      }
      const remaining = await listAll(service, eventId, 0);
      if (remaining.length) { pending.push(eventId); continue; }

      const { error: doneError } = await service.from("refos_storage_purge_queue").delete().eq("purged_event_id", eventId);
      if (doneError) throw doneError;
      purged.push({ eventId, objects: paths.length });
    }
    return json({ purged, pending });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Every object path under <prefix>/ (folders are listed recursively).
async function listAll(service: ReturnType<typeof createClient>, prefix: string, depth: number): Promise<string[]> {
  if (depth > 6) return [];
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await service.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data || []) {
      const full = `${prefix}/${item.name}`;
      if (item.id === null) paths.push(...await listAll(service, full, depth + 1)); // folder
      else paths.push(full);
    }
    if (!data || data.length < 1000) break;
  }
  return paths;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
