import fs from "node:fs";
import crypto from "node:crypto";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const envPath = process.argv[2] || ".env";

if (!fs.existsSync(envPath)) {
  console.error(`Could not find ${envPath}`);
  process.exit(1);
}

const env = {};
for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const credentials = [
  ["site_password", "ref", env.REFOS_SITE_PASSWORD || env.VITE_SITE_PASSWORD],
  ["judge_password", "judge", env.REFOS_JUDGE_PASSWORD || env.VITE_JUDGE_PASSWORD],
  ["emcee_password", "emcee", env.REFOS_EMCEE_PASSWORD || env.VITE_EMCEE_PASSWORD],
  ["admin_password", "admin", env.REFOS_ADMIN_PASSWORD || env.VITE_ADMIN_PASSWORD],
].filter(([, , value]) => value);

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const esc = (value) => String(value).replaceAll("'", "''");

console.log("-- Generated locally by scripts/generate-access-security-sql.mjs");
console.log("-- Password plaintext is NOT included in this output.");
for (const [name, role, value] of credentials) {
  console.log(`
insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
values('${EVENT_ID}','${name}','${role}','${hash(value)}',true)
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true,updated_at=now();`);
}
if (!credentials.length) {
  console.error("No REFOS_* or legacy VITE_* password values were found in the env file.");
  process.exitCode = 2;
}
