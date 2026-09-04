import React, { useState } from "react";

const Label = ({ children }) => <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{children}</label>;

export default function NameScreen({ onName }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const valid = !!firstName.trim() && !!lastName.trim();
  const submit = () => valid && onName(fullName);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-700 grid place-items-center p-6 font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-1"><img src="/logo.svg" alt="" className="h-6 w-6 object-contain" /><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Highlander Summit Signature</span></div>
        <h1 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Welcome, ref</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Your name is shown on everything you log, so the crew knows exactly who made each call.</p>
        <div className="space-y-3">
          <div>
            <Label>First name</Label>
            <input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Alex"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div>
            <Label>Last name</Label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Rodriguez"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>
        <button onClick={submit} disabled={!valid}
          className={`w-full mt-4 py-2.5 rounded-lg font-semibold text-white ${valid ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Start logging</button>
      </div>
    </div>
  );
}
