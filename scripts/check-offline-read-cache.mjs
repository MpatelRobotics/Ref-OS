import fs from "node:fs";
const api = fs.readFileSync(new URL("../src/api.js", import.meta.url), "utf8");
for (const required of [
  'readCacheKey',
  'saveReadCache(eventId, "teams", teams)',
  'loadReadCache(eventId, "teams")',
  'saveReadCache(eventId, "matches", matches)',
  'loadReadCache(eventId, "matches")',
]) {
  if (!api.includes(required)) throw new Error(`offline read cache contract missing: ${required}`);
}
console.log("✓ offline Teams + Matches read cache contract OK");
