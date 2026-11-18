import { supabase } from "./supabaseClient";
import { downloadFile } from "./eventArchive";

// Both the UI and the database require a developer sign-in for the selected event.
export async function exportDeveloperEvent(eventId, pendingOperations = [], onProgress = () => {}) {
  const { data: archive, error } = await supabase.rpc("export_refos_developer_event", { p_event: eventId });
  if (error) throw error;
  if (!archive?.event || !archive.tables || !Array.isArray(archive.photos)) throw new Error("The complete event export could not be loaded.");

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const safe = value => String(value).replace(/[^a-z0-9._-]/gi, "_").replace(/^\.+$/, "_");
  const photos = [];
  const teams = archive.tables.teams || [];
  const owner = path => teams.find(team => (team.photo_paths || []).includes(path))?.number;
  const pending = [...new Map(pendingOperations.filter(operation => operation?.kind === "robot_photo" && operation.dataUrl).map(operation => [operation.id, operation])).values()];
  const total = archive.photos.length + pending.length;
  let completed = 0;

  // Download every stored attachment. A failed download stops the export so it can be retried.
  for (const photo of archive.photos) {
    const { data, error: photoError } = await supabase.storage.from(photo.bucket).download(photo.path);
    if (photoError || !data) throw new Error(`Could not export picture ${photo.path}. Try again when connected.`);
    const team = owner(photo.path);
    const filename = photo.path.split("/").pop() || "picture";
    const file = `${team ? "teams/" + safe(team) : "attachments"}/${photos.length + 1}-${safe(filename)}`;
    zip.file(file, await data.arrayBuffer());
    photos.push({ ...photo, team: team || null, file });
    onProgress(++completed, total);
  }
  for (const operation of pending) {
    const response = await fetch(operation.dataUrl);
    if (!response.ok) throw new Error("Could not read a pending robot picture.");
    const blob = await response.blob();
    const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const file = `teams/${safe(operation.number)}/pending-${safe(operation.id)}.${extension}`;
    zip.file(file, await blob.arrayBuffer());
    photos.push({ team: operation.number, sessionId: operation.sessionId || null, pending: true, file });
    onProgress(++completed, total);
  }
  zip.file("event.json", JSON.stringify({ ...archive, photos }, null, 2));
  for (const team of teams) {
    zip.file(`teams/${safe(team.number)}/team.json`, JSON.stringify({
      ...team,
      pictures: photos.filter(photo => photo.team === team.number),
      matches: (archive.tables.matches || []).filter(match => [...(match.red || []), ...(match.blue || [])].includes(team.number)),
      violations: (archive.tables.violations || []).filter(violation => violation.team === team.number),
    }, null, 2));
  }
  onProgress(completed, total, true);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } });
  downloadFile(blob, `${safe(archive.event.name || "Ref-OS")}-complete-export.zip`, "application/zip");
}
