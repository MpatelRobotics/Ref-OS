import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Camera, Trash2, ChevronLeft, AlertTriangle, ShieldAlert, Pencil,
  ClipboardCheck, X, Search, BarChart3, Users, Download, Save,
  Settings, ChevronRight, ImageOff, RefreshCw, UserCircle2, Share2, Check,
  CalendarDays, ListOrdered, LogOut, Mail, Copy, CloudOff, Cloud, ShieldCheck, KeyRound, Upload, Wifi, BookOpen, Trophy, Star, Sun, Moon, Info, Flag, Clock, GitBranch, Type, Menu, Contact, GripVertical, PlayCircle, QrCode, ScanLine,
} from "lucide-react";
import { configured } from "./supabaseClient";
import * as api from "./api";
import * as outbox from "./outbox";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { APP_VERSION } from "./appVersion";
import CommandCenter from "./components/CommandCenter.jsx";
import EventContactDirectory from "./components/EventContactDirectory.jsx";
import LoginScreen from "./auth/LoginScreen.jsx";
import NameScreen from "./auth/NameScreen.jsx";
import RoleAccessCodeManager from "./auth/RoleAccessCodeManager.jsx";
import { latestRoleAccessConfig } from "./auth/accessConfig.js";
import TeamScanner from "./features/teams/TeamScanner.jsx";
import IdentityModal from "./components/modals/IdentityModal.jsx";
import ShareModal from "./components/modals/ShareModal.jsx";
import AdminPasswordModal from "./components/modals/AdminPasswordModal.jsx";
import EventModal from "./components/modals/EventModal.jsx";
import ClearModal from "./components/modals/ClearModal.jsx";
import AddTeamModal from "./components/modals/AddTeamModal.jsx";
import AnnouncementModal from "./components/modals/AnnouncementModal.jsx";
import CountdownSetupModal from "./components/modals/CountdownSetupModal.jsx";
import OfflineReadinessModal from "./components/modals/OfflineReadinessModal.jsx";
import FeedbackModal from "./components/modals/FeedbackModal.jsx";

/* This build is locked to one event: The Highlander Summit Signature Event.
   EVENT_ID must match supabase/seed.sql. A shared site password gates entry. */
const EVENT_ID = "11111111-1111-4111-8111-111111111111";



/* ---------- helpers ---------- */
const normNum = (n) => (n || "").trim().toUpperCase();
const initials = (name) =>
  (name || "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "?";

// A full name = at least a first and last word (blocks single names / initials like "ABR").
const isFullName = (name) => (name || "").trim().split(/\s+/).filter(Boolean).length >= 2;

function compress(file, maxDim = 1200, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const TYPES = {
  minor: { label: "Minor", Icon: AlertTriangle,
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700", dot: "bg-amber-500",
    solid: "bg-amber-500", solidHover: "hover:bg-amber-600", soft: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900", text: "text-amber-700 dark:text-amber-300" },
  major: { label: "Major", Icon: ShieldAlert,
    badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700", dot: "bg-red-500",
    solid: "bg-red-600", solidHover: "hover:bg-red-700", soft: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900", text: "text-red-700 dark:text-red-300" },
  inspection: { label: "Inspection", Icon: ClipboardCheck,
    badge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700", dot: "bg-blue-500",
    solid: "bg-blue-600", solidHover: "hover:bg-blue-700", soft: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900", text: "text-blue-700 dark:text-blue-300" },
};
// Returns { rows:[{number,name}], warnings:[] } from a TM team-list export (CSV or JSON)
function parseTeamsFile(text, filename = "") {
  const t = text.trim();
  const isTeamNum = (v) => /^[0-9]{1,6}[A-Z]{1,3}$/.test(String(v == null ? "" : v).trim().toUpperCase());
  if (filename.toLowerCase().endsWith(".json") || t.startsWith("{") || t.startsWith("[")) {
    const data = JSON.parse(t);
    const list = Array.isArray(data) ? data : (data.teams || data.items || []);
    const rows = list.map((x) => ({ number: String(x.number ?? x.team ?? "").trim().toUpperCase(), name: String(x.name ?? x.teamName ?? "").trim() })).filter((r) => r.number);
    return { rows, warnings: [] };
  }
  const table = parseCSV(text);
  if (table.length < 2) return { rows: [], warnings: ["No rows found in the file."] };
  const header = table[0].map((h) => String(h).trim().toLowerCase());
  let numberCol = header.findIndex((h) => h === "number" || h === "team" || h === "team number" || h === "#");
  if (numberCol < 0) numberCol = header.findIndex((h) => h.includes("number"));
  let nameCol = header.findIndex((h) => h.includes("team name"));
  if (nameCol < 0) nameCol = header.findIndex((h) => h.includes("name") && !h.includes("short") && !h.includes("user") && !h.includes("school") && !h.includes("first") && !h.includes("last"));
  const warnings = [];
  if (numberCol < 0) { // fall back: find a column whose values look like team numbers
    for (let c = 0; c < header.length; c++) { let hits = 0; for (let i = 1; i < Math.min(table.length, 10); i++) if (isTeamNum(table[i][c])) hits++; if (hits >= 2) { numberCol = c; break; } }
  }
  if (numberCol < 0) { warnings.push("Couldn't find a team-number column."); return { rows: [], warnings }; }
  if (nameCol < 0) warnings.push("No team-name column found — importing numbers only.");
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const num = String(table[i][numberCol] || "").trim().toUpperCase();
    if (!num) continue;
    const name = nameCol >= 0 ? String(table[i][nameCol] || "").trim() : "";
    rows.push({ number: num, name });
  }
  return { rows, warnings };
}

// Returns { rows:[{number,rank}], warnings:[] } from a Tournament Manager rankings export (CSV or JSON)
function parseRankingsFile(text, filename = "") {
  const t = text.trim();
  const cleanNum = (v) => String(v == null ? "" : v).trim().toUpperCase();
  const cleanRank = (v) => { const m = String(v == null ? "" : v).match(/\d+/); return m ? Number(m[0]) : null; };
  if (filename.toLowerCase().endsWith(".json") || t.startsWith("{") || t.startsWith("[")) {
    const data = JSON.parse(t);
    const list = Array.isArray(data) ? data : (data.rankings || data.teams || data.items || []);
    const rows = list.map((x) => ({
      number: cleanNum(x.number ?? x.team ?? x.teamNumber ?? x.teamNum ?? x.TeamNum ?? x.team_number),
      rank: cleanRank(x.rank ?? x.ranking ?? x.position ?? x.place),
    })).filter((r) => r.number && r.rank != null);
    return { rows, warnings: [] };
  }
  const table = parseCSV(text);
  if (table.length < 2) return { rows: [], warnings: ["No rows found in the file."] };
  const header = table[0].map((h) => String(h).trim().toLowerCase());
  let numberCol = header.findIndex((h) => h === "team" || h === "team number" || h === "teamnum" || h === "number" || h === "team #" || h === "team#");
  if (numberCol < 0) numberCol = header.findIndex((h) => h.includes("team") && (h.includes("number") || h.includes("#")));
  let rankCol = header.findIndex((h) => h === "rank" || h === "ranking" || h === "place" || h === "position");
  if (rankCol < 0) rankCol = header.findIndex((h) => h.includes("rank"));
  const warnings = [];
  if (numberCol < 0) { warnings.push("Couldn't find a team-number column."); return { rows: [], warnings }; }
  if (rankCol < 0) { warnings.push("Couldn't find a rank column."); return { rows: [], warnings }; }
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const number = cleanNum(table[i][numberCol]);
    const rank = cleanRank(table[i][rankCol]);
    if (number && rank != null) rows.push({ number, rank });
  }
  return { rows, warnings };
}

const ORDER = ["minor", "major", "inspection"];

/* ---- Parse a Tournament Manager export (CSV or JSON) into match rows ---- */
function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (cell !== "" || row.length) { row.push(cell); rows.push(row); row = []; cell = ""; } if (c === "\r" && text[i + 1] === "\n") i++; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
}
const _roundMap = { qualification: "qual", qual: "qual", q: "qual", qualifier: "qual", qualifying: "qual", practice: "practice", p: "practice", "round of 16": "r16", r16: "r16", ro16: "r16", quarterfinal: "qf", quarterfinals: "qf", qf: "qf", semifinal: "sf", semifinals: "sf", sf: "sf", final: "final", finals: "final", f: "final" };
function phaseFrom(roundVal, matchVal) {
  const raw = String(roundVal == null ? "" : roundVal).trim();
  const r = raw.toLowerCase();

  // Tournament Manager elimination CSVs often use numeric Round values.
  // Tournament Manager elimination exports for this event use Round 6 for the Round of 16.
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n === 6) return "r16";
  }

  if (_roundMap[r]) return _roundMap[r];
  const name = String(matchVal || "").trim().toUpperCase();
  if (/^R\s?16/.test(name)) return "r16";
  if (/^QF/.test(name)) return "qf";
  if (/^SF/.test(name)) return "sf";
  if (/^F\b|^FINAL/.test(name)) return "final";
  if (/^P\b|^PRAC/.test(name)) return "practice";
  return "qual";
}
const _numFrom = (s) => { const m = String(s == null ? "" : s).match(/\d+/); return m ? Number(m[0]) : null; };

// Returns { rows:[{phase,num,red,blue,field}], warnings:[] }
function parseMatchesFile(text, filename = "") {
  const t = text.trim();
  if (filename.toLowerCase().endsWith(".json") || t.startsWith("{") || t.startsWith("[")) {
    const data = JSON.parse(t);
    const list = Array.isArray(data) ? data : (data.matches || data.items || []);
    const rows = list.map((m) => {
      const info = m.matchInfo || m; const tuple = info.matchTuple || {};
      const al = info.alliances || [];
      const teams = (a) => ((a && a.teams) || []).map((x) => String(x.number)).filter(Boolean);
      const fs = m.finalScore || info.finalScore || [];
      const scored = String(info.state || "").toUpperCase() === "SCORED" || (Array.isArray(fs) && fs.length === 2);
      return { phase: phaseFrom(tuple.round, ""), num: Number(tuple.match ?? tuple.instance ?? 0), red: teams(al[0]), blue: teams(al[1]), field: info.field || "", redScore: scored ? Number(fs[0]) : null, blueScore: scored ? Number(fs[1]) : null, scored };
    }).filter((r) => r.num > 0 && (r.red.length || r.blue.length));
    return { rows, warnings: [] };
  }
  // CSV
  const table = parseCSV(text);
  if (table.length < 2) return { rows: [], warnings: ["No rows found in the file."] };
  const header = table[0].map((h) => String(h).trim().toLowerCase());
  const find = (...keys) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const matchCol = (() => { const tm = header.indexOf("matchnum"); if (tm >= 0) return tm; const exact = header.indexOf("match"); return exact >= 0 ? exact : find("match #", "match number", "match"); })();
  const roundCol = (() => { const exact = header.indexOf("round"); return exact >= 0 ? exact : find("round", "type", "phase"); })();
    const instanceCol = header.indexOf("instance");
  const fieldCol = find("field");
  const redScoreCol = header.findIndex((h) => h.includes("red") && h.includes("score"));
  const blueScoreCol = header.findIndex((h) => h.includes("blue") && h.includes("score"));
  const stateCol = header.findIndex((h) => h.includes("state") || h.includes("scored") || h.includes("status"));
  const redCols = header.map((h, i) => ({ h, i })).filter((x) => x.h.includes("red") && !x.h.includes("score") && !x.h.includes("won")).map((x) => x.i);
  const blueCols = header.map((h, i) => ({ h, i })).filter((x) => x.h.includes("blue") && !x.h.includes("score") && !x.h.includes("won")).map((x) => x.i);
  const warnings = [];
  if (matchCol < 0) warnings.push("Couldn't find a 'Match' column.");
  if (!redCols.length || !blueCols.length) warnings.push("Couldn't find Red/Blue team columns — check the export includes team columns.");
  const clean = (v) => String(v == null ? "" : v).trim().toUpperCase();
  const isTeam = (v) => /^[0-9]{1,6}[A-Z]{1,2}$/.test(clean(v)); // e.g. 1234A, 25335A, 119B — not "0"/"FALSE"/scores
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const matchVal = matchCol >= 0 ? r[matchCol] : "";
    const roundVal = roundCol >= 0 ? r[roundCol] : "";
    const phase = phaseFrom(roundVal, matchVal);
    const num = _numFrom(matchVal) ?? _numFrom(r[roundCol]) ?? i;
    const red = redCols.map((c) => clean(r[c])).filter(isTeam);
    const blue = blueCols.map((c) => clean(r[c])).filter(isTeam);
    const field = fieldCol >= 0 ? String(r[fieldCol] || "").trim() : "";
    const rs = redScoreCol >= 0 ? _numFrom(r[redScoreCol]) : null;
    const bs = blueScoreCol >= 0 ? _numFrom(r[blueScoreCol]) : null;
    const scored = stateCol >= 0 ? /scored|complete|final|done|true|1/i.test(String(r[stateCol] || "")) : ((rs != null || bs != null) && ((rs || 0) > 0 || (bs || 0) > 0));
    if (num > 0 && (red.length || blue.length)) rows.push({ phase, num, red, blue, field, redScore: scored ? rs : null, blueScore: scored ? bs : null, scored });
  }
  return { rows, warnings };
}

const tmClean = (v) => String(v == null ? "" : v).trim();
const tmSameTeams = (a, b) => {
  const aa = (a || []).map((x) => tmClean(x).toUpperCase());
  const bb = (b || []).map((x) => tmClean(x).toUpperCase());
  return aa.length === bb.length && aa.every((x, i) => x === bb[i]);
};
const tmMatchKey = (phase, num) => (phase === "qual" ? String(num) : `${phase}-${num}`);
const tmScheduleChanged = (existing, incoming) => !existing ||
  !tmSameTeams(existing.red, incoming.red) ||
  !tmSameTeams(existing.blue, incoming.blue) ||
  tmClean(existing.field) !== tmClean(incoming.field);
const tmScoreWinner = (redScore, blueScore) => redScore > blueScore ? "red" : blueScore > redScore ? "blue" : "tie";
const tmScoreChanged = (existing, redScore, blueScore, winner) => !existing ||
  Number(existing.redScore) !== Number(redScore) ||
  Number(existing.blueScore) !== Number(blueScore) ||
  tmClean(existing.winner).toLowerCase() !== tmClean(winner).toLowerCase();

const MATCH_PHASES = [
  { key: "qual", label: "Qualification", abbrev: "Q" },
  { key: "practice", label: "Practice", abbrev: "P" },
  { key: "r16", label: "Round of 16", abbrev: "R16" },
  { key: "qf", label: "Quarterfinal", abbrev: "QF" },
  { key: "sf", label: "Semifinal", abbrev: "SF" },
  { key: "final", label: "Final", abbrev: "F" },
  { key: "skills", label: "Skills", abbrev: "Skills" },
  { key: "none", label: "Not tied to a match", abbrev: "" },
];
const fmtMatch = (m) => {
  if (!m || !m.phase || m.phase === "none") return null;
  const p = MATCH_PHASES.find((x) => x.key === m.phase);
  if (!p) return null;
  const num = String(m.num == null ? "" : m.num).trim();
  if (m.phase === "skills") return num ? `Skills ${num}` : "Skills";
  if (!num) return p.abbrev;
  return /\d$/.test(p.abbrev) ? `${p.abbrev}-${num}` : `${p.abbrev}${num}`;
};
const elimCounts = (bracket) => {
  switch (Number(bracket)) {
    case 16: return { r16: 8, qf: 4, sf: 2 };
    case 8:  return { qf: 4, sf: 2 };
    case 4:  return { sf: 2 };
    default: return {};
  }
};
const phaseCount = (phase, event) => {
  if (!event) return null;
  if (phase === "qual") return event.quals > 0 ? event.quals : null;
  if (phase === "practice") return event.practice > 0 ? event.practice : null;
  if (phase === "final") return event.bracket ? (event.finalsBestOf || 1) : null;
  const ec = elimCounts(event.bracket);
  return phase in ec ? ec[phase] : null;
};
const availablePhases = (event) => MATCH_PHASES.filter((p) => {
  if (["qual", "practice", "skills", "none", "final"].includes(p.key)) return true;
  if (!event?.bracket) return true;
  return p.key in elimCounts(event.bracket);
});

const fmtRule = (code) => { const c = (code || "").trim().replace(/[<>]/g, "").toUpperCase(); return c ? `<${c}>` : "—"; };
const fmtTime = (ts) => new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const ago = (ts) => {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const days = Math.round(s / 86400);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
};

/* ---------- lazy photo thumbnail (signed URL from Supabase Storage) ---------- */
function Thumb({ pkey, onOpen }) {
  const [src, setSrc] = useState(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let live = true;
    api.photoUrl(pkey).then((u) => { if (live) { u ? setSrc(u) : setGone(true); } });
    return () => { live = false; };
  }, [pkey]);
  if (gone) return <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 grid place-items-center text-slate-300"><ImageOff size={18} /></div>;
  if (!src) return <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 animate-pulse" />;
  return (
    <button onClick={() => onOpen(src)} className="shrink-0">
      <img src={src} alt="robot" className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
    </button>
  );
}

/* ==================================================================== */
/*  ROOT: auth -> event selection -> tracker                            */
/* ==================================================================== */
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [role, setRole] = useState("ref");
  const [accessChecked, setAccessChecked] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("refosTheme") || "light");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark"); else root.classList.remove("dark");
    localStorage.setItem("refosTheme", theme);
  }, [theme]);

  const [textScale, setTextScale] = useState(() => localStorage.getItem("refosTextScale") || "normal");
  useEffect(() => {
    document.documentElement.style.fontSize = ({ normal: "100%", large: "115%", xl: "130%" })[textScale] || "100%";
    localStorage.setItem("refosTextScale", textScale);
  }, [textScale]);
  const cycleTextSize = () => setTextScale((s) => (s === "normal" ? "large" : s === "large" ? "xl" : "normal"));

  const [meName, setMeName] = useState(() => localStorage.getItem("refName") || "");
  const [event, setEvent] = useState(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const serverRole = await api.getMyEventRole(EVENT_ID);
        if (!live) return;
        if (serverRole) {
          const uiRole = serverRole === "admin" ? "ref" : serverRole;
          setRole(uiRole);
          setUnlocked(true);
          localStorage.setItem("unlocked", "1");
          localStorage.setItem("refosRole", uiRole);
          if (serverRole === "admin") sessionStorage.setItem("refosAdmin", "1");
          else sessionStorage.removeItem("refosAdmin");
        } else {
          localStorage.removeItem("unlocked");
          localStorage.removeItem("refosRole");
          sessionStorage.removeItem("refosAdmin");
        }
      } finally {
        if (live) setAccessChecked(true);
      }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!unlocked || !meName) return;
    api.setEventMemberName(EVENT_ID, meName).catch(() => {});
  }, [unlocked, meName]);

  useEffect(() => {
    if (!unlocked || !meName) return;
    let live = true;
    setLoadErr(false);
    api.getEvent(EVENT_ID)
      .then((ev) => { if (live) { ev ? setEvent(ev) : setLoadErr(true); } })
      .catch(() => { if (live) setLoadErr(true); });
    return () => { live = false; };
  }, [unlocked, meName]);

  const unlock = (r, admin, serverRole) => {
    const uiRole = r || "ref";
    localStorage.setItem("unlocked", "1");
    localStorage.setItem("refosRole", uiRole);
    if (admin || serverRole === "admin") sessionStorage.setItem("refosAdmin", "1");
    else sessionStorage.removeItem("refosAdmin");
    setRole(uiRole);
    setUnlocked(true);
  };

  const saveName = async (n) => {
    const clean = n.trim();
    localStorage.setItem("refName", clean);
    setMeName(clean);
    try { await api.setEventMemberName(EVENT_ID, clean); } catch {}
  };

  const lock = async () => {
    localStorage.removeItem("unlocked");
    localStorage.removeItem("refosRole");
    sessionStorage.removeItem("refosAdmin");
    setUnlocked(false);
    setEvent(null);
    await api.clearAccessSession();
  };

  if (!configured) return <ConfigError />;
  if (!accessChecked) return <FullPage>Checking event access…</FullPage>;
  if (!unlocked) return <LoginScreen eventId={EVENT_ID} onUnlock={unlock} />;
  if (!meName) return <NameScreen onName={saveName} />;
  if (loadErr) return (
    <FullPage>
      <div className="max-w-sm">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Couldn't load the event</p>
        <p className="text-sm mt-1">Confirm the Ref OS security migration has been run and this device still has event access.</p>
      </div>
    </FullPage>
  );
  if (!event) return <FullPage>Loading…</FullPage>;

  return <Tracker key={event.id} initialEvent={event} meName={meName} role={role} theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} textScale={textScale} onCycleTextSize={cycleTextSize} onEditName={saveName} onLock={lock} />;
}

const FullPage = ({ children }) => (
  <div className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-700 text-slate-400 font-sans p-6 text-center">{children}</div>
);
const ConfigError = () => (
  <FullPage>
    <div className="max-w-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-200">Not configured yet</p>
      <p className="text-sm mt-1">Copy <code>.env.example</code> to <code>.env</code> and add your Supabase URL and anon key, then restart.</p>
    </div>
  </FullPage>
);

