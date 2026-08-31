#!/usr/bin/env node
/**
 * Schema ↔ app contract check for Ref-OS.
 *
 * Parses every supabase/*.sql to learn which tables/columns exist, which tables
 * have RLS enabled, and which policies (operations) each table allows. Then parses
 * src/api.js to learn which tables/columns/operations the app actually uses, and
 * reports any mismatch:
 *   - a column the app reads/writes that the schema never declares
 *   - an operation (select/insert/update/delete) the app performs on an
 *     RLS-enabled table with no policy covering it
 *
 * This is the guardrail that would have caught both real drift bugs:
 *   - teams.watchlisted / teams.watch_note used by the app but missing from schema
 *   - ref_roster DELETE performed by the app with no delete policy
 *
 * Heuristic (regex) parsing — not a full SQL/JS parser — but tuned to this codebase.
 * Exit code 1 on any problem so it can gate a build/commit.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlDir = join(root, "supabase");
const apiFile = join(root, "src", "api.js");

const CONSTRAINT_KW = /^(primary|foreign|unique|check|constraint|references|create|alter|drop|do|end|begin|--)\b/i;

/* ---------------- parse SQL ---------------- */
const tables = {};                 // table -> Set(columns)
const rlsEnabled = new Set();      // tables with RLS on
const policies = {};               // table -> Set(ops)  (ops: select/insert/update/delete/all)

function addTable(t) { if (!tables[t]) tables[t] = new Set(); }
function addCol(t, c) { addTable(t); tables[t].add(c.toLowerCase()); }

for (const f of readdirSync(sqlDir).filter((f) => f.endsWith(".sql"))) {
  const sql = readFileSync(join(sqlDir, f), "utf8");

  // create table public.X ( ... );
  const ct = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)\s*\(([\s\S]*?)\);/gi;
  let m;
  while ((m = ct.exec(sql))) {
    const t = m[1];
    addTable(t);
    for (let line of m[2].split("\n")) {
      line = line.trim();
      if (!line || CONSTRAINT_KW.test(line)) continue;
      const col = line.split(/\s+/)[0].replace(/[",]/g, "");
      if (col) addCol(t, col);
    }
  }
  // alter table public.X add column [if not exists] col  (handles comma-chained)
  const at = /alter\s+table\s+public\.(\w+)([\s\S]*?);/gi;
  while ((m = at.exec(sql))) {
    const t = m[1], rest = m[2];
    const ac = /add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi;
    let a;
    while ((a = ac.exec(rest))) addCol(t, a[1]);
    if (/enable\s+row\s+level\s+security/i.test(rest)) rlsEnabled.add(t);
  }
  // create policy "..." on public.X for OP
  const cp = /create\s+policy\s+"[^"]*"\s+on\s+public\.(\w+)\s+for\s+(all|select|insert|update|delete)/gi;
  while ((m = cp.exec(sql))) {
    (policies[m[1]] = policies[m[1]] || new Set()).add(m[2].toLowerCase());
  }
}

/* ---------------- parse api.js ---------------- */
const api = readFileSync(apiFile, "utf8");
const used = {};   // table -> { ops:Set, cols:Set }
function u(t) { return (used[t] = used[t] || { ops: new Set(), cols: new Set() }); }

const fromRe = /\.from\("(\w+)"\)/g;
let fm;
while ((fm = fromRe.exec(api))) {
  const t = fm[1];
  const rec = u(t);
  // window = from here to end of statement (next unbraced ';') — approx with 600 chars
  const win = api.slice(fm.index, fm.index + 700);
  const stmt = win.split(/;\s*\n/)[0];

  if (/\.select\(/.test(stmt)) rec.ops.add("select");
  if (/\.insert\(/.test(stmt)) rec.ops.add("insert");
  if (/\.update\(/.test(stmt)) { rec.ops.add("update"); }
  if (/\.upsert\(/.test(stmt)) { rec.ops.add("insert"); rec.ops.add("update"); }
  if (/\.delete\(/.test(stmt)) rec.ops.add("delete");

  // columns from .eq/.neq/.order/.gt/.lt/.gte/.lte/.in("col"
  const filt = /\.(?:eq|neq|order|gt|lt|gte|lte|in|is|like|ilike)\("(\w+)"/g;
  let x;
  while ((x = filt.exec(stmt))) rec.cols.add(x[1].toLowerCase());

  // columns from .select("a,b,c")  (skip * and embedded relations with parens)
  const sel = /\.select\("([^"]*)"/.exec(stmt);
  if (sel && sel[1] !== "*") {
    for (const c of sel[1].split(",")) {
      const name = c.trim();
      if (name && name !== "*" && !name.includes("(") && !name.includes(":")) rec.cols.add(name.toLowerCase());
    }
  }
  // columns from insert/update/upsert — inline object literal OR a variable
  // defined just above as `const <var> = { ... }` (the common pattern in this codebase)
  const opCall = /\.(?:insert|update|upsert)\(\s*(\{[\s\S]*?\}|\w+)/.exec(stmt);
  if (opCall) {
    let objBody = null;
    const arg = opCall[1];
    if (arg.startsWith("{")) objBody = arg;
    else {
      const defRe = new RegExp("const\\s+" + arg + "\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*;");
      const back = api.slice(Math.max(0, fm.index - 900), fm.index);
      const dm = defRe.exec(back);
      if (dm) objBody = "{" + dm[1] + "}";
    }
    if (objBody) {
      const keyRe = /(\w+)\s*:/g;
      let k;
      while ((k = keyRe.exec(objBody))) rec.cols.add(k[1].toLowerCase());
    }
  }
}

/* ---------------- compare ---------------- */
const problems = [];
const OP_POLICY = { select: "select", insert: "insert", update: "update", delete: "delete" };

for (const [t, rec] of Object.entries(used)) {
  if (!tables[t]) { problems.push(`Table "${t}" is used by api.js but never CREATEd in supabase/*.sql`); continue; }
  // column checks
  for (const c of rec.cols) {
    if (!tables[t].has(c)) problems.push(`Column "${t}.${c}" is used by api.js but not declared in the schema`);
  }
  // RLS policy checks (only if RLS is enabled for that table)
  if (rlsEnabled.has(t)) {
    const allowed = policies[t] || new Set();
    if (allowed.has("all")) continue;
    for (const op of rec.ops) {
      const need = OP_POLICY[op];
      if (need && !allowed.has(need)) {
        problems.push(`Table "${t}" has RLS enabled and the app performs ${op.toUpperCase()}, but there is no "${need}" (or "all") policy`);
      }
    }
  }
}

/* ---------------- report ---------------- */
const tCount = Object.keys(tables).length;
const uCount = Object.keys(used).length;
if (problems.length === 0) {
  console.log(`✓ schema/app contract OK — ${uCount} tables used, ${tCount} declared, no column or RLS gaps.`);
  process.exit(0);
} else {
  console.error(`✗ schema/app contract FAILED — ${problems.length} issue(s):\n`);
  for (const p of problems) console.error("  • " + p);
  console.error("\nFix the schema (supabase/*.sql) or the app (src/api.js) so they agree.");
  process.exit(1);
}
