import React, { useState } from "react";

const input = "w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-100";
const button = "min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 px-3 font-semibold disabled:opacity-50";
const empty = { channels: [], radios: [] };
export default function RadioManagement({ data = empty, onSave, volunteers = [] }) {
  const [crew, setCrew] = useState("");
  const [channel, setChannel] = useState("");
  const [number, setNumber] = useState("");
  const [holders, setHolders] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const channels = data?.channels || [];
  const radios = data?.radios || [];
  async function save(update, success, after = () => {}) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await onSave(update); after(); setMessage(success); }
    catch (e) { setError(`Could not save. Check your connection and try again. ${e.message || ""}`); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <p className="text-sm text-slate-600 dark:text-slate-300">Optional: use this only if your event has radios. Nothing here is required for event setup. Channels and checkouts are shared across this event's divisions and league sessions.</p>
    {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
    <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
    <section aria-label="Radio channel directory" className="space-y-3">
      <h3 className="font-bold">Radio channel directory</h3>
      <p className="text-sm">List the channel each crew should use.</p>
      <form className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end" onSubmit={e => {
        e.preventDefault(); if (!crew.trim() || !channel.trim()) return;
        save(current => {
          const rows = current.channels || [];
          if (rows.some(r => r.crew.toLowerCase() === crew.trim().toLowerCase())) throw new Error("That crew already has a channel. Remove it before assigning a different channel.");
          return { ...current, channels: [...rows, { crew: crew.trim(), channel: channel.trim() }] };
        }, "Channel saved.", () => { setCrew(""); setChannel(""); });
      }}>
        <label className="space-y-1"><span className="text-sm">Crew</span><input required maxLength={80} className={input} value={crew} onChange={e => setCrew(e.target.value)} placeholder="e.g. Field crew"/></label>
        <label className="space-y-1"><span className="text-sm">Channel</span><input required maxLength={80} className={input} value={channel} onChange={e => setChannel(e.target.value)} placeholder="e.g. Channel 2"/></label>
        <button disabled={busy} className={button}>Add channel</button>
      </form>
      {!channels.length && <p className="text-sm text-slate-500 dark:text-slate-400">No radio channels added.</p>}
      {channels.map(row => <div key={row.crew} className="flex items-center gap-3 border rounded-lg p-3"><div className="flex-1 min-w-0 break-words"><b>{row.crew}</b><p>{row.channel}</p></div><button className={button} disabled={busy} aria-label={`Remove channel for ${row.crew}`} onClick={() => save(cur => ({ ...cur, channels: (cur.channels || []).filter(r => r.crew !== row.crew) }), "Channel removed.")}>Remove</button></div>)}
    </section>
    <section aria-label="Radio checkout" className="space-y-3">
      <h3 className="font-bold">Radio checkout</h3>
      <p className="text-sm">Add numbered radios, record who takes one, and mark it returned.</p>
      <form className="flex flex-wrap gap-3 items-end" onSubmit={e => {
        e.preventDefault(); if (!number.trim()) return;
        save(cur => {
          const rows = cur.radios || [];
          if (rows.some(r => r.number.toLowerCase() === number.trim().toLowerCase())) throw new Error("That radio is already listed.");
          return { ...cur, radios: [...rows, { number: number.trim(), holder: "" }] };
        }, "Radio added.", () => setNumber(""));
      }}><label className="flex-1 space-y-1"><span className="text-sm">Radio number or label</span><input required maxLength={40} className={input} value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. Radio 01"/></label><button className={button} disabled={busy}>Add radio</button></form>
      <datalist id="radio-volunteers">{[...new Set(volunteers.map(v => v.name).filter(Boolean))].map(name => <option key={name} value={name}/>)}</datalist>
      {!radios.length && <p className="text-sm text-slate-500 dark:text-slate-400">No radios added. You can leave this empty.</p>}
      {radios.map(row => <div key={row.number} className="border rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap justify-between gap-2"><b>{row.number}</b><span className="text-sm">{row.holder ? `Checked out to ${row.holder}` : "Available"}</span></div>
        {row.holder ? <><p className="text-sm text-slate-500 dark:text-slate-400">Checked out {new Date(row.checkedOutAt).toLocaleString()}</p><button className={button} disabled={busy} onClick={() => save(cur => ({ ...cur, radios: (cur.radios || []).map(r => r.number === row.number ? { ...r, holder: "", checkedOutAt: null } : r) }), "Radio returned.")}>Mark returned</button></> : <form className="flex flex-wrap gap-3 items-end" onSubmit={e => {
          e.preventDefault(); const holder = (holders[row.number] || "").trim(); if (!holder) return;
          save(cur => {
            const current = (cur.radios || []).find(r => r.number === row.number);
            if (!current || current.holder) throw new Error("This radio is no longer available. Reopen Radios to refresh the list.");
            return { ...cur, radios: cur.radios.map(r => r.number === row.number ? { ...r, holder, checkedOutAt: Date.now() } : r) };
          }, "Radio checked out.", () => setHolders(cur => ({ ...cur, [row.number]: "" })));
        }}><label className="flex-1 space-y-1"><span className="text-sm">Borrower for {row.number}</span><input required maxLength={100} list="radio-volunteers" className={input} value={holders[row.number] || ""} onChange={e => setHolders(cur => ({ ...cur, [row.number]: e.target.value }))} placeholder="Choose or type a name"/></label><button className={button} disabled={busy}>Check out</button><button type="button" className={button} disabled={busy} onClick={() => save(cur => {
          const current = (cur.radios || []).find(r => r.number === row.number);
          if (current?.holder) throw new Error("Return this radio before removing it.");
          return { ...cur, radios: (cur.radios || []).filter(r => r.number !== row.number) };
        }, "Radio removed.")}>Remove radio</button></form>}
      </div>)}
      {busy && <p className="text-sm">Saving…</p>}
    </section>
  </div>;
}
