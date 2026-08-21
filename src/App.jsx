import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Camera, Trash2, ChevronLeft, AlertTriangle, ShieldAlert,
  ClipboardCheck, X, Search, BarChart3, Users, Download,
  Settings, ChevronRight, ImageOff, RefreshCw, UserCircle2, Share2, Check,
  CalendarDays, ListOrdered, LogOut, Mail, Copy, CloudOff, Cloud, ShieldCheck, KeyRound, Upload, Wifi, BookOpen,
} from "lucide-react";
import { configured } from "./supabaseClient";
import * as api from "./api";
import * as outbox from "./outbox";

/* This build is locked to one event: The Highlander Summit Signature Event.
   EVENT_ID must match supabase/seed.sql. A shared site password gates entry. */
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD || "";

/* ---------- helpers ---------- */
const normNum = (n) => (n || "").trim().toUpperCase();
const initials = (name) =>
  (name || "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "?";

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
    badge: "bg-amber-100 text-amber-800 border-amber-300", dot: "bg-amber-500",
    solid: "bg-amber-500", solidHover: "hover:bg-amber-600", soft: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  major: { label: "Major", Icon: ShieldAlert,
    badge: "bg-red-100 text-red-800 border-red-300", dot: "bg-red-500",
    solid: "bg-red-600", solidHover: "hover:bg-red-700", soft: "bg-red-50 border-red-200", text: "text-red-700" },
  inspection: { label: "Inspection", Icon: ClipboardCheck,
    badge: "bg-blue-100 text-blue-800 border-blue-300", dot: "bg-blue-500",
    solid: "bg-blue-600", solidHover: "hover:bg-blue-700", soft: "bg-blue-50 border-blue-200", text: "text-blue-700" },
};
const ORDER = ["minor", "major", "inspection"];

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
  const num = (m.num || "").trim();
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
  return `${Math.round(s / 3600)}h ago`;
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
  if (gone) return <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 grid place-items-center text-slate-300"><ImageOff size={18} /></div>;
  if (!src) return <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 animate-pulse" />;
  return (
    <button onClick={() => onOpen(src)} className="shrink-0">
      <img src={src} alt="robot" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
    </button>
  );
}

/* ==================================================================== */
/*  ROOT: auth -> event selection -> tracker                            */
/* ==================================================================== */
export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem("unlocked") === "1");
  const [meName, setMeName] = useState(() => localStorage.getItem("refName") || "");
  const [event, setEvent] = useState(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    if (!unlocked || !meName) return;
    let live = true; setLoadErr(false);
    api.getEvent(EVENT_ID).then((ev) => { if (live) { ev ? setEvent(ev) : setLoadErr(true); } });
    return () => { live = false; };
  }, [unlocked, meName]);

  const unlock = () => { localStorage.setItem("unlocked", "1"); setUnlocked(true); };
  const saveName = (n) => { localStorage.setItem("refName", n.trim()); setMeName(n.trim()); };
  const lock = () => { localStorage.removeItem("unlocked"); setUnlocked(false); setEvent(null); };

  if (!configured) return <ConfigError />;
  if (!unlocked) return <PasswordScreen onUnlock={unlock} />;
  if (!meName) return <NameScreen onName={saveName} />;
  if (loadErr) return (
    <FullPage>
      <div className="max-w-sm">
        <p className="font-semibold text-slate-700">Couldn't load the event</p>
        <p className="text-sm mt-1">Make sure <code>schema.sql</code> and <code>seed.sql</code> have been run in Supabase, then reload.</p>
      </div>
    </FullPage>
  );
  if (!event) return <FullPage>Loading…</FullPage>;

  return <Tracker key={event.id} initialEvent={event} meName={meName} onEditName={saveName} onLock={lock} />;
}

const FullPage = ({ children }) => (
  <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-400 font-sans p-6 text-center">{children}</div>
);
const ConfigError = () => (
  <FullPage>
    <div className="max-w-sm">
      <p className="font-semibold text-slate-700">Not configured yet</p>
      <p className="text-sm mt-1">Copy <code>.env.example</code> to <code>.env</code> and add your Supabase URL and anon key, then restart.</p>
    </div>
  </FullPage>
);

