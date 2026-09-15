import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, KeyRound, Share2, X } from "lucide-react";
import Label from "./FormLabel.jsx";

export default function ShareModal({ event, role = "ref", adminUnlocked = false, roleCodeConfig, onManageCodes, onClose }) {
  const [copied, setCopied] = useState("");
  const [sessionCodes, setSessionCodes] = useState({});
  const url = window.location.origin;
  const eventId = event?.id;

  useEffect(() => {
    if (!adminUnlocked || !eventId) return;
    try {
      setSessionCodes(JSON.parse(sessionStorage.getItem(`refosRoleCodes:${eventId}`) || "{}"));
    } catch {
      setSessionCodes({});
    }
  }, [adminUnlocked, eventId]);

  const copy = (text, which) => {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(""), 1500);
  };

  const roles = [
    { key: "ref", label: "Referee" },
    { key: "judge", label: "Judge Advisor" },
    { key: "emcee", label: "Emcee" },
  ];
  const roleText = String(role || "").trim().toLowerCase();
  const currentRoleKey = roleText.includes("judge") ? "judge" : roleText.includes("emcee") ? "emcee" : "ref";
  const visibleRoles = adminUnlocked ? roles : roles.filter((item) => item.key === currentRoleKey);

  return (
    <div className="refos-modal-backdrop fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="refos-modal-panel bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Share2 size={18} /> Invite Other Key Volunteers</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>

        <div className="p-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>Everyone works from the same live Highlander Summit log and sees each other's entries within seconds.</p>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div>
              <Label>Send Your Crew the Site</Label>
              <div className="flex gap-2">
                <input readOnly value={url} className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm" />
                <button onClick={() => copy(url, "url")} className="px-3 rounded-lg bg-slate-900 text-white flex items-center gap-1 text-sm">
                  {copied === "url" ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">They open the link, choose their volunteer role, enter the role join code, set their name, and they're in.</p>
          </div>

          {(adminUnlocked || visibleRoles.length > 0) && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                <KeyRound size={16} />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">Volunteer Join Codes</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{adminUnlocked ? "All event role codes" : "Share your role code with another volunteer"}</div>
                </div>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {visibleRoles.map((roleRow) => {
                  const active = !!roleCodeConfig?.codes?.[roleRow.key]?.enabled;
                  const code = active ? (roleCodeConfig?.codes?.[roleRow.key]?.code || sessionCodes[roleRow.key]) : "";
                  return (
                    <div key={roleRow.key} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{roleRow.label}</div>
                        {!active && <div className="text-xs text-slate-400">No active code</div>}
                        {active && !code && <div className="text-xs text-slate-400">Generate a new code once to make it visible here</div>}
                      </div>
                      {code ? (
                        <button
                          onClick={() => copy(code, roleRow.key)}
                          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-black tracking-[0.16em] text-slate-900 dark:text-white flex items-center gap-2"
                          title={`Copy ${roleRow.label} join code`}
                        >
                          {code}
                          {copied === roleRow.key ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      ) : (
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"}`}>
                          {active ? "ACTIVE" : "OFF"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {adminUnlocked && onManageCodes && (
                <button
                  onClick={onManageCodes}
                  className="w-full px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-[#0D0F32] dark:text-indigo-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  Manage Join Codes
                </button>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <span>Share each join code only with volunteers who should have that role.</span>
          </div>
        </div>

        <div className="p-4 pt-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 flex items-center justify-center gap-2"><Check size={16} /> Done</button>
        </div>
      </div>
    </div>
  );
}
