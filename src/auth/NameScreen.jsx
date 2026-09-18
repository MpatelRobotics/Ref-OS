import React, { useState } from "react";

const Label = ({ children }) => <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{children}</label>;

export default function NameScreen({ onIdentity }) {
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const valid = !!nickname.trim() && !!firstName.trim() && !!lastName.trim();
  const submit = () => valid && onIdentity({ nickname: nickname.trim(), fullName, phone: phone.trim() });
  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-slate-100 dark:bg-slate-700 grid place-items-start sm:place-items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-1"><img src="/logo.svg" alt="" className="h-6 w-6 object-contain" /><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Highlander Summit Signature</span></div>
        <h1 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Set up your profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Your nickname is shown inside Ref OS.</p>
        <div className="space-y-3">
          <div>
            <Label>Nickname</Label>
            <input autoFocus value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Maharshi"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div>
            <Label>First name</Label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Required for exports"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div>
            <Label>Last name</Label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Required for exports"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
            First and last name are required so official violation and judging export forms identify who submitted the entry. Your full name also appears in the shared Event Contact Directory.
          </div>
          <div>
            <Label>Phone number (optional)</Label>
            <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Added to the Event Contact Directory"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your full name, nickname, and role appear in the Event Contact Directory. If provided, your phone number appears there too.</p>
          </div>
        </div>
        <button onClick={submit} disabled={!valid}
          className={`w-full mt-4 py-2.5 rounded-lg font-semibold text-white ${valid ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Start logging</button>
      </div>
    </div>
  );
}
