import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Label from "./FormLabel.jsx";

export default function IdentityModal({ me, onSave, onClose }) {
  const existingParts = String(me?.fullName || "").trim().split(/\s+/).filter(Boolean);
  const [nickname, setNickname] = useState(me?.nickname || "");
  const [phone, setPhone] = useState(me?.phone || "");
  const [firstName, setFirstName] = useState(existingParts[0] || "");
  const [lastName, setLastName] = useState(existingParts.slice(1).join(" ") || "");
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const valid = !!nickname.trim() && !!firstName.trim() && !!lastName.trim();
  const submit = () => valid && onSave({ nickname: nickname.trim(), fullName, phone: phone.trim() });
  return createPortal(
    <div className="fixed inset-0 z-[150] bg-black/40 flex items-stretch sm:items-center justify-center">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white dark:bg-slate-800 sm:h-auto sm:max-h-[90dvh] sm:max-w-sm sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-slate-700">
          <h2 className="min-w-0 flex-1 truncate font-bold text-slate-900 dark:text-slate-100">Edit name</h2>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close edit name"><X size={22} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Your nickname appears throughout Ref OS.</p>
          <div>
            <Label>Nickname</Label>
            <input autoFocus value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Name shown in Ref OS"
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
        <div className="shrink-0 border-t border-slate-200 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-700"><button onClick={submit} disabled={!valid} className={`w-full py-2.5 rounded-lg font-semibold text-white ${valid ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Save</button></div>
      </div>
    </div>,
    document.body
  );
}

/* ============================ SHARE / INVITE MODAL ============================ */
