import React, { useEffect, useMemo, useState } from "react";
import * as api from "../api";

const HIGHLANDER_EVENT_ID = "11111111-1111-4111-8111-111111111111";
const STEPS = ["Event", "Format", "Branding", "Access", "Review"];
const ROLE_META = [
  ["ref", "Referee"], ["judge", "Judge Advisor"], ["emcee", "Emcee"], ["inspection", "Inspection"],
];
const randomCode = () => `${Math.floor(1 + Math.random()*8)}${String.fromCharCode(65 + Math.floor(Math.random()*4))}${Math.floor(10 + Math.random()*90)}`;
const hashCode = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export default function EventGateway({ currentEventId, onSelect, onClose }) {
  const [events, setEvents] = useState([]), [eventLink, setEventLink] = useState("");
  const [builderCode, setBuilderCode] = useState(""), [authorizedCode, setAuthorizedCode] = useState("");
  const [step, setStep] = useState(0), [name, setName] = useState(""), [date, setDate] = useState("");
  const [venue, setVenue] = useState(""), [quals, setQuals] = useState("0"), [practice, setPractice] = useState("0");
  const [bracket, setBracket] = useState("16"), [finals, setFinals] = useState("1"), [adminCredential, setAdminCredential] = useState("");
  const [accent, setAccent] = useState("#2563eb"), [logoData, setLogoData] = useState("");
  const [codes, setCodes] = useState(() => Object.fromEntries(ROLE_META.map(([key]) => [key, randomCode()])));
  const [created, setCreated] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");

  useEffect(() => { api.ensureAnonymousSession().then(() => api.listMyEvents()).then(setEvents).catch(() => {}); }, []);
  const eventUrl = created ? `${window.location.origin}/?event=${created.id}` : "";
  const canNext = useMemo(() => step === 0 ? name.trim().length >= 3 : step === 3 ? adminCredential.length >= 12 && Object.values(codes).every((c) => c.length >= 4) : true, [step, name, adminCredential, codes]);

  const verify = async () => { setBusy(true); setError(""); try { if (!await api.verifyEventConfigurator(builderCode.trim().toUpperCase())) throw new Error("Incorrect configurator code."); setAuthorizedCode(builderCode.trim().toUpperCase()); setBuilderCode(""); } catch (e) { setError(e.message || "Could not open the configurator."); } finally { setBusy(false); } };
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); } catch {} };
  const loadLogo = (file) => {
    if (!file) return;
    if (file.size > 250000) { setError("Event logo must be 250 KB or smaller."); return; }
    const reader = new FileReader(); reader.onload = () => setLogoData(String(reader.result || "")); reader.readAsDataURL(file);
  };
  const regenerate = (role) => setCodes((current) => ({ ...current, [role]: randomCode() }));
  const removeEvent = async (event) => {
    if (event.id === HIGHLANDER_EVENT_ID) { setError("Highlander is protected and cannot be deleted."); return; }
    const confirmed = window.confirm(`Delete ${event.name}? This permanently deletes this event and all of its Ref OS data. This cannot be undone.`);
    if (!confirmed) return;
    setBusy(true); setError("");
    try {
      await api.deleteConfiguredEvent(event.id, authorizedCode);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      if (currentEventId === event.id) onSelect(HIGHLANDER_EVENT_ID);
    } catch (e) { setError(e.message || "Could not delete the event."); } finally { setBusy(false); }
  };

  const create = async () => {
    setError(""); setBusy(true);
    try {
      const event = await api.createEvent({ name: name.trim(), quals: Number(quals), practice: Number(practice), bracket: Number(bracket), finalsBestOf: Number(finals), adminCredential, builderCode: authorizedCode });
      if (event.id === HIGHLANDER_EVENT_ID) throw new Error("The protected Highlander event cannot be configured here.");
      const codeEntries = {};
      for (const [role] of ROLE_META) codeEntries[role] = { code: codes[role], hash: await hashCode(codes[role]), enabled: true, updatedAt: Date.now() };
      await api.finishConfiguredEvent(event.id, {
        branding: { accent, logoData, venue: venue.trim(), date },
        roleCodes: { version: 1, codes: codeEntries },
      });
      setCreated(event); setEvents((current) => [event, ...current]);
    } catch (e) { setError(e.message || "Could not create the event."); } finally { setBusy(false); }
  };

  const pickLink = () => { const raw = eventLink.trim(); let id = raw; try { id = new URL(raw).searchParams.get("event") || raw; } catch {} if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) { setError("Enter an event link or event ID."); return; } onSelect(id); };

  return <div className="min-h-[100dvh] bg-slate-100 dark:bg-slate-900 p-4 sm:p-8 text-slate-900 dark:text-slate-100">
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-5">
      <div className="flex items-start gap-3"><img src="/refos-logo.svg" alt="Ref OS" className="h-12 w-12 shrink-0"/><div className="flex-1"><h1 className="text-xl font-bold">Ref OS events</h1><p className="text-sm text-slate-500 dark:text-slate-300">Choose an event or configure a new one.</p></div><button onClick={onClose} className="px-3 py-2 rounded-lg border">Back</button></div>
      {events.length > 0 && <section className="space-y-2"><h2 className="font-semibold">Your events</h2>{events.map((event) => <div key={event.id} className="flex items-stretch gap-2"><button onClick={() => onSelect(event.id)} className="min-w-0 flex-1 text-left rounded-lg border border-slate-200 dark:border-slate-600 p-3 hover:border-blue-500"><b>{event.name}</b>{event.id === HIGHLANDER_EVENT_ID && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">PROTECTED</span>}{event.id === currentEventId && <span className="text-xs ml-2 text-slate-400">Current</span>}</button>{authorizedCode && event.id !== HIGHLANDER_EVENT_ID && <button disabled={busy} onClick={() => removeEvent(event)} className="shrink-0 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30">Delete</button>}</div>)}</section>}
      <section className="border-t pt-4 space-y-4"><h2 className="font-semibold">Create an event</h2>
        {!authorizedCode ? <div className="flex gap-2"><input value={builderCode} onChange={(e)=>setBuilderCode(e.target.value)} onKeyDown={(e)=>e.key === "Enter" && verify()} maxLength={4} placeholder="Configurator login code" className="min-w-0 flex-1 rounded-lg border px-3 py-2 bg-white dark:bg-slate-900"/><button disabled={busy || builderCode.length !== 4} onClick={verify} className="rounded-lg bg-blue-600 text-white px-4 disabled:opacity-50">Log in</button></div> : created ?
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 p-4 space-y-4"><div><h3 className="font-bold text-lg">{created.name} is ready</h3><p className="text-xs text-slate-600 dark:text-slate-300">Copy the event link and give each volunteer only the code for their role.</p></div><div className="rounded-lg bg-white dark:bg-slate-900 border p-3"><div className="text-xs font-bold uppercase text-slate-500">Event link</div><div className="flex gap-2 mt-1"><input readOnly value={eventUrl} className="min-w-0 flex-1 bg-transparent text-sm" onFocus={(e)=>e.target.select()}/><button onClick={()=>copy(eventUrl)} className="rounded bg-slate-900 text-white px-3 py-1 text-xs">Copy</button></div></div><div className="grid sm:grid-cols-2 gap-2">{ROLE_META.map(([role,label])=><div key={role} className="rounded-lg bg-white dark:bg-slate-900 border p-3"><div className="text-xs text-slate-500">{label}</div><div className="flex items-center justify-between"><b className="font-mono text-lg">{codes[role]}</b><button onClick={()=>copy(codes[role])} className="text-xs underline">Copy</button></div></div>)}</div><p className="text-xs"><b>Organizer Admin password:</b> use the password you created to regain Admin access on another device. It is intentionally not displayed here.</p><div className="flex gap-2"><button onClick={()=>copy([`Ref OS: ${created.name}`,eventUrl,...ROLE_META.map(([r,l])=>`${l}: ${codes[r]}`)].join("\n"))} className="flex-1 rounded-lg border px-4 py-2 font-bold">Copy setup sheet</button><button onClick={()=>onSelect(created.id)} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 font-bold">Open event</button></div></div> :
        <div className="space-y-4"><div className="flex gap-1">{STEPS.map((label,i)=><div key={label} className={`flex-1 h-1.5 rounded-full ${i<=step ? "bg-blue-600":"bg-slate-200 dark:bg-slate-600"}`}/>)}</div><div className="text-xs font-bold uppercase tracking-wide text-blue-600">Step {step+1} of {STEPS.length} · {STEPS[step]}</div>
          {step===0 && <div className="space-y-3"><label className="block text-sm">Event name<input value={name} onChange={(e)=>setName(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-1 bg-white dark:bg-slate-900" placeholder="Event name"/></label><div className="grid sm:grid-cols-2 gap-2"><label className="text-sm">Event date<input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-1 bg-white dark:bg-slate-900"/></label><label className="text-sm">Venue / location<input value={venue} onChange={(e)=>setVenue(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-1 bg-white dark:bg-slate-900" placeholder="Optional"/></label></div></div>}
          {step===1 && <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><label className="text-sm">Qualification matches<input type="number" min="0" max="1000" value={quals} onChange={(e)=>setQuals(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-1 bg-white dark:bg-slate-900"/></label><label className="text-sm">Practice matches<input type="number" min="0" max="1000" value={practice} onChange={(e)=>setPractice(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-1 bg-white dark:bg-slate-900"/></label></div><div className="grid grid-cols-2 gap-2"><label className="text-sm">Elimination bracket<select value={bracket} onChange={(e)=>setBracket(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-1 bg-white dark:bg-slate-900"><option value="0">None</option><option value="4">Top 4</option><option value="8">Top 8</option><option value="16">Top 16</option></select></label><label className="text-sm">Finals<select value={finals} onChange={(e)=>setFinals(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-1 bg-white dark:bg-slate-900"><option value="1">Single match</option><option value="3">Best of 3</option></select></label></div></div>}
          {step===2 && <div className="space-y-3"><label className="block text-sm">Accent color<div className="flex gap-2 mt-1"><input type="color" value={accent} onChange={(e)=>setAccent(e.target.value)} className="h-10 w-14 rounded border"/><input value={accent} onChange={(e)=>setAccent(e.target.value)} className="flex-1 rounded-lg border px-3 bg-white dark:bg-slate-900"/></div></label><label className="block text-sm">Event logo <span className="text-xs text-slate-400">PNG, JPG, SVG or WebP, max 250 KB</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e)=>loadLogo(e.target.files?.[0])} className="block w-full mt-1 text-sm"/></label><div className="rounded-xl border p-4 flex items-center gap-3" style={{borderColor:accent}}>{logoData ? <img src={logoData} alt="Event logo preview" className="h-12 w-12 object-contain"/>:<img src="/refos-logo.svg" alt="Ref OS" className="h-12 w-12"/>}<div><b>{name || "Your event"}</b><div className="text-xs text-slate-500">Powered by Ref OS</div></div></div></div>}
          {step===3 && <div className="space-y-3"><label className="block text-sm">Organizer Admin password<input type="password" autoComplete="new-password" value={adminCredential} onChange={(e)=>setAdminCredential(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-1 bg-white dark:bg-slate-900" placeholder="At least 12 characters"/></label><div><div className="text-sm font-semibold mb-2">Volunteer codes</div><div className="grid sm:grid-cols-2 gap-2">{ROLE_META.map(([role,label])=><div key={role} className="rounded-lg border p-3"><div className="text-xs text-slate-500">{label}</div><div className="flex gap-2 mt-1"><input value={codes[role]} onChange={(e)=>setCodes(c=>({...c,[role]:e.target.value.toUpperCase()}))} className="min-w-0 flex-1 font-mono rounded border px-2 py-1 bg-white dark:bg-slate-900"/><button onClick={()=>regenerate(role)} className="text-xs underline">Regenerate</button></div></div>)}</div></div></div>}
          {step===4 && <div className="rounded-xl border p-4 space-y-2 text-sm"><div className="flex items-center gap-3">{logoData ? <img src={logoData} className="h-12 w-12 object-contain" alt=""/>:<img src="/refos-logo.svg" className="h-12 w-12" alt=""/>}<div><div className="font-bold text-lg">{name}</div><div className="text-slate-500">{date || "Date not set"}{venue ? ` · ${venue}`:""}</div></div></div><p><b>Format:</b> {quals} qualification, {practice} practice, {bracket === "0" ? "no elimination bracket" : `top ${bracket} bracket`}, {finals === "3" ? "best of 3 finals":"single match finals"}.</p><p><b>Access:</b> Organizer Admin plus Referee, Judge Advisor, Emcee, and Inspection codes.</p><p className="text-xs text-slate-500">This creates an isolated event. Highlander is a protected legacy event and is not modified by this wizard.</p></div>}
          <div className="flex gap-2">{step>0 && <button onClick={()=>setStep(s=>s-1)} className="rounded-lg border px-4 py-2 font-bold">Back</button>}<button disabled={busy || !canNext} onClick={()=>step<STEPS.length-1 ? setStep(s=>s+1) : create()} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-3 font-bold disabled:opacity-50">{busy ? "Creating…" : step<STEPS.length-1 ? "Continue":"Create event"}</button></div>
        </div>}
      </section>{error && <p role="alert" className="text-red-700 dark:text-red-300 text-sm">{error}</p>}
    </div>
  </div>;
}
