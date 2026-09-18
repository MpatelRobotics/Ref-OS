import React, { useEffect, useRef, useState } from "react";
import { Contact, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";

export default function EventContactDirectory({ contacts, canEdit, onSave, onClose }) {
  const blank = () => ({ role: "", name: "", phone: "", email: "", location: "", notes: "" });
  const [draft, setDraft] = useState(() => (contacts || []).map((c) => ({ ...blank(), ...c })));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!editing) setDraft((contacts || []).map((c) => ({ ...blank(), ...c })));
  }, [contacts, editing]);

  const [dragIndex, setDragIndex] = useState(null);
  const dragIndexRef = useRef(null);
  const update = (i, key, value) => setDraft((cur) => cur.map((c, n) => n === i ? { ...c, [key]: value } : c));
  const moveContact = (from, to) => {
    if (from == null || to == null || from === to) return;
    setDraft((cur) => {
      if (from < 0 || to < 0 || from >= cur.length || to >= cur.length) return cur;
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    dragIndexRef.current = to;
    setDragIndex(to);
  };
  const beginPointerDrag = (index, e) => {
    dragIndexRef.current = index;
    setDragIndex(index);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const pointerDragMove = (e) => {
    if (dragIndexRef.current == null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-contact-index]");
    if (!el) return;
    const to = Number(el.dataset.contactIndex);
    if (Number.isInteger(to) && to !== dragIndexRef.current) moveContact(dragIndexRef.current, to);
  };
  const endPointerDrag = (e) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
    dragIndexRef.current = null;
    setDragIndex(null);
  };
  const save = async () => {
    const cleaned = draft
      .map((c) => Object.fromEntries(Object.entries(c).map(([k,v]) => [k, String(v || "").trim()])))
      .filter((c) => c.role || c.name || c.phone || c.email || c.location || c.notes);
    setBusy(true);
    await onSave(cleaned);
    setBusy(false);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2">
        <Contact size={20}/>
        <div><h2 className="font-bold">Event Contact Directory</h2><p className="text-xs text-slate-400">Who to contact during the event</p></div>
        <button onClick={onClose} className="ml-auto"><X size={22}/></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="w-full rounded-xl bg-[#0D0F32] text-white px-4 py-3 font-semibold flex items-center justify-center gap-2">
              <Pencil size={17}/> Edit directory
            </button>
          )}

          {!editing ? (
            (contacts || []).length ? (
              <>
                {(contacts || []).map((c, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="text-xs uppercase tracking-wide font-bold text-[#D7212B]">{c.role || "Event contact"}</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{c.name || "Name not set"}</div>
                <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {c.nickname && <div><b>Nickname:</b> {c.nickname}</div>}
                  {c.location && <div><b>Location:</b> {c.location}</div>}
                  {c.phone && <div><b>Phone:</b> <a className="underline" href={`tel:${c.phone}`}>{c.phone}</a></div>}
                  {c.email && <div><b>Email:</b> <a className="underline" href={`mailto:${c.email}`}>{c.email}</a></div>}
                  {c.notes && <div><b>Notes:</b> {c.notes}</div>}
                </div>
              </div>
                ))}
              </>
            ) : (
              <div className="bg-white dark:bg-slate-800 border rounded-xl p-6 text-center text-slate-500">
                No event contacts have been added yet.
                {canEdit && <div className="text-xs mt-1">Use Edit directory to add event leadership and support contacts.</div>}
              </div>
            )
          ) : (
            <>
              {draft.length > 1 && (
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <GripVertical size={17} className="shrink-0"/> Drag the handle to arrange contacts in the order everyone will see.
                </div>
              )}
              {draft.map((c, i) => (
                <div key={i} data-contact-index={i}
                  className={`bg-white dark:bg-slate-800 border rounded-xl p-3 space-y-2 transition-all ${dragIndex === i ? "border-[#D7212B] shadow-lg scale-[1.01]" : "border-slate-200 dark:border-slate-700"}`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => { dragIndexRef.current = i; setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => { e.preventDefault(); const from = dragIndexRef.current; if (from != null && from !== i) moveContact(from, i); }}
                      onDragEnd={() => { dragIndexRef.current = null; setDragIndex(null); }}
                      onPointerDown={(e) => beginPointerDrag(i, e)}
                      onPointerMove={pointerDragMove}
                      onPointerUp={endPointerDrag}
                      onPointerCancel={endPointerDrag}
                      className="touch-none cursor-grab active:cursor-grabbing p-2 -ml-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                      aria-label={`Drag contact ${i + 1} to reorder`}
                      title="Drag to reorder">
                      <GripVertical size={20}/>
                    </button>
                    <div className="font-semibold flex-1">Contact {i + 1}</div>
                    <button onClick={() => setDraft((cur) => cur.filter((_, n) => n !== i))} className="p-2 text-red-600"><Trash2 size={17}/></button>
                  </div>
                  <input value={c.role} onChange={(e) => update(i,"role",e.target.value)} placeholder="Role, e.g. Head Referee" className="w-full px-3 py-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900"/>
                  <input value={c.name} onChange={(e) => update(i,"name",e.target.value)} placeholder="Name" className="w-full px-3 py-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900"/>
                  {c.nickname !== undefined && <input value={c.nickname} onChange={(e) => update(i,"nickname",e.target.value)} placeholder="Nickname" className="w-full px-3 py-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900"/>}
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input value={c.phone} onChange={(e) => update(i,"phone",e.target.value)} placeholder="Phone" className="w-full px-3 py-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900"/>
                    <input value={c.email} onChange={(e) => update(i,"email",e.target.value)} placeholder="Email" className="w-full px-3 py-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900"/>
                  </div>
                  <input value={c.location} onChange={(e) => update(i,"location",e.target.value)} placeholder="Event location, e.g. Field 1 / Scoring Table" className="w-full px-3 py-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900"/>
                  <textarea value={c.notes} onChange={(e) => update(i,"notes",e.target.value)} placeholder="Notes or best reason to contact" rows={2} className="w-full px-3 py-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900"/>
                </div>
              ))}
              <button onClick={() => setDraft((cur) => [...cur, blank()])} className="w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 px-4 py-3 font-semibold flex items-center justify-center gap-2"><Plus size={17}/> Add contact</button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setDraft((contacts || []).map((c) => ({ ...blank(), ...c }))); setEditing(false); }} className="rounded-xl border px-4 py-3 font-semibold">Cancel</button>
                <button disabled={busy} onClick={save} className="rounded-xl bg-[#D7212B] text-white px-4 py-3 font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save directory"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