/* ==================================================================== */
/*  TRACKER (the main app, scoped to one event)                        */
/* ==================================================================== */
function Tracker({ initialEvent, meName, role, theme, onToggleTheme, textScale, onCycleTextSize, onEditName, onLock }) {
  const isJudge = role === "judge";
  const isEmcee = role === "emcee";
  const eventId = initialEvent.id;
  const [event, setEvent] = useState(initialEvent);
  const [teams, setTeams] = useState([]);
  const [viols, setViols] = useState([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(0);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine !== false);
  const [cloudReachable, setCloudReachable] = useState(null);
  const [queuedWrites, setQueuedWrites] = useState(0);
  const [lastCloudError, setLastCloudError] = useState("");
  const [matches, setMatches] = useState({}); // { [num]: {red:[], blue:[]} }
  const [rules, setRules] = useState([]);      // [{ code, desc, category }]
  const [presence, setPresence] = useState([]); // [{ name, ... }] currently online
  const [refRoster, setRefRoster] = useState([]); // refs seen at this event, including offline
  const pendingCount = viols.filter((v) => v._pending).length;

  const [lastMatch, setLastMatch] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lastMatch")) || { phase: "qual", num: "" }; }
    catch { return { phase: "qual", num: "" }; }
  });

  const [view, setView] = useState(role === "judge" ? "judging" : "teams");
  const [openTeam, setOpenTeam] = useState(null);
  const [openMatch, setOpenMatch] = useState(null);
  const [openRobot, setOpenRobot] = useState(null);
  const [query, setQuery] = useState("");
  const [showTeamScanner, setShowTeamScanner] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [menu, setMenu] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // { title, chips, warnings, resolve }
  const confirmImport = (p) => new Promise((resolve) => setImportPreview({ ...p, resolve }));
  const [importing, setImporting] = useState(null); // { label, done, total } | null while an import is writing
  const menuRef = useRef(null);
  const menuTimer = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const el = menuRef.current;
    const reset = () => { clearTimeout(menuTimer.current); menuTimer.current = setTimeout(() => setMenu(false), 3500); };
    reset();
    const evs = ["pointerdown", "pointermove", "touchstart", "wheel", "scroll", "keydown"];
    evs.forEach((ev) => el && el.addEventListener(ev, reset, { passive: true }));
  return () => { clearTimeout(menuTimer.current); evs.forEach((ev) => el && el.removeEventListener(ev, reset)); };
  }, [menu]);

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() =>
    typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true)
  );
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent); // covers Chrome + Samsung Internet
  const matchFileRef = useRef(null);
  const teamFileRef = useRef(null);
  const scoreFileRef = useRef(null);
  const rankingFileRef = useRef(null);
  const allianceFileRef = useRef(null);
  const [logFor, setLogFor] = useState(null);
  const [noms, setNoms] = useState([]);
  const [finalists, setFinalists] = useState(new Set()); // `${award}::${team}`
  const [watchNotes, setWatchNotes] = useState([]);
  const [fieldLog, setFieldLog] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [eventSettings, setEventSettings] = useState({});
  const [failedSyncItems, setFailedSyncItems] = useState([]);
  const announcements = fieldLog.filter((e) => e.kind === "announcement").sort((a,b) => b.createdAt - a.createdAt);
  const activeAnnouncement = announcements.find((e) => {
    try { return localStorage.getItem(`refosAnnouncementAck:${e.id}`) !== "1"; } catch { return true; }
  });
  const acknowledgeAnnouncement = (id) => {
    try { localStorage.setItem(`refosAnnouncementAck:${id}`, "1"); } catch {}
    setAnnouncementAckTick((n) => n + 1);
  };
  const [alliances, setAlliances] = useState({}); // seed -> [team1, team2]
  const [alliancesLoaded, setAlliancesLoaded] = useState(false);
  const [showFieldLog, setShowFieldLog] = useState(false);
  const [addMatchOpen, setAddMatchOpen] = useState(false);
  const [nominating, setNominating] = useState(null); // award key when the nominate modal is open
  const [editing, setEditing] = useState(null); // violation being edited
  const [logMatch, setLogMatch] = useState(null);
  const [addTeam, setAddTeam] = useState(false);
  const [expandRule, setExpandRule] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [showByRule, setShowByRule] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showTMSync, setShowTMSync] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showCountdownSetup, setShowCountdownSetup] = useState(false);
  const [showOfflineTest, setShowOfflineTest] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [showContactDirectory, setShowContactDirectory] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [showPreEventTest, setShowPreEventTest] = useState(false);
  const [showTwoDeviceSyncTest, setShowTwoDeviceSyncTest] = useState(false);
  const [showDiagnosticReport, setShowDiagnosticReport] = useState(false);
  const [showRoleCodeManager, setShowRoleCodeManager] = useState(false);
  const [lastSystemTest, setLastSystemTest] = useState(null);
  const [tourStep, setTourStep] = useState(0);

  const contactDirectoryEntries = fieldLog.filter((e) => e.kind === "contact_directory").sort((a, b) => b.createdAt - a.createdAt);
  const contactDirectoryEntry = contactDirectoryEntries[0] || null;
  const legacyContacts = (() => {
    if (!contactDirectoryEntry?.note) return [];
    try { const parsed = JSON.parse(contactDirectoryEntry.note); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  })();
  const eventContacts = Array.isArray(eventSettings?.contact_directory?.value)
    ? eventSettings.contact_directory.value
    : legacyContacts;

  const [countdownNow, setCountdownNow] = useState(Date.now());
  const countdownEntries = fieldLog.filter((e) => e.kind === "event_countdown").sort((a, b) => b.createdAt - a.createdAt);
  const eventCountdownEntry = countdownEntries[0] || null;
  const legacyCountdown = (() => {
    if (!eventCountdownEntry?.note) return null;
    try { const parsed = JSON.parse(eventCountdownEntry.note); return parsed?.target ? parsed : null; }
    catch { return null; }
  })();
  const eventCountdown = eventSettings?.event_countdown?.value?.target
    ? eventSettings.event_countdown.value
    : legacyCountdown;
  const countdownRemaining = eventCountdown?.target ? Math.max(0, new Date(eventCountdown.target).getTime() - countdownNow) : 0;
  const countdownText = countdownRemaining > 0 ? (() => {
    const total = Math.floor(countdownRemaining / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return days ? `${days}d ${hours}h ${mins}m` : hours ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
  })() : "";
  const [announcementAckTick, setAnnouncementAckTick] = useState(0);
  const [tmSyncStatus, setTmSyncStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`refosTmSync:${eventId}`)) || {}; }
    catch { return {}; }
  });
  const [showRankings, setShowRankings] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(() => sessionStorage.getItem("refosAdmin") === "1");
  const [eventMembers, setEventMembers] = useState([]);
  const myRole = isEmcee ? "Emcee" : isJudge ? "Judge Advisor" : adminUnlocked ? "Admin" : "Referee";
  const deviceId = useMemo(() => {
    try {
      let id = localStorage.getItem("refosDeviceId");
      if (!id) {
        id = (globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem("refosDeviceId", id);
      }
      return id;
    } catch {
      return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  useEffect(() => {
    if (!showGuidedTour) return;
    setMenu(false);
    setMobileNavOpen(false);
    setShowFieldLog(false);
    setShowContactDirectory(false);
    setLogFor(null);
    setLogMatch(null);
    setOpenTeam(null);
    setOpenRobot(null);
    setOpenMatch(null);

    if (isJudge) {
      if (tourStep <= 1) setView("judging");
      else setView("alliances");
      return;
    }

    if (tourStep === 0 || tourStep === 1) setView("teams");
    if (tourStep === 2) setView(Object.keys(matches).length ? "matches" : "teams");
    if (tourStep === 3) {
      setView(Object.keys(matches).length ? "matches" : "teams");
      const first = Object.values(matches).sort((a,b) => Number(a.num || 0) - Number(b.num || 0))[0];
      if (first?.id) setOpenMatch(first.id);
    }
    if (tourStep === 4 && !isEmcee) {
      setView("teams");
      setLogFor("");
    }
    if (tourStep === 5) setView(rules.length ? "rulebook" : "teams");
    if (tourStep === 6) setShowFieldLog(true);
    if (tourStep === 7) setView("alliances");
    if (tourStep === 8) setShowContactDirectory(true);
  }, [showGuidedTour, tourStep]);

  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const pendingAdminAction = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const captureInstallPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); };
    const installed = () => { setIsInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("beforeinstallprompt", captureInstallPrompt); window.removeEventListener("appinstalled", installed); };
  }, []);

  const installRefOS = async () => {
    setMenu(false);
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
      return;
    }
    setShowInstallHelp(true);
  };

  const requireAdmin = useCallback((action) => {
    if (adminUnlocked) { action(); return; }
    pendingAdminAction.current = action;
    setShowAdminPassword(true);
  }, [adminUnlocked]);

  const unlockAdmin = async (password) => {
    try {
      const result = await api.claimEventAccess(eventId, password);
      if (!result.isAdmin) return { ok: false, message: "That credential does not have Admin access." };
      sessionStorage.setItem("refosAdmin", "1");
      setAdminUnlocked(true);
      setShowAdminPassword(false);
      const action = pendingAdminAction.current;
      pendingAdminAction.current = null;
      if (action) setTimeout(action, 0);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message?.includes("Invalid event credential") ? "Incorrect admin credential." : (e.message || "Could not verify Admin access.") };
    }
  };

  const lockAdmin = async () => {
    try { await api.downgradeMyEventRole(eventId, role === "judge" ? "judge" : role === "emcee" ? "emcee" : "ref"); } catch {}
    sessionStorage.removeItem("refosAdmin");
    setAdminUnlocked(false);
    setMenu(false);
  };

  useEffect(() => {
    if (isJudge || isEmcee) return;
    let cancelled = false;
    const syncServerAdminRole = async () => {
      try {
        const serverRole = await api.getMyEventRole(eventId);
        if (cancelled) return;
        const isServerAdmin = serverRole === "admin";
        if (isServerAdmin) sessionStorage.setItem("refosAdmin", "1");
        else sessionStorage.removeItem("refosAdmin");
        setAdminUnlocked(isServerAdmin);
      } catch {}
    };
    syncServerAdminRole();
    const iv = setInterval(syncServerAdminRole, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [eventId, isJudge, isEmcee]);

  const loadEventMembers = useCallback(async () => {
    if (!adminUnlocked) { setEventMembers([]); return; }
    try { setEventMembers(await api.listEventMembersForAdmin(eventId)); }
    catch { setEventMembers([]); }
  }, [adminUnlocked, eventId]);

  const setVolunteerAdmin = async (member, makeAdmin) => {
    if (!member?.user_id) return;
    try {
      await api.setVolunteerAdminRole(eventId, member.user_id, makeAdmin);
      await Promise.all([loadEventMembers(), api.listRefRoster(eventId).then(setRefRoster)]);
    } catch (e) {
      alert(e?.message || "Could not update admin role.");
    }
  };

  const markTMSync = (key) => {
    const next = { ...tmSyncStatus, [key]: Date.now() };
    setTmSyncStatus(next);
    try { localStorage.setItem(`refosTmSync:${eventId}`, JSON.stringify(next)); } catch {}
  };

  const refreshQueueHealth = useCallback(async () => {
    try { setQueuedWrites((await outbox.loadQueue(eventId)).length); } catch {}
  }, [eventId]);

  const refresh = useCallback(async () => {
    setSyncing(true);
    setAlliancesLoaded(false);
    try {
      const [ev, t, v, nm, sl, wn] = await Promise.all([api.getEvent(eventId), api.listTeams(eventId), api.listViolations(eventId), api.listNominations(eventId), api.listShortlist(eventId), api.listWatchNotes(eventId)]);
      if (ev) setEvent(ev);
      setTeams((cur) => {
        const pending = cur.filter((x) => x._pending && !t.some((s) => s.number === x.number));
        return [...t, ...pending];
      });
      setViols((cur) => { const pend = cur.filter((x) => x._pending && !v.some((s) => s.id === x.id)); return [...pend, ...v]; });
      setNoms(nm);
      setFinalists(new Set(sl.map((s) => `${s.award}::${s.team}`)));
      setWatchNotes(wn);
      api.listFieldLog(eventId).then(setFieldLog).catch(() => {});
      api.listEventSettings(eventId).then(setEventSettings).catch(() => {});
      outbox.loadFailed(eventId).then(setFailedSyncItems).catch(() => {});
      api.listAlliances(eventId).then((rows) => { const m = {}; for (const a of rows) m[a.seed] = a.teams; setAlliances(m); setAlliancesLoaded(true); }).catch(() => { setAlliancesLoaded(true); });
      const now = Date.now();
      setSyncedAt(now);
      setCloudReachable(true);
      setLastCloudError("");
    } catch (e) {
      setCloudReachable(false);
      setLastCloudError(e?.message || String(e || "Cloud connection failed"));
      throw e;
    } finally {
      setSyncing(false);
      refreshQueueHealth();
    }
  }, [eventId, refreshQueueHealth]);

  const doFlush = useCallback(async () => {
    await outbox.flush(eventId, {
      onSynced: (saved) => setViols((cur) => cur.map((x) => (x.id === saved.id ? saved : x))),
      onTeamSynced: (number) => setTeams((cur) => cur.map((x) => x.number === number ? { ...x, _pending: false } : x)),
      onFailed: (op, e) => {
        console.error("outbox op retained as failed", op, e);
        outbox.loadFailed(eventId).then(setFailedSyncItems).catch(() => {});
      },
      onIdle: () => {
        outbox.loadFailed(eventId).then(setFailedSyncItems).catch(() => {});
        refreshQueueHealth();
      },
    });
  }, [eventId, refreshQueueHealth]);

  const retryFailedSync = async (failedId) => {
    await outbox.retryFailed(eventId, failedId);
    setFailedSyncItems(await outbox.loadFailed(eventId));
    doFlush();
  };
  const discardFailedSync = async (failedId) => {
    if (!confirm("Discard this failed sync item permanently?")) return;
    setFailedSyncItems(await outbox.discardFailed(eventId, failedId));
  };

  useEffect(() => {
    (async () => {
      await refresh();
      api.listMatches(eventId).then((list) => {
        const map = {}; for (const m of list) map[m.id] = m; setMatches(map);
      }).catch((error) => {
        console.warn("Matches unavailable and no local match cache exists yet.", error);
      });
      api.listRules(eventId).then(setRules);
      // restore violations still waiting in the queue (e.g. after a reload while offline)
      const q = await outbox.loadQueue(eventId);
      setQueuedWrites(q.length);
      const pendingTeams = q.filter((o) => o.kind === "team").map((o) => ({
        number: normNum(o.number), name: (o.name || "").trim(), createdAt: o.createdAt || Date.now(), _pending: true,
      }));
      if (pendingTeams.length) setTeams((cur) => {
        const have = new Set(cur.map((t) => t.number));
        return [...cur, ...pendingTeams.filter((t) => !have.has(t.number))];
      });
      const pend = q.filter((o) => o.kind === "violation").map((o) => ({
        id: o.row.id, team: o.row.team, type: o.row.type, code: o.row.code, desc: o.row.rule_desc || "",
        notes: o.row.notes || "", match: o.row.match_info || null, by: o.row.logged_by || "",
        photoKeys: [], createdAt: o.createdAt || Date.now(), _pending: true, _localPhotos: o.photos || [],
      }));
      if (pend.length) setViols((cur) => { const have = new Set(cur.map((v) => v.id)); return [...pend.filter((p) => !have.has(p.id)), ...cur]; });
      setReady(true);
      doFlush();
    })();
    const unsub = api.subscribeEvent(eventId, () => refresh());
    const onFocus = () => { refresh(); doFlush(); };
    const goOnline = () => { setOnline(true); setCloudReachable(null); refresh().catch(() => {}); doFlush(); };
    const goOffline = () => { setOnline(false); setCloudReachable(false); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const iv = setInterval(doFlush, 20000); // retry any stragglers
    return () => {
      unsub(); window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline);
      clearInterval(iv);
    };
  }, [eventId, refresh, doFlush]);

  useEffect(() => {
    const name = meName || "Ref";
    const loadRoster = () => api.listRefRoster(eventId).then(setRefRoster);
    api.touchRefRoster(eventId, name, myRole).then(loadRoster);
    const leave = api.joinPresence(eventId, { name, role: myRole, online_at: Date.now() }, setPresence);
    const iv = setInterval(() => { api.touchRefRoster(eventId, name, myRole); loadRoster(); }, 60000);
    return () => { clearInterval(iv); leave(); };
  }, [eventId, meName, myRole]);

  const saveEvent = async (data) => {
    const ev = await api.updateEvent(eventId, {
      name: (data.name || "").trim(),
      quals: Math.max(0, parseInt(data.quals, 10) || 0),
      practice: Math.max(0, parseInt(data.practice, 10) || 0),
      bracket: Number(data.bracket) || 0, finalsBestOf: Number(data.finalsBestOf) || 1,
    });
    setEvent(ev); setShowEvent(false);
  };

  const upsertTeam = async (number, name) => {
    const num = normNum(number);
    setTeams((cur) => {
      const ex = cur.find((t) => t.number === num);
      if (!ex) return [...cur, { number: num, name: (name || "").trim(), createdAt: Date.now(), _pending: true }];
      if (name && !ex.name) return cur.map((t) => (t.number === num ? { ...t, name: name.trim(), _pending: true } : t));
      return cur.map((t) => t.number === num ? { ...t, _pending: true } : t);
    });
    try {
      await api.upsertTeam(eventId, num, name);
      setTeams((cur) => cur.map((t) => t.number === num ? { ...t, _pending: false } : t));
    } catch (e) {
      if (outbox.isOffline(e)) {
        await outbox.enqueue(eventId, { id: `team:${num}:${Date.now()}`, kind: "team", eventId, number: num, name, createdAt: Date.now() });
      } else {
        setTeams((cur) => cur.filter((t) => !(t.number === num && t._pending)));
        throw e;
      }
    }
    return num;
  };

  const saveViolation = async ({ team, type, code, desc, notes, photos, match }) => {
    const cleanMatch = match && match.phase && match.phase !== "none" ? { phase: match.phase, num: (match.num || "").trim() } : null;
    const row = api.buildViolationRow(eventId, {
      team, type, code: normNum(code).replace(/[<>]/g, ""), desc: desc.trim(),
      notes: notes.trim(), by: meName || "", match: cleanMatch,
    });
    const createdAt = Date.now();
    // show it immediately (marked pending), then persist to the durable queue and try to send
    setViols((cur) => [{
      id: row.id, team: row.team, type: row.type, code: row.code, desc: row.rule_desc,
      notes: row.notes, match: row.match_info, by: row.logged_by, photoKeys: [],
      createdAt, _pending: true, _localPhotos: photos,
    }, ...cur]);
    if (cleanMatch) { setLastMatch(cleanMatch); localStorage.setItem("lastMatch", JSON.stringify(cleanMatch)); }
    await outbox.enqueue(eventId, { id: row.id, kind: "violation", eventId, row, photos, createdAt });
    doFlush();
  };

  const deleteViolation = async (v) => {
    if (v._pending) { await outbox.removeOp(eventId, v.id); setViols((cur) => cur.filter((x) => x.id !== v.id)); return; }
    try { await api.deleteViolation(v); setViols((cur) => cur.filter((x) => x.id !== v.id)); }
    catch (e) { if (outbox.isOffline(e)) alert("You're offline — reconnect to delete this violation."); else throw e; }
  };
  const editViolation = async (orig, form) => {
    const cleanMatch = form.match && form.match.phase && form.match.phase !== "none" ? { phase: form.match.phase, num: (form.match.num || "").trim() } : null;
    const row = {
      id: orig.id, event_id: eventId, team: form.team, type: form.type,
      code: normNum(form.code).replace(/[<>]/g, ""), rule_desc: (form.desc || "").trim(),
      notes: (form.notes || "").trim(), match_info: cleanMatch, logged_by: orig.by || meName || "",
    };
    try {
      const saved = await api.updateViolation(eventId, row, form.keepKeys || [], form.photos || [], orig.photoKeys || []);
      setViols((cur) => cur.map((x) => (x.id === orig.id ? saved : x)));
    } catch (e) {
      if (outbox.isOffline(e)) { alert("You're offline — reconnect to edit this violation."); return; }
      throw e;
    }
  };
  const deleteTeam = async (num) => {
    if (!adminUnlocked) {
      requireAdmin(() => deleteTeam(num));
      return;
    }
    try { await api.deleteTeam(eventId, num); }
    catch (e) { if (outbox.isOffline(e)) { alert("You're offline — reconnect to delete a team."); return; } throw e; }
    setViols((cur) => cur.filter((v) => v.team !== num));
    setTeams((cur) => cur.filter((t) => t.number !== num));
    setOpenTeam(null);
  };
  const addWatchNote = async (number, note) => {
    try {
      const saved = await api.addWatchNote(eventId, { team: number, by: meName, note });
      setWatchNotes((cur) => [...cur.filter((x) => x.id !== saved.id), saved]);
    } catch (e) {
      if (outbox.isOffline(e)) throw new Error("You're offline — reconnect to add to the watchlist.");
      throw e;
    }
  };
  const removeWatchNote = async (id) => {
    try { await api.deleteWatchNote(id); setWatchNotes((cur) => cur.filter((x) => x.id !== id)); }
    catch (e) { if (outbox.isOffline(e)) { alert("You're offline — reconnect to remove this note."); return; } throw e; }
  };

  const addRobotPhoto = async (number, dataUrl) => {
    const paths = await api.addTeamPhoto(eventId, number, dataUrl);
    setTeams((cur) => cur.map((t) => (t.number === number ? { ...t, photoKeys: paths } : t)));
  };
  const removeRobotPhoto = async (number, path) => {
    try {
      const paths = await api.removeTeamPhoto(eventId, number, path);
      setTeams((cur) => cur.map((t) => (t.number === number ? { ...t, photoKeys: paths } : t)));
    } catch (e) {
      if (outbox.isOffline(e)) { alert("You're offline — reconnect to delete this photo."); return; }
      throw e;
    }
  };
  const addNomination = async (form) => {
    try {
      const saved = await api.addNomination(eventId, { ...form, by: meName, byRole: myRole });
      setNoms((cur) => [saved, ...cur.filter((x) => x.id !== saved.id)]);
    } catch (e) {
      if (outbox.isOffline(e)) throw new Error("You're offline — reconnect to nominate.");
      throw e;
    }
  };
  const removeNomination = async (id) => {
    try { await api.deleteNomination(id); setNoms((cur) => cur.filter((x) => x.id !== id)); }
    catch (e) { if (outbox.isOffline(e)) { alert("You're offline — reconnect to remove this nomination."); return; } throw e; }
  };
  const removeRef = async (name) => {
    try { await api.deleteRefRoster(eventId, name); setRefRoster((cur) => cur.filter((r) => r.name !== name)); }
    catch (e) { if (outbox.isOffline(e)) { alert("You're offline — reconnect to remove a ref."); return; } throw e; }
  };
  const loadFeedback = async () => {
    if (!adminUnlocked) return;
    try { setFeedback(await api.listFeedback(eventId)); } catch (e) { console.error("Feedback load failed", e); }
  };

  const submitFeedback = async (payload) => {
    return await api.submitFeedback(eventId, payload);
  };

  const deleteFeedbackSubmission = async (id) => {
    try {
      await api.deleteFeedback(id);
      setFeedback((cur) => cur.filter((x) => x.id !== id));
    } catch (e) {
      alert("Could not delete feedback: " + (e.message || e));
    }
  };

  const addFieldLog = async (entry) => {
    try {
      const saved = await api.addFieldLog(eventId, { ...entry, by: meName });
      setFieldLog((cur) => [saved, ...cur.filter((x) => x.id !== saved.id)]);
      return saved;
    } catch (e) {
      if (outbox.isOffline(e)) throw new Error("You're offline — reconnect to log this.");
      throw e;
    }
  };
  const removeFieldLog = async (id) => {
    try { await api.deleteFieldLog(id); setFieldLog((cur) => cur.filter((x) => x.id !== id)); }
    catch (e) { if (outbox.isOffline(e)) { alert("You're offline — reconnect to remove this."); return; } throw e; }
  };
  const saveEventContacts = async (contacts) => {
    try {
      const saved = await api.upsertEventSetting(eventId, "contact_directory", contacts, meName);
      setEventSettings((cur) => ({ ...cur, contact_directory: saved }));
    } catch (e) {
      if (outbox.isOffline(e)) { alert("You're offline — reconnect to update the contact directory."); return; }
      alert("Could not save contact directory: " + (e.message || e));
    }
  };
  const saveRoleAccessConfig = async (config) => {
    try {
      const saved = await api.upsertEventSetting(eventId, "role_access_codes", config, meName);
      const roleMap = { ref: "ref", judge: "judge", emcee: "emcee" };
      await Promise.all(Object.entries(roleMap).map(async ([key, serverRole]) => {
        const entry = config?.codes?.[key];
        const credentialName = `${key}_code`;
        if (entry?.hash) {
          await api.setEventAccessCredentialHash(eventId, credentialName, serverRole, entry.hash, !!entry.enabled);
        } else {
          await api.disableEventAccessCredential(eventId, credentialName).catch(() => {});
        }
      }));
      setEventSettings((cur) => ({ ...cur, role_access_codes: saved }));
      return saved;
    } catch (e) {
      if (outbox.isOffline(e)) throw new Error("Reconnect before changing event access codes.");
      throw e;
    }
  };

  const addElimMatch = async (m) => {
    try {
      await api.addMatch(eventId, m);
      const list = await api.listMatches(eventId);
      const map = {}; for (const x of list) map[x.id] = x; setMatches(map);
    } catch (e) {
      if (outbox.isOffline(e)) { alert("You're offline — reconnect to add this match."); return; }
      throw e;
    }
    setAddMatchOpen(false);
  };
  const importTeamsFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { rows, warnings } = parseTeamsFile(text, file.name);
      if (!rows.length) { alert("No teams found in that file.\n" + warnings.join("\n")); return; }
      const existingTeamsT = new Map(teams.map((t) => [t.number, t]));
      let newCount = 0, renamedCount = 0, unchangedCount = 0;
      for (const r of rows) {
        const current = existingTeamsT.get(r.number);
        if (!current) newCount++;
        else if (tmClean(current.name) !== tmClean(r.name)) renamedCount++;
        else unchangedCount++;
      }
      const chipsT = [
        { label: `${newCount} team${newCount === 1 ? "" : "s"} added` },
        { label: `${renamedCount} name${renamedCount === 1 ? "" : "s"} changed` },
        { label: `${unchangedCount} unchanged` },
        { label: `${Math.max(0, teams.length - rows.filter((r) => existingTeamsT.has(r.number)).length)} existing teams not in file remain untouched` },
      ];
      if (!(await confirmImport({ title: "Team list — change preview", chips: chipsT, warnings, noChanges: newCount === 0 && renamedCount === 0 }))) return;
      setImporting({ label: "Importing teams…", done: 0, total: 0 });
      await api.bulkUpsertTeams(eventId, rows);
      const t = await api.listTeams(eventId);
      setTeams((cur) => {
      const pending = cur.filter((x) => x._pending && !t.some((s) => s.number === x.number));
      return [...t, ...pending];
    });
      markTMSync("teams");
      alert(`Imported ${rows.length} teams.` + (warnings.length ? "\n\nNote:\n" + warnings.join("\n") : ""));
    } catch (e) {
      alert("Could not read that file: " + (e.message || e) + "\n\nExport the team list from Tournament Manager as CSV and try again.");
    } finally { setImporting(null); }
  };

  const importAlliancesFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        alert("That CSV does not contain any match rows.");
        return;
      }

      const parseCsvLine = (line) => {
        const cells = [];
        let cur = "", quoted = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
            else quoted = !quoted;
          } else if (ch === "," && !quoted) {
            cells.push(cur.trim());
            cur = "";
          } else cur += ch;
        }
        cells.push(cur.trim());
        return cells;
      };

      const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
      const col = (name) => header.indexOf(name.toLowerCase());

      const roundCol = col("Round");
      const instanceCol = col("Instance");
      const red1Col = col("Red1");
      const red2Col = col("Red2");
      const blue1Col = col("Blue1");
      const blue2Col = col("Blue2");
      const fieldCol = col("Field");
      const redScoreCol = col("RedScore");
      const blueScoreCol = col("BlueScore");
      const scoredCol = col("Scored");
      const winnerCol = col("Winner");

      const required = [
        ["Round", roundCol], ["Instance", instanceCol],
        ["Red1", red1Col], ["Red2", red2Col],
        ["Blue1", blue1Col], ["Blue2", blue2Col],
      ];
      const missing = required.filter(([, i]) => i < 0).map(([name]) => name);
      if (missing.length) {
        alert("Missing required Tournament Manager columns: " + missing.join(", "));
        return;
      }

      const cleanTeam = (v) => String(v || "").trim();
      const r16 = [];

      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        if (Number(cells[roundCol]) !== 6) continue;

        const instance = Number(cells[instanceCol]);
        if (!Number.isInteger(instance) || instance < 1 || instance > 8) continue;

        const red = [cleanTeam(cells[red1Col]), cleanTeam(cells[red2Col])].filter(Boolean);
        const blue = [cleanTeam(cells[blue1Col]), cleanTeam(cells[blue2Col])].filter(Boolean);

        r16.push({
          instance,
          red,
          blue,
          field: fieldCol >= 0 ? String(cells[fieldCol] || "").trim() : "",
          redScore: redScoreCol >= 0 && cells[redScoreCol] !== "" ? Number(cells[redScoreCol]) : null,
          blueScore: blueScoreCol >= 0 && cells[blueScoreCol] !== "" ? Number(cells[blueScoreCol]) : null,
          scored: scoredCol >= 0 ? String(cells[scoredCol] || "").toLowerCase() === "true" : false,
          winner: winnerCol >= 0 ? String(cells[winnerCol] || "").trim().toLowerCase() : "",
        });
      }

      r16.sort((a, b) => a.instance - b.instance);

      const instances = r16.map((m) => m.instance);
      const expected = [1,2,3,4,5,6,7,8];
      const validInstances = instances.length === 8 && expected.every((n, i) => instances[i] === n);

      if (!validInstances) {
        alert(
          "Expected exactly one Round 6 row for each Instance 1 through 8.\n\n" +
          "Found instances: " + (instances.join(", ") || "none") +
          "\n\nNo changes were made."
        );
        return;
      }

      // Tournament Manager R16 instance to alliance seed mapping.
      const seedPairs = {
        1: [1,16],
        2: [8,9],
        3: [4,13],
        4: [5,12],
        5: [2,15],
        6: [7,10],
        7: [3,14],
        8: [6,11],
      };

      const candidateAlliances = {};
      for (const m of r16) {
        const [redSeed, blueSeed] = seedPairs[m.instance];
        candidateAlliances[redSeed] = [...m.red];
        candidateAlliances[blueSeed] = [...m.blue];
      }
      let allianceChanged = 0, allianceUnchanged = 0, r16Added = 0, r16Changed = 0, r16Unchanged = 0;
      for (let seed = 1; seed <= 16; seed++) {
        if (tmSameTeams(alliances[seed] || [], candidateAlliances[seed] || [])) allianceUnchanged++;
        else allianceChanged++;
      }
      for (const m of r16) {
        const existing = matches[tmMatchKey("r16", m.instance)];
        if (!existing) r16Added++;
        else if (tmScheduleChanged(existing, m)) r16Changed++;
        else r16Unchanged++;
      }
      const allianceChips = [
        { label: `${allianceChanged} alliance${allianceChanged === 1 ? "" : "s"} changed` },
        { label: `${allianceUnchanged} alliances unchanged` },
        { label: `${r16Added} R16 match${r16Added === 1 ? "" : "es"} added` },
        { label: `${r16Changed} R16 match${r16Changed === 1 ? "" : "es"} changed` },
        { label: `${r16Unchanged} R16 unchanged` },
      ];
      if (!(await confirmImport({
        title: "Alliances & R16 — change preview",
        chips: allianceChips,
        warnings: ["Applying this import replaces the current R16 and all 16 alliance assignments with the Tournament Manager file."],
        noChanges: allianceChanged === 0 && r16Added === 0 && r16Changed === 0,
      }))) return;

      // Remove all previous R16 matches and alliance assignments first.
      for (let n = 1; n <= 64; n++) {
        try {
          await api.deleteMatch(eventId, "r16", n);
        } catch (e) {
          if (!outbox.isOffline(e)) throw e;
        }
      }
      await api.clearAlliances(eventId);

      const nextAlliances = {};

      for (let i = 0; i < r16.length; i++) {
        const m = r16[i];
        setImporting({ label: "Importing alliances…", done: i + 1, total: r16.length });
        await api.addMatch(eventId, {
          phase: "r16",
          num: m.instance,
          red: m.red,
          blue: m.blue,
          field: m.field,
          redScore: m.redScore,
          blueScore: m.blueScore,
          winner: m.winner === "red" || m.winner === "blue" ? m.winner : null,
          label: `R16 ${m.instance}`,
        });

        const [redSeed, blueSeed] = seedPairs[m.instance];
        nextAlliances[redSeed] = [...m.red];
        nextAlliances[blueSeed] = [...m.blue];

        await api.upsertAlliance(eventId, redSeed, m.red);
        await api.upsertAlliance(eventId, blueSeed, m.blue);
      }

      const savedAlliances = await api.listAlliances(eventId);
      const savedAllianceMap = {};
      for (const a of savedAlliances) savedAllianceMap[a.seed] = a.teams;
      setAlliances(savedAllianceMap);
      setAlliancesLoaded(true);
      await reloadMatches();

      markTMSync("alliances");
      alert("Imported exactly 8 Round of 16 matches and rebuilt all 16 alliances from the Tournament Manager CSV.");
    } catch (e) {
      alert("Could not import alliances: " + (e.message || e));
    } finally { setImporting(null); }
  };

  const importRankingsFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { rows, warnings } = parseRankingsFile(text, file.name);
      if (!rows.length) { alert("No rankings found in that file.\n" + warnings.join("\n")); return; }
      const teamMapR = new Map(teams.map((t) => [t.number, t]));
      let changedR = 0, unchangedR = 0, newRankR = 0, unknownR = 0;
      for (const r of rows) {
        const current = teamMapR.get(r.number);
        if (!current) { unknownR++; continue; }
        if (current.rank == null) newRankR++;
        else if (Number(current.rank) !== Number(r.rank)) changedR++;
        else unchangedR++;
      }
      const chipsR = [
        { label: `${newRankR} new ranking${newRankR === 1 ? "" : "s"}` },
        { label: `${changedR} ranking${changedR === 1 ? "" : "s"} changed` },
        { label: `${unchangedR} unchanged` },
        { label: `${unknownR} unknown team${unknownR === 1 ? "" : "s"}`, warn: unknownR > 0 },
      ];
      if (!(await confirmImport({ title: "Qualification rankings — change preview", chips: chipsR, warnings, noChanges: newRankR === 0 && changedR === 0 && unknownR === 0 }))) return;
      setImporting({ label: "Importing rankings…", done: 0, total: 0 });
      await api.bulkUpsertRankings(eventId, rows);
      const t = await api.listTeams(eventId);
      setTeams((cur) => { const pending = cur.filter((x) => x._pending && !t.some((serverTeam) => serverTeam.number === x.number)); return [...t, ...pending]; });
      markTMSync("rankings");
      alert(`Uploaded rankings for ${rows.length} teams.` + (warnings.length ? "\n\nNote:\n" + warnings.join("\n") : ""));
    } catch (e) {
      alert("Could not read that rankings file: " + (e.message || e) + "\n\nExport the rankings from Tournament Manager as CSV and try again.");
    } finally { setImporting(null); }
  };
  const importScoresFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();

      // Read TM CSV directly for elimination score updates so Round 6 +
      // Instance maps to the existing R16 match without replacing its teams.
      const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
      const parseCsvLine = (line) => {
        const cells = [];
        let cur = "", quoted = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
            else quoted = !quoted;
          } else if (ch === "," && !quoted) {
            cells.push(cur.trim());
            cur = "";
          } else cur += ch;
        }
        cells.push(cur.trim());
        return cells;
      };

      const header = lines.length ? parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase()) : [];
      const col = (name) => header.indexOf(name.toLowerCase());
      const roundCol = col("Round");
      const instanceCol = col("Instance");
      const redScoreCol = col("RedScore");
      const blueScoreCol = col("BlueScore");
      const scoredCol = col("Scored");

      const elimScoreRows = [];
      if (roundCol >= 0 && instanceCol >= 0 && redScoreCol >= 0 && blueScoreCol >= 0) {
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i]);
          const round = Number(cells[roundCol]);
          const instance = Number(cells[instanceCol]);
          const scoredFlag = scoredCol < 0 || String(cells[scoredCol] || "").trim().toLowerCase() === "true";

          if (round !== 6 || !Number.isInteger(instance) || instance < 1 || instance > 8 || !scoredFlag) continue;

          const redScore = Number(cells[redScoreCol]);
          const blueScore = Number(cells[blueScoreCol]);
          if (!Number.isFinite(redScore) || !Number.isFinite(blueScore)) continue;

          elimScoreRows.push({ instance, redScore, blueScore });
        }
      }

      if (elimScoreRows.length) {
        let scoreChangesE = 0, scoreUnchangedE = 0, scoreMissingE = 0;
        for (const r of elimScoreRows) {
          const current = matches[tmMatchKey("r16", r.instance)];
          const winner = tmScoreWinner(r.redScore, r.blueScore);
          if (!current) scoreMissingE++;
          else if (tmScoreChanged(current, r.redScore, r.blueScore, winner)) scoreChangesE++;
          else scoreUnchangedE++;
        }
        const scoreChipsE = [
          { label: `${scoreChangesE} score${scoreChangesE === 1 ? "" : "s"} updated` },
          { label: `${scoreUnchangedE} unchanged` },
          { label: `${scoreMissingE} missing R16 match${scoreMissingE === 1 ? "" : "es"}`, warn: scoreMissingE > 0 },
          { label: "alliance teams unchanged" },
        ];
        if (!(await confirmImport({ title: "Match results — change preview", chips: scoreChipsE, warnings: [], noChanges: scoreChangesE === 0 && scoreMissingE === 0 }))) return;

        for (let i = 0; i < elimScoreRows.length; i++) {
          const r = elimScoreRows[i];
          setImporting({ label: "Importing scores…", done: i + 1, total: elimScoreRows.length });
          const winner = r.redScore > r.blueScore ? "red" : r.blueScore > r.redScore ? "blue" : "tie";
          await api.updateMatchScore(eventId, "r16", r.instance, r.redScore, r.blueScore, winner);
        }

        await reloadMatches();
        markTMSync("scores");
        alert(`Updated scores for ${elimScoreRows.length} R16 matches. Alliance teams were left unchanged.`);
        return;
      }

      // No scored R16 rows were found, so use the normal qualification score import.
      const { rows } = parseMatchesFile(text, file.name);
      const scored = rows.filter((r) =>
        r.phase === "qual" &&
        r.scored &&
        r.redScore != null &&
        r.blueScore != null
      );

      if (!scored.length) {
        alert("No scored qualification or Round of 16 matches found in that file.");
        return;
      }

      const rosterS = new Set(teams.map((t) => t.number));
      const inFileS = new Set(); scored.forEach((r) => { (r.red || []).forEach((x) => inFileS.add(x)); (r.blue || []).forEach((x) => inFileS.add(x)); });
      let unknownS = 0; inFileS.forEach((x) => { if (!rosterS.has(x)) unknownS++; });
      let scoreChangesS = 0, scoreUnchangedS = 0, scoreNewMatchS = 0;
      for (const r of scored) {
        const current = matches[tmMatchKey(r.phase, r.num)];
        const winner = tmScoreWinner(r.redScore, r.blueScore);
        if (!current) scoreNewMatchS++;
        else if (tmScoreChanged(current, r.redScore, r.blueScore, winner)) scoreChangesS++;
        else scoreUnchangedS++;
      }
      const chipsS = [
        { label: `${scoreChangesS} score${scoreChangesS === 1 ? "" : "s"} updated` },
        { label: `${scoreNewMatchS} scored match${scoreNewMatchS === 1 ? "" : "es"} added` },
        { label: `${scoreUnchangedS} unchanged` },
        { label: `${unknownS} unknown team${unknownS === 1 ? "" : "s"}`, warn: unknownS > 0 },
      ];
      if (!(await confirmImport({ title: "Match results — change preview", chips: chipsS, warnings: [], noChanges: scoreChangesS === 0 && scoreNewMatchS === 0 && unknownS === 0 }))) return;

      for (let i = 0; i < scored.length; i++) {
        const r = scored[i];
        setImporting({ label: "Importing scores…", done: i + 1, total: scored.length });
        const winner = r.redScore > r.blueScore ? "red" : r.blueScore > r.redScore ? "blue" : "tie";
        await api.addMatch(eventId, {
          phase: r.phase,
          num: r.num,
          red: r.red,
          blue: r.blue,
          field: r.field,
          redScore: r.redScore,
          blueScore: r.blueScore,
          winner
        });
      }

      await reloadMatches();
      const newFromScores = [...inFileS].filter((x) => !rosterS.has(x)).map((number) => ({ number, name: "" }));
      if (newFromScores.length) { await api.bulkUpsertTeams(eventId, newFromScores); const t = await api.listTeams(eventId); setTeams((cur) => { const pending = cur.filter((x) => x._pending && !t.some((s) => s.number === x.number)); return [...t, ...pending]; }); }
      markTMSync("scores");
      alert(`Updated scores for ${scored.length} qualification matches. Team records refreshed.`);
    } catch (e) {
      alert("Could not read that file: " + (e.message || e) + "\n\nExport match results from Tournament Manager as CSV and try again.");
    } finally { setImporting(null); }
  };
  const importMatchesFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { rows, warnings } = parseMatchesFile(text, file.name);
      if (!rows.length) { alert("No matches found in that file.\n" + warnings.join("\n")); return; }
      const counts = rows.reduce((a, r) => { a[r.phase] = (a[r.phase] || 0) + 1; return a; }, {});
      const summary = Object.entries(counts).map(([p, n]) => `${n} ${p}`).join(", ");
      const roster = new Set(teams.map((t) => t.number));
      const inFile = new Set(); for (const r of rows) { (r.red || []).forEach((x) => inFile.add(x)); (r.blue || []).forEach((x) => inFile.add(x)); }
      let unknown = 0; inFile.forEach((x) => { if (!roster.has(x)) unknown++; });
      let addedMatches = 0, changedMatches = 0, unchangedMatches = 0;
      for (const r of rows) {
        const current = matches[tmMatchKey(r.phase, r.num)];
        if (!current) addedMatches++;
        else if (tmScheduleChanged(current, r)) changedMatches++;
        else unchangedMatches++;
      }
      const inFileKeys = new Set(rows.map((r) => tmMatchKey(r.phase, r.num)));
      const existingNotInFile = Object.values(matches).filter((m) => !inFileKeys.has(tmMatchKey(m.phase || "qual", m.num))).length;
      const chips = [
        { label: `${addedMatches} match${addedMatches === 1 ? "" : "es"} added` },
        { label: `${changedMatches} match${changedMatches === 1 ? "" : "es"} changed` },
        { label: `${unchangedMatches} unchanged` },
        { label: `${existingNotInFile} existing match${existingNotInFile === 1 ? "" : "es"} not in file remain untouched` },
        { label: `${unknown} unknown team${unknown === 1 ? "" : "s"}`, warn: unknown > 0 },
      ];
      if (!(await confirmImport({ title: "Match schedule — change preview", chips, warnings, noChanges: addedMatches === 0 && changedMatches === 0 && unknown === 0 }))) return;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        setImporting({ label: "Importing matches…", done: i + 1, total: rows.length });
        await api.addMatch(eventId, { phase: r.phase, num: r.num, red: r.red, blue: r.blue, field: r.field });
      }
      const newTeams = [...inFile].filter((x) => !roster.has(x)).map((number) => ({ number, name: "" }));
      if (newTeams.length) { await api.bulkUpsertTeams(eventId, newTeams); const t = await api.listTeams(eventId); setTeams((cur) => { const pending = cur.filter((x) => x._pending && !t.some((s) => s.number === x.number)); return [...t, ...pending]; }); }
      await reloadMatches();
      markTMSync("matches");
      alert(`Imported ${rows.length} matches (${summary}).` + (warnings.length ? "\n\nNote:\n" + warnings.join("\n") : ""));
    } catch (e) {
      alert("Could not read that file: " + (e.message || e) + "\n\nExport the match list from Tournament Manager as CSV and try again.");
    } finally { setImporting(null); }
  };
  const setAllianceTeam = async (seed, idx, team) => {
    const cur = alliances[seed] ? [...alliances[seed]] : ["", ""];
    cur[idx] = team;
    const teams = cur;
    setAlliances((a) => ({ ...a, [seed]: teams }));
    try { await api.upsertAlliance(eventId, seed, teams.filter(Boolean).length ? teams : []); }
    catch (e) { if (!outbox.isOffline(e)) throw e; }
  };
  const clearAlliances = async () => {
    await api.clearAlliances(eventId); setAlliances({});
  };
  const reloadMatches = async () => {
    const list = await api.listMatches(eventId);
    const map = {}; for (const x of list) map[x.id] = x; setMatches(map); return map;
  };
  const winnerTeams = (m) => (m && m.winner ? (m.winner === "red" ? m.red : m.blue) : null);
  const advanceBracket = async (map) => {
    const get = (phase, num) => map[`${phase}-${num}`];
    const toCreate = [];
    const push = (phase, num, red, blue, label) => {
      const ex = get(phase, num);
      toCreate.push({ phase, num, red, blue, label, field: (ex && ex.field) || "" });
    };
    for (let i = 1; i <= 4; i++) { const w1 = winnerTeams(get("r16", 2 * i - 1)), w2 = winnerTeams(get("r16", 2 * i)); if (w1 && w2) push("qf", i, w1, w2, `QF ${i}`); }
    for (let i = 1; i <= 2; i++) { const w1 = winnerTeams(get("qf", 2 * i - 1)), w2 = winnerTeams(get("qf", 2 * i)); if (w1 && w2) push("sf", i, w1, w2, `SF ${i}`); }
    { const w1 = winnerTeams(get("sf", 1)), w2 = winnerTeams(get("sf", 2)); if (w1 && w2) for (let g = 1; g <= 3; g++) push("final", g, w1, w2, `Final ${g}`); }
    if (toCreate.length) { for (const mm of toCreate) await api.addMatch(eventId, mm); await reloadMatches(); }
  };
  const setMatchWinner = async (m, winner) => {
    const next = m.winner === winner ? "" : winner; // tapping the current winner clears it
    try {
      await api.setMatchWinner(eventId, m.phase, m.num, next);
    } catch (e) {
      if (outbox.isOffline(e)) { alert("You're offline — reconnect to set the match winner."); return; }
      throw e;
    }
    const map = { ...matches, [m.id]: { ...m, winner: next } };
    setMatches(map);
    try {
      await advanceBracket(map);
    } catch (e) {
      if (outbox.isOffline(e)) { alert("Winner saved, but you went offline before the next round could be created — reconnect and tap the winner again to advance the bracket."); return; }
      throw e;
    }
  };
  // 16-alliance single-elimination Round of 16 seeding (higher seed = red)
  const ELIM16 = [[1, 16], [8, 9], [5, 12], [4, 13], [3, 14], [6, 11], [7, 10], [2, 15]];
  const finalizeAlliances = async () => {
    const complete = ELIM16.every(([a, b]) => (alliances[a] || []).filter(Boolean).length && (alliances[b] || []).filter(Boolean).length);
    if (!complete) { alert("Every alliance (seeds 1–16) needs at least one team before finalizing."); return; }
    const existingElims = Object.values(matches).some((m) => m.phase === "r16");
    if (existingElims && !confirm("Round-of-16 matches already exist. Re-create them from the current alliances? (Existing R16 matches will be overwritten.)")) return;
    if (!confirm("Generate the Round of 16 from these 16 alliances?")) return;
    try {
      for (let i = 0; i < ELIM16.length; i++) {
        const [hi, lo] = ELIM16[i];
        await api.addMatch(eventId, {
          phase: "r16", num: i + 1,
          red: (alliances[hi] || []).filter(Boolean),
          blue: (alliances[lo] || []).filter(Boolean),
          label: `R16 ${i + 1} — A${hi} vs A${lo}`,
        });
      }
      const list = await api.listMatches(eventId);
      const map = {}; for (const x of list) map[x.id] = x; setMatches(map);
    } catch (e) {
      if (outbox.isOffline(e)) { alert("You're offline — the Round of 16 wasn't fully created. Reconnect and tap Finalize again to rebuild it."); return; }
      throw e;
    }
    setView("matches");
    alert("Round of 16 created. Open the Matches tab → Eliminations to see them. Add QF/SF/Final as each round's winners are known.");
  };
  const toggleFinalist = async (award, team) => {
    const key = `${award}::${team}`;
    const on = !finalists.has(key);
    setFinalists((cur) => { const n = new Set(cur); on ? n.add(key) : n.delete(key); return n; });
    try { await api.setShortlist(eventId, award, team, on); }
    catch (e) {
      setFinalists((cur) => { const n = new Set(cur); on ? n.delete(key) : n.add(key); return n; });
      if (outbox.isOffline(e)) alert("You're offline — reconnect to change finalists."); else throw e;
    }
  };
  const exportNominations = async () => {
    if (!noms.length) { alert("There are no nominations to export."); return; }

    const sorted = [...noms].sort((a, b) =>
      a.award.localeCompare(b.award) ||
      a.team.localeCompare(b.team, undefined, { numeric: true }) ||
      a.createdAt - b.createdAt
    );

    try {
      const [energyBytes, sportsmanshipBytes] = await Promise.all([
        fetch("/forms/energy-award-nomination.pdf").then((r) => {
          if (!r.ok) throw new Error("Energy Award PDF template could not be loaded.");
          return r.arrayBuffer();
        }),
        fetch("/forms/sportsmanship-award-nomination.pdf").then((r) => {
          if (!r.ok) throw new Error("Sportsmanship Award PDF template could not be loaded.");
          return r.arrayBuffer();
        }),
      ]);

      const output = await PDFDocument.create();
      const font = await output.embedFont(StandardFonts.Helvetica);
      const bold = await output.embedFont(StandardFonts.HelveticaBold);

      const wrap = (text, maxWidth, size, useFont = font) => {
        const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
        const lines = [];
        let line = "";
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (useFont.widthOfTextAtSize(test, size) <= maxWidth) line = test;
          else {
            if (line) lines.push(line);
            line = word;
          }
        }
        if (line) lines.push(line);
        return lines;
      };

      const drawWrapped = (page, text, x, y, width, size = 9, lineHeight = 13, maxLines = 4) => {
        const lines = wrap(text, width, size).slice(0, maxLines);
        lines.forEach((line, i) => page.drawText(line, { x, y: y - i * lineHeight, size, font, color: rgb(0, 0, 0) }));
      };

      const fmtDate = (value) => {
        const d = new Date(value || Date.now());
        return d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" });
      };

      for (let i = 0; i < sorted.length; i++) {
        const n = sorted[i];
        const isEnergy = n.award === "energy";
        const templateBytes = isEnergy ? energyBytes : sportsmanshipBytes;
        const template = await PDFDocument.load(templateBytes);
        const [page] = await output.copyPages(template, [0]);
        output.addPage(page);

        // Header fields (measured coordinates; energy/sports differ by ~1pt, negligible).
        page.drawText(String(event.name || "The Highlander Summit Signature Event"), { x: 116, y: 650, size: 9, font });
        page.drawText(fmtDate(n.createdAt), { x: 434, y: 650, size: 9, font });
        page.drawText(String(n.by || ""), { x: 188, y: 625, size: 9, font });
        page.drawText(String(n.team || ""), { x: 472, y: 625, size: 9.5, font: bold });

        // Check the same observed criteria selected in Ref OS.
        const selected = new Set(n.criteria || []);
        const criteria = (AWARDS.find((a) => a.key === n.award)?.criteria || []);
        const checkYs = isEnergy
          ? [562.8, 541.7, 520.6, 499.5, 478.4, 457.3]
          : [564.2, 543.1, 522.0, 500.8];
        criteria.forEach((criterion, idx) => {
          if (!selected.has(criterion) || checkYs[idx] == null) return;
          page.drawText("X", { x: 56, y: checkYs[idx], size: 9, font: bold, color: rgb(0, 0, 0) });
        });

        // The app's reason maps to "Specific Example Observed" (answer lines are ~21pt apart).
        drawWrapped(page, n.reason || "", 42, isEnergy ? 413.5 : 457.5, 531, 9, 21, 4);

        // The app already stores a separate where/when field.
        const where = n.whereWhen || (fmtMatch(n.match) ? fmtMatch(n.match) : "");
        drawWrapped(page, where, 42, isEnergy ? 305.5 : 348.5, 531, 9, 21, 3);
      }

      const bytes = await output.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(event.name || "vex").replace(/\W+/g, "-").toLowerCase()}-award-nominations.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setMenu(false);
    } catch (e) {
      console.error(e);
      alert("Could not export nomination PDF: " + (e.message || e));
    }
  };
  const clearSelected = async (sel) => {
    try {
      if (sel.violations) { await api.clearViolations(eventId); setViols([]); }
      if (sel.replays) {
        const ids = fieldLog.filter((e) => e.kind === "replay").map((e) => e.id);
        for (const id of ids) await api.deleteFieldLog(id);
        setFieldLog((cur) => cur.filter((e) => e.kind !== "replay"));
      }
      if (sel.teams) { await api.clearTeams(eventId); setTeams([]); }
      if (sel.schedule) { await api.clearMatches(eventId); setMatches({}); await api.clearRankings(eventId); setTeams((cur) => cur.map((t) => ({ ...t, rank: null }))); }
      if (sel.judging) { await api.clearJudging(eventId); setNoms([]); setFinalists(new Set()); }
      if (sel.alliances) { await api.clearAlliances(eventId); setAlliances({}); setAlliancesLoaded(true); }
      if (sel.watchlist) { await api.clearWatchNotes(eventId); setWatchNotes([]); }
    } catch (e) {
      if (outbox.isOffline(e)) { alert("You're offline — reconnect to clear."); return; }
      throw e;
    }
    if (sel.teams) setOpenTeam(null);
    if (sel.schedule) setOpenMatch(null);
    setShowClear(false); setMenu(false);
  };

  const countsByTeam = useMemo(() => {
    const m = {};
    for (const v of viols) { m[v.team] = m[v.team] || { total: 0, minor: 0, major: 0, inspection: 0 }; m[v.team].total++; m[v.team][v.type]++; }
    return m;
  }, [viols]);
  const knownRules = useMemo(() => {
    const m = {}; for (const v of viols) if (v.code && !m[v.code]) m[v.code] = v.desc || ""; return m;
  }, [viols]);
  const teamNameMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.number, t.name])), [teams]);
  const teamRankMap = useMemo(() => Object.fromEntries(teams.filter((t) => t.rank != null).map((t) => [t.number, t.rank])), [teams]);
  const rankedTeamsForAlliance = useMemo(() =>
    [...teams]
      .filter((t) => t.rank != null && Number(t.rank) > 0)
      .sort((a, b) => Number(a.rank) - Number(b.rank))
      .map((t) => t.number),
    [teams]
  );

  // VEX alliance selection behavior:
  // A higher seeded alliance may select a lower ranked team that is currently
  // listed as a future captain. Once selected, that team leaves the captain
  // pool and the remaining ranked teams shift upward automatically.
  useEffect(() => {
    if (!eventId || !alliancesLoaded || !rankedTeamsForAlliance.length) return;

    // Once an R16 bracket exists, Tournament Manager is the source of truth
    // for alliance membership. Never let ranking-based captain logic rewrite
    // uploaded alliance captains or first picks.
    const hasR16Bracket = Object.values(matches).some((m) => m.phase === "r16");
    if (hasR16Bracket) return;

    const completeAllianceCount = Array.from({ length: 16 }, (_, i) => i + 1)
      .filter((seed) => (alliances[seed] || []).filter(Boolean).length >= 2).length;
    if (completeAllianceCount === 16) return;

    const selectedFirstPicks = new Set(
      Object.values(alliances)
        .map((a) => (a || [])[1])
        .filter(Boolean)
    );

    const captainPool = rankedTeamsForAlliance.filter((team) => !selectedFirstPicks.has(team));
    const next = { ...alliances };
    let changed = false;
    const updates = [];

    for (let seed = 1; seed <= 16; seed++) {
      const captain = captainPool[seed - 1] || "";
      const cur = next[seed] ? [...next[seed]] : ["", ""];
      const firstPick = cur[1] || "";
      const desired = [captain, firstPick];

      if ((cur[0] || "") !== desired[0] || (cur[1] || "") !== desired[1]) {
        next[seed] = desired;
        changed = true;
        updates.push([seed, desired]);
      }
    }

    if (!changed) return;
    setAlliances(next);

    for (const [seed, teamsForSeed] of updates) {
      api.upsertAlliance(eventId, seed, teamsForSeed.filter(Boolean)).catch((e) => {
        if (!outbox.isOffline(e)) console.error("Could not sync ranked alliance captain", e);
      });
    }
  }, [eventId, alliancesLoaded, rankedTeamsForAlliance.join("|"), Object.values(matches).map((m) => `${m.phase}:${m.num}`).join("|"), Object.values(alliances).map((a) => (a || [])[1] || "").join("|")]);

  const teamRecords = useMemo(() => {
    const rec = {};
    const bump = (team, k) => { const x = rec[team] = rec[team] || { w: 0, l: 0, t: 0 }; x[k]++; };
    for (const m of Object.values(matches)) {
      if (m.phase !== "qual") continue; // W-L-T is the qualification record
      let result = null;
      if (m.winner === "red" || m.winner === "blue" || m.winner === "tie") result = m.winner;
      else if (m.redScore != null && m.blueScore != null) result = m.redScore > m.blueScore ? "red" : m.blueScore > m.redScore ? "blue" : "tie";
      if (!result) continue;
      for (const t of (m.red || [])) bump(t, result === "red" ? "w" : result === "blue" ? "l" : "t");
      for (const t of (m.blue || [])) bump(t, result === "blue" ? "w" : result === "red" ? "l" : "t");
    }
    return rec;
  }, [matches]);
  const teamWatch = useMemo(() => {
    const m = {};
    for (const w of watchNotes) { (m[w.team] = m[w.team] || []).push(w); }
    for (const k in m) m[k].sort((a, b) => a.createdAt - b.createdAt);
    return m;
  }, [watchNotes]);
  const matchNums = useMemo(() => Object.keys(matches), [matches]);

  const backupAll = () => {
    const snapshot = {
      app: "Ref-OS",
      exportedAt: new Date().toISOString(),
      event: { id: eventId, name: event.name || "", ...event },
      counts: { teams: teams.length, violations: viols.length, nominations: noms.length, matches: Object.keys(matches).length, watchNotes: watchNotes.length, fieldLog: fieldLog.length },
      teams,
      matches: Object.values(matches),
      violations: viols,
      nominations: noms,
      finalists: Array.from(finalists),
      watchNotes,
      fieldLog,
      eventSettings,
      failedSyncItems,
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.download = `${(event.name || "vex").replace(/\W+/g, "-").toLowerCase()}-backup-${stamp}.json`;
    a.click(); setMenu(false);
  };

  const sendAnnouncement = async (message) => {
    const entry = await api.addFieldLog(eventId, { kind: "announcement", note: message, by: meName });
    setFieldLog((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)]);
  };

  const deleteAnnouncementForAll = async (id) => {
    await api.deleteFieldLog(id);
    setFieldLog((prev) => prev.filter((e) => e.id !== id));
  };

  const clearAnnouncementsForAll = async () => {
    const entries = fieldLog.filter((e) => e.kind === "announcement");
    await Promise.all(entries.map((e) => api.deleteFieldLog(e.id)));
    setFieldLog((prev) => prev.filter((e) => e.kind !== "announcement"));
  };

  const saveSharedCountdown = async (value) => {
    const saved = await api.upsertEventSetting(eventId, "event_countdown", value, meName);
    setEventSettings((cur) => ({ ...cur, event_countdown: saved }));
    setShowCountdownSetup(false);
  };

  const clearSharedCountdown = async () => {
    await api.deleteEventSetting(eventId, "event_countdown");
    setEventSettings((cur) => {
      const next = { ...cur };
      delete next.event_countdown;
      return next;
    });
    setShowCountdownSetup(false);
  };

  const exportEventReport = async () => {
    try {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const pageSize = [612, 792];
      let page = pdf.addPage(pageSize);
      let y = 744;

      const newPage = () => { page = pdf.addPage(pageSize); y = 744; };
      const ensure = (need = 28) => { if (y < 48 + need) newPage(); };
      const line = (text, size = 10, isBold = false, indent = 0) => {
        ensure(size + 8);
        const clean = String(text ?? "").replace(/\s+/g, " ").trim();
        const maxWidth = 530 - indent;
        const f = isBold ? bold : font;
        let s = size;
        while (s > 7 && f.widthOfTextAtSize(clean, s) > maxWidth) s -= 0.5;
        let shown = clean;
        while (shown.length > 1 && f.widthOfTextAtSize(shown, s) > maxWidth) shown = shown.slice(0, -1);
        if (shown !== clean) shown = shown.slice(0, -3) + "...";
        page.drawText(shown, { x: 41 + indent, y, size: s, font: f, color: rgb(0,0,0) });
        y -= size + 7;
      };
      const section = (title) => { ensure(36); y -= 5; line(title, 14, true); };

      line(event.name || "Ref OS Event Report", 20, true);
      line(`Generated ${new Date().toLocaleString()}`, 9);
      y -= 8;

      const matchList = Object.values(matches);
      const quals = matchList.filter((m) => (m.phase || "qual") === "qual");
      const elims = matchList.filter((m) => m.phase && m.phase !== "qual");
      const majors = viols.filter((v) => v.type === "major").length;
      const minors = viols.filter((v) => v.type === "minor").length;
      const inspections = viols.filter((v) => v.type === "inspection").length;
      const replays = fieldLog.filter((e) => e.kind === "replay").length;
      const faults = fieldLog.filter((e) => e.kind === "field_fault").length;
      const awpEntries = fieldLog.filter((e) => e.kind === "awp");
      const awpSides = awpEntries.flatMap((e) => [parseAwpSide(e.note, "Red"), parseAwpSide(e.note, "Blue")]).filter(Boolean);
      const awpMet = awpSides.filter((a) => a.met).length;
      const awpRate = awpSides.length ? Math.round(awpMet / awpSides.length * 100) : 0;

      section("Event overview");
      line(`Teams: ${teams.length}`);
      line(`Matches loaded: ${matchList.length} (${quals.length} qualifications, ${elims.length} eliminations)`);
      line(`Violations logged: ${viols.length} (${majors} major, ${minors} minor, ${inspections} inspection)`);
      line(`AWP checks saved: ${awpEntries.length} (${awpRate}% alliance success)`);
      line(`Replays: ${replays}   Field faults: ${faults}`);
      line(`Judging nominations: ${noms.length}   Finalists: ${finalists.size}`);
      line(`Alliance selections entered: ${Object.values(alliances).filter((a) => (a || []).filter(Boolean).length).length}`);

      section("AWP analytics");
      line(`Overall alliance AWP success: ${awpMet}/${awpSides.length} (${awpRate}%)`);
      for (const [label, key] of [["Pins","pinsMet"],["Goals","goalsMet"],["Off perimeter","perimeterMet"],["No auton violations","noViolationsMet"]]) {
        const met = awpSides.filter((a) => a[key]).length;
        line(`${label}: ${met}/${awpSides.length} met (${awpSides.length ? Math.round(met/awpSides.length*100) : 0}%)`, 10, false, 10);
      }

      section("Field comparison");
      const fields = [...new Set(matchList.map((m) => m.field).filter(Boolean))].sort();
      if (!fields.length) line("No field assignments are loaded.");
      for (const field of fields) {
        const fm = matchList.filter((m) => m.field === field);
        const ids = new Set(fm.map((m) => m.id));
        const refs = new Set(fm.map((m) => m.phase === "qual" ? `Q${m.num}` : fmtMatch({phase:m.phase,num:m.num})));
        const vc = viols.filter((v) => v.match && v.match.num != null && refs.has(v.match.phase === "qual" ? `Q${v.match.num}` : fmtMatch(v.match))).length;
        const rp = fieldLog.filter((e) => e.kind === "replay" && ((e.matchId && ids.has(e.matchId)) || (e.matchRef && refs.has(e.matchRef)))).length;
        const ff = fieldLog.filter((e) => e.kind === "field_fault" && ((e.matchId && ids.has(e.matchId)) || (e.matchRef && refs.has(e.matchRef)))).length;
        line(`${field}: ${fm.length} matches, ${vc} violations, ${rp} replays, ${ff} field faults`);
      }

      section("Violation summary");
      const ruleCounts = {};
      viols.forEach((v) => { const k = v.code ? fmtRule(v.code) : "No rule"; ruleCounts[k] = (ruleCounts[k] || 0) + 1; });
      const rulesTop = Object.entries(ruleCounts).sort((a,b) => b[1]-a[1]);
      if (!rulesTop.length) line("No violations logged.");
      rulesTop.forEach(([rule,count]) => line(`${rule}: ${count}`, 10, false, 10));

      section("Alliance selections");
      const allianceRows = Object.entries(alliances).sort((a,b) => Number(a[0])-Number(b[0]));
      if (!allianceRows.length) line("No alliances entered.");
      allianceRows.forEach(([seed, arr]) => line(`A${seed}: ${(arr || []).filter(Boolean).join(" + ") || "Not set"}`, 10, false, 10));

      section("Judging");
      line(`Nominations recorded: ${noms.length}`);
      line(`Finalist selections: ${finalists.size}`);
      const awardCounts = {};
      noms.forEach((n) => { const k = n.award || "Unspecified"; awardCounts[k] = (awardCounts[k] || 0) + 1; });
      Object.entries(awardCounts).sort((a,b)=>b[1]-a[1]).forEach(([award,count]) => line(`${award}: ${count} nominations`, 10, false, 10));

      const bytes = await pdf.save();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      a.download = `${(event.name || "ref-os").replace(/\W+/g, "-").toLowerCase()}-event-report.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setMenu(false);
    } catch (e) {
      console.error(e);
      alert("Could not generate event report: " + (e.message || e));
    }
  };

  const exportCSV = async () => {
    if (!viols.length) {
      alert("There are no violations to export.");
      return;
    }

    try {
      const templateBytes = await fetch("/forms/match-anomaly-log.pdf").then((r) => {
        if (!r.ok) throw new Error("Match Anomaly Log PDF template could not be loaded.");
        return r.arrayBuffer();
      });

      const pdf = await PDFDocument.load(templateBytes);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

      // Team placement is fixed by the supplied 12-page Match Anomaly Log.
      const pageTeams = [
        ["37S","88S","96Z","119B","119P","119X","169A","169C","169R"],
        ["169X","197E","197G","255H","293Z","295A","295Y","1028A","1281A"],
        ["1523A","1584A","1698A","1755N","1769A","1862A","1862X","2145V","2145X"],
        ["2145Y","2145Z","2429A","2498B","2502A","2502V","2523A","2523V","2627E"],
        ["2702R","2982A","2982B","2982X","2982Z","3150Z","3151X","3760X","3866F"],
        ["4478N","4610J","4610P","4610S","4610T","4610W","4610Z","5150D","5249Z"],
        ["7405A","7405B","7405C","7405M","8737M","9039J","9364E","9909D","9909M"],
        ["10702X","11753A","11753B","12125A","12914X","12914Y","16099A","16099B","16099C"],
        ["16099D","16099E","16689A","16689G","20850G","20850T","20850V","20850W","20850X"],
        ["20850Z","25335A","26767P","48730A","59218C","62880A","62880C","62880D","62880E"],
        ["66300A","66556Z","81390E","88288A","90110X","91725A","93375B","96138A","96138E"],
        ["96138X","99209X"],
      ];

      const teamLocation = new Map();
      pageTeams.forEach((teamsOnPage, pageIndex) => {
        teamsOnPage.forEach((team, rowIndex) => teamLocation.set(team, { pageIndex, rowIndex }));
      });

      const byTeam = {};
      for (const v of [...viols].sort((a, b) => a.createdAt - b.createdAt)) {
        (byTeam[v.team] = byTeam[v.team] || []).push(v);
      }

      const fitText = (text, maxWidth, maxLines, startSize = 6.2, minSize = 4.3) => {
        const clean = String(text || "").replace(/\s+/g, " ").trim();
        if (!clean) return { size: startSize, lines: [] };

        const wrapAt = (size) => {
          const words = clean.split(" ");
          const lines = [];
          let line = "";
          for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(test, size) <= maxWidth) {
              line = test;
            } else {
              if (line) lines.push(line);
              line = word;
            }
          }
          if (line) lines.push(line);
          return lines;
        };

        for (let size = startSize; size >= minSize; size -= 0.25) {
          const lines = wrapAt(size);
          if (lines.length <= maxLines) return { size, lines };
        }

        const size = minSize;
        const lines = wrapAt(size);
        if (lines.length <= maxLines) return { size, lines };

        const kept = lines.slice(0, maxLines);
        let last = kept[maxLines - 1] || "";
        while (last && font.widthOfTextAtSize(last + "...", size) > maxWidth) {
          last = last.slice(0, -1);
        }
        kept[maxLines - 1] = last + "...";
        return { size, lines: kept };
      };

      const drawBlock = (page, text, x, topY, width, maxLines = 4, startSize = 6.2) => {
        const fitted = fitText(text, width, maxLines, startSize);
        const gap = 11.9;
        fitted.lines.forEach((line, i) => {
          page.drawText(line, {
            x,
            y: topY - i * gap,
            size: fitted.size,
            font,
            color: rgb(0, 0, 0),
          });
        });
      };

      const violationResult = (v) => {
        if (v.type === "major") return "Major";
        if (v.type === "minor") return "Minor";
        if (v.type === "inspection") return "Inspection";
        return TYPES[v.type]?.label || v.type || "";
      };

      const detailFor = (v) => {
        const matchLabel = fmtMatch(v.match) || "No match";
        const rule = v.code ? fmtRule(v.code) : "";
        const note = (v.notes || v.desc || "").replace(/\s+/g, " ").trim();
        return [matchLabel, rule, note, violationResult(v)].filter(Boolean).join(" | ");
      };

      const pages = pdf.getPages();

      const fitSingleLine = (text, maxWidth, startSize = 6.4, minSize = 4.4) => {
        const clean = String(text || "").replace(/\s+/g, " ").trim();
        if (!clean) return { text: "", size: startSize };

        for (let size = startSize; size >= minSize; size -= 0.2) {
          if (font.widthOfTextAtSize(clean, size) <= maxWidth) return { text: clean, size };
        }

        let clipped = clean;
        while (clipped.length > 1 && font.widthOfTextAtSize(clipped + "...", minSize) > maxWidth) {
          clipped = clipped.slice(0, -1);
        }
        return { text: clipped + "...", size: minSize };
      };

      const drawCentered = (page, text, left, right, y, startSize = 6.4) => {
        const fitted = fitSingleLine(text, right - left - 6, startSize, 4.8);
        if (!fitted.text) return;
        const width = font.widthOfTextAtSize(fitted.text, fitted.size);
        page.drawText(fitted.text, {
          x: left + ((right - left) - width) / 2,
          y,
          size: fitted.size,
          font,
          color: rgb(0, 0, 0),
        });
      };

      for (const [team, entries] of Object.entries(byTeam)) {
        const loc = teamLocation.get(team);
        if (!loc || !pages[loc.pageIndex]) continue;

        const page = pages[loc.pageIndex];

        // The supplied form has four ruled lines per team.
        // PDF coordinates are calibrated to the printed grid:
        // Major(s) 105.29-214.30, Minor(s) 214.30-323.33,
        // details begin just inside the 323.33 divider.
        const firstLineY = 535.2 - loc.rowIndex * 48.22;
        const lineGap = 12.05;
        const visible = entries.slice(0, 4);

        visible.forEach((v, entryIndex) => {
          const y = firstLineY - entryIndex * lineGap;
          const ruleText = v.code ? fmtRule(v.code) : "";

          if (v.type === "major") {
            drawCentered(page, ruleText || "Major", 105.29, 214.30, y, 6.3);
          } else if (v.type === "minor") {
            drawCentered(page, ruleText || "Minor", 214.30, 323.33, y, 6.3);
          }

          let detail = detailFor(v);
          if (entryIndex === 3 && entries.length > 4) {
            detail += ` | +${entries.length - 4} more`;
          }

          const fitted = fitSingleLine(detail, 759.39 - 327.5 - 5, 6.15, 4.35);
          if (fitted.text) {
            page.drawText(fitted.text, {
              x: 327.5,
              y,
              size: fitted.size,
              font,
              color: rgb(0, 0, 0),
            });
          }
        });
      }

      // Warn if Ref-OS contains a team that is not present on this specific template.
      const missingTeams = Object.keys(byTeam).filter((team) => !teamLocation.has(team));

      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(event.name || "vex").replace(/\W+/g, "-").toLowerCase()}-match-anomaly-log.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setMenu(false);

      if (missingTeams.length) {
        alert(
          `The PDF was exported, but ${missingTeams.length} team${missingTeams.length === 1 ? "" : "s"} are not printed on this Match Anomaly Log template: ${missingTeams.join(", ")}`
        );
      }
    } catch (e) {
      console.error(e);
      alert("Could not export Match Anomaly Log PDF: " + (e.message || e));
    }
  };


  const connectionHealth = !online
    ? { label: queuedWrites > 0 ? `Offline • ${queuedWrites} saved locally` : "Offline • local mode", tone: "amber", icon: "offline" }
    : syncing
      ? { label: "Ref OS Cloud • Syncing", tone: "blue", icon: "sync" }
      : cloudReachable === false
        ? { label: "Ref OS Cloud • Unavailable", tone: "red", icon: "offline" }
        : cloudReachable === null
          ? { label: "Ref OS Cloud • Checking", tone: "slate", icon: "sync" }
          : queuedWrites > 0
            ? { label: `Ref OS Cloud • ${queuedWrites} queued`, tone: "amber", icon: "sync" }
            : { label: "Ref OS Cloud • Connected", tone: "green", icon: "cloud" };

  if (!ready) return <FullPage>Loading event…</FullPage>;

  const filteredTeams = teams
    .filter((t) => { const q = query.trim().toLowerCase(); return !q || t.number.toLowerCase().includes(q) || (t.name || "").toLowerCase().includes(q); })
    .sort((a, b) => (countsByTeam[b.number]?.total || 0) - (countsByTeam[a.number]?.total || 0)
      || a.number.localeCompare(b.number, undefined, { numeric: true }));

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-700 font-sans text-slate-800 dark:text-slate-100 antialiased">
      <header className="sticky top-0 z-20 bg-[#0D0F32] text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {(openTeam || openMatch || openRobot) ? (
            <button onClick={() => { setOpenTeam(null); setOpenMatch(null); setOpenRobot(null); }} className="p-1 -ml-1 rounded hover:bg-white/10"><ChevronLeft size={22} /></button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <img src="/logo.svg" alt="Highlander Summit" className="h-9 w-9 object-contain" />
              <div className="leading-tight hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <div className="font-bold text-[13px] text-white">Ref-OS</div>
                  <span className="rounded-full border border-amber-300/50 bg-amber-400/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-200">Private Beta</span>
                </div>
                <div className="text-[9px] text-slate-400">Referee Operating System</div>
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5 flex-wrap">
              <h1 className="font-bold tracking-tight leading-tight text-[15px] sm:text-base line-clamp-2">{event?.name || "Violation Log"}</h1>
              <button
                onClick={() => adminUnlocked && setShowDiagnosticReport(true)}
                title={adminUnlocked ? "Open Admin Diagnostics" : connectionHealth.label}
                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${
                  connectionHealth.tone === "green" ? "text-emerald-300 bg-emerald-900/40" :
                  connectionHealth.tone === "blue" ? "text-sky-300 bg-sky-900/40" :
                  connectionHealth.tone === "red" ? "text-red-300 bg-red-900/40" :
                  connectionHealth.tone === "amber" ? "text-amber-300 bg-amber-900/40" :
                  "text-slate-300 bg-slate-700/60"
                } ${adminUnlocked ? "hover:ring-1 hover:ring-white/30" : "cursor-default"}`}
              >
                {connectionHealth.icon === "cloud" ? <Cloud size={10} /> : connectionHealth.icon === "sync" ? <RefreshCw size={10} className={syncing ? "animate-spin" : ""} /> : <CloudOff size={10} />}
                {connectionHealth.label}
              </button>
            </div>
            <button onClick={() => { refresh(); doFlush(); }} className="text-[11px] text-slate-400 leading-tight mt-0.5 flex items-center gap-1 hover:text-slate-200">
              <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
              {teams.length} teams · {viols.length} violations · synced {ago(syncedAt)}
            </button>
          </div>
          <OnlineCluster presence={presence} onClick={() => setShowOnline(true)} />
          {!isJudge && !isEmcee && <button onClick={() => setShowByRule(true)} title="By rule" className="p-1.5 rounded hover:bg-white/10"><BarChart3 size={18} /></button>}
          <button onClick={() => setShowIdentity(true)} title="Your full name"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-full pl-1 pr-2.5 py-1">
            <span className="w-6 h-6 rounded-full bg-[#D7212B] text-white text-[11px] font-bold grid place-items-center">{meName ? initials(meName) : "?"}</span>
            <span className="text-xs font-medium max-w-[70px] truncate">{meName || "Set name"}</span>
          </button>
          <div className="relative">
            <button aria-label="Settings" onClick={() => setMenu((m) => !m)} className="p-1.5 rounded hover:bg-white/10"><Settings size={19} /></button>
            {menu && (
              <div ref={menuRef} className="refos-menu-pop absolute right-0 mt-2 w-56 max-h-[75vh] overflow-y-auto overscroll-contain bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 text-sm">
                {isJudge ? (
                  <>
                    <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400 flex items-center gap-1.5"><Trophy size={12} /> Judge Advisor</div>
                    <button onClick={() => { setMenu(false); exportNominations(); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Download size={16} /> Export nominations</button>
                    <button onClick={() => { setMenu(false); setShowIdentity(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><UserCircle2 size={16} /> Change name</button>
<button onClick={onToggleTheme} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light Mode" : "Dark Mode"}</button>
<button onClick={onCycleTextSize} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Type size={16} /> Text Size: {textScale === "large" ? "Large" : textScale === "xl" ? "Extra large" : "Normal"}</button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={() => { setMenu(false); setShowFieldLog(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Flag size={16} /> Field Log</button>
                {isAndroid && !isInstalled && <button onClick={() => { setMenu(false); installRefOS(); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Download size={16} /> Install app</button>}
                <button onClick={() => { setMenu(false); setTourStep(0); setShowGuidedTour(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><PlayCircle size={16} /> Guided Tour</button>
                    <div className="refos-menu-section">Help &amp; Display</div>
                <button onClick={() => { setMenu(false); setShowFeatures(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Info size={16} /> Features &amp; Help</button>
                <button onClick={() => { setMenu(false); onLock(); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><LogOut size={16} /> Lock This Device</button>
                  </>
                ) : isEmcee ? (
                  <>
                    <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400 flex items-center gap-1.5"><Trophy size={12} /> Emcee</div>
                    <button onClick={() => { setMenu(false); setShowIdentity(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><UserCircle2 size={16} /> Change name</button>
                    <button onClick={onToggleTheme} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light Mode" : "Dark Mode"}</button>
                    <button onClick={onCycleTextSize} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Type size={16} /> Text Size: {textScale === "large" ? "Large" : textScale === "xl" ? "Extra large" : "Normal"}</button>
                    {isAndroid && !isInstalled && <button onClick={() => { setMenu(false); installRefOS(); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Download size={16} /> Install app</button>}
                    <button onClick={() => { setMenu(false); setTourStep(0); setShowGuidedTour(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><PlayCircle size={16} /> Guided Tour</button>
                    <button onClick={() => { setMenu(false); setShowFeatures(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Info size={16} /> Features &amp; help</button>
                    <button onClick={() => { setMenu(false); onLock(); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><LogOut size={16} /> Lock This Device</button>
                  </>
                ) : (
                <>
                <div className="refos-menu-section">Event</div>
                {adminUnlocked && <button onClick={() => { setMenu(false); loadEventMembers(); loadFeedback(); setShowCommandCenter(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><BarChart3 size={16} /> Event Command Center</button>}
                <button onClick={() => { setMenu(false); setShowContactDirectory(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Contact size={16} /> Event Contact Directory</button>
                <button onClick={() => { setMenu(false); api.listRefRoster(eventId).then(setRefRoster); if (adminUnlocked) loadEventMembers(); setShowOnline(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Users size={16} /> Key Volunteer Status</button>
                <button onClick={() => { setMenu(false); setShowFieldLog(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Flag size={16} /> Field Log</button>
                <button onClick={() => { setMenu(false); setShowFeatures(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Info size={16} /> Features &amp; help</button>
                <button onClick={() => { setMenu(false); setTourStep(0); setShowGuidedTour(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><PlayCircle size={16} /> Guided Tour</button>
                <button onClick={onCycleTextSize} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Type size={16} /> Text Size: {textScale === "large" ? "Large" : textScale === "xl" ? "Extra large" : "Normal"}</button>
                <button onClick={onToggleTheme} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light Mode" : "Dark Mode"}</button>
                <div className="refos-menu-section">Access</div>
                <button onClick={() => { setMenu(false); setShowShare(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><Share2 size={16} /> Invite Other Key Volunteers</button>
                <button onClick={() => { setMenu(false); onLock(); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><LogOut size={16} /> Lock This Device</button>
                <div className="border-t border-slate-100 my-1" />
                {!adminUnlocked ? (
                  <button onClick={() => { setMenu(false); pendingAdminAction.current = null; setShowAdminPassword(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2"><KeyRound size={16} /> Admin Login</button>
                ) : (
                  <>
                    <div className="w-full px-4 py-2.5 flex items-center gap-2 text-emerald-700 bg-emerald-50/60"><KeyRound size={16} /> Admin mode <span className="ml-auto text-[10px] font-semibold">ACTIVE</span></div>
                    <button onClick={lockAdmin} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-2 text-amber-700"><KeyRound size={16} /> Lock Admin Access</button>
                  </>
                )}
                </>
                )}
              </div>
            )}
          </div>
        </div>
        {!openTeam && !openMatch && !openRobot && (() => {
          const navItems = isJudge ? [
            { k: "judging", label: "Judging", Icon: Trophy },
            { k: "alliances", label: "Alliances", Icon: GitBranch }
          ] : [
            { k: "teams", label: "Teams", Icon: Users },
            ...(Object.keys(matches).length > 0 ? [{ k: "matches", label: "Matches", Icon: ListOrdered }] : []),
            ...(rules.length > 0 ? [{ k: "rulebook", label: "Rules", Icon: BookOpen }] : []),
            { k: "robots", label: "Robots", Icon: Camera },
            { k: "alliances", label: "Alliances", Icon: GitBranch },
            { k: "judging", label: "Judging", Icon: Trophy }
          ];
          const active = navItems.find((item) => item.k === view) || navItems[0];
          const ActiveIcon = active?.Icon || Menu;
          return (
            <>
              <div className="max-w-2xl mx-auto px-4 hidden sm:flex gap-1 overflow-x-auto">
                {navItems.map(({ k, label, Icon }) => (
                  <button key={k} onClick={() => { setView(k); setQuery(""); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${view === k ? "border-[#D7212B] text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
              <div className="sm:hidden max-w-2xl mx-auto px-4 pb-2">
                <button onClick={() => setMobileNavOpen(true)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5 flex items-center gap-2 text-white">
                  <ActiveIcon size={18} />
                  <span className="font-semibold">{active?.label || "Navigation"}</span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">Sections <Menu size={18}/></span>
                </button>
              </div>
            </>
          );
        })()}
      </header>

      {mobileNavOpen && !openTeam && !openMatch && !openRobot && (() => {
        const navItems = isJudge ? [
          { k: "judging", label: "Judging", Icon: Trophy },
          { k: "alliances", label: "Alliances", Icon: GitBranch }
        ] : [
          { k: "teams", label: "Teams", Icon: Users },
          ...(Object.keys(matches).length > 0 ? [{ k: "matches", label: "Matches", Icon: ListOrdered }] : []),
          ...(rules.length > 0 ? [{ k: "rulebook", label: "Rules", Icon: BookOpen }] : []),
          { k: "robots", label: "Robots", Icon: Camera },
          { k: "alliances", label: "Alliances", Icon: GitBranch },
          { k: "judging", label: "Judging", Icon: Trophy }
        ];
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 sm:hidden" onClick={() => setMobileNavOpen(false)}>
            <div className="absolute left-3 right-3 top-20 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center">
                <div className="font-bold text-slate-900 dark:text-slate-100">Go to section</div>
                <button onClick={() => setMobileNavOpen(false)} className="ml-auto p-1 text-slate-500"><X size={20}/></button>
              </div>
              <div className="p-2">
                {navItems.map(({ k, label, Icon }) => (
                  <button key={k} onClick={() => { setView(k); setQuery(""); setMobileNavOpen(false); }}
                    className={`w-full px-3 py-3 rounded-xl flex items-center gap-3 text-left font-semibold ${view === k ? "bg-[#0D0F32] text-white" : "text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                    <Icon size={20}/>
                    <span>{label}</span>
                    {view === k && <Check size={18} className="ml-auto"/>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {(pendingCount > 0 || !online) && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-2">
            {online ? <RefreshCw size={13} className="animate-spin shrink-0" /> : <CloudOff size={13} className="shrink-0" />}
            {pendingCount > 0
              ? <span>{pendingCount} {pendingCount === 1 ? "entry" : "entries"} saved on this device{online ? " — syncing now…" : " — will sync when you're back online."}</span>
              : <span>You're offline. New entries are saved here and will sync automatically when you reconnect.</span>}
          </div>
        </div>
      )}

      {eventCountdown && countdownRemaining > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 flex items-center gap-3">
            <Clock size={20} className="text-indigo-700 dark:text-indigo-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-bold text-indigo-600 dark:text-indigo-300">Event countdown</div>
              <div className="font-bold text-slate-900 dark:text-slate-100">{eventCountdown.label || "Next event milestone"}</div>
            </div>
            <div className="font-mono text-lg font-bold text-indigo-800 dark:text-indigo-200 whitespace-nowrap">{countdownText}</div>
          </div>
        </div>
      )}
      {activeAnnouncement && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 flex gap-3 items-start">
            <Flag size={20} className="text-amber-700 dark:text-amber-300 shrink-0 mt-0.5"/>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Key Volunteer Announcement</div>
              <div className="text-sm font-medium mt-1 whitespace-pre-wrap">{activeAnnouncement.note}</div>
              <div className="text-[11px] text-slate-500 mt-1">{activeAnnouncement.by ? `From ${activeAnnouncement.by} · ` : ""}{fmtTime(activeAnnouncement.createdAt)}</div>
            </div>
            <button onClick={() => acknowledgeAnnouncement(activeAnnouncement.id)} className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-bold shrink-0">Acknowledge</button>
          </div>
        </div>
      )}
      <main className="max-w-2xl mx-auto px-4 pb-28 pt-4">
        {openTeam ? (
          <TeamDetail team={teams.find((t) => t.number === openTeam)} viols={viols.filter((v) => v.team === openTeam)} record={teamRecords[openTeam]}
            onLog={() => setLogFor(openTeam)} onDeleteViolation={deleteViolation} onEditViolation={setEditing} onDeleteTeam={deleteTeam} canDeleteTeam={adminUnlocked} watch={teamWatch[openTeam] || []} meName={meName} onAddWatch={addWatchNote} onRemoveWatch={removeWatchNote} onOpenPhoto={setLightbox} emcee={isEmcee} />
        ) : openMatch ? (
          <MatchDetail match={matches[openMatch]} matches={matches} teamName={teamNameMap} teamRank={teamRankMap} teamWatch={teamWatch} viols={viols} onNav={setOpenMatch}
            fieldLog={fieldLog} onAddField={addFieldLog} onRemoveField={removeFieldLog} meName={meName} canDelete={adminUnlocked}
            onLogTeam={(n) => { const m = matches[openMatch]; setLogFor(n); setLogMatch(m ? { phase: m.phase, num: m.num } : null); }} onOpenPhoto={setLightbox} onDeleteViolation={deleteViolation} onEditViolation={setEditing} emcee={isEmcee} />
        ) : openRobot ? (
          <RobotDetail team={teams.find((t) => t.number === openRobot)} onAddPhoto={addRobotPhoto} onRemovePhoto={removeRobotPhoto} onOpenPhoto={setLightbox} emcee={isEmcee} />
        ) : view === "matches" ? (
          <MatchList matches={matches} teamName={teamNameMap} teamRank={teamRankMap} viols={viols} fieldLog={fieldLog} query={query} setQuery={setQuery} onOpen={setOpenMatch} canAdd={adminUnlocked} onAddMatch={() => requireAdmin(() => setAddMatchOpen(true))} emcee={isEmcee} onOpenAwp={() => setView("awp")} />
        ) : view === "robots" ? (
          <RobotList teams={teams} query={query} setQuery={setQuery} onOpen={setOpenRobot} />
        ) : view === "judging" ? (
          <JudgingView noms={noms} viols={viols} teamName={teamNameMap} finalists={finalists} emcee={isEmcee}
            onToggleFinalist={(award, team) => (isJudge ? toggleFinalist(award, team) : requireAdmin(() => toggleFinalist(award, team)))}
            onNominate={(award) => setNominating(award || "sportsmanship")} onDeleteNom={removeNomination}
            onExport={isEmcee ? undefined : () => (isJudge ? exportNominations() : requireAdmin(exportNominations))} />
        ) : view === "rulebook" ? (
          <RuleBook rules={rules} />
        ) : view === "awp" ? (
          <AWPHistory fieldLog={fieldLog} matches={matches} viols={viols} canSeeFieldComparison={adminUnlocked} />
        ) : view === "alliances" ? (
          <AllianceSelection teams={teams} alliances={alliances} matches={matches} canEditAlliances={adminUnlocked && !isJudge} canEditBracket={!isJudge && !isEmcee} onSet={setAllianceTeam} onFinalize={finalizeAlliances} onSetWinner={setMatchWinner} onClear={() => requireAdmin(() => { if (confirm("Clear all alliance picks? (This does not delete any matches already generated.)")) clearAlliances(); })} />
        ) : (
          <>
            {!event?.quals ? (
              <button onClick={() => requireAdmin(() => setShowEvent(true))} className="w-full mb-4 bg-[#0D0F32] text-white rounded-xl p-4 flex items-center gap-3 text-left hover:bg-[#171a45]">
                <CalendarDays size={22} className="text-[#EBA622] shrink-0" />
                <div className="flex-1"><p className="font-semibold leading-tight">Finish event setup</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add how many matches so logging picks the match from a list.</p></div>
                <ChevronRight size={18} className="text-slate-500 dark:text-slate-400" />
              </button>
            ) : (
              <button onClick={() => requireAdmin(() => setShowEvent(true))} className="w-full mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-2 text-left hover:border-slate-300 dark:border-slate-600">
                <CalendarDays size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{event.name || "Event"}</span>
                <span className="text-xs text-slate-400">{event.quals} quals{event.bracket ? ` · top ${event.bracket}` : ""}</span>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            )}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team #"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <button onClick={() => setShowTeamScanner(true)} className="px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-1 text-sm font-medium"><Camera size={17} /> Scan</button>
              {!isEmcee && <button onClick={() => setAddTeam(true)} className="px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 flex items-center gap-1 text-sm font-medium"><Plus size={17} /> Team</button>}
            </div>
            {filteredTeams.length === 0 ? (
              <Empty title={teams.length ? "No matches" : "No teams yet"} sub={teams.length ? "Try a different team number." : "Add a team, or just log a violation and the team is created for you."} />
            ) : (
              <ul className="space-y-2">
                {filteredTeams.map((t) => {
                  const c = countsByTeam[t.number] || { total: 0 };
                  return (
                    <li key={t.number}>
                      <button onClick={() => setOpenTeam(t.number)} className="w-full text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 hover:border-slate-300 dark:border-slate-600 hover:shadow-sm transition">
                        <span className="font-mono font-bold text-lg text-slate-900 dark:text-slate-100">{t.number}</span>
                        {t.rank != null && <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800 text-xs font-bold shrink-0">Rank {t.rank}</span>}
                        {!isEmcee && teamWatch[t.number]?.length > 0 && <span title={teamWatch[t.number].map((w) => `${w.by || "Ref"}: ${w.note}`).join("\n")} className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold shrink-0"><Star size={15} fill="currentColor" /> WATCH{teamWatch[t.number].length > 1 ? ` ${teamWatch[t.number].length}` : ""}</span>}
                        {t.name && <span className="text-sm text-slate-500 dark:text-slate-400 truncate flex-1">{t.name}</span>}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {isEmcee ? (() => { const r = teamRecords[t.number]; return (r && (r.w || r.l || r.t)) ? <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">{r.w}-{r.l}-{r.t}</span> : <span className="text-xs text-slate-300">—</span>; })() : (<>
                          {ORDER.map((ty) => c[ty] ? (
                            <span key={ty} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold border ${TYPES[ty].badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${TYPES[ty].dot}`} />{c[ty]}</span>) : null)}
                          {!c.total && <span className="text-xs text-slate-300">clean</span>}
                          </>)}
                          <ChevronRight size={16} className="text-slate-300" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        <div className="flex flex-col items-center gap-2 mt-10 pb-2">
          <img src="/logo.svg" alt="Highlander Summit" className="h-10 w-10 object-contain opacity-90" />
          <p className="text-center text-xs text-slate-400">
            Made by Maharshi Patel ·{" "}
            <a href="https://www.instagram.com/mpatel_ref/" target="_blank" rel="noopener noreferrer" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 underline">@mpatel_ref</a>{" · "}v{APP_VERSION} · Private Beta
          </p>
        </div>
      </main>

      {!openTeam && !openMatch && !openRobot && view !== "judging" && !isEmcee && (
        <button onClick={() => setLogFor("")} className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 bg-[#D7212B] text-white px-5 py-3.5 rounded-full shadow-xl flex items-center gap-2 font-semibold hover:bg-[#B42024] active:scale-95 transition">
          <Plus size={20} /> Log violation
        </button>
      )}

      {showTeamScanner && <TeamScanner
        teams={teams}
        onDetected={(number) => { setShowTeamScanner(false); setOpenTeam(number); }}
        onClose={() => setShowTeamScanner(false)}
      />}
      {logFor !== null && (
        <LogModal teams={teams} viols={viols} presetTeam={logFor || null} knownRules={knownRules} me={{ name: meName }} lastMatch={lastMatch} event={event} matches={matches} presetMatch={logMatch} rules={rules} onOpenPhoto={setLightbox} tourMode={showGuidedTour && tourStep === 4}
          onSetName={() => setShowIdentity(true)} onClose={() => { setLogFor(null); setLogMatch(null); }}
          onSave={async (form) => { const team = await upsertTeam(form.team || form.newNumber, form.newName); await saveViolation({ ...form, team }); setLogFor(null); setLogMatch(null); }} />
      )}
      {editing && (
        <LogModal teams={teams} viols={viols} presetTeam={editing.team} knownRules={knownRules} me={{ name: meName }} lastMatch={lastMatch} event={event} matches={matches} rules={rules} onOpenPhoto={setLightbox} edit={editing}
          onSetName={() => setShowIdentity(true)} onClose={() => setEditing(null)}
          onSave={async (form) => { const team = await upsertTeam(form.team || form.newNumber, form.newName); await editViolation(editing, { ...form, team }); setEditing(null); }} />
      )}
      {nominating && (
        <NominateModal teams={teams} presetAward={nominating} me={{ name: meName }} lastMatch={lastMatch} event={event} matches={matches}
          onSetName={() => setShowIdentity(true)} onClose={() => setNominating(null)}
          onSave={async (form) => { const team = await upsertTeam(form.team || form.newNumber, form.newName); await addNomination({ ...form, team }); setNominating(null); }} />
      )}
      {addTeam && <AddTeamModal onClose={() => setAddTeam(false)} onSave={async (num, name) => { await upsertTeam(num, name); setAddTeam(false); }} />}
      {showIdentity && <IdentityModal me={{ name: meName }} onSave={async (n) => { await onEditName(n); setShowIdentity(false); }} onClose={() => setShowIdentity(false)} />}
      {showClear && <ClearModal counts={{ violations: viols.length, teams: teams.length, schedule: Object.keys(matches).length, replays: fieldLog.filter((e) => e.kind === "replay").length, judging: noms.length, alliances: Object.values(alliances).filter((a) => (a || []).filter(Boolean).length).length, watchlist: watchNotes.length }} onClear={clearSelected} onClose={() => setShowClear(false)} />}
      {showOnline && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setShowOnline(false)}>
          <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Users size={18} /> Key Volunteer Status</h2>
              <button onClick={() => setShowOnline(false)} className="text-slate-400"><X size={22} /></button>
            </div>
            <div className="p-4"><OnlineList presence={presence} roster={refRoster} meName={meName} onRemove={adminUnlocked ? removeRef : undefined} eventMembers={eventMembers} onSetAdmin={adminUnlocked ? setVolunteerAdmin : undefined} /></div>
          </div>
        </div>
      )}
      {showByRule && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 flex flex-col font-sans">
          <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 shrink-0">
            <button onClick={() => setShowByRule(false)} className="text-slate-500 dark:text-slate-400 p-1 -ml-1"><ChevronLeft size={22} /></button>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><BarChart3 size={18} /> Violations by rule</h2>
          </div>
          <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto px-4 py-4"><ByRule viols={viols} expandRule={expandRule} setExpandRule={setExpandRule} /></div></div>
        </div>
      )}
      {showTMSync && (
        <TMSyncCenter
          onClose={() => setShowTMSync(false)}
          onImportTeams={() => teamFileRef.current?.click()}
          onImportMatches={() => matchFileRef.current?.click()}
          onImportRankings={() => rankingFileRef.current?.click()}
          onImportAlliances={() => allianceFileRef.current?.click()}
          onImportScores={() => scoreFileRef.current?.click()}
          stats={{
            teams: teams.length,
            matches: Object.keys(matches).length,
            ranked: teams.filter((t) => t.rank != null).length,
            alliances: Object.values(alliances).filter((a) => (a || []).filter(Boolean).length >= 2).length,
            scored: Object.values(matches).filter((m) => m.redScore != null && m.blueScore != null).length,
          }}
          syncStatus={tmSyncStatus}
        />
      )}
      <input ref={matchFileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importMatchesFile(f); }} />
      <input ref={teamFileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importTeamsFile(f); }} />
      <input ref={scoreFileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importScoresFile(f); }} />
      <input ref={rankingFileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importRankingsFile(f); }} />
      {importPreview && <ImportPreviewModal preview={importPreview}
        onImport={() => { const p = importPreview; setImportPreview(null); p.resolve(true); }}
        onCancel={() => { const p = importPreview; setImportPreview(null); p.resolve(false); }} />}
      {importing && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 w-full max-w-xs shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw size={18} className="text-[#D7212B] animate-spin" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">{importing.label}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              {importing.total > 0
                ? <div className="h-full bg-[#D7212B] transition-all duration-150" style={{ width: `${Math.round((importing.done / importing.total) * 100)}%` }} />
                : <div className="h-full w-full bg-[#D7212B] animate-pulse" />}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {importing.total > 0 ? `${importing.done} of ${importing.total}` : "Working… please keep this screen open."}
            </div>
          </div>
        </div>
      )}
      <input ref={allianceFileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importAlliancesFile(f); }} />
      {addMatchOpen && <AddMatchModal teams={teams} onSave={addElimMatch} onClose={() => setAddMatchOpen(false)} />}
      {showFieldLog && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 flex flex-col font-sans">
          <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 shrink-0">
            <button onClick={() => setShowFieldLog(false)} className="text-slate-500 p-1 -ml-1"><ChevronLeft size={22} /></button>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Flag size={18} /> Field log</h2>
          </div>
          <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto px-4 py-4">
            <FieldLogView entries={fieldLog.filter((e) => !["announcement","event_countdown","contact_directory","system_test","sync_probe","sync_ack","role_access_codes","feedback"].includes(e.kind))} onAdd={addFieldLog} onRemove={removeFieldLog} meName={meName} canDelete={adminUnlocked} />
          </div></div>
        </div>
      )}
      {showGuidedTour && <GuidedTour role={myRole} step={tourStep} hasMatches={Object.keys(matches).length > 0} hasRules={rules.length > 0}
        onStep={setTourStep} onClose={() => { setShowGuidedTour(false); setShowFieldLog(false); setShowContactDirectory(false); setLogFor(null); setLogMatch(null); setOpenMatch(null); }} />}
      {showPreEventTest && adminUnlocked && <PreEventSystemTest eventId={eventId} adminUnlocked={adminUnlocked}
        onClose={() => setShowPreEventTest(false)} onComplete={setLastSystemTest} />}
      {showTwoDeviceSyncTest && adminUnlocked && <TwoDeviceSyncTest fieldLog={fieldLog} deviceId={deviceId} meName={meName}
        onAdd={addFieldLog} onRemove={removeFieldLog} onClose={() => setShowTwoDeviceSyncTest(false)} />}
      {showDiagnosticReport && adminUnlocked && <EventDiagnosticReport event={event} eventId={eventId} teams={teams} matches={matches}
        viols={viols} rules={rules} fieldLog={fieldLog} presence={presence} roster={refRoster} contacts={eventContacts}
        countdown={eventCountdown} tmSyncStatus={tmSyncStatus} online={online} pendingCount={pendingCount}
        queuedWrites={queuedWrites} failedSyncCount={failedSyncItems.length} cloudReachable={cloudReachable}
        lastCloudError={lastCloudError} syncedAt={syncedAt} syncing={syncing}
        lastSystemTest={lastSystemTest} onClose={() => setShowDiagnosticReport(false)} />}
      {showRoleCodeManager && adminUnlocked && <RoleAccessCodeManager eventId={eventId} config={eventSettings?.role_access_codes?.value || latestRoleAccessConfig(fieldLog).config}
        onSave={saveRoleAccessConfig} onClose={() => setShowRoleCodeManager(false)} />}
      {showContactDirectory && <EventContactDirectory contacts={eventContacts} canEdit={adminUnlocked}
        onSave={saveEventContacts} onClose={() => setShowContactDirectory(false)} />}
      {showCountdownSetup && adminUnlocked && <CountdownSetupModal current={eventCountdown}
        onSave={saveSharedCountdown}
        onClear={clearSharedCountdown}
        onClose={() => setShowCountdownSetup(false)} />}
      {showOfflineTest && adminUnlocked && <OfflineReadinessModal onClose={() => setShowOfflineTest(false)} />}
      {showCommandCenter && adminUnlocked && <CommandCenter matches={matches} viols={viols} fieldLog={fieldLog} presence={presence} roster={refRoster}
        eventMembers={eventMembers} meName={meName} onSetAdmin={setVolunteerAdmin}
        failedSyncItems={failedSyncItems} onRetryFailedSync={retryFailedSync} onDiscardFailedSync={discardFailedSync}
        countdown={eventCountdown} countdownText={countdownText}
        onCountdown={() => { setShowCommandCenter(false); setShowCountdownSetup(true); }}
        onClearCountdown={clearSharedCountdown}
        onOfflineTest={() => { setShowCommandCenter(false); setShowOfflineTest(true); }}
        onAnnouncement={() => { setShowCommandCenter(false); setShowAnnouncement(true); }}
        onDeleteAnnouncement={deleteAnnouncementForAll}
        onClearAnnouncements={clearAnnouncementsForAll}
        onContactDirectory={() => { setShowCommandCenter(false); setShowContactDirectory(true); }}
        onRoleCodes={() => { setShowCommandCenter(false); setShowRoleCodeManager(true); }}
        onPreEventTest={() => { setShowCommandCenter(false); setShowPreEventTest(true); }}
        onTwoDeviceSyncTest={() => { setShowCommandCenter(false); setShowTwoDeviceSyncTest(true); }}
        onDiagnosticReport={() => { setShowCommandCenter(false); setShowDiagnosticReport(true); }}
        onEventSetup={() => { setShowCommandCenter(false); setShowEvent(true); }}
        onTMSync={() => { setShowCommandCenter(false); setShowTMSync(true); }}
        onExportViolations={exportCSV}
        onExportNominations={exportNominations}
        onExportEventReport={exportEventReport}
        onBackupAll={backupAll}
        onActivityFeed={() => { setShowCommandCenter(false); setShowActivity(true); }}
        onRankings={() => { setShowCommandCenter(false); setShowRankings(true); }}
        feedback={feedback} onRefreshFeedback={loadFeedback} onDeleteFeedback={deleteFeedbackSubmission}
        onClearData={() => { setShowCommandCenter(false); setShowClear(true); }}
        onClose={() => setShowCommandCenter(false)} />}
      {showAnnouncement && adminUnlocked && <AnnouncementModal onClose={() => setShowAnnouncement(false)} onSend={sendAnnouncement} />}
      {showFeatures && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 flex flex-col font-sans">
          <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 shrink-0">
            <button onClick={() => setShowFeatures(false)} className="text-slate-500 p-1 -ml-1"><ChevronLeft size={22} /></button>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Info size={18} /> Features &amp; help</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-4">
              <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#D7212B] flex items-center justify-center shrink-0"><Mail size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Help Improve Ref OS</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Report a bug, request a feature, or send general feedback.</div>
                </div>
                <button onClick={() => setShowFeedback(true)} className="px-3 py-2 rounded-lg bg-[#D7212B] text-white text-sm font-semibold shrink-0">Send Feedback</button>
              </div>
              <FeaturesGuide />
            </div>
          </div>
        </div>
      )}
      {showFeedback && <FeedbackModal meName={meName} myRole={myRole} onSubmit={submitFeedback} onClose={() => setShowFeedback(false)} />}
      {showActivity && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 flex flex-col font-sans">
          <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 shrink-0">
            <button onClick={() => setShowActivity(false)} className="text-slate-500 dark:text-slate-400 p-1 -ml-1"><ChevronLeft size={22} /></button>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><ListOrdered size={18} /> Activity feed</h2>
          </div>
          <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto px-4 py-4"><ActivityFeed viols={viols} onOpenPhoto={setLightbox} onDeleteViolation={deleteViolation} onEditViolation={setEditing} /></div></div>
        </div>
      )}
      {showRankings && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 flex flex-col font-sans">
          <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 shrink-0">
            <button onClick={() => setShowRankings(false)} className="text-slate-500 dark:text-slate-400 p-1 -ml-1"><ChevronLeft size={22} /></button>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><BarChart3 size={18} /> Team rankings</h2>
          </div>
          <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto px-4 py-4"><Rankings viols={viols} teamName={teamNameMap} /></div></div>
        </div>
      )}
      {showShare && <ShareModal
        event={event}
        adminUnlocked={adminUnlocked}
        roleCodeConfig={eventSettings?.role_access_codes?.value || latestRoleAccessConfig(fieldLog).config}
        onManageCodes={() => { setShowShare(false); setShowRoleCodeManager(true); }}
        onClose={() => setShowShare(false)}
      />}
      {showAdminPassword && <AdminPasswordModal onUnlock={unlockAdmin} onClose={() => { pendingAdminAction.current = null; setShowAdminPassword(false); }} />}
      {showInstallHelp && (
        <Modal onClose={() => setShowInstallHelp(false)}>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Install Ref-OS</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p><b>Chrome:</b> Open the browser menu (⋮), then choose <b>Install app</b> or <b>Add to Home screen</b>.</p>
            <p><b>Samsung Internet:</b> Open the menu (☰), tap <b>Add page to</b>, then <b>Home screen</b>.</p>
            <p className="text-xs text-slate-500">If the install option is missing, make sure you are on the deployed HTTPS website rather than an in-app browser.</p>
          </div>
          <button onClick={() => setShowInstallHelp(false)} className="w-full mt-4 py-2.5 rounded-lg bg-[#0D0F32] text-white font-semibold">Got it</button>
        </Modal>
      )}
      {showEvent && <EventModal event={event} onSave={saveEvent} onClose={() => setShowEvent(false)} />}
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[60] bg-black/90 grid place-items-center p-4">
          <img src={lightbox} alt="robot" className="max-h-full max-w-full rounded-lg" />
          <button className="absolute top-4 right-4 text-white/80 p-2"><X size={26} /></button>
        </div>
      )}
    </div>
  );
}

/* ============================ TEAM DETAIL ============================ */
function TeamDetail({ team, viols, record, onLog, onDeleteViolation, onEditViolation, onDeleteTeam, canDeleteTeam, watch = [], meName, onAddWatch, onRemoveWatch, onOpenPhoto, emcee }) {
  const [wnote, setWnote] = useState("");
  const addWatch = () => { const n = wnote.trim(); if (!n) return; onAddWatch(team.number, n); setWnote(""); };
  if (!team) return null;
  const sorted = [...viols].sort((a, b) => b.createdAt - a.createdAt);
  const byRule = useMemo(() => {
    const m = {};
    for (const v of viols) {
      const key = v.code || "—";
      m[key] = m[key] || { code: v.code, desc: v.desc, count: 0, types: {} };
      m[key].count++; m[key].types[v.type] = (m[key].types[v.type] || 0) + 1;
      if (!m[key].desc && v.desc) m[key].desc = v.desc;
    }
    return Object.values(m).sort((a, b) => b.count - a.count);
  }, [viols]);
  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono font-bold text-2xl text-slate-900 dark:text-slate-100 leading-none">{team.number}</div>
            {team.name && <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{team.name}</div>}
            {record && (record.w || record.l || record.t) ? <div className="mt-1 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">{record.w}-{record.l}-{record.t} <span className="font-sans font-normal text-slate-400">(W-L-T)</span></div> : null}
          </div>
          {canDeleteTeam && (
            <button
              onClick={() => { if (confirm(`Delete team ${team.number} and all its violations?`)) onDeleteTeam(team.number); }}
              className="refos-destructive-icon p-1"
              title="Delete team (admin only)"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
        {!emcee && <button onClick={onLog} className="mt-4 w-full bg-[#D7212B] text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#B42024]"><Plus size={18} /> Log violation for {team.number}</button>}
        {!emcee && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Star size={16} className="text-amber-500 fill-amber-500" />
            <span className="font-semibold text-amber-700 dark:text-amber-300 text-sm">Watchlist{watch.length ? ` (${watch.length})` : ""}</span>
          </div>
          {watch.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {watch.map((w) => (
                <li key={w.id} className="flex items-start gap-2 text-sm">
                  <span className="text-slate-700 dark:text-slate-200 min-w-0"><span className="font-semibold">{w.by || "Ref"}:</span> {w.note || <span className="italic text-slate-400">(no note)</span>}</span>
                  {(w.by === meName || canDeleteTeam) && <button onClick={() => onRemoveWatch(w.id)} className="ml-auto refos-destructive-icon shrink-0" title="Remove note"><Trash2 size={13} /></button>}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input value={wnote} onChange={(e) => setWnote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addWatch(); }} placeholder="Add a watch note…"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <button onClick={addWatch} disabled={!wnote.trim()} className="px-3 rounded-lg bg-[#0D0F32] text-white text-sm font-medium disabled:bg-slate-300">Add</button>
          </div>
          {!meName && <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">Set your ref name so notes are attributed to you.</p>}
        </div>}
      </div>
      {!emcee && byRule.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">Violations by rule</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {byRule.map((r) => (
              <div key={r.code || "none"} className="px-4 py-2.5 flex items-center gap-3">
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{fmtRule(r.code)}</span>
                {r.desc && <span className="text-sm text-slate-500 dark:text-slate-400 truncate flex-1">{r.desc}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  {ORDER.map((ty) => r.types[ty] ? <span key={ty} className={`w-1.5 h-1.5 rounded-full ${TYPES[ty].dot}`} title={TYPES[ty].label} /> : null)}
                  <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums ml-1">×{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!emcee && (<>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">Log ({viols.length})</h2>
      {sorted.length === 0 ? <Empty title="No violations" sub="This team has a clean record." /> : (
        <ul className="space-y-2">{sorted.map((v) => <ViolationCard key={v.id} v={v} onDelete={onDeleteViolation} onOpenPhoto={onOpenPhoto} onEdit={onEditViolation} />)}</ul>
      )}
      </>)}
    </>
  );
}

function ViolationCard({ v, onDelete, onOpenPhoto, onEdit, showTeam }) {
  const T = TYPES[v.type];
  const canEdit = onEdit && !v._pending;
  return (
    <li className={`rounded-xl border p-3 ${T.soft}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${T.badge}`}><T.Icon size={12} /> {T.label}</span>
        {showTeam && <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded-md text-sm">{v.team}</span>}
        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{fmtRule(v.code)}</span>
        {fmtMatch(v.match) && <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">{fmtMatch(v.match)}</span>}
        {v._pending && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-300"><RefreshCw size={9} className="animate-spin" /> Saving</span>}
        <span className="text-[11px] text-slate-400 ml-auto">{fmtTime(v.createdAt)}</span>
        {canEdit && <button onClick={() => onEdit(v)} className="text-slate-300 hover:text-slate-700 dark:text-slate-200" title="Edit"><Pencil size={15} /></button>}
        <button onClick={() => { if (confirm(v._pending ? "Discard this unsynced violation?" : "Delete this violation?")) onDelete(v); }} className="refos-destructive-icon" title="Delete"><Trash2 size={15} /></button>
      </div>
      {v.desc && <p className={`text-sm mt-1.5 font-medium ${T.text}`}>{v.desc}</p>}
      {v.notes && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{v.notes}</p>}
      {v._localPhotos?.length > 0 ? (
        <div className="flex gap-2 mt-2 overflow-x-auto">{v._localPhotos.map((src, i) => (
          <button key={i} onClick={() => onOpenPhoto(src)} className="shrink-0"><img src={src} alt="robot" className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 opacity-90" /></button>
        ))}</div>
      ) : v.photoKeys?.length > 0 ? (
        <div className="flex gap-2 mt-2 overflow-x-auto">{v.photoKeys.map((k) => <Thumb key={k} pkey={k} onOpen={onOpenPhoto} />)}</div>
      ) : null}
      {v.by && <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><UserCircle2 size={12} /> {v.by}</p>}
    </li>
  );
}

/* ============================ BY RULE ============================ */
function ByRule({ viols, expandRule, setExpandRule }) {
  const rules = useMemo(() => {
    const m = {};
    for (const v of viols) {
      const key = v.code || "—";
      m[key] = m[key] || { code: v.code, desc: v.desc, count: 0, types: {}, teams: {} };
      m[key].count++; m[key].types[v.type] = (m[key].types[v.type] || 0) + 1;
      m[key].teams[v.team] = (m[key].teams[v.team] || 0) + 1;
      if (!m[key].desc && v.desc) m[key].desc = v.desc;
    }
    return Object.values(m).sort((a, b) => b.count - a.count);
  }, [viols]);
  const max = rules[0]?.count || 1;
  if (rules.length === 0) return <Empty title="Nothing logged yet" sub="Rule totals across all teams will appear here." />;
  return (
    <ul className="space-y-2">
      {rules.map((r) => {
        const teamCount = Object.keys(r.teams).length;
        const open = expandRule === (r.code || "—");
        return (
          <li key={r.code || "none"} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button onClick={() => setExpandRule(open ? null : (r.code || "—"))} className="w-full text-left px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{fmtRule(r.code)}</span>
                <span className="text-xs text-slate-400">{teamCount} team{teamCount !== 1 ? "s" : ""}</span>
                <span className="ml-auto font-bold text-lg text-slate-900 dark:text-slate-100 tabular-nums">{r.count}</span>
                <ChevronRight size={16} className={`text-slate-300 transition-transform ${open ? "rotate-90" : ""}`} />
              </div>
              {r.desc && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{r.desc}</p>}
              <div className="flex h-1.5 rounded-full overflow-hidden mt-2 bg-slate-100 dark:bg-slate-700" style={{ width: `${Math.max(12, (r.count / max) * 100)}%` }}>
                {ORDER.map((ty) => r.types[ty] ? <div key={ty} className={TYPES[ty].solid} style={{ flex: r.types[ty] }} /> : null)}
              </div>
            </button>
            {open && (
              <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                {Object.entries(r.teams).sort((a, b) => b[1] - a[1]).map(([num, n]) => (
                  <div key={num} className="flex items-center justify-between py-1 text-sm">
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{num}</span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">×{n}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ============================ LOG MODAL ============================ */
function LogModal({ teams, viols, presetTeam, knownRules, me, lastMatch, event, matches, presetMatch, rules, onOpenPhoto, edit, onSetName, onClose, onSave, tourMode = false }) {
  const ruleBook = useMemo(() => {
    const m = {}; for (const r of (rules || [])) m[r.code] = r.desc; return m;
  }, [rules]);
  const [team, setTeam] = useState((edit && edit.team) || presetTeam || (teams[0]?.number ?? ""));
  const [creatingNew, setCreatingNew] = useState(!edit && teams.length === 0);
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [matchPhase, setMatchPhase] = useState((edit && edit.match?.phase) || (presetMatch?.phase) || (lastMatch?.phase || "qual"));
  const [matchNum, setMatchNum] = useState((edit && edit.match?.num) || (presetMatch && presetMatch.num != null ? String(presetMatch.num) : (lastMatch?.num || "")));
  const [type, setType] = useState((edit && edit.type) || "minor");
  const [code, setCode] = useState((edit && edit.code) || "");
  const [desc, setDesc] = useState((edit && edit.desc) || "");
  const [notes, setNotes] = useState((edit && edit.notes) || "");
  const [photos, setPhotos] = useState([]);
  const [keepKeys, setKeepKeys] = useState((edit && edit.photoKeys) || []);
  const [busy, setBusy] = useState(false);
  const [showRulePicker, setShowRulePicker] = useState(false);
  const fileRef = useRef(null);
  const T = TYPES[type];

  const onCode = (val) => { setCode(val); const clean = normNum(val).replace(/[<>]/g, ""); const d = ruleBook[clean] || knownRules[clean]; if (d && !desc) setDesc(d); };
  const addPhotos = async (files) => { const list = Array.from(files).slice(0, 4); const out = []; for (const f of list) { try { out.push(await compress(f)); } catch {} } setPhotos((p) => [...p, ...out].slice(0, 6)); };
  const valid = (creatingNew ? newNumber.trim() : team) && (code.trim() || desc.trim());
  const doSave = async () => {
    setBusy(true);
    try {
      await onSave({ team: creatingNew ? "" : team, newNumber, newName, type, code, desc, notes, photos, keepKeys, match: { phase: matchPhase, num: matchNum } });
    } catch (e) {
      alert("Could not save: " + (e.message || e));
      setBusy(false);
    }
  };
  const submit = async () => {
    if (tourMode) return;
    if (!valid || busy) return;
    const selectedTeam = normNum(creatingNew ? newNumber : team);
    const selectedRule = normNum(code).replace(/[<>]/g, "");
    // duplicate guard (all users): same team + rule + match already logged
    if (!edit && selectedTeam && selectedRule) {
      const myKey = matchPhase !== "none" && matchNum ? `${matchPhase}:${matchNum}` : "";
      const dup = (viols || []).some((v) => {
        if (normNum(v.team) !== selectedTeam) return false;
        if (normNum(v.code).replace(/[<>]/g, "") !== selectedRule) return false;
        const vKey = v.match && v.match.phase && v.match.phase !== "none" && v.match.num ? `${v.match.phase}:${v.match.num}` : "";
        return vKey === myKey;
      });
      if (dup) {
        const where = myKey ? ` in ${fmtMatch({ phase: matchPhase, num: matchNum })}` : "";
        if (!window.confirm(`Possible duplicate — ${selectedTeam} already has ${fmtRule(selectedRule)}${where} logged. Add it again anyway?`)) return;
      }
    }
    await doSave();
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">{edit ? "Edit violation" : "New violation"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-300"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-4">
          {tourMode && <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-200"><b>Guided tour:</b> this is the real violation form, but saving is disabled while the tour is running.</div>}
          <button onClick={onSetName} className="w-full flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
            <UserCircle2 size={15} className="text-slate-400" />
            {me?.name ? <>Logging as <b className="text-slate-700 dark:text-slate-200">{me.name}</b></> : <span className="text-amber-600 font-medium">Tap to set your ref name (so entries are attributed)</span>}
          </button>

          <div>
            <Label>Team</Label>
            {creatingNew ? (
              <div className="space-y-2">
                <input autoFocus value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="Team number (e.g. 1234A)"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-slate-300" />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team name (optional)"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                {teams.length > 0 && <button onClick={() => setCreatingNew(false)} className="text-sm text-slate-500 dark:text-slate-400 underline">Pick an existing team instead</button>}
              </div>
            ) : (
              <select value={team} onChange={(e) => setTeam(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300">
                {teams.map((t) => <option key={t.number} value={t.number}>{t.number}{t.name ? ` — ${t.name}` : ""}</option>)}
              </select>
            )}
            {(() => {
              const rk = (teams.find((t) => t.number === team)?.photoKeys) || [];
              if (creatingNew || rk.length === 0) return null;
              return (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400">Robot on file:</span>
                  {rk.map((k) => <Thumb key={k} pkey={k} onOpen={onOpenPhoto} />)}
                </div>
              );
            })()}
          </div>

          <div>
            <Label>Match</Label>
            <div className="flex gap-2">
              <select value={matchPhase} onChange={(e) => { setMatchPhase(e.target.value); setMatchNum(""); }}
                className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300">
                {availablePhases(event).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              {(() => {
                if (matchPhase === "none") return null;
                const count = phaseCount(matchPhase, event);
                if (count) return (
                  <select value={matchNum} onChange={(e) => setMatchNum(e.target.value)}
                    className="w-32 px-2 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-300">
                    <option value="">Match…</option>
                    {Array.from({ length: count }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{fmtMatch({ phase: matchPhase, num: String(n) })}</option>)}
                  </select>
                );
                return (<input value={matchNum} onChange={(e) => setMatchNum(e.target.value)} placeholder={matchPhase === "skills" ? "run" : "#"} inputMode="numeric"
                  className="w-24 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-center focus:outline-none focus:ring-2 focus:ring-slate-300" />);
              })()}
            </div>
            {fmtMatch({ phase: matchPhase, num: matchNum }) && (<p className="text-[11px] text-slate-400 mt-1">Recorded as <b className="font-mono text-slate-600 dark:text-slate-300">{fmtMatch({ phase: matchPhase, num: matchNum })}</b></p>)}
            {(() => {
              const m = matchNum && matchPhase !== "none" ? matches?.[matchPhase === "qual" ? String(matchNum) : `${matchPhase}-${matchNum}`] : null;
              if (!m) return null;
              const chip = (num, color) => {
                const on = !creatingNew && team === num;
                return (
                  <button key={num} onClick={() => { setCreatingNew(false); setTeam(num); }}
                    className={`px-2.5 py-1.5 rounded-lg text-sm font-mono font-semibold border-2 transition ${on
                      ? (color === "red" ? "bg-red-600 text-white border-red-600" : "bg-blue-600 text-white border-blue-600")
                      : (color === "red" ? "bg-red-50 text-red-700 border-red-200 hover:border-red-400" : "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400")}`}>{num}</button>
                );
              };
              return (
                <div className="mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
                  <p className="text-[11px] text-slate-400 mb-1.5">Teams in this match — tap the one that committed the violation:</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.red.map((n) => chip(n, "red"))}
                    <span className="text-slate-300 px-1">vs</span>
                    {m.blue.map((n) => chip(n, "blue"))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div>
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {ORDER.map((ty) => { const M = TYPES[ty]; const on = type === ty; return (
                <button key={ty} onClick={() => setType(ty)} className={`py-2.5 rounded-lg border-2 font-semibold text-sm flex flex-col items-center gap-1 transition ${on ? `${M.solid} text-white border-transparent` : `bg-white dark:bg-slate-800 ${M.text} border-slate-200 dark:border-slate-700`}`}>
                  <M.Icon size={18} /> {M.label}
                </button>); })}
            </div>
          </div>

          <div>
            <Label>Rule cited</Label>
            <div className="flex gap-2 items-start">
              <button type="button" onClick={() => setShowRulePicker(true)}
                className="w-28 shrink-0 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300">
                {code ? <span className="text-slate-900 dark:text-slate-100 font-semibold">{fmtRule(code)}</span> : <span className="text-slate-400 font-sans">Rule…</span>}
              </button>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What the rule covers" rows={2}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm leading-snug resize-y focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Tap the box to pick a rule — search by code or description.</p>
          </div>

          <div>
            <Label>Robot photos</Label>
            <div className="flex gap-2 flex-wrap">
              {keepKeys.map((k) => (
                <div key={k} className="relative">
                  <Thumb pkey={k} onOpen={onOpenPhoto} />
                  <button onClick={() => setKeepKeys((ks) => ks.filter((x) => x !== k))} className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"><X size={13} /></button>
                </div>
              ))}
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700" alt="robot" />
                  <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"><X size={13} /></button>
                </div>
              ))}
              {keepKeys.length + photos.length < 6 && (<button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 grid place-items-center text-slate-400 hover:border-slate-400 hover:text-slate-500 dark:text-slate-400"><Camera size={22} /></button>)}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What happened, where on the field, who was told…"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-4 flex gap-2">
          <button onClick={onClose} className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-medium text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={submit} disabled={tourMode || !valid || busy} className={`flex-1 py-3 rounded-lg font-semibold text-white transition ${!tourMode && valid && !busy ? `${T.solid} ${T.solidHover}` : "bg-slate-300"}`}>{tourMode ? "Tour only · saving disabled" : busy ? "Saving…" : edit ? "Save changes" : "Save violation"}</button>
        </div>
      </div>
      {showRulePicker && (
        <RulePicker rules={rules} knownRules={knownRules}
          onPickRule={(c, d) => { setCode(c); setDesc(d || ""); setShowRulePicker(false); }}
          onPickCustom={(c) => { setCode(c); setShowRulePicker(false); }}
          onClose={() => setShowRulePicker(false)} />
      )}
    </div>
  );
}

/* ============================ RULE PICKER ============================ */
function RulePicker({ rules, knownRules, onPickRule, onPickCustom, onClose }) {
  const [q, setQ] = useState("");
  const [favoriteCodes, setFavoriteCodes] = useState(() => { try { return JSON.parse(localStorage.getItem("refosRuleFavorites") || "[]"); } catch { return []; } });
  const [recentCodes, setRecentCodes] = useState(() => { try { return JSON.parse(localStorage.getItem("refosRecentRules") || "[]"); } catch { return []; } });
  const query = q.trim();
  const uq = query.toUpperCase();
  const book = rules || [];
  const bookCodes = new Set(book.map((r) => r.code));
  const custom = Object.keys(knownRules || {}).filter((c) => !bookCodes.has(c)).map((c) => ({ code: c, desc: knownRules[c], category: "Previously used" }));
  const all = [...book, ...custom];
  const byCode = new Map(all.map((r) => [r.code, r]));
  const toggleFavorite = (code, e) => {
    e?.stopPropagation();
    const next = favoriteCodes.includes(code) ? favoriteCodes.filter((c) => c !== code) : [...favoriteCodes, code];
    setFavoriteCodes(next); localStorage.setItem("refosRuleFavorites", JSON.stringify(next));
  };
  const rememberRule = (code) => {
    const next = [code, ...recentCodes.filter((c) => c !== code)].slice(0, 8);
    setRecentCodes(next); localStorage.setItem("refosRecentRules", JSON.stringify(next));
  };
  const chooseRule = (r) => { rememberRule(r.code); onPickRule(r.code, r.desc); };
  const filtered = query ? all.filter((r) => r.code.toUpperCase().includes(uq) || (r.desc || "").toUpperCase().includes(uq)) : all;
  const groups = [];
  if (!query) {
    const favorites = favoriteCodes.map((c) => byCode.get(c)).filter(Boolean);
    const recent = recentCodes.filter((c) => !favoriteCodes.includes(c)).map((c) => byCode.get(c)).filter(Boolean);
    if (favorites.length) groups.push({ cat: "Favorites", items: favorites });
    if (recent.length) groups.push({ cat: "Recently used", items: recent });
  }
  const idx = {};
  for (const r of filtered) {
    if (!query && (favoriteCodes.includes(r.code) || recentCodes.includes(r.code))) continue;
    if (!(r.category in idx)) { idx[r.category] = groups.length; groups.push({ cat: r.category, items: [] }); }
    groups[idx[r.category]].items.push(r);
  }
  const exact = all.some((r) => r.code.toUpperCase() === uq);
  const showCustom = query && !exact;
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-800 flex flex-col font-sans">
      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="text-slate-500 dark:text-slate-400 p-1 -ml-1"><ChevronLeft size={22} /></button>
        <h2 className="font-bold text-slate-900 dark:text-slate-100">Cite a rule</h2>
      </div>
      <div className="p-3 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or description"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {showCustom && (
          <button onClick={() => onPickCustom(uq.replace(/[<>]/g, ""))} className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900">
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">Use {fmtRule(uq)}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">custom — not in the rulebook</span>
          </button>
        )}
        {groups.length === 0 && !showCustom && <p className="text-center text-slate-400 py-10">No rules match.</p>}
        {groups.map((g) => (
          <div key={g.cat}>
            <div className="sticky top-0 bg-slate-100 dark:bg-slate-700 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.cat}</div>
            {g.items.map((r) => (
              <div key={`${g.cat}-${r.code}`} className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">
                <button onClick={() => chooseRule(r)} className="flex-1 min-w-0 text-left px-4 py-2.5 flex gap-3 items-baseline">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 w-16 shrink-0">{fmtRule(r.code)}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{r.desc}</span>
                </button>
                <button type="button" onClick={(e) => toggleFavorite(r.code, e)} className={`px-3 shrink-0 ${favoriteCodes.includes(r.code) ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`}>
                  <Star size={17} fill={favoriteCodes.includes(r.code) ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ ADD TEAM MODAL ============================ */

function MatchList({ matches, teamName, teamRank = {}, viols, fieldLog = [], query, setQuery, onOpen, canAdd, onAddMatch, emcee, onOpenAwp }) {
  const [field, setField] = useState("all");
  const all = Object.values(matches);
  const hasElims = all.some((m) => m.phase && m.phase !== "qual");
  const [tab, setTab] = useState(() => hasElims ? "elim" : "qual"); // "qual" | "elim"

  // Elimination matches take priority once they exist. This also handles the
  // normal async load where MatchList first renders before matches arrive.
  useEffect(() => {
    if (hasElims) {
      setTab("elim");
      setField("all");
    } else {
      setTab("qual");
    }
  }, [hasElims]);

  const replaySet = new Set(fieldLog.filter((e) => e.kind === "replay" && e.matchId).map((e) => e.matchId));
  const timeoutSet = new Set(fieldLog.filter((e) => e.kind === "timeout" && e.matchId).map((e) => e.matchId));
  const faultSet = new Set(fieldLog.filter((e) => e.kind === "field_fault" && e.matchId).map((e) => e.matchId));
  const inTab = all.filter((m) => (tab === "qual" ? (m.phase || "qual") === "qual" : (m.phase && m.phase !== "qual")));
  const PHASE_ORDER = { qual: 0, practice: 1, r16: 2, qf: 3, sf: 4, final: 5 };
  const list = inTab.sort((a, b) => (PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]) || (a.num - b.num));
  const fields = [...new Set(list.map((m) => m.field).filter(Boolean))].sort();
  const vcount = {};
  for (const v of viols) {
    if (!v.match || !v.match.phase || v.match.phase === "none" || v.match.num == null) continue;
    const id = v.match.phase === "qual" ? String(v.match.num) : `${v.match.phase}-${v.match.num}`;
    vcount[id] = (vcount[id] || 0) + 1;
  }
  const q = query.trim().toUpperCase();
  const base = field === "all" ? list : list.filter((m) => m.field === field);
  const filtered = q
    ? base.filter((m) => String(m.num) === q || String(m.num).startsWith(q) || (m.label || "").toUpperCase().includes(q) || m.red.some((t) => t.includes(q)) || m.blue.some((t) => t.includes(q)))
    : base;
  const rowLabel = (m) => (m.phase === "qual" ? `Q${m.num}` : (fmtMatch({ phase: m.phase, num: m.num }) || m.label || `${m.phase} ${m.num}`));
  return (
    <>
      {!emcee && replaySet.size > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1.5 flex items-center gap-1"><RefreshCw size={13} /> Matches to re-run ({replaySet.size})</p>
          <div className="flex flex-wrap gap-1.5">
            {all.filter((m) => replaySet.has(m.id)).sort((a, b) => a.num - b.num).map((m) => (
              <button key={m.id} onClick={() => onOpen(m.id)} className="font-mono text-xs font-bold px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200">
                {m.phase === "qual" ? `Q${m.num}` : (fmtMatch({ phase: m.phase, num: m.num }) || m.label)}
              </button>
            ))}
          </div>
        </div>
      )}
      {(hasElims || canAdd) && (
        <div className="flex gap-1.5 mb-3">
          {[["qual", "Qualifications"], ["elim", "Eliminations"]].map(([k, lbl]) => (
            <button key={k} onClick={() => { setTab(k); setField("all"); }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${tab === k ? "bg-[#0D0F32] text-white border-[#0D0F32]" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>{lbl}</button>
          ))}
        </div>
      )}
      {fields.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {["all", ...fields].map((f) => (
            <button key={f} onClick={() => setField(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${field === f ? "bg-[#0D0F32] text-white border-[#0D0F32]" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600"}`}>
              {f === "all" ? "All fields" : f}
            </button>
          ))}
          <button onClick={onOpenAwp}
            className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600">
            AWP
          </button>
        </div>
      )}
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search match # or team"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>
      {tab === "elim" && canAdd && (
        <button onClick={onAddMatch} className="w-full mb-3 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium flex items-center justify-center gap-2 hover:border-slate-400"><Plus size={16} /> Add elimination match</button>
      )}
      {filtered.length === 0 ? (
        <Empty title={tab === "elim" ? "No elimination matches" : "No matches"} sub={tab === "elim" ? (canAdd ? "Add an elimination match, or import the bracket from Tournament Manager." : "Elimination matches will appear here once loaded.") : "Try a different match number or team."} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.id}>
              <button onClick={() => onOpen(m.id)} className="w-full text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 hover:border-slate-300 dark:border-slate-600 hover:shadow-sm transition">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 w-14 shrink-0">{rowLabel(m)}</span>
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-mono">
                  <span className="text-red-700 font-semibold">{m.red.join("  ")}</span>
                  <span className="text-slate-300 font-sans">vs</span>
                  <span className="text-blue-700 font-semibold">{m.blue.join("  ")}</span>
                </div>
                {m.field && <span className="text-[11px] text-slate-400 shrink-0">{m.field.replace("Field ", "F")}</span>}
                {m.redScore != null && m.blueScore != null && (
                  <span className="font-mono text-xs font-bold shrink-0"><span className={m.winner === "red" ? "text-red-700 dark:text-red-300" : "text-slate-400"}>{m.redScore}</span><span className="text-slate-300">-</span><span className={m.winner === "blue" ? "text-blue-700 dark:text-blue-300" : "text-slate-400"}>{m.blueScore}</span></span>
                )}
                {!emcee && replaySet.has(m.id) && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700 shrink-0"><RefreshCw size={10} /> REPLAY</span>}
                {!emcee && timeoutSet.has(m.id) && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700 shrink-0">TO</span>}
                {!emcee && faultSet.has(m.id) && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700 shrink-0">FAULT</span>}
                {!emcee && vcount[m.id] ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 shrink-0">{vcount[m.id]}</span> : null}
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AwpStep({ label, sub, val, set }) {
  return (
    <div className="flex items-center justify-between">
      <div><div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</div><div className="text-[11px] text-slate-400">{sub}</div></div>
      <div className="flex items-center gap-2">
        <button onClick={() => set(Math.max(0, val - 1))} className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 text-lg font-bold leading-none">−</button>
        <span className="w-7 text-center font-mono font-bold text-lg">{val}</span>
        <button onClick={() => set(val + 1)} className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 text-lg font-bold leading-none">+</button>
      </div>
    </div>
  );
}

function AwpAlliance({ color, th, state, onChange }) {
  const { pins, goals, perim, noViol } = state;
  const pinsOk = pins >= th.pins, goalsOk = goals >= th.goals;
  const pass = pinsOk && goalsOk && perim && noViol;
  const isRed = color === "red";
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${isRed ? "border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20" : "border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20"}`}>
      <div className={`text-xs font-bold uppercase tracking-wide ${isRed ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"}`}>{color} alliance</div>
      <AwpStep label="Pins Scored" sub={`Need ${th.pins}+`} val={pins} set={(n) => onChange({ pins: n })} />
      <AwpStep label="Goals with 2+ Pins" sub={`Need ${th.goals}+`} val={goals} set={(n) => onChange({ goals: n })} />
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={perim} onChange={(e) => onChange({ perim: e.target.checked })} className="w-4 h-4 accent-emerald-600" /> Robots off the Field Perimeter</label>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={noViol} onChange={(e) => onChange({ noViol: e.target.checked })} className="w-4 h-4 accent-emerald-600" /> No auton violations</label>
      <div className={`rounded-lg p-2.5 text-sm font-bold ${pass ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}>
        {pass ? "\u2713 AWP can be awarded" : "AWP not met yet"}
        {!pass && (
          <ul className="mt-1 font-normal text-xs space-y-0.5">
            {!pinsOk && <li>• {th.pins}+ Pins (have {pins})</li>}
            {!goalsOk && <li>• {th.goals}+ Goals with 2+ Pins (have {goals})</li>}
            {!perim && <li>• Both robots off the Field Perimeter</li>}
            {!noViol && <li>• No auton violations</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

// AWP (Autonomous Win Point) checklist — a manual aid for the head ref. No live field
// data exists in the app, so the ref enters what they saw at the end of auton for BOTH
// alliances at once and this evaluates each against the v2.0 criteria.
// Signature/Worlds-qualifying = 7 Pins / 3 Goals; standard events = 6 Pins / 2 Goals.
// "Save to match log" writes the result to the field log so the match can be referenced later.
function AwpChecker({ onSave }) {
  const [sig, setSig] = useState(true);
  const [red, setRed] = useState({ pins: 0, goals: 0, perim: true, noViol: true });
  const [blue, setBlue] = useState({ pins: 0, goals: 0, perim: true, noViol: true });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const th = sig ? { pins: 7, goals: 3 } : { pins: 6, goals: 2 };
  const summarize = (label, s) => {
    const ok = s.pins >= th.pins && s.goals >= th.goals && s.perim && s.noViol;
    const gaps = [];
    if (s.pins < th.pins) gaps.push(`pins ${s.pins}/${th.pins}`);
    if (s.goals < th.goals) gaps.push(`goals ${s.goals}/${th.goals}`);
    if (!s.perim) gaps.push("on perimeter");
    if (!s.noViol) gaps.push("auton violation");
    return `${label}: ${ok ? "MET" : "NOT met"} (${s.pins}P/${s.goals}G${!ok && gaps.length ? " — " + gaps.join(", ") : ""})`;
  };
  const doSave = async () => {
    if (!onSave) return;
    const note = `AWP ${sig ? "Sig 7/3" : "Std 6/2"} — ${summarize("Red", red)}; ${summarize("Blue", blue)}`;
    setSaving(true);
    try {
      await onSave(note);
      setSavedMsg("Saved to the match log ✓");
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (e) {
      alert(e.message || "Couldn't save the AWP result.");
    } finally { setSaving(false); }
  };
  return (
    <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">Criteria (exclude anything across the auton line)</span>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setSig(true)} className={`px-2 py-1 rounded-md text-xs font-semibold border ${sig ? "bg-[#0D0F32] text-white border-[#0D0F32]" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600"}`}>Signature 7/3</button>
          <button onClick={() => setSig(false)} className={`px-2 py-1 rounded-md text-xs font-semibold border ${!sig ? "bg-[#0D0F32] text-white border-[#0D0F32]" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600"}`}>Standard 6/2</button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <AwpAlliance color="red" th={th} state={red} onChange={(patch) => setRed((s) => ({ ...s, ...patch }))} />
        <AwpAlliance color="blue" th={th} state={blue} onChange={(patch) => setBlue((s) => ({ ...s, ...patch }))} />
      </div>
      {onSave && (
        <button onClick={doSave} disabled={saving} className="w-full py-2.5 rounded-lg bg-[#0D0F32] text-white font-semibold flex items-center justify-center gap-2 disabled:bg-slate-300 hover:bg-[#171a45]"><Save size={16} /> {saving ? "Saving…" : "Save result to match log"}</button>
      )}
      {savedMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center font-medium">{savedMsg}</p>}
      <p className="text-[11px] text-slate-400">Manual aid — enter what you saw at the end of auton. It changes no scores; Tournament Manager records the official AWP. Saving keeps a copy in this match's log for later reference. Every saved result is also collected in the <b>AWP tab</b>, where you can see the match and which criteria each alliance met.</p>
    </div>
  );
}

function MatchDetail({ match, matches, teamName, teamRank = {}, teamWatch = {}, viols, onNav, onLogTeam, onOpenPhoto, onDeleteViolation, onEditViolation, fieldLog = [], onAddField, onRemoveField, meName, canDelete, emcee }) {
  const [toOpen, setToOpen] = useState(false);
  const [toAlliance, setToAlliance] = useState("red");
  const [toTeam, setToTeam] = useState("");
  const [faultOpen, setFaultOpen] = useState(false);
  const [faultNote, setFaultNote] = useState("");
  const [awpOpen, setAwpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!match) return <Empty title="Match not found" sub="This match isn't in the loaded schedule." />;
  const m = match;
  const heading = m.phase === "qual" ? `Q${m.num}` : (fmtMatch({ phase: m.phase, num: m.num }) || m.label || `${m.phase} ${m.num}`);
  const matchEntries = fieldLog.filter((e) => e.matchId === m.id).sort((a, b) => b.createdAt - a.createdAt);
  const replayEntry = matchEntries.find((e) => e.kind === "replay");
  const allTimeouts = fieldLog.filter((e) => e.kind === "timeout");
  const allianceTeams = toAlliance === "red" ? (m.red || []) : (m.blue || []);
  const isElim = m.phase && m.phase !== "qual" && m.phase !== "practice";
  const doTimeout = async () => {
    if (busy) return;
    // one timeout per alliance for the whole elimination bracket — an alliance is its set of teams
    const usedTeams = new Set();
    for (const e of allTimeouts) {
      const roster = (e.teams && e.teams.length) ? e.teams : (e.team ? [e.team] : []);
      roster.forEach((t) => usedTeams.add(t));
    }
    const clash = allianceTeams.find((t) => usedTeams.has(t));
    if (clash) {
      if (!confirm(`This alliance already used its timeout — each alliance gets only one for the elimination bracket. Log another anyway?`)) return;
    } else if (toTeam && usedTeams.has(toTeam)) {
      if (!confirm(`Team ${toTeam} already called a timeout. Log another anyway?`)) return;
    }
    setBusy(true);
    try { await onAddField({ kind: "timeout", matchId: m.id, matchRef: heading, alliance: toAlliance, team: toTeam || "", teams: allianceTeams, note: "" }); setToOpen(false); setToTeam(""); setToAlliance("red"); }
    catch (e) { alert("Could not save: " + (e.message || e)); }
    setBusy(false);
  };
  const doFault = async () => {
    if (busy) return; setBusy(true);
    try { await onAddField({ kind: "field_fault", matchId: m.id, matchRef: heading, note: faultNote.trim() }); setFaultOpen(false); setFaultNote(""); }
    catch (e) { alert("Could not save: " + (e.message || e)); }
    setBusy(false);
  };
  const toggleReplay = async () => {
    if (busy) return; setBusy(true);
    try {
      if (replayEntry) { await onRemoveField(replayEntry.id); }
      else { await onAddField({ kind: "replay", matchId: m.id, matchRef: heading, note: "" }); }
    } catch (e) { alert("Could not save: " + (e.message || e)); }
    setBusy(false);
  };
  // siblings in the same phase, ordered by num, for prev/next + jump
  const siblings = Object.values(matches || {}).filter((x) => (x.phase || "qual") === (m.phase || "qual")).sort((a, b) => a.num - b.num);
  const ids = siblings.map((x) => x.id);
  const idx = ids.indexOf(m.id);
  const prev = idx > 0 ? ids[idx - 1] : null;
  const next = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;
  const mv = viols.filter((v) => v.match && v.match.phase === m.phase && String(v.match.num) === String(m.num)).sort((a, b) => b.createdAt - a.createdAt);
  const stat = {};
  for (const v of viols) {
    const t = v.team;
    stat[t] = stat[t] || { total: 0, minor: 0, major: 0, inspection: 0, codes: {} };
    stat[t].total++; stat[t][v.type] = (stat[t][v.type] || 0) + 1;
    const code = v.code || "—";
    stat[t].codes[code] = (stat[t].codes[code] || 0) + 1;
  }
  const Alliance = ({ label, teams, color }) => (
    <div className={`rounded-xl border p-3 ${color === "red" ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${color === "red" ? "text-red-700" : "text-blue-700"}`}>{label}</p>
      <div className="space-y-2">
        {teams.map((n) => {
          const s = stat[n];
          return (
            <button key={n} onClick={emcee ? undefined : () => onLogTeam(n)} className={`w-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left ${emcee ? "cursor-default" : "hover:border-slate-300 dark:border-slate-600"}`}>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{n}</span>
                {teamRank[n] != null && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800 text-[11px] font-bold shrink-0">Rank {teamRank[n]}</span>}
                {teamName[n] && <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{teamName[n]}</span>}
                {!emcee && <span className="ml-auto text-xs font-semibold text-[#D7212B] flex items-center gap-1 shrink-0"><Plus size={14} /> Log</span>}
              </div>
              {!emcee && s && s.total > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Prior:</span>
                  {ORDER.map((ty) => s[ty] ? (
                    <span key={ty} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border ${TYPES[ty].badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${TYPES[ty].dot}`} />{s[ty]}
                    </span>) : null)}
                  {Object.entries(s.codes).sort((a, b) => b[1] - a[1]).map(([c, n2]) => (
                    <span key={c} className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{fmtRule(c)}{n2 > 1 ? <span className="text-slate-400">×{n2}</span> : null}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-mono font-bold text-2xl text-slate-900 dark:text-slate-100 leading-none">{heading}</div>
            {match.field && <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{match.field}</div>}
            {m.redScore != null && m.blueScore != null && (
              <div className="mt-2 inline-flex items-center gap-2 text-sm font-mono font-bold">
                <span className={`px-2 py-0.5 rounded ${m.winner === "red" ? "bg-red-600 text-white" : "text-red-700 dark:text-red-300"}`}>{m.redScore}</span>
                <span className="text-slate-400">–</span>
                <span className={`px-2 py-0.5 rounded ${m.winner === "blue" ? "bg-blue-600 text-white" : "text-blue-700 dark:text-blue-300"}`}>{m.blueScore}</span>
                <span className="ml-1 text-xs font-sans font-semibold text-slate-500 dark:text-slate-400">{m.winner === "tie" ? "Tie" : m.winner === "red" ? "Red wins" : m.winner === "blue" ? "Blue wins" : ""}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => prev && onNav(prev)} disabled={!prev} title="Previous match"
              className={`p-2 rounded-lg border ${prev ? "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900" : "border-slate-200 dark:border-slate-700 text-slate-300"}`}><ChevronLeft size={18} /></button>
            <button onClick={() => next && onNav(next)} disabled={!next}
              className={`px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-1 ${next ? "bg-[#D7212B] text-white hover:bg-[#B42024]" : "bg-slate-200 dark:bg-slate-600 text-slate-400"}`}>Next <ChevronRight size={16} /></button>
          </div>
        </div>
        {ids.length > 1 && (
          <select value={m.id} onChange={(e) => onNav(e.target.value)}
            className="w-full mt-3 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
            {siblings.map((x) => <option key={x.id} value={x.id}>Jump to {x.phase === "qual" ? `Q${x.num}` : (fmtMatch({ phase: x.phase, num: x.num }) || x.label)}</option>)}
          </select>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Alliance label="Red alliance" teams={match.red} color="red" />
        <Alliance label="Blue alliance" teams={match.blue} color="blue" />
      </div>
      {!emcee && (<div className="mb-4">
        <div className="flex gap-2">
          {isElim && <button onClick={() => { setToOpen((v) => !v); setFaultOpen(false); }} className={`flex-1 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-1.5 ${toOpen ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"}`}><Clock size={15} /> Timeout</button>}
          <button onClick={() => { setFaultOpen((v) => !v); setToOpen(false); }} className={`flex-1 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-1.5 ${faultOpen ? "bg-red-600 text-white border-red-600" : "bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"}`}><AlertTriangle size={15} /> Field fault</button>
          <button onClick={toggleReplay} className={`flex-1 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-1.5 ${replayEntry ? "bg-amber-500 text-white border-amber-500" : "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"}`}><RefreshCw size={15} /> {replayEntry ? "For replay ✓" : "Replay"}</button>
        </div>
        {!isElim && <button onClick={() => { setAwpOpen((v) => !v); setToOpen(false); setFaultOpen(false); }} className={`w-full mt-2 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-1.5 ${awpOpen ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"}`}><ClipboardCheck size={15} /> AWP check</button>}
        {!isElim && awpOpen && <AwpChecker onSave={(note) => onAddField({ kind: "awp", matchId: m.id, matchRef: heading, note })} />}
        {isElim && toOpen && (
          <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2">
            <div className="flex gap-2">
              {["red", "blue"].map((a) => (
                <button key={a} onClick={() => { setToAlliance(a); setToTeam(""); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold border capitalize ${toAlliance === a ? (a === "red" ? "bg-red-600 text-white border-red-600" : "bg-blue-600 text-white border-blue-600") : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"}`}>{a} alliance</button>
              ))}
            </div>
            <select value={toTeam} onChange={(e) => setToTeam(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
              <option value="">Tie to a team (optional)</option>
              {allianceTeams.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={doTimeout} disabled={busy} className="w-full py-2.5 rounded-lg bg-[#0D0F32] text-white font-semibold disabled:bg-slate-300">Log timeout</button>
          </div>
        )}
        {faultOpen && (
          <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2">
            <textarea value={faultNote} onChange={(e) => setFaultNote(e.target.value)} rows={2} placeholder="What happened? (optional)" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm" />
            <button onClick={doFault} disabled={busy} className="w-full py-2.5 rounded-lg bg-[#D7212B] text-white font-semibold disabled:bg-slate-300">Log field fault</button>
          </div>
        )}
        {matchEntries.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {matchEntries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 flex-wrap text-sm bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${kindColor(e.kind)}`}>{kindLabel(e.kind)}</span>
                {e.alliance && <span className={`text-[11px] font-semibold capitalize ${e.alliance === "red" ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"}`}>{e.alliance}</span>}
                {e.team && <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{e.team}</span>}
                {e.note && <span className="text-slate-600 dark:text-slate-300">{e.note}</span>}
                <span className="text-[11px] text-slate-400 ml-auto">{e.by ? `${e.by} · ` : ""}{fmtTime(e.createdAt)}</span>
                {(e.by === meName || canDelete) && <button onClick={() => onRemoveField(e.id)} className="refos-destructive-icon"><Trash2 size={13} /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>)}
      {(() => {
        const inMatch = [...(match.red || []), ...(match.blue || [])].flatMap((n) => teamWatch[n] || []);
        if (emcee || inMatch.length === 0) return null;
        return (
          <div className="mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1 flex items-center gap-1"><Star size={12} className="text-amber-500 fill-amber-500" /> Watchlist ({inMatch.length})</h2>
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 space-y-1.5">
              {inMatch.map((w) => (
                <p key={w.id} className="text-sm text-slate-700 dark:text-slate-200"><span className="font-mono font-bold">{w.team}</span> — <span className="font-semibold">{w.by || "Ref"}:</span> {w.note}</p>
              ))}
            </div>
          </div>
        );
      })()}
      {!emcee && (<>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">Violations in this match ({mv.length})</h2>
      {mv.length === 0 ? (
        <Empty title="No violations logged" sub="Tap a team above to log one for this match." />
      ) : (
        <ul className="space-y-2">{mv.map((v) => <ViolationCard key={v.id} v={v} onDelete={onDeleteViolation} onOpenPhoto={onOpenPhoto} onEdit={onEditViolation} showTeam />)}</ul>
      )}
      </>)}
    </>
  );
}

/* ============================ CLEAR MODAL ============================ */



function GuidedTour({ role, step, hasMatches, hasRules, onStep, onClose }) {
  const judge = role === "Judge Advisor";
  const emcee = role === "Emcee";
  const standard = [
    { title: "Teams", text: "The tour has switched Ref OS to Teams. Use this section when you are starting with a team number, reviewing its history, or opening its record.", hint: "You are looking at the live Teams section behind this card." },
    { title: "Finding a team", text: "Use the search box to find a team quickly. Opening a team shows its event information, violations, robot information, and team specific actions.", hint: "Try scrolling the Teams list behind the tour." },
    { title: "Matches", text: hasMatches ? "Ref OS has now switched to Matches. This is the normal field workflow for finding the match you are working." : "This event does not currently have imported matches, so the tour cannot open the Matches section yet.", hint: hasMatches ? "The live Matches list is behind this card." : "Import a match schedule from TM Sync Center to enable this part." },
    { title: "Opening a match", text: hasMatches ? "The tour has opened the first match in the event. A match page shows Red and Blue teams, team history, field tools, AWP controls for qualifications, and existing violations." : "Once matches are imported, tapping any match opens the full match detail screen.", hint: hasMatches ? "This is a real match screen. The tour is not changing it." : "No match data is available right now." },
    { title: "Logging a violation", text: emcee ? "Emcee mode is view focused, so violation entry is not available in this role." : "The actual New Violation form is open behind this card. A referee selects the team and match, chooses Minor, Major, or Inspection, cites the rule, adds notes or photos, then saves.", hint: emcee ? "Switch to a Referee role to practice violation entry." : "Saving is disabled while the guided tour is active, so you can safely explore the real form." },
    { title: "Rules", text: hasRules ? "The tour has switched to Rules. Search by rule code or description, and tap a rule when you need the exact event reference." : "No rulebook is loaded for this event yet, so the Rules section cannot be demonstrated.", hint: hasRules ? "The live rulebook is visible behind this card." : "Load rules to enable this step." },
    { title: "Field Log", text: "The actual Field Log is open behind the tour. This is where operational entries such as replays, field faults, timeouts, and saved field information are reviewed.", hint: "Close the tour later and the Field Log works normally." },
    { title: "Alliances", text: "The tour has moved to Alliances. This section is used to follow alliance selection and the elimination bracket. Editing depends on the current role and Admin permissions.", hint: "The live Alliances section is behind this card." },
    { title: "Event contacts", text: "The Event Contact Directory is open behind the tour. Everyone can view event leadership and support contacts. Admin controls the shared directory.", hint: "Phone and email links are usable outside the tour." },
    { title: "Done", text: "That is the core Ref OS workflow. You can run this guided tour again from the gear menu at any time.", hint: "Finish returns you to normal Ref OS operation." },
  ];
  const judgeSteps = [
    { title: "Judging", text: "The tour has opened the live Judging section. This is the Judge Advisor's primary workspace for nominations and finalist information.", hint: "The Judging screen is behind this card." },
    { title: "Judging workflow", text: "Use this area to review nomination information and finalists during deliberations. Official nomination export is handled through Admin tools.", hint: "Nothing in the tour changes judging data." },
    { title: "Alliances", text: "The tour has switched to Alliances. Judge Advisors can see alliance selection and the bracket without editing it.", hint: "Judge Advisor bracket access remains view only." },
    { title: "Done", text: "You can run the guided tour again from the gear menu whenever you need a refresher.", hint: "Finish returns to normal Ref OS operation." },
  ];
  const steps = judge ? judgeSteps : standard;
  const safeStep = Math.min(step, steps.length - 1);
  const cur = steps[safeStep];
  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      <div className="absolute left-3 right-3 bottom-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[560px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden pointer-events-auto">
        <div className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2">
          <PlayCircle size={19}/><div className="font-bold">Guided tour</div>
          <div className="ml-2 text-xs text-slate-400">{safeStep + 1} of {steps.length}</div>
          <button onClick={onClose} className="ml-auto"><X size={21}/></button>
        </div>
        <div className="p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-[#D7212B]">{cur.title}</div>
          <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{cur.text}</p>
          <div className="mt-2 rounded-lg bg-slate-100 dark:bg-slate-900 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{cur.hint}</div>
          <div className="flex gap-1.5 mt-4">{steps.map((_,i)=><div key={i} className={`h-1.5 flex-1 rounded-full ${i <= safeStep ? "bg-[#D7212B]" : "bg-slate-200 dark:bg-slate-700"}`}/>)}</div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={() => safeStep ? onStep(safeStep - 1) : onClose()} className="rounded-xl border px-4 py-2.5 font-semibold">{safeStep ? "Back" : "Exit"}</button>
            <button onClick={() => safeStep < steps.length - 1 ? onStep(safeStep + 1) : onClose()} className="rounded-xl bg-[#0D0F32] text-white px-4 py-2.5 font-semibold">{safeStep < steps.length - 1 ? "Next" : "Finish"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}


function PreEventSystemTest({ eventId, adminUnlocked, onClose, onComplete }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const addResult = (key, label, status, detail = "") => setResults((cur) => [...cur.filter((r) => r.key !== key), { key, label, status, detail }]);

  const run = async () => {
    setRunning(true);
    setResults([]);

    try {
      const key = `refosSystemTest:${Date.now()}`;
      localStorage.setItem(key, "ok");
      const ok = localStorage.getItem(key) === "ok";
      localStorage.removeItem(key);
      addResult("storage", "Browser storage", ok ? "pass" : "fail", ok ? "Local storage read and write succeeded." : "Local storage did not return the test value.");
    } catch (e) {
      addResult("storage", "Browser storage", "fail", e.message || String(e));
    }

    addResult("admin", "Admin session", adminUnlocked ? "pass" : "fail", adminUnlocked ? "Admin mode is unlocked on this device." : "Admin mode is not unlocked.");

    const swSupported = "serviceWorker" in navigator;
    addResult("sw-support", "Service worker support", swSupported ? "pass" : "fail", swSupported ? "This browser supports service workers." : "Service workers are not supported.");
    addResult("sw-control", "App controlled by service worker", navigator.serviceWorker?.controller ? "pass" : "check",
      navigator.serviceWorker?.controller ? "The current Ref OS page is controlled by a service worker." : "The page is not currently controlled by a service worker. Refresh or reopen Ref OS after installation.");

    try {
      const cacheNames = "caches" in window ? await caches.keys() : [];
      addResult("cache", "Offline cache", cacheNames.length ? "pass" : "check", cacheNames.length ? `${cacheNames.length} browser cache${cacheNames.length === 1 ? "" : "s"} detected.` : "No browser caches were found.");
    } catch (e) {
      addResult("cache", "Offline cache", "check", e.message || String(e));
    }

    try {
      await api.listFieldLog(eventId);
      addResult("db-read", "Database read", "pass", "Ref OS successfully read shared event data.");
    } catch (e) {
      addResult("db-read", "Database read", "fail", e.message || String(e));
    }

    let saved = null;
    try {
      let realtimeSeen = false;
      let realtimeResolve;
      const realtimePromise = new Promise((resolve) => { realtimeResolve = resolve; });
      const unsub = api.subscribeEvent(eventId, () => {
        realtimeSeen = true;
        realtimeResolve(true);
      });
      saved = await api.addFieldLog(eventId, {
        kind: "system_test",
        note: JSON.stringify({ purpose: "pre_event_test", createdAt: Date.now() }),
        by: "Ref OS System Test",
      });
      addResult("db-write", "Database write", "pass", "A temporary event test record was created successfully.");
      await Promise.race([realtimePromise, new Promise((resolve) => setTimeout(resolve, 3500))]);
      unsub?.();
      addResult("realtime", "Realtime event sync", realtimeSeen ? "pass" : "check",
        realtimeSeen ? "A realtime database change was received on this device." : "The database write worked, but no realtime callback arrived within 3.5 seconds. Use Two Device Sync Test for a full verification.");
    } catch (e) {
      addResult("db-write", "Database write", "fail", e.message || String(e));
      addResult("realtime", "Realtime event sync", "check", "Realtime could not be verified because the temporary database write failed.");
    } finally {
      if (saved?.id) {
        try { await api.deleteFieldLog(saved.id); }
        catch {}
      }
    }

    try {
      const parsed = parseTeamsFile("Team Number,Team Name\n1234A,Ref OS System Test", "teams.csv");
      const ok = parsed.rows?.some((r) => r.number === "1234A");
      addResult("tm", "Tournament Manager parser", ok ? "pass" : "fail", ok ? "A sample TM style team CSV parsed successfully." : "The sample TM parser test did not return the expected team.");
    } catch (e) {
      addResult("tm", "Tournament Manager parser", "fail", e.message || String(e));
    }

    try {
      const pdf = await PDFDocument.create();
      pdf.addPage([200, 200]);
      const bytes = await pdf.save();
      addResult("pdf", "PDF generation", bytes?.length ? "pass" : "fail", bytes?.length ? "A test PDF was generated in memory." : "The PDF test did not produce output.");
    } catch (e) {
      addResult("pdf", "PDF generation", "fail", e.message || String(e));
    }

    setRunning(false);
  };

  useEffect(() => { run(); }, []);

  useEffect(() => {
    if (!running && results.length) {
      onComplete?.({ ranAt: Date.now(), results });
    }
  }, [running, results]);

  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const check = results.filter((r) => r.status === "check").length;
  const badge = (status) => status === "pass"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : status === "fail"
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";

  return (
    <div className="fixed inset-0 z-[80] bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2">
        <ClipboardCheck size={20}/>
        <div><h2 className="font-bold">Pre Event System Test</h2><p className="text-xs text-slate-400">Run before volunteers begin using Ref OS</p></div>
        <button onClick={onClose} className="ml-auto"><X size={22}/></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border bg-white dark:bg-slate-800 p-3"><div className="text-xs text-slate-400">PASS</div><div className="text-2xl font-bold text-emerald-600">{pass}</div></div>
            <div className="rounded-xl border bg-white dark:bg-slate-800 p-3"><div className="text-xs text-slate-400">CHECK</div><div className="text-2xl font-bold text-amber-600">{check}</div></div>
            <div className="rounded-xl border bg-white dark:bg-slate-800 p-3"><div className="text-xs text-slate-400">FAIL</div><div className="text-2xl font-bold text-red-600">{fail}</div></div>
          </div>
          {results.map((r) => (
            <div key={r.key} className="rounded-xl border bg-white dark:bg-slate-800 p-4">
              <div className="flex items-center gap-3">
                <div className="font-semibold flex-1">{r.label}</div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${badge(r.status)}`}>{r.status}</span>
              </div>
              {r.detail && <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{r.detail}</div>}
            </div>
          ))}
          {running && <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 flex items-center gap-2"><RefreshCw size={17} className="animate-spin"/> Running system checks…</div>}
          <button disabled={running} onClick={run} className="w-full rounded-xl bg-[#0D0F32] text-white py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"><RefreshCw size={17}/> Run again</button>
          <div className="text-xs text-slate-500 dark:text-slate-400">The temporary database record created by this test is deleted automatically. For full cross device realtime verification, use Two Device Sync Test.</div>
        </div>
      </div>
    </div>
  );
}

function TwoDeviceSyncTest({ fieldLog, deviceId, meName, onAdd, onRemove, onClose }) {
  const parse = (e) => {
    try { return JSON.parse(e.note || "{}"); } catch { return {}; }
  };
  const probes = (fieldLog || []).filter((e) => e.kind === "sync_probe").sort((a,b) => b.createdAt - a.createdAt);
  const latestProbe = probes[0] || null;
  const probeData = latestProbe ? parse(latestProbe) : null;
  const acks = latestProbe ? (fieldLog || []).filter((e) => e.kind === "sync_ack" && parse(e).token === probeData?.token) : [];
  const remoteAcks = acks.filter((e) => parse(e).deviceId && parse(e).deviceId !== probeData?.deviceId);
  const isStarter = probeData?.deviceId === deviceId;
  const alreadyAckedHere = acks.some((e) => parse(e).deviceId === deviceId);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await onAdd({
        kind: "sync_probe",
        note: JSON.stringify({ token, deviceId, startedBy: meName || "Admin", startedAt: Date.now() }),
      });
    } catch (e) {
      alert("Could not start sync test: " + (e.message || e));
    }
    setBusy(false);
  };

  const acknowledge = async () => {
    if (!latestProbe || !probeData?.token || alreadyAckedHere) return;
    setBusy(true);
    try {
      await onAdd({
        kind: "sync_ack",
        note: JSON.stringify({ token: probeData.token, deviceId, by: meName || "Admin", at: Date.now() }),
      });
    } catch (e) {
      alert("Could not confirm sync test: " + (e.message || e));
    }
    setBusy(false);
  };

  const clear = async () => {
    setBusy(true);
    const ids = [...probes, ...(fieldLog || []).filter((e) => e.kind === "sync_ack")].map((e) => e.id);
    for (const id of ids) {
      try { await onRemove(id); } catch {}
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2">
        <Wifi size={20}/>
        <div><h2 className="font-bold">Two Device Sync Test</h2><p className="text-xs text-slate-400">Verify shared realtime data between two devices</p></div>
        <button onClick={onClose} className="ml-auto"><X size={22}/></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          {!latestProbe ? (
            <div className="rounded-xl border bg-white dark:bg-slate-800 p-5">
              <h3 className="font-bold">Device 1</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Start the test here. Then open Ref OS on a second device, unlock Admin mode, open this same test, and confirm the probe.</p>
              <button disabled={busy} onClick={start} className="mt-4 w-full rounded-xl bg-[#0D0F32] text-white py-3 font-semibold">Start sync test</button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-white dark:bg-slate-800 p-4">
                <div className="text-xs uppercase font-bold text-slate-400">Active test</div>
                <div className="font-bold mt-1">Started by {probeData?.startedBy || "Admin"}</div>
                <div className="text-sm text-slate-500 mt-1">Waiting for a different device to receive and acknowledge this shared probe.</div>
              </div>

              {isStarter ? (
                <div className={`rounded-xl border p-5 ${remoteAcks.length ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"}`}>
                  <div className="font-bold">{remoteAcks.length ? "PASS · second device confirmed" : "Waiting for Device 2"}</div>
                  <div className="text-sm mt-1 text-slate-600 dark:text-slate-300">
                    {remoteAcks.length
                      ? `Realtime sync was confirmed by ${parse(remoteAcks[0]).by || "another Admin device"}.`
                      : "On Device 2, open Command Center → Two Device Sync Test and tap Confirm on this device."}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 p-5">
                  <div className="font-bold">Device 2 detected the shared test</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">This proves the probe reached this device. Confirm it to send an acknowledgement back to Device 1.</div>
                  <button disabled={busy || alreadyAckedHere} onClick={acknowledge} className="mt-4 w-full rounded-xl bg-[#0D0F32] text-white py-3 font-semibold disabled:opacity-50">{alreadyAckedHere ? "Confirmed on this device" : "Confirm on this device"}</button>
                </div>
              )}
            </>
          )}
          {(latestProbe || acks.length) && <button disabled={busy} onClick={clear} className="w-full rounded-xl border border-red-200 text-red-700 dark:text-red-300 py-3 font-semibold">Clear sync test data</button>}
          <div className="text-xs text-slate-500 dark:text-slate-400">The test uses temporary hidden system records. They do not appear in Field Log.</div>
        </div>
      </div>
    </div>
  );
}

function EventDiagnosticReport({ event, eventId, teams, matches, viols, rules, fieldLog, presence, roster, contacts, countdown, tmSyncStatus, online, pendingCount, queuedWrites = 0, failedSyncCount = 0, cloudReachable = null, lastCloudError = "", syncedAt = 0, syncing = false, lastSystemTest, onClose }) {
  const [runtime, setRuntime] = useState({ cacheCount: null, swControlled: false, swSupported: false });
  useEffect(() => {
    (async () => {
      let cacheCount = null;
      try { cacheCount = "caches" in window ? (await caches.keys()).length : null; } catch {}
      setRuntime({
        cacheCount,
        swControlled: !!navigator.serviceWorker?.controller,
        swSupported: "serviceWorker" in navigator,
      });
    })();
  }, []);

  const internalKinds = new Set(["announcement","event_countdown","contact_directory","system_test","sync_probe","sync_ack","role_access_codes","feedback"]);
  const operationalFieldLog = (fieldLog || []).filter((e) => !internalKinds.has(e.kind));
  const report = {
    generatedAt: new Date().toISOString(),
    app: {
      version: APP_VERSION,
      mode: import.meta.env.MODE || "unknown",
      url: typeof location !== "undefined" ? location.href : "",
    },
    event: {
      id: eventId,
      name: event?.name || "",
      qualificationMatchesConfigured: event?.quals ?? null,
    },
    device: {
      userAgent: navigator.userAgent,
      platform: navigator.platform || "",
      language: navigator.language || "",
      online: !!online,
      serviceWorkerSupported: runtime.swSupported,
      serviceWorkerControlled: runtime.swControlled,
      cacheCount: runtime.cacheCount,
      pendingOfflineChanges: pendingCount,
      queuedWrites,
      failedSyncItems: failedSyncCount,
      cloudReachable,
      cloudSyncing: syncing,
      lastSuccessfulCloudSync: syncedAt ? new Date(syncedAt).toISOString() : null,
      lastCloudError: lastCloudError || null,
      displayMode: window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true ? "standalone" : "browser",
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
    data: {
      teams: (teams || []).length,
      matches: Object.keys(matches || {}).length,
      violations: (viols || []).length,
      rules: (rules || []).length,
      operationalFieldLogEntries: operationalFieldLog.length,
      eventContacts: (contacts || []).length,
      volunteersSeen: (roster || []).length,
      volunteersOnline: (presence || []).length,
      activeCountdown: !!countdown,
    },
    tournamentManager: tmSyncStatus || {},
    lastPreEventSystemTest: lastSystemTest || null,
  };

  const text = JSON.stringify(report, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Diagnostic report copied.");
    } catch {
      alert("Could not copy automatically. Use Download report instead.");
    }
  };
  const download = () => {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ref-os-diagnostic-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2">
        <ShieldCheck size={20}/>
        <div><h2 className="font-bold">Admin Diagnostics</h2><p className="text-xs text-slate-400">Cloud, device, sync, and app health</p></div>
        <button onClick={onClose} className="ml-auto"><X size={22}/></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[["Teams",report.data.teams],["Matches",report.data.matches],["Violations",report.data.violations],["Online",report.data.volunteersOnline]].map(([l,v]) =>
              <div key={l} className="rounded-xl border bg-white dark:bg-slate-800 p-3"><div className="text-xs text-slate-400">{l}</div><div className="text-2xl font-bold">{v}</div></div>
            )}
          </div>

          <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 space-y-2 text-sm">
            <div className="font-bold">Connection & Sync</div>
            <div className="flex justify-between"><span>Network</span><b className={report.device.online ? "text-emerald-600" : "text-amber-600"}>{report.device.online ? "Online" : "Offline"}</b></div>
            <div className="flex justify-between"><span>Ref OS Cloud</span><b className={cloudReachable === true ? "text-emerald-600" : cloudReachable === false ? "text-red-600" : "text-slate-500"}>{syncing ? "Syncing" : cloudReachable === true ? "Connected" : cloudReachable === false ? "Unavailable" : "Checking"}</b></div>
            <div className="flex justify-between"><span>Last successful sync</span><b>{syncedAt ? ago(syncedAt) : "Not yet"}</b></div>
            <div className="flex justify-between"><span>Queued writes</span><b>{queuedWrites}</b></div>
            <div className="flex justify-between"><span>Failed sync items</span><b className={failedSyncCount ? "text-red-600" : ""}>{failedSyncCount}</b></div>
            {lastCloudError && <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2 text-xs text-red-700 dark:text-red-300 break-words">Last cloud error: {lastCloudError}</div>}
          </div>

          <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 space-y-2 text-sm">
            <div className="font-bold">Device & App</div>
            <div className="flex justify-between"><span>Ref OS version</span><b>v{APP_VERSION}</b></div>
            <div className="flex justify-between"><span>App mode</span><b>{report.device.displayMode === "standalone" ? "Installed PWA" : "Browser"}</b></div>
            <div className="flex justify-between"><span>Viewport</span><b>{report.device.viewport}</b></div>
            <div className="flex justify-between"><span>Service worker</span><b>{report.device.serviceWorkerControlled ? "Controlling app" : report.device.serviceWorkerSupported ? "Supported, not controlling" : "Unsupported"}</b></div>
            <div className="flex justify-between"><span>Offline caches</span><b>{runtime.cacheCount == null ? "Unknown" : runtime.cacheCount}</b></div>
          </div>

          <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 space-y-2 text-sm">
            <div className="font-bold">Shared event data</div>
            <div className="flex justify-between"><span>Rules</span><b>{report.data.rules}</b></div>
            <div className="flex justify-between"><span>Field Log entries</span><b>{report.data.operationalFieldLogEntries}</b></div>
            <div className="flex justify-between"><span>Event contacts</span><b>{report.data.eventContacts}</b></div>
            <div className="flex justify-between"><span>Volunteers seen</span><b>{report.data.volunteersSeen}</b></div>
            <div className="flex justify-between"><span>Event countdown</span><b>{report.data.activeCountdown ? "Active" : "None"}</b></div>
          </div>

          {lastSystemTest && (
            <div className="rounded-xl border bg-white dark:bg-slate-800 p-4">
              <div className="font-bold">Latest Pre Event System Test</div>
              <div className="text-sm text-slate-500 mt-1">{new Date(lastSystemTest.ranAt).toLocaleString()}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {lastSystemTest.results?.map((r) => <span key={r.key} className={`px-2 py-1 rounded-full text-xs font-bold ${r.status === "pass" ? "bg-emerald-100 text-emerald-700" : r.status === "fail" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{r.label}: {r.status.toUpperCase()}</span>)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={copy} className="rounded-xl border py-3 font-semibold flex items-center justify-center gap-2"><Copy size={17}/> Copy report</button>
            <button onClick={download} className="rounded-xl bg-[#0D0F32] text-white py-3 font-semibold flex items-center justify-center gap-2"><Download size={17}/> Download report</button>
          </div>
          <pre className="rounded-xl bg-slate-950 text-slate-200 p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words">{text}</pre>
        </div>
      </div>
    </div>
  );
}




function OnlineCluster({ presence, onClick }) {
  const names = [...new Set(presence.map((p) => p.name || "Ref"))];
  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;
  return (
    <button onClick={onClick} title={`${names.length} online`} className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full hover:bg-white/10">
      <div className="flex -space-x-2">
        {shown.map((n) => (
          <span key={n} className="w-6 h-6 rounded-full bg-[#D7212B] text-white text-[10px] font-bold grid place-items-center ring-2 ring-emerald-400">{initials(n)}</span>
        ))}
        {extra > 0 && <span className="w-6 h-6 rounded-full bg-white/20 text-white text-[10px] font-bold grid place-items-center ring-2 ring-[#0D0F32]">+{extra}</span>}
      </div>
    </button>
  );
}

function roleChip(role) {
  switch (role) {
    case "Admin": return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    case "Judge Advisor": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "Emcee": return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800";
    default: return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600";
  }
}

function OnlineList({ presence, roster, meName, onRemove, eventMembers = [], onSetAdmin }) {
  const onlineCounts = {};
  const roleByName = {};
  const userIdByName = {};
  for (const p of presence) {
    const n = p.name || "Ref";
    onlineCounts[n] = (onlineCounts[n] || 0) + 1;
    if (p.role) roleByName[n] = p.role;
    if (p.user_id) userIdByName[n] = p.user_id;
  }
  const all = new Map((roster || []).map((r) => [r.name, r]));
  Object.keys(onlineCounts).forEach((name) => { if (!all.has(name)) all.set(name, { name, lastSeen: Date.now() }); });
  const refs = [...all.values()].sort((a, b) => {
    const ao = !!onlineCounts[a.name], bo = !!onlineCounts[b.name];
    return Number(bo) - Number(ao) || a.name.localeCompare(b.name);
  });
  const onlineTotal = refs.filter((r) => onlineCounts[r.name]).length;
  return (
    <>
      <p className="text-xs text-slate-400 mb-3">{onlineTotal} online · {Math.max(0, refs.length - onlineTotal)} offline. Status updates live as volunteers join or leave.{onRemove ? " Tap the trash on an offline volunteer to remove them." : ""}</p>
      <ul className="space-y-2">
        {refs.map((r) => {
          const isOnline = !!onlineCounts[r.name];
          const presenceUserId = userIdByName[r.name];
          const member = eventMembers.find((m) =>
            (presenceUserId && m.user_id === presenceUserId) ||
            (m.name || "").trim().toLowerCase() === (r.name || "").trim().toLowerCase()
          );
          const adminTarget = member || (presenceUserId ? { user_id: presenceUserId, role: String(roleByName[r.name] || r.role || "").toLowerCase() } : null);
          const role = member?.role === "admin" ? "Admin" : (roleByName[r.name] || r.role || "");
          return (
            <li key={r.name} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full text-white text-xs font-bold grid place-items-center shrink-0 ${isOnline ? "bg-[#D7212B]" : "bg-slate-400"}`}>{initials(r.name)}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{r.name}{r.name === meName && <span className="text-xs text-slate-400 ml-1">(you)</span>}</span>
                  {role && <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border shrink-0 ${roleChip(role)}`}>{role}</span>}
                </div>
                {!isOnline && r.lastSeen > 0 && <div className="text-[11px] text-slate-400">last seen {ago(r.lastSeen)}</div>}
              </div>
              <span className={`ml-auto inline-flex items-center gap-1 text-xs shrink-0 ${isOnline ? "text-emerald-600" : "text-slate-400"}`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-300"}`} />
                {isOnline ? `online${onlineCounts[r.name] > 1 ? ` · ${onlineCounts[r.name]} devices` : ""}` : "offline"}
              </span>
              {onSetAdmin && adminTarget && isOnline && r.name !== meName && (
                adminTarget.role === "admin" ? (
                  <button onClick={() => { if (confirm(`Remove Admin access from ${r.name}?`)) onSetAdmin(adminTarget, false); }} className="refos-destructive-button text-[11px] shrink-0" title="Remove Admin access">Remove Admin</button>
                ) : (
                  <button onClick={() => { if (confirm(`Give ${r.name} Admin access without requiring the Admin password?`)) onSetAdmin(adminTarget, true); }} className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shrink-0" title="Give Admin access">Make Admin</button>
                )
              )}
              {onRemove && !isOnline && (
                <button onClick={() => { if (confirm(`Remove ${r.name} from the volunteer list?`)) onRemove(r.name); }} className="refos-destructive-icon shrink-0" title="Remove volunteer"><Trash2 size={15} /></button>
              )}
            </li>
          );
        })}
        {refs.length === 0 && <li className="text-sm text-slate-400 text-center py-6">No volunteers have joined this event yet.</li>}
      </ul>
    </>
  );
}

/* ============================ ROBOTS (inspection photos) ============================ */
function RobotList({ teams, query, setQuery, onOpen }) {
  const q = query.trim().toUpperCase();
  const list = [...teams].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  const filtered = q ? list.filter((t) => t.number.toUpperCase().includes(q) || (t.name || "").toUpperCase().includes(q)) : list;
  const withPhotos = teams.filter((t) => (t.photoKeys || []).length > 0).length;
  return (
    <>
      <p className="text-xs text-slate-400 mb-3">{withPhotos} of {teams.length} teams have a robot photo. Tap a team to add inspection photos.</p>
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team #"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>
      {filtered.length === 0 ? (
        <Empty title="No teams" sub="Try a different team number." />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filtered.map((t) => {
            const key = (t.photoKeys || [])[0];
            return (
              <li key={t.number}>
                <button onClick={() => onOpen(t.number)} className="w-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-slate-300 dark:border-slate-600 hover:shadow-sm transition text-left">
                  <div className="aspect-square bg-slate-100 dark:bg-slate-700 grid place-items-center">
                    {key ? <Thumb pkey={key} /> : <Camera size={26} className="text-slate-300" />}
                  </div>
                  <div className="px-2.5 py-2 flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{t.number}</span>
                    {(t.photoKeys || []).length > 0 && <span className="ml-auto text-[10px] font-semibold text-slate-400">{t.photoKeys.length}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function RobotDetail({ team, onAddPhoto, onRemovePhoto, onOpenPhoto, emcee }) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  if (!team) return <Empty title="Team not found" sub="" />;
  const photos = team.photoKeys || [];
  const add = async (files) => {
    const list = Array.from(files).slice(0, 6);
    setBusy(true);
    for (const f of list) {
      try { const d = await compress(f); await onAddPhoto(team.number, d); }
      catch (e) { alert("Couldn't save that photo — check your connection."); break; }
    }
    setBusy(false);
  };
  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="font-mono font-bold text-2xl text-slate-900 dark:text-slate-100 leading-none">{team.number}</div>
        {team.name && <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{team.name}</div>}
      </div>
      {!emcee && <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="w-full mb-4 bg-[#D7212B] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#B42024] disabled:bg-slate-300">
        <Camera size={18} /> {busy ? "Saving…" : photos.length ? "Add another photo" : "Add robot photo"}
      </button>}
      {!emcee && <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />}
      {photos.length === 0 ? (
        <Empty title="No robot photos yet" sub={emcee ? "No inspection photos have been added for this team." : "Snap the robot during inspection so refs can reference it later."} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700">
              <button onClick={() => onOpenPhoto(p)} className="w-full h-full"><Thumb pkey={p} /></button>
              {!emcee && <button onClick={() => { if (confirm("Delete this robot photo?")) onRemovePhoto(team.number, p); }}
                className="absolute top-1 right-1 refos-destructive-photo rounded-full p-1"><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ============================ JUDGING (award nominations) ============================ */
const AWARDS = [
  { key: "sportsmanship", label: "Sportsmanship", full: "Sportsmanship Award",
    blurb: "Recognizes a team that consistently shows respect, professionalism, fairness, and positive conduct.",
    criteria: ["Courteous, respectful, and kind to everyone", "Cooperative and competes in a friendly spirit", "Honest, professional, and acts with integrity", "Adds positively to the event for others"] },
  { key: "energy", label: "Energy", full: "Energy Award",
    blurb: "Recognizes a team that brings enthusiasm, excitement, positivity, and spirit to the competition.",
    criteria: ["Keeps energy and positivity high", "Passion for robotics that lifts the event", "Encourages and supports other participants", "Shows strong, positive team or school spirit", "Cheers and celebrates positively and appropriately", "Engages positively with teams, volunteers, and spectators"] },
];
const G_RULE = /^G[1-5]$/i;

function JudgingView({ noms, viols, teamName, finalists, onToggleFinalist, onNominate, onDeleteNom, onExport, emcee }) {
  const [award, setAward] = useState("sportsmanship");
  const [openTeam, setOpenTeam] = useState(null);

  // conduct flags: which G1–G5 rules each team has been cited for
  const gByTeam = {};
  for (const v of viols) {
    if (G_RULE.test(v.code || "")) {
      const t = v.team; (gByTeam[t] = gByTeam[t] || {});
      const c = (v.code || "").toUpperCase();
      gByTeam[t][c] = (gByTeam[t][c] || 0) + 1;
    }
  }

  const forAward = noms.filter((n) => n.award === award);
  const tally = {};
  for (const n of forAward) { tally[n.team] = tally[n.team] || { team: n.team, count: 0, noms: [] }; tally[n.team].count++; tally[n.team].noms.push(n); }
  const ranked = Object.values(tally).sort((a, b) => b.count - a.count || a.team.localeCompare(b.team, undefined, { numeric: true }));
  const cur = AWARDS.find((a) => a.key === award);

  return (
    <>
      {onExport && noms.length > 0 && (
        <div className="flex justify-end mb-2">
          <button onClick={onExport} className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-1.5"><Download size={15} /> Export nominations</button>
        </div>
      )}
      <div className="flex gap-1.5 mb-4">
        {AWARDS.map((a) => (
          <button key={a.key} onClick={() => { setAward(a.key); setOpenTeam(null); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${award === a.key ? "bg-[#0D0F32] text-white border-[#0D0F32]" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>{a.full}</button>
        ))}
      </div>

      <button onClick={() => onNominate(award)} className="w-full mb-4 bg-[#D7212B] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#B42024]">
        <Trophy size={18} /> Nominate a team for {cur.label}
      </button>

      {ranked.length === 0 ? (
        <Empty title="No nominations yet" sub={`Tap “Nominate a team” to add the first ${cur.label} nomination.`} />
      ) : (
        <ul className="space-y-2">
          {ranked.map((row, i) => {
            const g = gByTeam[row.team];
            const gCodes = g ? Object.keys(g).sort() : [];
            const expanded = openTeam === row.team;
            const isFinalist = finalists && finalists.has(`${award}::${row.team}`);
            return (
              <li key={row.team} className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden ${(!emcee && isFinalist) ? "border-[#EBA622] ring-1 ring-[#EBA622]" : "border-slate-200 dark:border-slate-700"}`}>
                <div className="w-full px-4 py-3 flex items-center gap-3">
                  <button onClick={() => setOpenTeam(expanded ? null : row.team)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                    <span className={`w-7 h-7 rounded-full grid place-items-center text-sm font-bold shrink-0 ${i === 0 ? "bg-[#EBA622] text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{row.team}</span>
                        {teamName[row.team] && <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{teamName[row.team]}</span>}
                        {!emcee && isFinalist && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8a6100] bg-[#EBA622]/20 border border-[#EBA622] rounded-md px-1.5 py-0.5"><Star size={10} className="fill-[#EBA622] text-[#EBA622]" /> FINALIST</span>}
                      </div>
                      {!emcee && gCodes.length > 0 && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md px-1.5 py-0.5">
                          <AlertTriangle size={11} /> Conduct: {gCodes.map((c) => `${c}${g[c] > 1 ? `×${g[c]}` : ""}`).join(", ")}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold">{row.count} <span className="text-slate-400 font-normal text-xs">nom{row.count !== 1 ? "s" : ""}</span></span>
                  </button>
                  {!emcee && <button onClick={() => onToggleFinalist(award, row.team)} title={isFinalist ? "Remove finalist" : "Mark finalist"} className="shrink-0 p-1">
                    <Star size={20} className={isFinalist ? "fill-[#EBA622] text-[#EBA622]" : "text-slate-300 hover:text-[#EBA622]"} />
                  </button>}
                </div>
                {expanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100 dark:divide-slate-700">
                    {row.noms.sort((a, b) => b.createdAt - a.createdAt).map((n) => (
                      <div key={n.id} className="px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {fmtMatch(n.match) && <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{fmtMatch(n.match)}</span>}
                          {n.by && <span className="flex items-center gap-1"><UserCircle2 size={12} /> {n.by}</span>}
                          {n.byRole && <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${roleChip(n.byRole)}`}>{n.byRole}</span>}
                          <span className="ml-auto">{fmtTime(n.createdAt)}</span>
                          {!emcee && <button onClick={() => { if (confirm("Remove this nomination?")) onDeleteNom(n.id); }} className="refos-destructive-icon"><Trash2 size={14} /></button>}
                        </div>
                        {n.reason ? <p className="text-slate-700 dark:text-slate-200 mt-1">{n.reason}</p> : <p className="text-slate-400 italic mt-1">No reason given</p>}
                        {n.criteria && n.criteria.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {n.criteria.map((c) => <span key={c} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{c}</span>)}
                          </div>
                        )}
                        {n.whereWhen && <p className="text-[11px] text-slate-400 mt-1">Where/when: {n.whereWhen}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function NominateModal({ teams, presetAward, me, lastMatch, event, matches, onSetName, onClose, onSave }) {
  const [award, setAward] = useState(presetAward || "sportsmanship");
  const [team, setTeam] = useState(teams[0]?.number ?? "");
  const [creatingNew, setCreatingNew] = useState(teams.length === 0);
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [matchPhase, setMatchPhase] = useState("none");
  const [matchNum, setMatchNum] = useState("");
  const [reason, setReason] = useState("");
  const [whereWhen, setWhereWhen] = useState("");
  const [criteria, setCriteria] = useState([]);
  const [busy, setBusy] = useState(false);
  const awardDef = AWARDS.find((a) => a.key === award) || AWARDS[0];
  const toggleCriterion = (c) => setCriteria((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  const pickAward = (k) => { setAward(k); setCriteria([]); };
  const count = phaseCount(matchPhase, event);
  const valid = (creatingNew ? newNumber.trim() : team) && reason.trim();
  const submit = async () => {
    if (!valid || busy) return; setBusy(true);
    try { await onSave({ award, team: creatingNew ? "" : team, newNumber, newName, reason, criteria, whereWhen, match: { phase: matchPhase, num: matchNum } }); }
    catch (e) { alert("Could not save: " + (e.message || e)); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Nominate for an award</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-300"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-4">
          <button onClick={onSetName} className="w-full flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
            <UserCircle2 size={15} className="text-slate-400" />
            {me?.name ? <>Nominating as <b className="text-slate-700 dark:text-slate-200">{me.name}</b></> : <span className="text-amber-600 font-medium">Tap to set your ref name</span>}
          </button>

          <div>
            <Label>Award</Label>
            <div className="grid grid-cols-2 gap-2">
              {AWARDS.map((a) => (
                <button key={a.key} onClick={() => pickAward(a.key)}
                  className={`py-2.5 rounded-lg border-2 font-semibold text-sm flex items-center justify-center gap-1.5 ${award === a.key ? "bg-[#0D0F32] text-white border-transparent" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>
                  <Trophy size={15} /> {a.full}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 italic">{awardDef.blurb}</p>
          </div>

          <div>
            <Label>Team</Label>
            {creatingNew ? (
              <div className="space-y-2">
                <input autoFocus value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="Team number (e.g. 1234A)"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-slate-300" />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team name (optional)"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                {teams.length > 0 && <button onClick={() => setCreatingNew(false)} className="text-sm text-slate-500 dark:text-slate-400 underline">Pick an existing team instead</button>}
              </div>
            ) : (
              <select value={team} onChange={(e) => setTeam(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300">
                {teams.map((t) => <option key={t.number} value={t.number}>{t.number}{t.name ? ` — ${t.name}` : ""}</option>)}
              </select>
            )}
          </div>

          <div>
            <Label>Match</Label>
            <div className="flex gap-2">
              <select value={matchPhase} onChange={(e) => { setMatchPhase(e.target.value); setMatchNum(""); }} className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300">
                {availablePhases(event).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              {matchPhase !== "none" && count > 0 && (
                <select value={matchNum} onChange={(e) => setMatchNum(e.target.value)} className="w-32 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">#</option>
                  {Array.from({ length: count }, (_, i) => String(i + 1)).map((n) => <option key={n} value={n}>{fmtMatch({ phase: matchPhase, num: n })}</option>)}
                </select>
              )}
            </div>
          </div>

          <div>
            <Label>Observed criteria <span className="font-normal text-slate-400">(check all that apply)</span></Label>
            <div className="space-y-1.5 mt-1">
              {awardDef.criteria.map((c) => (
                <button key={c} onClick={() => toggleCriterion(c)} className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${criteria.includes(c) ? "border-[#0D0F32] bg-slate-50 dark:bg-slate-800 dark:border-slate-500" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${criteria.includes(c) ? "bg-[#0D0F32] border-[#0D0F32]" : "border-slate-300 dark:border-slate-600"}`}>{criteria.includes(c) && <Check size={12} className="text-white" />}</span>
                  <span className="text-slate-700 dark:text-slate-200">{c}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Specific example observed</Label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Briefly describe what the team did…"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>

          <div>
            <Label>Where / when observed <span className="font-normal text-slate-400">(optional)</span></Label>
            <input value={whereWhen} onChange={(e) => setWhereWhen(e.target.value)} placeholder="e.g. pit area during lunch, Field 2 after Q34"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-4 flex gap-2">
          <button onClick={onClose} className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={submit} disabled={!valid || busy} className={`flex-1 py-3 rounded-lg font-semibold text-white transition ${valid && !busy ? "bg-[#D7212B] hover:bg-[#B42024]" : "bg-slate-300"}`}>{busy ? "Saving…" : "Submit nomination"}</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ ACTIVITY FEED (admin) ============================ */
function ActivityFeed({ viols, onOpenPhoto, onDeleteViolation, onEditViolation }) {
  const sorted = [...viols].sort((a, b) => b.createdAt - a.createdAt);
  if (sorted.length === 0) return <Empty title="No activity yet" sub="Violations will appear here as refs log them." />;
  return (
    <>
      <p className="text-xs text-slate-400 mb-3">{sorted.length} violation{sorted.length !== 1 ? "s" : ""} logged, newest first.</p>
      <ul className="space-y-2">{sorted.map((v) => <ViolationCard key={v.id} v={v} onDelete={onDeleteViolation} onOpenPhoto={onOpenPhoto} onEdit={onEditViolation} showTeam />)}</ul>
    </>
  );
}

/* ============================ RANKINGS (admin) ============================ */
function Rankings({ viols, teamName }) {
  const stat = {};
  for (const v of viols) {
    const t = v.team; if (!t) continue;
    stat[t] = stat[t] || { team: t, total: 0, minor: 0, major: 0, inspection: 0 };
    stat[t].total++; stat[t][v.type] = (stat[t][v.type] || 0) + 1;
  }
  // weight: major counts more than minor for ordering
  const ranked = Object.values(stat).sort((a, b) =>
    (b.major * 3 + b.minor + b.inspection) - (a.major * 3 + a.minor + a.inspection) ||
    b.total - a.total || a.team.localeCompare(b.team, undefined, { numeric: true }));
  if (ranked.length === 0) return <Empty title="No violations yet" sub="Team rankings appear once violations are logged." />;
  return (
    <>
      <p className="text-xs text-slate-400 mb-3">{ranked.length} team{ranked.length !== 1 ? "s" : ""} with violations, most to least (Majors weighted highest).</p>
      <ul className="space-y-2">
        {ranked.map((r, i) => (
          <li key={r.team} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
            <span className={`w-7 h-7 rounded-full grid place-items-center text-sm font-bold shrink-0 ${i === 0 ? "bg-[#D7212B] text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{r.team}</span>
                {teamName[r.team] && <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{teamName[r.team]}</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {ORDER.map((ty) => r[ty] ? (
                  <span key={ty} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border ${TYPES[ty].badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${TYPES[ty].dot}`} />{TYPES[ty].label} {r[ty]}
                  </span>) : null)}
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold">{r.total} <span className="text-slate-400 font-normal text-xs">total</span></span>
          </li>
        ))}
      </ul>
    </>
  );
}


/* ============================ TOURNAMENT MANAGER SYNC CENTER ============================ */
/* ============================ IMPORT VALIDATION PREVIEW ============================ */
function ImportPreviewModal({ preview, onImport, onCancel }) {
  if (!preview) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2"><Upload size={18} /> Review Tournament Manager changes</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5"><b className="text-slate-700 dark:text-slate-200">{preview.title}</b></p>
        <p className="text-xs text-slate-400 mt-1">Nothing is written until you choose Apply changes.</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {preview.chips.map((c, i) => (
            <span key={i} className={`text-xs font-mono px-2 py-1 rounded-md ${c.warn ? "bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700 font-bold" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}`}>{c.label || c}</span>
          ))}
        </div>
        {preview.warnings && preview.warnings.length > 0 && (
          <div className="mt-3 text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5">
            {preview.warnings.map((w, i) => <div key={i}>• {w}</div>)}
          </div>
        )}
        {preview.chips.some((c) => c.warn) && <p className="mt-3 text-[11px] text-red-600 dark:text-red-300">Unknown teams aren\'t in your roster — check you picked the right file, or import teams first.</p>}
        {preview.noChanges && <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Ref-OS found no data changes to apply.</div>}
        <div className="flex gap-2 mt-5">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300">{preview.noChanges ? "Close" : "Cancel"}</button>
          {!preview.noChanges && <button onClick={onImport} className="flex-1 py-2.5 rounded-lg bg-[#D7212B] text-white font-semibold hover:bg-[#B42024]">Apply changes</button>}
        </div>
      </div>
    </div>
  );
}

function TMSyncCenter({ onClose, onImportTeams, onImportMatches, onImportRankings, onImportAlliances, onImportScores, stats, syncStatus }) {
  const items = [
    { key: "teams", title: "Teams", detail: `${stats.teams} teams loaded`, action: "Import teams", onClick: onImportTeams, Icon: Users },
    { key: "matches", title: "Match schedule", detail: `${stats.matches} matches loaded`, action: "Import matches", onClick: onImportMatches, Icon: ListOrdered },
    { key: "rankings", title: "Qualification rankings", detail: `${stats.ranked} ranked teams`, action: "Upload rankings", onClick: onImportRankings, Icon: BarChart3 },
    { key: "alliances", title: "Alliance selection", detail: `${stats.alliances} / 16 alliances loaded`, action: "Upload alliances", onClick: onImportAlliances, Icon: GitBranch },
    { key: "scores", title: "Match results", detail: `${stats.scored} scored matches`, action: "Import scores", onClick: onImportScores, Icon: Trophy },
  ];
  const when = (ts) => {
    if (!ts) return "Not imported this session";
    const d = new Date(ts);
    return `Last updated ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  };
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 dark:bg-slate-900 w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 z-10">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><RefreshCw size={18} className="text-[#D7212B]" /> Tournament Manager Sync Center</h2>
            <p className="text-xs text-slate-400 mt-0.5">Import and refresh event data from Tournament Manager CSV exports.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-3">
          {items.map(({ key, title, detail, action, onClick, Icon }) => (
            <div key={key} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-slate-600 dark:text-slate-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{detail}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{when(syncStatus[key])}</div>
                </div>
                <button onClick={onClick} className="shrink-0 px-3 py-2 rounded-lg bg-[#0D0F32] text-white text-xs font-semibold hover:bg-[#171a45]">
                  {action}
                </button>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400">
            Recommended event flow: teams and schedule first, rankings after qualifications, alliances when selection is complete, then results as matches are scored.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ ALLIANCE SELECTION (admin) ============================ */
function AllianceSelection({ teams, alliances, matches, onSet, onFinalize, onSetWinner, onClear, canEditAlliances = false, canEditBracket = false }) {
  const opts = [...teams].sort((a, b) => (Number(a.rank ?? 999999) - Number(b.rank ?? 999999)) || a.number.localeCompare(b.number, undefined, { numeric: true })).map((t) => t.number);
  const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
  const filled = SEEDS.filter((s) => (alliances[s] || []).filter(Boolean).length > 0).length;
  const selectedPicks = new Set();
  for (const s of SEEDS) {
    const pick = (alliances[s] || [])[1];
    if (pick) selectedPicks.add(pick);
  }
  const Sel = ({ seed, idx, label }) => {
    const v = (alliances[seed] || [])[idx] || "";
    const captain = (alliances[seed] || [])[0] || "";
    return (
      <select value={v} onChange={(e) => onSet(seed, idx, e.target.value)}
        disabled={!canEditAlliances || idx === 0}
        className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:text-slate-500">
        <option value="">{label}</option>
        {opts.map((n) => {
          const usedAsPick = selectedPicks.has(n) && n !== v;
          const isSelf = idx === 1 && n === captain;
          const disabled = usedAsPick || isSelf;
          return <option key={n} value={n} disabled={disabled}>{n}{usedAsPick ? " ✓" : ""}</option>;
        })}
      </select>
    );
  };
  const ROUNDS = [["r16", "Round of 16"], ["qf", "Quarterfinals"], ["sf", "Semifinals"], ["final", "Finals (best of 3)"]];
  const byPhase = (p) => Object.values(matches || {}).filter((m) => m.phase === p).sort((a, b) => a.num - b.num);
  const hasBracket = byPhase("r16").length > 0;
  // finals champion: an alliance that wins 2 of the 3 final games
  const finals = byPhase("final");
  let champion = null;
  if (finals.length) {
    const tally = {};
    for (const f of finals) { const w = f.winner ? (f.winner === "red" ? f.red : f.blue) : null; if (w) { const key = w.join(" "); tally[key] = (tally[key] || 0) + 1; } }
    for (const k in tally) if (tally[k] >= 2) champion = k;
  }
  const Side = ({ m, side }) => {
    const teamsArr = side === "red" ? m.red : m.blue;
    const won = m.winner === side;
    return (
      <button disabled={!canEditBracket} onClick={() => canEditBracket && onSetWinner(m, side)}
        className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-left disabled:cursor-default ${won ? (side === "red" ? "bg-red-600 text-white border-red-600" : "bg-blue-600 text-white border-blue-600") : `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${side === "red" ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"}`}`}>
        <span className="font-mono text-xs font-bold">{teamsArr.join(" ") || "—"}</span>
        {won && <Check size={13} className="inline ml-1" />}
      </button>
    );
  };
  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><GitBranch size={18} className="text-[#D7212B]" /> Alliance selection</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{canEditAlliances ? "Enter each alliance as it's picked (captain + 1st pick). Finalize to create the Round of 16. Bracket winners can then be advanced live." : "View the current alliance selections. Admin access is required to edit captains or picks."}</p>
        <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{filled} / 16 alliances entered{!canEditAlliances ? " · alliance picks view only" : ""}</div>
      </div>
      <div className="space-y-2">
        {SEEDS.map((seed) => {
          const done = (alliances[seed] || []).filter(Boolean).length >= 2;
          return (
            <div key={seed} className={`rounded-xl border p-3 flex items-center gap-3 ${done ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
              <span className="w-8 shrink-0 text-center font-mono font-bold text-slate-900 dark:text-slate-100">A{seed}</span>
              <Sel seed={seed} idx={0} label="Captain" />
              <Sel seed={seed} idx={1} label="1st pick" />
            </div>
          );
        })}
      </div>
      {canEditAlliances && (
        <>
          <button onClick={onFinalize} className="w-full mt-4 py-3 rounded-xl bg-[#D7212B] hover:bg-[#B42024] text-white font-bold flex items-center justify-center gap-2"><GitBranch size={18} /> Finalize alliances → create Round of 16</button>
          <button onClick={onClear} className="w-full mt-2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium">Clear all picks</button>
        </>
      )}
      <p className="text-[11px] text-slate-400 mt-3 text-center">Bracket: 1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15 (higher seed = red).</p>

      {hasBracket && (
        <div className="mt-6">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1"><Trophy size={18} className="text-[#D7212B]" /> Bracket</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{canEditBracket ? "Tap the winning alliance in each match. Winners auto-advance — QF from R16, SF from QF, and a best-of-3 Final from SF. Tap a winner again to clear it." : "Current elimination bracket and winners — view only."}</p>
          {champion && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 mb-3 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              <span className="text-sm text-amber-800 dark:text-amber-200">Champion alliance: <b className="font-mono">{champion}</b></span>
            </div>
          )}
          {ROUNDS.map(([phase, label]) => {
            const ms = byPhase(phase);
            if (!ms.length) return null;
            return (
              <div key={phase} className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">{label}</h3>
                <div className="space-y-2">
                  {ms.map((m) => (
                    <div key={m.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-400 w-16 shrink-0">{phase === "final" ? `Final ${m.num}` : fmtMatch({ phase: m.phase, num: m.num })}</span>
                        <Side m={m} side="red" />
                        <span className="text-slate-300 text-xs font-sans shrink-0">vs</span>
                        <Side m={m} side="blue" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ============================ ADD ELIMINATION MATCH (admin) ============================ */
function AddMatchModal({ teams, onSave, onClose }) {
  const ELIM = [{ key: "r16", label: "Round of 16" }, { key: "qf", label: "Quarterfinal" }, { key: "sf", label: "Semifinal" }, { key: "final", label: "Final" }];
  const [phase, setPhase] = useState("qf");
  const [num, setNum] = useState("1");
  const [field, setField] = useState("");
  const [r1, setR1] = useState(""); const [r2, setR2] = useState("");
  const [b1, setB1] = useState(""); const [b2, setB2] = useState("");
  const [busy, setBusy] = useState(false);
  const opts = teams.map((t) => t.number);
  const valid = num.trim() && (r1 || r2) && (b1 || b2);
  const submit = async () => {
    if (!valid || busy) return; setBusy(true);
    try {
      await onSave({ phase, num: Number(num), field: field.trim(), red: [r1, r2].filter(Boolean), blue: [b1, b2].filter(Boolean) });
    } catch (e) { alert("Could not save: " + (e.message || e)); setBusy(false); }
  };
  const Sel = ({ v, set, label }) => (
    <select value={v} onChange={(e) => set(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
      <option value="">{label}</option>
      {opts.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Add elimination match</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1"><Label>Round</Label>
              <select value={phase} onChange={(e) => setPhase(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                {ELIM.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className="w-24"><Label>Match #</Label>
              <input value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-mono text-sm" />
            </div>
          </div>
          <div><Label>Field (optional)</Label>
            <input value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. Field 1" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm" />
          </div>
          <div><Label>Red alliance</Label>
            <div className="flex gap-2"><Sel v={r1} set={setR1} label="Team 1" /><Sel v={r2} set={setR2} label="Team 2" /></div>
          </div>
          <div><Label>Blue alliance</Label>
            <div className="flex gap-2"><Sel v={b1} set={setB1} label="Team 1" /><Sel v={b2} set={setB2} label="Team 2" /></div>
          </div>
          <p className="text-[11px] text-slate-400">Shows as {fmtMatch({ phase, num }) || `${phase} ${num}`} in the Eliminations tab.</p>
        </div>
        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-4 flex gap-2">
          <button onClick={onClose} className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={submit} disabled={!valid || busy} className={`flex-1 py-3 rounded-lg font-semibold text-white ${valid && !busy ? "bg-[#D7212B] hover:bg-[#B42024]" : "bg-slate-300"}`}>{busy ? "Saving…" : "Add match"}</button>
        </div>
      </div>
    </div>
  );
}


/* ============================ AWP HISTORY ============================ */
function parseAwpSide(note, side) {
  const mode = /AWP\s+(Sig|Std)\s+(\d+)\/(\d+)/i.exec(note || "");
  const pinsNeed = mode ? Number(mode[2]) : 0;
  const goalsNeed = mode ? Number(mode[3]) : 0;
  const re = new RegExp(`${side}:\\s*(MET|NOT met)\\s*\\((\\d+)P\\/(\\d+)G([^)]*)\\)`, "i");
  const m = re.exec(note || "");
  if (!m) return null;
  const pins = Number(m[2]);
  const goals = Number(m[3]);
  const extra = String(m[4] || "").toLowerCase();
  return {
    met: m[1].toUpperCase() === "MET",
    pins, goals, pinsNeed, goalsNeed,
    pinsMet: pinsNeed ? pins >= pinsNeed : true,
    goalsMet: goalsNeed ? goals >= goalsNeed : true,
    perimeterMet: !extra.includes("on perimeter"),
    noViolationsMet: !extra.includes("auton violation"),
    mode: mode ? (mode[1].toLowerCase() === "sig" ? "Signature" : "Standard") : "",
  };
}

function AWPAnalytics({ fieldLog = [] }) {
  const checks = fieldLog.filter((e) => e.kind === "awp");
  const sides = checks.flatMap((e) => [
    { side: "Red", data: parseAwpSide(e.note, "Red") },
    { side: "Blue", data: parseAwpSide(e.note, "Blue") },
  ]).filter((x) => x.data);

  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
  const totalMet = sides.filter((x) => x.data.met).length;
  const red = sides.filter((x) => x.side === "Red");
  const blue = sides.filter((x) => x.side === "Blue");
  const criteria = [
    ["Pins", "pinsMet"],
    ["Goals", "goalsMet"],
    ["Off perimeter", "perimeterMet"],
    ["No auton violations", "noViolationsMet"],
  ].map(([label, key]) => ({
    label, met: sides.filter((x) => x.data[key]).length,
    failed: sides.filter((x) => !x.data[key]).length,
  }));
  const mostFailed = [...criteria].sort((a, b) => b.failed - a.failed)[0];

  if (!sides.length) return null;
  const Stat = ({ label, value, sub }) => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="AWP success" value={`${pct(totalMet, sides.length)}%`} sub={`${totalMet} of ${sides.length} alliance checks`} />
        <Stat label="Red success" value={`${pct(red.filter((x) => x.data.met).length, red.length)}%`} sub={`${red.length} checks`} />
        <Stat label="Blue success" value={`${pct(blue.filter((x) => x.data.met).length, blue.length)}%`} sub={`${blue.length} checks`} />
        <Stat label="Most failed" value={mostFailed?.failed ? mostFailed.label : "None"} sub={mostFailed?.failed ? `${mostFailed.failed} failures` : "All recorded criteria met"} />
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Criteria success</div>
        <div className="space-y-2">
          {criteria.map((c) => {
            const rate = pct(c.met, sides.length);
            return <div key={c.label}>
              <div className="flex justify-between text-xs mb-1"><span className="font-medium text-slate-700 dark:text-slate-200">{c.label}</span><span className="text-slate-500">{rate}% · {c.met}/{sides.length}</span></div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rate}%` }} /></div>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}

function FieldComparison({ matches = {}, viols = [], fieldLog = [] }) {
  const all = Object.values(matches);
  const fields = [...new Set(all.map((m) => m.field).filter(Boolean))].sort();
  if (!fields.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-center gap-2 mb-3"><BarChart3 size={18} className="text-[#D7212B]" /><h3 className="font-bold text-slate-900 dark:text-slate-100">Field comparison</h3></div>
      <div className="grid sm:grid-cols-3 gap-2">
        {fields.map((field) => {
          const fm = all.filter((m) => m.field === field);
          const ids = new Set(fm.map((m) => m.id));
          const refs = new Set(fm.map((m) => m.phase === "qual" ? `Q${m.num}` : fmtMatch({ phase: m.phase, num: m.num })));
          const violations = viols.filter((v) => {
            if (!v.match || v.match.num == null) return false;
            const ref = v.match.phase === "qual" ? `Q${v.match.num}` : fmtMatch(v.match);
            return refs.has(ref);
          }).length;
          const replays = fieldLog.filter((e) => e.kind === "replay" && ((e.matchId && ids.has(e.matchId)) || (e.matchRef && refs.has(e.matchRef)))).length;
          const faults = fieldLog.filter((e) => e.kind === "field_fault" && ((e.matchId && ids.has(e.matchId)) || (e.matchRef && refs.has(e.matchRef)))).length;
          return <div key={field} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="font-bold text-slate-900 dark:text-slate-100">{field}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
              <span className="text-slate-500">Matches</span><span className="font-bold text-right">{fm.length}</span>
              <span className="text-slate-500">Violations</span><span className="font-bold text-right">{violations}</span>
              <span className="text-slate-500">Replays</span><span className="font-bold text-right">{replays}</span>
              <span className="text-slate-500">Field faults</span><span className="font-bold text-right">{faults}</span>
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

function AWPHistory({ fieldLog = [], matches = {}, viols = [], canSeeFieldComparison = false }) {
  const entries = fieldLog
    .filter((e) => e.kind === "awp")
    .sort((a, b) => b.createdAt - a.createdAt);

  const parseSide = (note, side) => {
    const mode = /AWP\s+(Sig|Std)\s+(\d+)\/(\d+)/i.exec(note || "");
    const pinsNeed = mode ? Number(mode[2]) : 0;
    const goalsNeed = mode ? Number(mode[3]) : 0;
    const re = new RegExp(`${side}:\\s*(MET|NOT met)\\s*\\((\\d+)P\\/(\\d+)G([^)]*)\\)`, "i");
    const m = re.exec(note || "");
    if (!m) return null;
    const met = m[1].toUpperCase() === "MET";
    const pins = Number(m[2]);
    const goals = Number(m[3]);
    const extra = String(m[4] || "").toLowerCase();
    return {
      met,
      pins,
      goals,
      pinsNeed,
      goalsNeed,
      pinsMet: pinsNeed ? pins >= pinsNeed : true,
      goalsMet: goalsNeed ? goals >= goalsNeed : true,
      perimeterMet: !extra.includes("on perimeter"),
      noViolationsMet: !extra.includes("auton violation"),
      mode: mode ? (mode[1].toLowerCase() === "sig" ? "Signature" : "Standard") : "",
    };
  };

  const Criteria = ({ ok, children }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold ${
      ok
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
        : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
    }`}>
      {ok ? <Check size={12} /> : <X size={12} />} {children}
    </span>
  );

  const AllianceCard = ({ label, color, data, teams }) => {
    if (!data) return null;
    const isRed = color === "red";
    return (
      <div className={`rounded-xl border p-3 ${isRed ? "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20" : "border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20"}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold uppercase tracking-wide ${isRed ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"}`}>{label}</span>
          {teams?.length ? <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{teams.join(" + ")}</span> : null}
          <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold ${
            data.met
              ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700"
              : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
          }`}>
            {data.met ? "AWP MET" : "AWP NOT MET"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Criteria ok={data.pinsMet}>{data.pins} Pins {data.pinsNeed ? `(${data.pinsNeed}+ needed)` : ""}</Criteria>
          <Criteria ok={data.goalsMet}>{data.goals} Goals with 2+ Pins {data.goalsNeed ? `(${data.goalsNeed}+ needed)` : ""}</Criteria>
          <Criteria ok={data.perimeterMet}>Robots off Field Perimeter</Criteria>
          <Criteria ok={data.noViolationsMet}>No auton violations</Criteria>
        </div>
      </div>
    );
  };

  if (!entries.length) {
    return <Empty title="No AWP checks saved" sub="Saved AWP checks from qualification matches will appear here." />;
  }

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="text-emerald-600" />
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Autonomous Win Points</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{entries.length} saved AWP {entries.length === 1 ? "check" : "checks"}. Each entry shows the match and which criteria were met.</p>
          </div>
        </div>
      </div>

      <AWPAnalytics fieldLog={fieldLog} />
      {canSeeFieldComparison && <FieldComparison matches={matches} viols={viols} fieldLog={fieldLog} />}
      {entries.map((e) => {
        const red = parseAwpSide(e.note, "Red");
        const blue = parseAwpSide(e.note, "Blue");
        const match = e.matchId ? matches[e.matchId] : null;
        const matchLabel = e.matchRef || (match ? fmtMatch({ phase: match.phase, num: match.num }) : "Match not recorded");
        const mode = red?.mode || blue?.mode || "";
        return (
          <div key={e.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{matchLabel}</span>
              {mode && <span className="text-[11px] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300">{mode} criteria</span>}
              <span className="ml-auto text-[11px] text-slate-400">{fmtTime(e.createdAt)}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <AllianceCard label="Red alliance" color="red" data={red} teams={match?.red || []} />
              <AllianceCard label="Blue alliance" color="blue" data={blue} teams={match?.blue || []} />
            </div>
            {e.by && <div className="mt-2 text-[11px] text-slate-400">Saved by {e.by}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ============================ FIELD LOG (timeouts / faults / replays) ============================ */
const FIELD_KINDS = [{ key: "timeout", label: "Timeout" }, { key: "field_fault", label: "Field fault" }, { key: "replay", label: "Match replay" }, { key: "other", label: "Other" }];
const kindLabel = (k) => k === "awp" ? "AWP" : (FIELD_KINDS.find((x) => x.key === k) || {}).label || "Other";
const kindColor = (k) => k === "field_fault" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700"
  : k === "replay" ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700"
  : k === "timeout" ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700"
  : k === "awp" ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700"
  : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600";

function FieldLogView({ entries, onAdd, onRemove, meName, canDelete }) {
  const [kind, setKind] = useState("timeout");
  const [field, setField] = useState("");
  const [matchRef, setMatchRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (busy) return; setBusy(true);
    try { await onAdd({ kind, field: field.trim(), matchRef: matchRef.trim(), note: note.trim() }); setField(""); setMatchRef(""); setNote(""); setKind("timeout"); }
    catch (e) { alert("Could not save: " + (e.message || e)); }
    setBusy(false);
  };
  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-4 space-y-2">
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
            {FIELD_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <input value={field} onChange={(e) => setField(e.target.value)} placeholder="Field (opt)" className="w-28 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm" />
          <input value={matchRef} onChange={(e) => setMatchRef(e.target.value)} placeholder="Match (opt)" className="w-28 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm" />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What happened…" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm" />
        <button onClick={add} disabled={busy} className="w-full py-2.5 rounded-lg bg-[#D7212B] text-white font-semibold disabled:bg-slate-300">{busy ? "Saving…" : "Log it"}</button>
      </div>
      {entries.length === 0 ? (
        <Empty title="Nothing logged yet" sub="Timeouts, field faults, and replays you log will appear here." />
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${kindColor(e.kind)}`}>{kindLabel(e.kind)}</span>
                {e.field && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{e.field}</span>}
                {e.matchRef && <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{e.matchRef}</span>}
                <span className="text-[11px] text-slate-400 ml-auto">{fmtTime(e.createdAt)}</span>
                {(e.by === meName || canDelete) && <button onClick={() => { if (confirm("Remove this entry?")) onRemove(e.id); }} className="refos-destructive-icon"><Trash2 size={14} /></button>}
              </div>
              {e.note && <p className="text-sm text-slate-700 dark:text-slate-200 mt-1.5">{e.note}</p>}
              {e.by && <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><UserCircle2 size={12} /> {e.by}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ============================ FEATURES & HELP ============================ */
function FeaturesGuide() {
  const Section = ({ icon: Ic, title, children }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-3">
      <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">{Ic && <Ic size={17} className="text-[#D7212B]" />}{title}</h3>
      <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">{children}</div>
    </div>
  );
  const Li = ({ children }) => <li className="flex gap-2"><span className="text-[#D7212B] mt-0.5">•</span><span>{children}</span></li>;

  return (
    <>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Ref-OS is the shared referee, event operations, alliance, and judging workspace for the Highlander Summit. This guide reflects Ref-OS v{APP_VERSION}.
      </p>

      <Section icon={KeyRound} title="Login, access codes & roles">
        <p>Ref-OS supports the normal role passwords plus event access codes and QR login. Role access is enforced by Supabase on the server, not only by hiding buttons in the interface.</p>
        <ul className="space-y-1.5">
          <Li><b>Referee / crew</b> — teams, matches, violations, robot photos, rules, watchlist, field operations, judging nominations, and bracket advancement.</Li>
          <Li><b>Judge Advisor</b> — Judging plus view access to Alliances and the elimination bracket. Judge Advisors do not get referee violation tools or bracket editing.</Li>
          <Li><b>Emcee / announcer</b> — teams, matches, scores, rules, alliances, bracket information, and judging nominations without exposing referee disciplinary information.</Li>
          <Li><b>Admin</b> — all normal event access plus the Event Command Center, setup, imports, exports, role access code management, diagnostics, data clearing, and alliance selection controls.</Li>
          <Li><b>Permanent Admin keypad code</b> — the fixed event Admin code can be entered directly on the keypad. Generated volunteer codes use the pattern number, letter A-D, number, number.</Li>
          <Li><b>QR login</b> — admins can generate a QR login card for a role access code. QR creation and QR decoding are local to Ref-OS; the actual login still verifies access with Supabase.</Li>
        </ul>
        <p>After login, enter your <b>first and last name</b>. Your name is used to identify entries and volunteer presence across the event.</p>
      </Section>

      <Section icon={ShieldAlert} title="Security & permissions">
        <ul className="space-y-1.5">
          <Li><b>Database enforced permissions</b> — Supabase Row Level Security restricts event data reads and writes by the signed-in role.</Li>
          <Li><b>Server validated credentials</b> — role passwords and access codes are verified by server-side RPCs instead of being compared in the browser.</Li>
          <Li><b>Private robot photos</b> — robot images are stored privately and opened with signed URLs for authorized event members.</Li>
          <Li><b>Disabled access codes</b> — disabling a generated code blocks future logins with that code. It does not automatically kick out volunteers who are already signed in.</Li>
        </ul>
      </Section>

      <Section icon={BarChart3} title="Event Command Center (Admin)">
        <p>The Event Command Center is the main Admin operations screen. Most event management tools that used to live directly in the gear menu are now organized here.</p>
        <ul className="space-y-1.5">
          <Li><b>Event overview</b> — quick counts for matches, violations, replays, field faults, volunteer presence, and event activity.</Li>
          <Li><b>Key Volunteer Status</b> — see volunteers online now and the known volunteer roster with role and online or offline status.</Li>
          <Li><b>Announcements</b> — send a shared Key Volunteer Announcement to connected Ref-OS devices. Each device can acknowledge it.</Li>
          <Li><b>Shared countdown</b> — create or clear an event countdown that syncs across devices.</Li>
          <Li><b>Event Contact Directory</b> — shared names, roles, phone numbers, email, locations, and notes for event contacts. Admins can edit and reorder it.</Li>
          <Li><b>Role access codes</b> — generate, display, print, QR encode, or disable event role codes.</Li>
          <Li><b>Pre Event System Test</b> — checks browser storage, service worker readiness, database read/write, realtime sync, Tournament Manager parsing, PDF generation, and other event-critical functions.</Li>
          <Li><b>Two Device Sync Test</b> — verifies that two Ref-OS devices can exchange a live probe and acknowledgement through the event backend.</Li>
          <Li><b>Event Diagnostic Report</b> — displays the app, device, event, storage, network, and sync snapshot and can copy or download the report as JSON.</Li>
          <Li><b>Failed Sync Items</b> — permanent offline write failures are retained so an Admin can retry or discard them instead of silently losing the entry.</Li>
          <Li><b>Event setup, TM Sync Center, exports, backup, Activity feed, Rankings, and Clear event data</b> are also accessed from the Command Center.</Li>
        </ul>
      </Section>

      <Section icon={CloudOff} title="Offline & live sync">
        <p>If Wi-Fi drops, supported entries are queued on the device and automatically retried when connectivity returns. Pending items show their saving state so volunteers do not need to enter them twice.</p>
        <ul className="space-y-1.5">
          <Li><b>Offline queue</b> — temporary failures remain queued locally until they can sync.</Li>
          <Li><b>Cached teams</b> — every successful team roster sync is saved on the device. If the network drops, Ref-OS keeps the last synced roster visible and searchable instead of replacing it with an empty list.</Li>
          <Li><b>Cached matches</b> — every successful match schedule sync is saved on the device. Previously loaded qualification and elimination matches remain available while offline.</Li>
          <Li><b>Permanent failures</b> — rejected writes are moved into Failed Sync Items for Admin review.</Li>
          <Li><b>Realtime updates</b> — shared event data and event settings update across connected devices through Supabase realtime.</Li>
        </ul>
      </Section>

      <Section icon={ListOrdered} title="Matches & logging violations">
        <p>The fastest referee workflow is <b>Matches</b>: open a match, tap the team involved, then complete the violation form.</p>
        <ul className="space-y-1.5">
          <Li>Choose <b>Minor</b>, <b>Major</b>, or <b>Inspection</b>, select the applicable rule, add notes, and attach robot photos when useful.</Li>
          <Li><b>Duplicate protection</b> warns before adding the same team, rule, and match combination twice.</Li>
          <Li><b>Field filters</b>, match jumping, replay flags, field faults, timeouts, watchlist information, and match violation history are available from the match workflow.</Li>
          <Li><b>Elimination priority</b> — when elimination matches exist, the Matches view prioritizes them while qualifications remain available.</Li>
          <Li><b>Timeouts</b> are available for elimination matches and are tracked by alliance across the elimination bracket.</Li>
        </ul>
      </Section>

      <Section icon={Clock} title="AWP checks & analytics">
        <ul className="space-y-1.5">
          <Li><b>Qualification AWP check</b> — record what was observed for Red and Blue at the end of autonomous. Ref-OS evaluates the event checklist but does not change the official Tournament Manager score.</Li>
          <Li><b>AWP history</b> — open AWP history from the Matches area next to the field filters instead of from the main navigation.</Li>
          <Li><b>AWP analytics</b> — review overall, Red, and Blue success rates and the success rate for Pins, Goals, Field Perimeter, and autonomous violation criteria.</Li>
        </ul>
      </Section>

      <Section icon={Users} title="Teams, watchlist & robot scanner">
        <ul className="space-y-1.5">
          <Li><b>Teams</b> — search teams, open their full history, add teams, review Tournament Manager rank, and start a new log from the team record.</Li>
          <Li><b>Team scanner</b> — use the camera OCR scanner to recognize a team number and jump to the team record.</Li>
          <Li><b>Watchlist</b> — add shared watch notes to teams. Watched teams are flagged and their notes appear during relevant matches.</Li>
          <Li><b>Robot photos</b> — store inspection photos for teams so referees can identify and review robots later.</Li>
        </ul>
      </Section>

      <Section icon={BookOpen} title="Rules, favorites & recent rules">
        <p>The Rules tab and violation rule picker use the same searchable rule reference.</p>
        <ul className="space-y-1.5">
          <Li><b>Favorites</b> — star frequently used rules so they appear in a Favorites group when no search is active.</Li>
          <Li><b>Recently used</b> — recently selected rules are shown automatically for faster repeat access.</Li>
          <Li><b>Offline rule index</b> — the event rule index is bundled with Ref-OS, so rule codes, descriptions, categories, favorites, recent rules, and referee notes remain available when Supabase or Wi-Fi is unavailable.</Li>
          <Li><b>Referee guidance</b> — rules with supplemental guidance can be opened for violation notes, escalation guidance, and event-specific interpretation.</Li>
        </ul>
        <p>Favorites and recently used rules are stored on the local browser or device.</p>
      </Section>

      <Section icon={Flag} title="Field log">
        <p>The Field Log is the referee-facing running list for operational entries such as timeouts, field faults, replays, and other field notes. Internal Ref-OS sync, announcement, access-code, diagnostic, and settings records are intentionally hidden from this view.</p>
      </Section>

      <Section icon={Trophy} title="Judging">
        <ul className="space-y-1.5">
          <Li><b>Sportsmanship and Energy nominations</b> — record the team, match, observed criteria, specific example, and supporting details.</Li>
          <Li><b>Judge Advisor workflow</b> — Judge Advisors can manage judging information without receiving referee disciplinary views.</Li>
          <Li><b>Official form export</b> — Ref-OS can generate a combined PDF using the supplied official nomination forms.</Li>
          <Li><b>Alliance visibility</b> — Judge Advisors can view the Alliances section and bracket but cannot edit alliance selection or advance the bracket.</Li>
        </ul>
      </Section>

      <Section icon={Trophy} title="Alliance selection & elimination bracket">
        <ul className="space-y-1.5">
          <Li><b>Ranking seeded captains</b> — uploaded Tournament Manager rankings automatically seed alliance captains before the official elimination bracket is imported.</Li>
          <Li><b>Captain shifting</b> — if a higher seed selects a team that would have been a later captain, that team drops from the captain list and the remaining ranked teams move up.</Li>
          <Li><b>Admin selection controls</b> — alliance captain and pick editing is Admin only.</Li>
          <Li><b>Bracket permissions</b> — regular Referee and Emcee access can use their permitted bracket workflow; Judge Advisor access is view only.</Li>
          <Li><b>Tournament Manager source of truth</b> — after a Round of 16 bracket is imported, Ref-OS preserves the imported alliances instead of overwriting them from rankings.</Li>
        </ul>
      </Section>

      <Section icon={BarChart3} title="Tournament Manager Sync Center">
        <ul className="space-y-1.5">
          <Li><b>Teams</b> — import or update the event roster from Tournament Manager CSV.</Li>
          <Li><b>Matches</b> — import the qualification and elimination schedule and update existing matches in place.</Li>
          <Li><b>Rankings</b> — import qualification rankings using TeamNum and store the rank on each team.</Li>
          <Li><b>Alliances</b> — import the official elimination bracket. Round 6 is treated as Round of 16 and its Instance value determines the R16 matchup.</Li>
          <Li><b>Change preview</b> — before a Tournament Manager import writes anything, Ref-OS compares the file with the current event and shows what will be added, changed, or left untouched. If no differences are found, the import is blocked as unnecessary.</Li>
          <Li><b>Scores</b> — when elimination scores are present, Ref-OS prioritizes elimination score updates and leaves qualification score importing alone. Qualification records update when qualification results are imported without elimination results.</Li>
        </ul>
      </Section>

      <Section icon={BarChart3} title="Exports, analytics & backup">
        <ul className="space-y-1.5">
          <Li><b>Event Report PDF</b> — includes event overview, AWP analytics, field comparison, violation summary, alliance selections, and judging totals.</Li>
          <Li><b>Violation export</b> — violation data can be exported and the official Match Anomaly Log PDF can be filled from Ref-OS data.</Li>
          <Li><b>Judging export</b> — create the combined official Energy and Sportsmanship nomination PDF.</Li>
          <Li><b>Field comparison</b> — Admin view comparing matches, violations, replays, and field faults by field.</Li>
          <Li><b>Backup all JSON</b> — download a snapshot of the event data for event-day insurance.</Li>
          <Li><b>Clear event data</b> — Admins can selectively clear supported event data, including judging, alliances, and watchlist data.</Li>
        </ul>
      </Section>

      <Section icon={Info} title="Guided tour, install & device settings">
        <ul className="space-y-1.5">
          <Li><b>Interactive Guided Tour</b> — walks through the live role-specific Ref-OS interface and opens real sections such as Teams, Matches, a match, violation logging, Rules, Field Log, Alliances, and contacts.</Li>
          <Li><b>Install Ref-OS</b> — add the deployed HTTPS site to the device home screen for an app-like PWA experience.</Li>
          <Li><b>Dark / Light mode</b> and <b>Text size</b> are saved per device.</Li>
          <Li><b>Mobile navigation</b> — phones use the compact Go to section menu instead of forcing the full desktop navigation across the screen.</Li>
          <Li><b>Device readiness</b> — event staff can approve modern devices by running the Pre Event System Test before use.</Li>
        </ul>
      </Section>

      <Section icon={Pencil} title="Editing & correcting records">
        <p>Synced violations can be reopened, edited, and deleted according to the signed-in role. Editing keeps the existing record and reopens the form with its current information so corrections can be made without creating a second violation.</p>
      </Section>

      <p className="text-center text-xs text-slate-400 mt-4 mb-2">
        Made by Maharshi Patel · <a href="https://www.instagram.com/mpatel_ref/" target="_blank" rel="noopener noreferrer" className="underline">@mpatel_ref</a> · v{APP_VERSION}
      </p>
    </>
  );
}

/* ============================ RULEBOOK (reference) ============================ */
// Referee notes per rule (shown in a popup when a rule is tapped in the Rules tab).
// Keyed by rule code. Fill these in as needed; rules without an entry show a default message.
const RULE_NOTES = {
  "SC8": "Autonomous Win Point. Signature Events (like this one) and other Worlds-qualifying events use the higher v2.0 bar: 7+ Pins Scored for your alliance, AND 3+ Goals that each hold 2+ of your alliance's Pins, AND neither of your robots touching the Field Perimeter when auton ends \u2014 with zero auton violations. (Standard events stay at 6 Pins / 2 Goals.)\nPins and Goals in Quadrants on the opposing side of the Autonomous Line don't count toward your total.\nAny auton violation, Major or Minor, voids the AWP.",
  "SG1": "Match won't start until every condition is met. If a robot can't get legal in time, it's removed from the field (R2d and GG2 then apply) \u2014 no DQ, but log a Minor and it can't play that match.",
  "SG2": "Incidental / insignificant in-match issues are Minor; escalate to Major only in extreme cases.\nTypical Minors: loose wires; broken zip ties or rubber bands; bent or broken parts not used for strategic gain.",
  "SG4": "Match-affecting impact is hard to judge, so most are Minor. Blatantly intentional or clearly match-affecting cases (especially in elims) can be escalated to Major at head-ref discretion.",
  "SG7": "Any violation (Major or Minor) awards the Autonomous Bonus to the opponents (see SG8b for the exception).\nIntentional / strategic / egregious cases \u2014 e.g., deliberately contacting an opposing robot while on foam on the opponents' side, or SG7e interactions \u2014 are Major and should be a DQ.\nDeliberate defensive auton (SG7a) may also be recorded as G1.",
  "SG8": "The Midfield and auton-line objects are shared, so robot-to-robot contact (incidental and intentional) is expected and should almost never be a violation \u2014 teams own their robots' actions and shouldn't claim GG14 on their own tippy robot.\nBut the Midfield isn't a free-for-all: head refs may still act on teams exploiting the rule, and reckless / unsafe play aimed at destruction, damage, tipping, entanglement, trapping, or forcing a penalty is still prohibited.",
  "SG9": "Incidental / unintentional contact with a goal or its stacked objects is usually Minor.\nIntentional / strategic / egregious interactions \u2014 including adding or removing placed objects on the goal \u2014 are Major.\nRepeated Minors can escalate to Major, especially after prior warnings.",
  "SG10": "v2.0 match-affecting math for Placed objects pulled out of a neutral Goal uses a fixed pin value: 10 pts per Pin for an interaction that removes 1\u20133 Pins, or a flat 50 pts total once an interaction removes 4+ Pins. If deducting that from the offender's final score would flip the result, it's Match Affecting (the value is never added to the real score). Refs just make a best-guess count \u2014 teams accept it.\nIntentional / strategic / egregious cases are Major.\nRepeated Minors can escalate to Major, especially after warnings.",
  "SG11": "v2.0: match loads may only be introduced through your own alliance-colored Loaders, only during driver control, and only via the top or back (dropped or placed, nested is fine); they're removed only through the bottom. Momentary simultaneous contact between a match load, a drive-team member, and a robot is now allowed until it's released. The custom SG11 point math and repeat thresholds were removed \u2014 handle violations with standard Minor/Major judgment (excessive or unsafe actions can also invoke S1 / G1).",
  "SG12": "Most are Minor; repeated Minors can escalate to Major, especially after warnings.\nv2.0: the Endgame restriction is now no Placing Scoring Objects on the Midfield Goal (the old vertical-expansion height cap in the Midfield was removed).\nA Midfield-Goal placement that changes the outcome in the offender's favor is Match Affecting.",
  "SG13": "Egregious cases are Major; repeated Minors can escalate to Major, especially after warnings.\n(Protects Load Zones from opponent interference during driver control; doesn't apply during auton. v2.0 also bars adding objects to, or removing them from, an opposing alliance's Loaders.)",
  "G1": "Any G1 can be treated as a Major, handled case-by-case. Teams at risk usually get a 'final warning,' though the head ref isn't required to give one.",
  "G2": "Reviewed case-by-case. By definition it becomes match-affecting the moment an adult-built or adult-programmed robot scores in a match.",
  "G3": "Common sense applies. Obvious typos aren't taken literally; understand the realities of the V5 system; if you have to ask whether something violates S1 / G1 / T1, it's probably outside the spirit. Teams get benefit of the doubt for accidental / edge cases, but not repeated or strategic infractions. If no rule makes a part legal, it isn't.",
  "G4": "Report suspected violations to the Judge Advisor, Head Referee, or Event Partner to investigate with VEX. The team may be removed from further matches, have skills scores removed, and/or be removed from judged-award consideration. Handled case-by-case with VEX (per G1 / G2).",
  "G5": "A team that circumvents a robot rule for competitive advantage should get an immediate DQ for the current match.",
  "GG1": "Major violations don't have to be match-affecting, and may also invoke G1, G2, or G4.",
  "GG8": "Major should be rare (robots shouldn't be designed to detach parts). Minors are usually from gameplay damage, like a wheel falling off.",
  "GG11": "Intent is that robots obey the tournament software. Temporarily unplugging the cable for mid-match troubleshooting with an Event Partner or technical staff present is not a violation.",
  "GG13": "Minor SG-rule violations in auton generally only affect the auton outcome and shouldn't count toward repeat tracking. If the head ref judges an SG/GG auton violation to be intentional / strategic, record it as Minor or Major and count it toward repeats.",
  "GG14": "A Major here doesn't have to be match-affecting \u2014 intentional / egregious tipping, entanglement, or damage may be Major at head-ref discretion. Repeated violations within a match or tournament could become a G1 and/or S1.",
  "GG16": "Usually the head ref just doesn't enforce the penalty on the forced opponent, and it's a Minor for the team that forced it. But if the forced situation ends up match-affecting in favor of the team that forced it, it's a Major for that team.",
  "GG17": "No holding an opponent longer than a 3-count in driver control. Head refs count out loud; the count pauses/ends when the robots separate (~2 ft / one tile), when the held robot gets trapped or pinned by a different robot, or when an escape route opens. After a count ends you can't immediately re-hold the same robot \u2014 that resumes at a 5-count.\nWhen judging if a hold was match-affecting, weigh the full context: the first 3 seconds are legal, so only the extra time counts; how much extra time; how far/long they separated before returning; and what both robots were doing overall. Holding is inherently defensive, so GG15 may also apply on judgment calls.",
};

function RuleBook({ rules }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // rule object shown in the notes popup
  if (!rules.length) return <Empty title="No rulebook loaded" sub="Run seed_rules.sql in Supabase to load the rules." />;
  const q = query.trim().toUpperCase();
  const filtered = q ? rules.filter((r) => r.code.toUpperCase().includes(q) || (r.desc || "").toUpperCase().includes(q)) : rules;
  const groups = [];
  const idx = {};
  for (const r of filtered) {
    if (!(r.category in idx)) { idx[r.category] = groups.length; groups.push({ cat: r.category, items: [] }); }
    groups[idx[r.category]].items.push(r);
  }
  return (
    <>
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rules — code or wording"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>
      {groups.length === 0 ? (
        <Empty title="No rules match" sub="Try a different word or code." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.cat}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">{g.cat}</h2>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                {g.items.map((r) => {
                  const note = RULE_NOTES[r.code];
                  return note ? (
                    <button key={r.code} onClick={() => setSelected(r)} className="w-full text-left px-4 py-2.5 flex gap-3 items-baseline hover:bg-slate-50 dark:hover:bg-slate-700">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 w-16 shrink-0">{fmtRule(r.code)}</span>
                      <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{r.desc}</span>
                      <span className="text-[10px] font-semibold text-[#D7212B] shrink-0 self-center flex items-center gap-1">Notes <ChevronRight size={14} /></span>
                    </button>
                  ) : (
                    <div key={r.code} className="px-4 py-2.5 flex gap-3 items-baseline">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 w-16 shrink-0">{fmtRule(r.code)}</span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{r.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-[55] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-slate-800 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 px-4 py-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{fmtRule(selected.code)}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{selected.desc}</span>
              <button onClick={() => setSelected(null)} className="ml-auto text-slate-400 hover:text-slate-600 shrink-0"><X size={22} /></button>
            </div>
            <div className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Violation notes</h3>
              {RULE_NOTES[selected.code] ? (
                <div className="text-sm text-slate-700 dark:text-slate-200 space-y-2 leading-relaxed whitespace-pre-line">{RULE_NOTES[selected.code]}</div>
              ) : (
                <p className="text-sm text-slate-400 italic">No notes for this rule yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- shared bits ---------- */
const Label = ({ children }) => <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{children}</label>;
const Empty = ({ title, sub }) => (
  <div className="text-center py-14 px-6"><p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p><p className="text-sm text-slate-400 mt-1">{sub}</p></div>
);