/* ---------------------- PASSWORD GATE ---------------------- */
function PasswordScreen({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!SITE_PASSWORD) { setErr("Site password isn't set. Add VITE_SITE_PASSWORD to the environment."); return; }
    if (pw === SITE_PASSWORD) onUnlock(); else setErr("Incorrect password.");
  };
  return (
    <div className="min-h-screen bg-[#0D0F32] text-white grid place-items-center p-6 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/logo.svg" alt="Highlander Summit" className="h-24 w-24 object-contain mb-3" />
          <span className="font-bold text-lg">Highlander Summit — Violation Log</span>
        </div>
        <p className="text-sm text-slate-300 mb-4 text-center">Enter the crew password to open the log.</p>
        <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="Password" autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full px-3 py-3 rounded-lg bg-[#1b1f4d] border border-[#2c3168] text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D7212B]" />
        {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
        <button onClick={submit} disabled={!pw}
          className="w-full mt-3 py-3 rounded-lg font-semibold bg-[#D7212B] text-white hover:bg-[#B42024] disabled:bg-[#2c3168] disabled:text-slate-400">Enter</button>
      </div>
    </div>
  );
}

/* ---------------------- NAME (ref identity) ---------------------- */
function NameScreen({ onName }) {
  const [name, setName] = useState("");
  return (
    <div className="min-h-screen bg-slate-100 grid place-items-center p-6 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1"><img src="/logo.svg" alt="" className="h-6 w-6 object-contain" /><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Highlander Summit Signature</span></div>
        <h1 className="font-bold text-slate-900 text-lg">Welcome, ref</h1>
        <p className="text-sm text-slate-500 mt-1 mb-4">Your name is shown on every violation you log, so the crew knows who made the call.</p>
        <Label>Name or initials</Label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex R or ABR"
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onName(name)}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300" />
        <button onClick={() => name.trim() && onName(name)} disabled={!name.trim()}
          className={`w-full mt-3 py-2.5 rounded-lg font-semibold text-white ${name.trim() ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Start logging</button>
      </div>
    </div>
  );
}

/* ==================================================================== */
/*  TRACKER (the main app, scoped to one event)                        */
/* ==================================================================== */
function Tracker({ initialEvent, meName, onEditName, onLock }) {
  const eventId = initialEvent.id;
  const [event, setEvent] = useState(initialEvent);
  const [teams, setTeams] = useState([]);
  const [viols, setViols] = useState([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(0);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine !== false);
  const [matches, setMatches] = useState({}); // { [num]: {red:[], blue:[]} }
  const [rules, setRules] = useState([]);      // [{ code, desc, category }]
  const [presence, setPresence] = useState([]); // [{ name, ... }] currently online
  const pendingCount = viols.filter((v) => v._pending).length;

  const [lastMatch, setLastMatch] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lastMatch")) || { phase: "qual", num: "" }; }
    catch { return { phase: "qual", num: "" }; }
  });

  const [view, setView] = useState("teams");
  const [openTeam, setOpenTeam] = useState(null);
  const [openMatch, setOpenMatch] = useState(null);
  const [openRobot, setOpenRobot] = useState(null);
  const [query, setQuery] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [menu, setMenu] = useState(false);
  const [logFor, setLogFor] = useState(null);
  const [logMatch, setLogMatch] = useState(null);
  const [addTeam, setAddTeam] = useState(false);
  const [expandRule, setExpandRule] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [showByRule, setShowByRule] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    const [ev, t, v] = await Promise.all([api.getEvent(eventId), api.listTeams(eventId), api.listViolations(eventId)]);
    if (ev) setEvent(ev);
    // keep optimistic items the server hasn't caught up on yet (unsynced writes)
    setTeams((cur) => { const extra = cur.filter((x) => !t.some((s) => s.number === x.number)); return [...t, ...extra]; });
    setViols((cur) => { const pend = cur.filter((x) => x._pending && !v.some((s) => s.id === x.id)); return [...pend, ...v]; });
    setSyncedAt(Date.now()); setSyncing(false);
  }, [eventId]);

  const doFlush = useCallback(async () => {
    await outbox.flush(eventId, {
      onSynced: (saved) => setViols((cur) => cur.map((x) => (x.id === saved.id ? saved : x))),
      onDropped: (op, e) => console.error("outbox op dropped", op, e),
    });
  }, [eventId]);

  useEffect(() => {
    (async () => {
      await refresh();
      api.listMatches(eventId).then((list) => {
        const map = {}; for (const m of list) map[m.num] = m; setMatches(map);
      });
      api.listRules(eventId).then(setRules);
      // restore violations still waiting in the queue (e.g. after a reload while offline)
      const q = await outbox.loadQueue(eventId);
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
    const goOnline = () => { setOnline(true); doFlush(); };
    const goOffline = () => setOnline(false);
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
    const leave = api.joinPresence(eventId, { name: meName || "Ref", online_at: Date.now() }, setPresence);
    return leave;
  }, [eventId, meName]);

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
      if (!ex) return [...cur, { number: num, name: (name || "").trim(), createdAt: Date.now() }];
      if (name && !ex.name) return cur.map((t) => (t.number === num ? { ...t, name: name.trim() } : t));
      return cur;
    });
    try { await api.upsertTeam(eventId, num, name); }
    catch (e) { if (outbox.isOffline(e)) await outbox.enqueue(eventId, { id: `team:${num}:${Date.now()}`, kind: "team", eventId, number: num, name }); else throw e; }
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
  const deleteTeam = async (num) => {
    try { await api.deleteTeam(eventId, num); }
    catch (e) { if (outbox.isOffline(e)) { alert("You're offline — reconnect to delete a team."); return; } throw e; }
    setViols((cur) => cur.filter((v) => v.team !== num));
    setTeams((cur) => cur.filter((t) => t.number !== num));
    setOpenTeam(null);
  };
  const addRobotPhoto = async (number, dataUrl) => {
    const paths = await api.addTeamPhoto(eventId, number, dataUrl);
    setTeams((cur) => cur.map((t) => (t.number === number ? { ...t, photoKeys: paths } : t)));
  };
  const removeRobotPhoto = async (number, path) => {
    const paths = await api.removeTeamPhoto(eventId, number, path);
    setTeams((cur) => cur.map((t) => (t.number === number ? { ...t, photoKeys: paths } : t)));
  };
  const clearSelected = async (sel) => {
    try {
      if (sel.violations) { await api.clearViolations(eventId); setViols([]); }
      if (sel.teams) { await api.clearTeams(eventId); setTeams([]); }
      if (sel.schedule) { await api.clearMatches(eventId); setMatches({}); }
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
  const matchNums = useMemo(() => Object.keys(matches).map(Number).sort((a, b) => a - b), [matches]);

  const exportCSV = () => {
    const rows = [["Team", "Team Name", "Match", "Type", "Rule", "Rule Description", "Notes", "Logged By", "Photos", "Time"]];
    for (const v of [...viols].sort((a, b) => a.createdAt - b.createdAt)) {
      const t = teams.find((x) => x.number === v.team);
      rows.push([v.team, t?.name || "", fmtMatch(v.match) || "", TYPES[v.type].label, fmtRule(v.code), v.desc || "",
        v.notes || "", v.by || "", String((v.photoKeys || []).length), new Date(v.createdAt).toISOString()]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${(event.name || "vex").replace(/\W+/g, "-").toLowerCase()}-violations.csv`; a.click(); setMenu(false);
  };

  if (!ready) return <FullPage>Loading event…</FullPage>;

  const filteredTeams = teams
    .filter((t) => { const q = query.trim().toLowerCase(); return !q || t.number.toLowerCase().includes(q) || (t.name || "").toLowerCase().includes(q); })
    .sort((a, b) => (countsByTeam[b.number]?.total || 0) - (countsByTeam[a.number]?.total || 0)
      || a.number.localeCompare(b.number, undefined, { numeric: true }));

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased">
      <header className="sticky top-0 z-20 bg-[#0D0F32] text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {(openTeam || openMatch || openRobot) ? (
            <button onClick={() => { setOpenTeam(null); setOpenMatch(null); setOpenRobot(null); }} className="p-1 -ml-1 rounded hover:bg-white/10"><ChevronLeft size={22} /></button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <img src="/logo.svg" alt="Highlander Summit" className="h-9 w-9 object-contain" />
              <div className="leading-tight hidden sm:block">
                <div className="font-bold text-[13px] text-white">Ref-OS</div>
                <div className="text-[9px] text-slate-400">Referee Operating System</div>
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5 flex-wrap">
              <h1 className="font-bold tracking-tight leading-tight text-[15px] sm:text-base line-clamp-2">{event?.name || "Violation Log"}</h1>
              {online ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-900/40 px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-900/40 px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">
                  <CloudOff size={10} /> offline
                </span>
              )}
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-200 bg-amber-900/40 px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">
                  <RefreshCw size={9} className="animate-spin" /> {pendingCount} pending
                </span>
              )}
            </div>
            <button onClick={() => { refresh(); doFlush(); }} className="text-[11px] text-slate-400 leading-tight mt-0.5 flex items-center gap-1 hover:text-slate-200">
              <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
              {teams.length} teams · {viols.length} violations · synced {ago(syncedAt)}
            </button>
          </div>
          <OnlineCluster presence={presence} onClick={() => setShowOnline(true)} />
          <button onClick={() => setShowByRule(true)} title="By rule" className="p-1.5 rounded hover:bg-white/10"><BarChart3 size={18} /></button>
          <button onClick={() => setShowIdentity(true)} title="Your ref name"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-full pl-1 pr-2.5 py-1">
            <span className="w-6 h-6 rounded-full bg-[#D7212B] text-white text-[11px] font-bold grid place-items-center">{meName ? initials(meName) : "?"}</span>
            <span className="text-xs font-medium max-w-[70px] truncate">{meName || "Set name"}</span>
          </button>
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="p-1.5 rounded hover:bg-white/10"><Settings size={19} /></button>
            {menu && (
              <div className="absolute right-0 mt-2 w-56 bg-white text-slate-700 rounded-xl shadow-xl border border-slate-200 py-1 text-sm">
                <button onClick={() => { setMenu(false); setShowEvent(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2"><CalendarDays size={16} /> Event setup</button>
                <button onClick={() => { setMenu(false); setShowShare(true); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2"><Share2 size={16} /> Invite other refs</button>
                <button onClick={exportCSV} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2"><Download size={16} /> Export CSV</button>
                <button onClick={() => { setMenu(false); onLock(); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2"><LogOut size={16} /> Lock this device</button>
                <div className="border-t border-slate-100 my-1" />
                <button onClick={() => { setMenu(false); setShowClear(true); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={16} /> Clear data…</button>
              </div>
            )}
          </div>
        </div>
        {!openTeam && !openMatch && !openRobot && (
          <div className="max-w-2xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {[{ k: "teams", label: "Teams", Icon: Users },
              ...(Object.keys(matches).length > 0 ? [{ k: "matches", label: "Matches", Icon: ListOrdered }] : []),
              { k: "robots", label: "Robots", Icon: Camera },
              ...(rules.length > 0 ? [{ k: "rulebook", label: "Rules", Icon: BookOpen }] : [])].map(({ k, label, Icon }) => (
              <button key={k} onClick={() => { setView(k); setQuery(""); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${view === k ? "border-[#D7212B] text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        )}
      </header>

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

      <main className="max-w-2xl mx-auto px-4 pb-28 pt-4">
        {openTeam ? (
          <TeamDetail team={teams.find((t) => t.number === openTeam)} viols={viols.filter((v) => v.team === openTeam)}
            onLog={() => setLogFor(openTeam)} onDeleteViolation={deleteViolation} onDeleteTeam={deleteTeam} onOpenPhoto={setLightbox} />
        ) : openMatch ? (
          <MatchDetail num={openMatch} match={matches[openMatch]} teamName={teamNameMap} viols={viols} allNums={matchNums} onNav={setOpenMatch}
            onLogTeam={(n) => { setLogFor(n); setLogMatch(openMatch); }} onOpenPhoto={setLightbox} onDeleteViolation={deleteViolation} />
        ) : openRobot ? (
          <RobotDetail team={teams.find((t) => t.number === openRobot)} onAddPhoto={addRobotPhoto} onRemovePhoto={removeRobotPhoto} onOpenPhoto={setLightbox} />
        ) : view === "matches" ? (
          <MatchList matches={matches} teamName={teamNameMap} viols={viols} query={query} setQuery={setQuery} onOpen={setOpenMatch} />
        ) : view === "robots" ? (
          <RobotList teams={teams} query={query} setQuery={setQuery} onOpen={setOpenRobot} />
        ) : view === "rulebook" ? (
          <RuleBook rules={rules} />
        ) : (
          <>
            {!event?.quals ? (
              <button onClick={() => setShowEvent(true)} className="w-full mb-4 bg-[#0D0F32] text-white rounded-xl p-4 flex items-center gap-3 text-left hover:bg-[#171a45]">
                <CalendarDays size={22} className="text-[#EBA622] shrink-0" />
                <div className="flex-1"><p className="font-semibold leading-tight">Finish event setup</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add how many matches so logging picks the match from a list.</p></div>
                <ChevronRight size={18} className="text-slate-500" />
              </button>
            ) : (
              <button onClick={() => setShowEvent(true)} className="w-full mb-4 bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-left hover:border-slate-300">
                <CalendarDays size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700 truncate flex-1">{event.name || "Event"}</span>
                <span className="text-xs text-slate-400">{event.quals} quals{event.bracket ? ` · top ${event.bracket}` : ""}</span>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            )}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team #"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <button onClick={() => setAddTeam(true)} className="px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1 text-sm font-medium"><Plus size={17} /> Team</button>
            </div>
            {filteredTeams.length === 0 ? (
              <Empty title={teams.length ? "No matches" : "No teams yet"} sub={teams.length ? "Try a different team number." : "Add a team, or just log a violation and the team is created for you."} />
            ) : (
              <ul className="space-y-2">
                {filteredTeams.map((t) => {
                  const c = countsByTeam[t.number] || { total: 0 };
                  return (
                    <li key={t.number}>
                      <button onClick={() => setOpenTeam(t.number)} className="w-full text-left bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 hover:border-slate-300 hover:shadow-sm transition">
                        <span className="font-mono font-bold text-lg text-slate-900">{t.number}</span>
                        {t.name && <span className="text-sm text-slate-500 truncate flex-1">{t.name}</span>}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {ORDER.map((ty) => c[ty] ? (
                            <span key={ty} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold border ${TYPES[ty].badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${TYPES[ty].dot}`} />{c[ty]}</span>) : null)}
                          {!c.total && <span className="text-xs text-slate-300">clean</span>}
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
      </main>

      {!openTeam && !openMatch && !openRobot && (
        <button onClick={() => setLogFor("")} className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 bg-[#D7212B] text-white px-5 py-3.5 rounded-full shadow-xl flex items-center gap-2 font-semibold hover:bg-[#B42024] active:scale-95 transition">
          <Plus size={20} /> Log violation
        </button>
      )}

      {logFor !== null && (
        <LogModal teams={teams} presetTeam={logFor || null} knownRules={knownRules} me={{ name: meName }} lastMatch={lastMatch} event={event} matches={matches} presetMatch={logMatch} rules={rules}
          onSetName={() => setShowIdentity(true)} onClose={() => { setLogFor(null); setLogMatch(null); }}
          onSave={async (form) => { const team = await upsertTeam(form.team || form.newNumber, form.newName); await saveViolation({ ...form, team }); setLogFor(null); setLogMatch(null); }} />
      )}
      {addTeam && <AddTeamModal onClose={() => setAddTeam(false)} onSave={async (num, name) => { await upsertTeam(num, name); setAddTeam(false); }} />}
      {showIdentity && <IdentityModal me={{ name: meName }} onSave={async (n) => { await onEditName(n); setShowIdentity(false); }} onClose={() => setShowIdentity(false)} />}
      {showClear && <ClearModal counts={{ violations: viols.length, teams: teams.length, schedule: Object.keys(matches).length }} onClear={clearSelected} onClose={() => setShowClear(false)} />}
      {showOnline && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setShowOnline(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="font-bold text-slate-900 flex items-center gap-2"><Wifi size={18} /> Who's online</h2>
              <button onClick={() => setShowOnline(false)} className="text-slate-400"><X size={22} /></button>
            </div>
            <div className="p-4"><OnlineList presence={presence} meName={meName} /></div>
          </div>
        </div>
      )}
      {showByRule && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col font-sans">
          <div className="px-3 py-3 border-b border-slate-200 bg-white flex items-center gap-2 shrink-0">
            <button onClick={() => setShowByRule(false)} className="text-slate-500 p-1 -ml-1"><ChevronLeft size={22} /></button>
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><BarChart3 size={18} /> Violations by rule</h2>
          </div>
          <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto px-4 py-4"><ByRule viols={viols} expandRule={expandRule} setExpandRule={setExpandRule} /></div></div>
        </div>
      )}
      {showShare && <ShareModal event={event} onClose={() => setShowShare(false)} />}
      {showEvent && <EventModal event={event} onSave={saveEvent} onClose={() => setShowEvent(false)} />}
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-40 bg-black/90 grid place-items-center p-4">
          <img src={lightbox} alt="robot" className="max-h-full max-w-full rounded-lg" />
          <button className="absolute top-4 right-4 text-white/80 p-2"><X size={26} /></button>
        </div>
      )}
    </div>
  );
}

/* ============================ TEAM DETAIL ============================ */
function TeamDetail({ team, viols, onLog, onDeleteViolation, onDeleteTeam, onOpenPhoto }) {
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
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono font-bold text-2xl text-slate-900 leading-none">{team.number}</div>
            {team.name && <div className="text-sm text-slate-500 mt-1">{team.name}</div>}
          </div>
          <button onClick={() => { if (confirm(`Delete team ${team.number} and all its violations?`)) onDeleteTeam(team.number); }} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
        </div>
        <button onClick={onLog} className="mt-4 w-full bg-[#D7212B] text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#B42024]"><Plus size={18} /> Log violation for {team.number}</button>
      </div>
      {byRule.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">Violations by rule</h2>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {byRule.map((r) => (
              <div key={r.code || "none"} className="px-4 py-2.5 flex items-center gap-3">
                <span className="font-mono font-semibold text-slate-800">{fmtRule(r.code)}</span>
                {r.desc && <span className="text-sm text-slate-500 truncate flex-1">{r.desc}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  {ORDER.map((ty) => r.types[ty] ? <span key={ty} className={`w-1.5 h-1.5 rounded-full ${TYPES[ty].dot}`} title={TYPES[ty].label} /> : null)}
                  <span className="font-bold text-slate-900 tabular-nums ml-1">×{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">Log ({viols.length})</h2>
      {sorted.length === 0 ? <Empty title="No violations" sub="This team has a clean record." /> : (
        <ul className="space-y-2">{sorted.map((v) => <ViolationCard key={v.id} v={v} onDelete={onDeleteViolation} onOpenPhoto={onOpenPhoto} />)}</ul>
      )}
    </>
  );
}

function ViolationCard({ v, onDelete, onOpenPhoto, showTeam }) {
  const T = TYPES[v.type];
  return (
    <li className={`rounded-xl border p-3 ${T.soft}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${T.badge}`}><T.Icon size={12} /> {T.label}</span>
        {showTeam && <span className="font-mono font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded-md text-sm">{v.team}</span>}
        <span className="font-mono font-bold text-slate-900">{fmtRule(v.code)}</span>
        {fmtMatch(v.match) && <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700">{fmtMatch(v.match)}</span>}
        {v._pending && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-300"><RefreshCw size={9} className="animate-spin" /> Saving</span>}
        <span className="text-[11px] text-slate-400 ml-auto">{fmtTime(v.createdAt)}</span>
        <button onClick={() => { if (confirm(v._pending ? "Discard this unsynced violation?" : "Delete this violation?")) onDelete(v); }} className="text-slate-300 hover:text-red-600"><Trash2 size={15} /></button>
      </div>
      {v.desc && <p className={`text-sm mt-1.5 font-medium ${T.text}`}>{v.desc}</p>}
      {v.notes && <p className="text-sm text-slate-600 mt-1">{v.notes}</p>}
      {v._localPhotos?.length > 0 ? (
        <div className="flex gap-2 mt-2 overflow-x-auto">{v._localPhotos.map((src, i) => (
          <button key={i} onClick={() => onOpenPhoto(src)} className="shrink-0"><img src={src} alt="robot" className="w-16 h-16 rounded-lg object-cover border border-slate-200 opacity-90" /></button>
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
          <li key={r.code || "none"} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button onClick={() => setExpandRule(open ? null : (r.code || "—"))} className="w-full text-left px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900">{fmtRule(r.code)}</span>
                <span className="text-xs text-slate-400">{teamCount} team{teamCount !== 1 ? "s" : ""}</span>
                <span className="ml-auto font-bold text-lg text-slate-900 tabular-nums">{r.count}</span>
                <ChevronRight size={16} className={`text-slate-300 transition-transform ${open ? "rotate-90" : ""}`} />
              </div>
              {r.desc && <p className="text-sm text-slate-500 mt-0.5">{r.desc}</p>}
              <div className="flex h-1.5 rounded-full overflow-hidden mt-2 bg-slate-100" style={{ width: `${Math.max(12, (r.count / max) * 100)}%` }}>
                {ORDER.map((ty) => r.types[ty] ? <div key={ty} className={TYPES[ty].solid} style={{ flex: r.types[ty] }} /> : null)}
              </div>
            </button>
            {open && (
              <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                {Object.entries(r.teams).sort((a, b) => b[1] - a[1]).map(([num, n]) => (
                  <div key={num} className="flex items-center justify-between py-1 text-sm">
                    <span className="font-mono font-medium text-slate-700">{num}</span>
                    <span className="text-slate-500 tabular-nums">×{n}</span>
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
function LogModal({ teams, presetTeam, knownRules, me, lastMatch, event, matches, presetMatch, rules, onSetName, onClose, onSave }) {
  const ruleBook = useMemo(() => {
    const m = {}; for (const r of (rules || [])) m[r.code] = r.desc; return m;
  }, [rules]);
  const [team, setTeam] = useState(presetTeam || (teams[0]?.number ?? ""));
  const [creatingNew, setCreatingNew] = useState(teams.length === 0);
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [matchPhase, setMatchPhase] = useState(presetMatch ? "qual" : (lastMatch?.phase || "qual"));
  const [matchNum, setMatchNum] = useState(presetMatch ? String(presetMatch) : (lastMatch?.num || ""));
  const [type, setType] = useState("minor");
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showRulePicker, setShowRulePicker] = useState(false);
  const fileRef = useRef(null);
  const T = TYPES[type];

  const onCode = (val) => { setCode(val); const clean = normNum(val).replace(/[<>]/g, ""); const d = ruleBook[clean] || knownRules[clean]; if (d && !desc) setDesc(d); };
  const addPhotos = async (files) => { const list = Array.from(files).slice(0, 4); const out = []; for (const f of list) { try { out.push(await compress(f)); } catch {} } setPhotos((p) => [...p, ...out].slice(0, 6)); };
  const valid = (creatingNew ? newNumber.trim() : team) && (code.trim() || desc.trim());
  const submit = async () => { if (!valid || busy) return; setBusy(true); try { await onSave({ team: creatingNew ? "" : team, newNumber, newName, type, code, desc, notes, photos, match: { phase: matchPhase, num: matchNum } }); } catch (e) { alert("Could not save: " + (e.message || e)); setBusy(false); } };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-200">
          <h2 className="font-bold text-slate-900">New violation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-4">
          <button onClick={onSetName} className="w-full flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <UserCircle2 size={15} className="text-slate-400" />
            {me?.name ? <>Logging as <b className="text-slate-700">{me.name}</b></> : <span className="text-amber-600 font-medium">Tap to set your ref name (so entries are attributed)</span>}
          </button>

          <div>
            <Label>Team</Label>
            {creatingNew ? (
              <div className="space-y-2">
                <input autoFocus value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="Team number (e.g. 1234A)"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-slate-300" />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team name (optional)"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                {teams.length > 0 && <button onClick={() => setCreatingNew(false)} className="text-sm text-slate-500 underline">Pick an existing team instead</button>}
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={team} onChange={(e) => setTeam(e.target.value)} className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                  {teams.map((t) => <option key={t.number} value={t.number}>{t.number}{t.name ? ` — ${t.name}` : ""}</option>)}
                </select>
                <button onClick={() => setCreatingNew(true)} className="px-3 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1 text-sm"><Plus size={16} /> New</button>
              </div>
            )}
          </div>

          <div>
            <Label>Match</Label>
            <div className="flex gap-2">
              <select value={matchPhase} onChange={(e) => { setMatchPhase(e.target.value); setMatchNum(""); }}
                className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                {availablePhases(event).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              {(() => {
                if (matchPhase === "none") return null;
                const count = phaseCount(matchPhase, event);
                if (count) return (
                  <select value={matchNum} onChange={(e) => setMatchNum(e.target.value)}
                    className="w-32 px-2 py-2.5 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-slate-300">
                    <option value="">Match…</option>
                    {Array.from({ length: count }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{fmtMatch({ phase: matchPhase, num: String(n) })}</option>)}
                  </select>
                );
                return (<input value={matchNum} onChange={(e) => setMatchNum(e.target.value)} placeholder={matchPhase === "skills" ? "run" : "#"} inputMode="numeric"
                  className="w-24 px-3 py-2.5 rounded-lg border border-slate-300 text-center focus:outline-none focus:ring-2 focus:ring-slate-300" />);
              })()}
            </div>
            {fmtMatch({ phase: matchPhase, num: matchNum }) && (<p className="text-[11px] text-slate-400 mt-1">Recorded as <b className="font-mono text-slate-600">{fmtMatch({ phase: matchPhase, num: matchNum })}</b></p>)}
            {(() => {
              const m = matchPhase === "qual" && matchNum ? matches?.[Number(matchNum)] : null;
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
                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
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
                <button key={ty} onClick={() => setType(ty)} className={`py-2.5 rounded-lg border-2 font-semibold text-sm flex flex-col items-center gap-1 transition ${on ? `${M.solid} text-white border-transparent` : `bg-white ${M.text} border-slate-200`}`}>
                  <M.Icon size={18} /> {M.label}
                </button>); })}
            </div>
          </div>

          <div>
            <Label>Rule cited</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowRulePicker(true)}
                className="w-28 px-3 py-2.5 rounded-lg border border-slate-300 bg-white font-mono text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300">
                {code ? <span className="text-slate-900 font-semibold">{fmtRule(code)}</span> : <span className="text-slate-400 font-sans">Rule…</span>}
              </button>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What the rule covers"
                className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Tap the box to pick a rule — search by code or description.</p>
          </div>

          <div>
            <Label>Robot photos</Label>
            <div className="flex gap-2 flex-wrap">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} className="w-20 h-20 rounded-lg object-cover border border-slate-200" alt="robot" />
                  <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"><X size={13} /></button>
                </div>
              ))}
              {photos.length < 6 && (<button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 grid place-items-center text-slate-400 hover:border-slate-400 hover:text-slate-500"><Camera size={22} /></button>)}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What happened, where on the field, who was told…"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-4 flex gap-2">
          <button onClick={onClose} className="px-4 py-3 rounded-lg border border-slate-300 bg-white font-medium text-slate-600">Cancel</button>
          <button onClick={submit} disabled={!valid || busy} className={`flex-1 py-3 rounded-lg font-semibold text-white transition ${valid && !busy ? `${T.solid} ${T.solidHover}` : "bg-slate-300"}`}>{busy ? "Saving…" : "Save violation"}</button>
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
  const query = q.trim();
  const uq = query.toUpperCase();
  const book = rules || [];
  const bookCodes = new Set(book.map((r) => r.code));
  const custom = Object.keys(knownRules || {}).filter((c) => !bookCodes.has(c)).map((c) => ({ code: c, desc: knownRules[c], category: "Previously used" }));
  const all = [...book, ...custom];
  const filtered = query ? all.filter((r) => r.code.toUpperCase().includes(uq) || (r.desc || "").toUpperCase().includes(uq)) : all;
  const groups = [];
  const idx = {};
  for (const r of filtered) {
    if (!(r.category in idx)) { idx[r.category] = groups.length; groups.push({ cat: r.category, items: [] }); }
    groups[idx[r.category]].items.push(r);
  }
  const exact = all.some((r) => r.code.toUpperCase() === uq);
  const showCustom = query && !exact;
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col font-sans">
      <div className="px-3 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="text-slate-500 p-1 -ml-1"><ChevronLeft size={22} /></button>
        <h2 className="font-bold text-slate-900">Cite a rule</h2>
      </div>
      <div className="p-3 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or description"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {showCustom && (
          <button onClick={() => onPickCustom(uq.replace(/[<>]/g, ""))} className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
            <span className="font-mono font-bold text-slate-900">Use {fmtRule(uq)}</span>
            <span className="text-sm text-slate-500 ml-2">custom — not in the rulebook</span>
          </button>
        )}
        {groups.length === 0 && !showCustom && <p className="text-center text-slate-400 py-10">No rules match.</p>}
        {groups.map((g) => (
          <div key={g.cat}>
            <div className="sticky top-0 bg-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.cat}</div>
            {g.items.map((r) => (
              <button key={r.code} onClick={() => onPickRule(r.code, r.desc)} className="w-full text-left px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 flex gap-3 items-baseline">
                <span className="font-mono font-bold text-slate-900 w-16 shrink-0">{fmtRule(r.code)}</span>
                <span className="text-sm text-slate-600">{r.desc}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ ADD TEAM MODAL ============================ */
function AddTeamModal({ onClose, onSave }) {
  const [num, setNum] = useState(""); const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200"><h2 className="font-bold text-slate-900">Add team</h2><button onClick={onClose} className="text-slate-400"><X size={22} /></button></div>
        <div className="p-4 space-y-3">
          <div><Label>Team number</Label><input autoFocus value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 1234A" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-slate-300" /></div>
          <div><Label>Team name (optional)</Label><input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" /></div>
        </div>
        <div className="p-4 pt-0 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 font-medium text-slate-600">Cancel</button>
          <button onClick={() => num.trim() && onSave(num, name)} disabled={!num.trim()} className={`flex-1 py-2.5 rounded-lg font-semibold text-white ${num.trim() ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Add team</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ IDENTITY MODAL ============================ */
function IdentityModal({ me, onSave, onClose }) {
  const [name, setName] = useState(me?.name || "");
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200">
          <h2 className="font-bold text-slate-900">Your ref name</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><Label>Name or initials</Label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex R or ABR"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>
        <div className="p-4 pt-0"><button onClick={() => name.trim() && onSave(name)} disabled={!name.trim()} className={`w-full py-2.5 rounded-lg font-semibold text-white ${name.trim() ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Save</button></div>
      </div>
    </div>
  );
}

/* ============================ SHARE / INVITE MODAL ============================ */
function ShareModal({ event, onClose }) {
  const [copied, setCopied] = useState("");
  const url = window.location.origin;
  const copy = (text, which) => { navigator.clipboard?.writeText(text); setCopied(which); setTimeout(() => setCopied(""), 1500); };
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><Share2 size={18} /> Invite other refs</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-4 text-sm text-slate-600">
          <p>Everyone works from the same live Highlander Summit log and sees each other's entries within seconds.</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <Label>Send your crew the site</Label>
              <div className="flex gap-2">
                <input readOnly value={url} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm" />
                <button onClick={() => copy(url, "url")} className="px-3 rounded-lg bg-slate-900 text-white flex items-center gap-1 text-sm">{copied === "url" ? <Check size={15} /> : <Copy size={15} />}</button>
              </div>
            </div>
            <p className="text-[13px] text-slate-500">They open the link, enter the crew password, set a ref name, and they're in.</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <span>Share the password only with your officiating crew — anyone who has it can view, add, and delete entries.</span>
          </div>
        </div>
        <div className="p-4 pt-0"><button onClick={onClose} className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 flex items-center justify-center gap-2"><Check size={16} /> Done</button></div>
      </div>
    </div>
  );
}

/* ============================ EVENT MODAL ============================ */
function EventModal({ event, onSave, onClose }) {
  const [name, setName] = useState(event?.name || "");
  const [quals, setQuals] = useState(event?.quals ? String(event.quals) : "");
  const [practice, setPractice] = useState(event?.practice ? String(event.practice) : "");
  const [bracket, setBracket] = useState(event?.bracket ? String(event.bracket) : "16");
  const [finalsBestOf, setFinalsBestOf] = useState(event?.finalsBestOf ? String(event.finalsBestOf) : "3");
  const creating = !event;
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-4 py-3 flex items-center justify-between border-b border-slate-200">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><CalendarDays size={18} /> {creating ? "New event" : "Event setup"}</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><Label>Event name</Label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Highlander Summit Signature"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300" /></div>
          <div><Label>Number of qualification matches</Label>
            <div className="relative">
              <ListOrdered size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={quals} onChange={(e) => setQuals(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="e.g. 60"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Logging will offer Q1–Q{quals || "n"} as a dropdown.</p>
          </div>
          <div><Label>Practice matches (optional)</Label>
            <input value={practice} onChange={(e) => setPractice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="leave blank if none"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Elimination bracket</Label>
              <select value={bracket} onChange={(e) => setBracket(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                <option value="0">None</option><option value="4">Top 4</option><option value="8">Top 8</option><option value="16">Top 16</option>
              </select>
            </div>
            <div><Label>Finals</Label>
              <select value={finalsBestOf} onChange={(e) => setFinalsBestOf(e.target.value)} disabled={bracket === "0"} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300">
                <option value="1">Single</option><option value="3">Best of 3</option>
              </select>
            </div>
          </div>
          {bracket !== "0" && (
            <p className="text-[11px] text-slate-400">Generates {(() => { const ec = elimCounts(bracket); const parts = []; if (ec.r16) parts.push("R16-1…8"); if (ec.qf) parts.push("QF1…4"); if (ec.sf) parts.push("SF1…2"); parts.push(finalsBestOf === "3" ? "F1…3" : "F1"); return parts.join(", "); })()} as dropdowns.</p>
          )}
        </div>
        <div className="p-4 pt-0 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 font-medium text-slate-600">Cancel</button>
          <button onClick={() => onSave({ name, quals, practice, bracket, finalsBestOf })} className="flex-1 py-2.5 rounded-lg font-semibold text-white bg-slate-900 hover:bg-slate-800">{creating ? "Create event" : "Save event"}</button>
        </div>
      </div>
    </div>
  );
}


/* ============================ MATCHES ============================ */
function MatchList({ matches, teamName, viols, query, setQuery, onOpen }) {
  const [field, setField] = useState("all");
  const list = Object.values(matches).sort((a, b) => a.num - b.num);
  const fields = [...new Set(list.map((m) => m.field).filter(Boolean))].sort();
  const vcount = {};
  for (const v of viols) if (v.match && v.match.phase === "qual" && v.match.num) vcount[v.match.num] = (vcount[v.match.num] || 0) + 1;
  const q = query.trim().toUpperCase();
  const base = field === "all" ? list : list.filter((m) => m.field === field);
  const filtered = q
    ? base.filter((m) => String(m.num) === q || String(m.num).startsWith(q) || m.red.some((t) => t.includes(q)) || m.blue.some((t) => t.includes(q)))
    : base;
  return (
    <>
      {fields.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {["all", ...fields].map((f) => (
            <button key={f} onClick={() => setField(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${field === f ? "bg-[#0D0F32] text-white border-[#0D0F32]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
              {f === "all" ? "All fields" : f}
            </button>
          ))}
        </div>
      )}
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search match # or team"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>
      {filtered.length === 0 ? (
        <Empty title="No matches" sub="Try a different match number or team." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.num}>
              <button onClick={() => onOpen(m.num)} className="w-full text-left bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 hover:border-slate-300 hover:shadow-sm transition">
                <span className="font-mono font-bold text-slate-900 w-11 shrink-0">Q{m.num}</span>
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-mono">
                  <span className="text-red-700 font-semibold">{m.red.join("  ")}</span>
                  <span className="text-slate-300 font-sans">vs</span>
                  <span className="text-blue-700 font-semibold">{m.blue.join("  ")}</span>
                </div>
                {m.field && <span className="text-[11px] text-slate-400 shrink-0">{m.field.replace("Field ", "F")}</span>}
                {vcount[m.num] ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-300 shrink-0">{vcount[m.num]}</span> : null}
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function MatchDetail({ num, match, teamName, viols, allNums, onNav, onLogTeam, onOpenPhoto, onDeleteViolation }) {
  if (!match) return <Empty title="Match not found" sub="This match isn't in the loaded schedule." />;
  const nums = allNums || [num];
  const idx = nums.indexOf(num);
  const prev = idx > 0 ? nums[idx - 1] : null;
  const next = idx >= 0 && idx < nums.length - 1 ? nums[idx + 1] : null;
  const mv = viols.filter((v) => v.match && v.match.phase === "qual" && String(v.match.num) === String(num)).sort((a, b) => b.createdAt - a.createdAt);
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
            <button key={n} onClick={() => onLogTeam(n)} className="w-full bg-white rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:border-slate-300">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900">{n}</span>
                {teamName[n] && <span className="text-sm text-slate-500 truncate">{teamName[n]}</span>}
                <span className="ml-auto text-xs font-semibold text-[#D7212B] flex items-center gap-1 shrink-0"><Plus size={14} /> Log</span>
              </div>
              {s && s.total > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Prior:</span>
                  {ORDER.map((ty) => s[ty] ? (
                    <span key={ty} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border ${TYPES[ty].badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${TYPES[ty].dot}`} />{s[ty]}
                    </span>) : null)}
                  {Object.entries(s.codes).sort((a, b) => b[1] - a[1]).map(([c, n2]) => (
                    <span key={c} className="font-mono text-[11px] text-slate-500">{fmtRule(c)}{n2 > 1 ? <span className="text-slate-400">×{n2}</span> : null}</span>
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
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-mono font-bold text-2xl text-slate-900 leading-none">Q{num}</div>
            {match.field && <div className="text-sm text-slate-500 mt-1">{match.field}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => prev && onNav(prev)} disabled={!prev} title="Previous match"
              className={`p-2 rounded-lg border ${prev ? "border-slate-300 text-slate-600 hover:bg-slate-50" : "border-slate-200 text-slate-300"}`}><ChevronLeft size={18} /></button>
            <button onClick={() => next && onNav(next)} disabled={!next}
              className={`px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-1 ${next ? "bg-[#D7212B] text-white hover:bg-[#B42024]" : "bg-slate-200 text-slate-400"}`}>Next <ChevronRight size={16} /></button>
          </div>
        </div>
        {nums.length > 1 && (
          <select value={num} onChange={(e) => onNav(Number(e.target.value))}
            className="w-full mt-3 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
            {nums.map((n) => <option key={n} value={n}>Jump to Q{n}</option>)}
          </select>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Alliance label="Red alliance" teams={match.red} color="red" />
        <Alliance label="Blue alliance" teams={match.blue} color="blue" />
      </div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">Violations in this match ({mv.length})</h2>
      {mv.length === 0 ? (
        <Empty title="No violations logged" sub="Tap a team above to log one for this match." />
      ) : (
        <ul className="space-y-2">{mv.map((v) => <ViolationCard key={v.id} v={v} onDelete={onDeleteViolation} onOpenPhoto={onOpenPhoto} showTeam />)}</ul>
      )}
    </>
  );
}

/* ============================ CLEAR MODAL ============================ */
function ClearModal({ counts, onClear, onClose }) {
  const [sel, setSel] = useState({ violations: false, teams: false, schedule: false });
  const opts = [
    { key: "violations", label: "Violations", desc: `${counts.violations} logged`, note: "Clears every violation and its photos." },
    { key: "teams", label: "Teams", desc: `${counts.teams} teams`, note: "Removes the team roster." },
    { key: "schedule", label: "Match schedule", desc: `${counts.schedule} matches`, note: "Removes the imported qual schedule." },
  ];
  const any = sel.violations || sel.teams || sel.schedule;
  const toggle = (k) => setSel((s) => ({ ...s, [k]: !s[k] }));
  const doClear = () => {
    const names = opts.filter((o) => sel[o.key]).map((o) => o.label.toLowerCase()).join(", ");
    if (confirm(`Permanently delete: ${names}?\nThis cannot be undone.`)) onClear(sel);
  };
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><Trash2 size={18} /> Clear data</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-sm text-slate-500 mb-1">Choose what to delete. Anything you leave unchecked is kept.</p>
          {opts.map((o) => {
            const on = sel[o.key];
            return (
              <button key={o.key} onClick={() => toggle(o.key)}
                className={`w-full flex items-start gap-3 text-left rounded-xl border-2 p-3 transition ${on ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-slate-300"}`}>
                <span className={`mt-0.5 w-5 h-5 rounded-md grid place-items-center shrink-0 border-2 ${on ? "bg-red-600 border-red-600 text-white" : "border-slate-300"}`}>{on && <Check size={13} />}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2"><b className="text-slate-800">{o.label}</b><span className="text-xs text-slate-400">{o.desc}</span></span>
                  <span className="block text-xs text-slate-500 mt-0.5">{o.note}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="p-4 pt-0 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 font-medium text-slate-600">Cancel</button>
          <button onClick={doClear} disabled={!any}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-white ${any ? "bg-red-600 hover:bg-red-700" : "bg-slate-300"}`}>Clear selected</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ ONLINE (presence) ============================ */
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

function OnlineList({ presence, meName }) {
  const byName = {};
  for (const p of presence) { const n = p.name || "Ref"; byName[n] = (byName[n] || 0) + 1; }
  const names = Object.keys(byName).sort((a, b) => a.localeCompare(b));
  return (
    <>
      <p className="text-xs text-slate-400 mb-3">{names.length} ref{names.length !== 1 ? "s" : ""} on the log right now. Updates live as people join or leave.</p>
      <ul className="space-y-2">
        {names.map((n) => (
          <li key={n} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#D7212B] text-white text-xs font-bold grid place-items-center shrink-0">{initials(n)}</span>
            <span className="font-medium text-slate-800 truncate">{n}{n === meName && <span className="text-xs text-slate-400 ml-1">(you)</span>}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> online{byName[n] > 1 ? ` · ${byName[n]} devices` : ""}
            </span>
          </li>
        ))}
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
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>
      {filtered.length === 0 ? (
        <Empty title="No teams" sub="Try a different team number." />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filtered.map((t) => {
            const key = (t.photoKeys || [])[0];
            return (
              <li key={t.number}>
                <button onClick={() => onOpen(t.number)} className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition text-left">
                  <div className="aspect-square bg-slate-100 grid place-items-center">
                    {key ? <Thumb pkey={key} /> : <Camera size={26} className="text-slate-300" />}
                  </div>
                  <div className="px-2.5 py-2 flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 text-sm truncate">{t.number}</span>
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

function RobotDetail({ team, onAddPhoto, onRemovePhoto, onOpenPhoto }) {
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
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="font-mono font-bold text-2xl text-slate-900 leading-none">{team.number}</div>
        {team.name && <div className="text-sm text-slate-500 mt-1">{team.name}</div>}
      </div>
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="w-full mb-4 bg-[#D7212B] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#B42024] disabled:bg-slate-300">
        <Camera size={18} /> {busy ? "Saving…" : photos.length ? "Add another photo" : "Add robot photo"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      {photos.length === 0 ? (
        <Empty title="No robot photos yet" sub="Snap the robot during inspection so refs can reference it later." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              <button onClick={() => onOpenPhoto(p)} className="w-full h-full"><Thumb pkey={p} /></button>
              <button onClick={() => { if (confirm("Delete this robot photo?")) onRemovePhoto(team.number, p); }}
                className="absolute top-1 right-1 bg-slate-900/80 text-white rounded-full p-1"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ============================ RULEBOOK (reference) ============================ */
function RuleBook({ rules }) {
  const [query, setQuery] = useState("");
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
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>
      {groups.length === 0 ? (
        <Empty title="No rules match" sub="Try a different word or code." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.cat}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">{g.cat}</h2>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {g.items.map((r) => (
                  <div key={r.code} className="px-4 py-2.5 flex gap-3 items-baseline">
                    <span className="font-mono font-bold text-slate-900 w-16 shrink-0">{fmtRule(r.code)}</span>
                    <span className="text-sm text-slate-600">{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- shared bits ---------- */
const Label = ({ children }) => <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{children}</label>;
const Empty = ({ title, sub }) => (
  <div className="text-center py-14 px-6"><p className="font-semibold text-slate-700">{title}</p><p className="text-sm text-slate-400 mt-1">{sub}</p></div>
);
