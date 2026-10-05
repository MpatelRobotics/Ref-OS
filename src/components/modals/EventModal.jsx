import EventProgramChoice from "../EventProgramChoice.jsx";
import React, { useState } from "react";
import { CalendarDays, ListOrdered, X } from "lucide-react";
import Label from "./FormLabel.jsx";

const elimCounts = (bracket) => {
  switch (Number(bracket)) {
    case 16: return { r16: 8, qf: 4, sf: 2 };
    case 8: return { qf: 4, sf: 2 };
    case 4: return { sf: 2 };
    default: return {};
  }
};

export default function EventModal({ event, onSave, onClose, competitionProgram="v5" }) {
  const [name, setName] = useState(event?.name || "");
  const [quals, setQuals] = useState(event?.quals ? String(event.quals) : "");
  const [practice, setPractice] = useState(event?.practice ? String(event.practice) : "");
  const [bracket, setBracket] = useState(event?.bracket ? String(event.bracket) : "16");
  const [finalsBestOf, setFinalsBestOf] = useState(event?.finalsBestOf ? String(event.finalsBestOf) : "3");
  const [program, setProgram] = useState(competitionProgram);
  const creating = !event;
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><CalendarDays size={18} /> {creating ? "New event" : "Event setup"}</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-3">
          <EventProgramChoice value={program} onChange={setProgram} />
          <div><Label>Event name</Label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Highlander Summit Signature"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" /></div>
          <div><Label>Number of qualification matches</Label>
            <div className="relative">
              <ListOrdered size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={quals} onChange={(e) => setQuals(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="e.g. 60"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Logging will offer Q1–Q{quals || "n"} as a dropdown.</p>
          </div>
          <div><Label>Practice matches (optional)</Label>
            <input value={practice} onChange={(e) => setPractice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="leave blank if none"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" /></div>
          {program === "iq" ? <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 p-3 text-sm">IQ uses ranked partner finals, one match per partnership. Choose the number of finals matches and review pairings in the Finals tab after importing official qualification ranks. There is no elimination bracket or best-of-three series.</div> : <div className="grid grid-cols-2 gap-2">
            <div><Label>Elimination bracket</Label>
              <select value={bracket} onChange={(e) => setBracket(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300">
                <option value="0">None</option><option value="4">Top 4</option><option value="8">Top 8</option><option value="16">Top 16</option>
              </select>
            </div>
            <div><Label>Finals</Label>
              <select value={finalsBestOf} onChange={(e) => setFinalsBestOf(e.target.value)} disabled={bracket === "0"} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 disabled:bg-slate-100 dark:bg-slate-700 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300">
                <option value="1">Single</option><option value="3">Best of 3</option>
              </select>
            </div>
          </div>
          }
          {program !== "iq" && bracket !== "0" && (
            <p className="text-[11px] text-slate-400">Generates {(() => { const ec = elimCounts(bracket); const parts = []; if (ec.r16) parts.push("R16-1…8"); if (ec.qf) parts.push("QF1…4"); if (ec.sf) parts.push("SF1…2"); parts.push(finalsBestOf === "3" ? "F1…3" : "F1"); return parts.join(", "); })()} as dropdowns.</p>
          )}
        </div>
        <div className="p-4 pt-0 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={() => onSave({ name, quals, practice, bracket:program==="iq"?"0":bracket, finalsBestOf:program==="iq"?"1":finalsBestOf, competitionProgram:program })} className="flex-1 py-2.5 rounded-lg font-semibold text-white bg-slate-900 hover:bg-slate-800">{creating ? "Create event" : "Save event"}</button>
        </div>
      </div>
    </div>
  );
}


/* ============================ MATCHES ============================ */
