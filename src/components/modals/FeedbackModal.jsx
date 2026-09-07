import React, { useMemo, useState } from "react";
import { Bug, CheckCircle2, Lightbulb, MessageSquare, Send, X } from "lucide-react";
import { APP_VERSION } from "../../appVersion";

const TYPES = [
  { key: "bug", label: "Bug", icon: Bug },
  { key: "suggestion", label: "Suggestion", icon: Lightbulb },
  { key: "general", label: "General Feedback", icon: MessageSquare },
];

export default function FeedbackModal({ meName, myRole, onSubmit, onClose }) {
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const device = useMemo(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    return {
      appVersion: APP_VERSION,
      browser: navigator.userAgent,
      platform: navigator.userAgentData?.platform || navigator.platform || "Unknown",
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      displayMode: standalone ? "Installed PWA" : "Browser",
      online: navigator.onLine,
      language: navigator.language || "",
      submittedAt: new Date().toISOString(),
    };
  }, []);

  const submit = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        type,
        message: message.trim(),
        submittedBy: meName || "",
        role: myRole || "",
        ...device,
      });
      setSent(true);
    } catch (e) {
      alert("Could not send feedback: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="refos-modal-backdrop fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center">
      <div className="refos-modal-panel bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Send Feedback</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ref OS Private Beta</p>
          </div>
          <button onClick={onClose} className="text-slate-400 p-1"><X size={22} /></button>
        </div>

        {sent ? (
          <div className="p-7 text-center">
            <CheckCircle2 size={42} className="mx-auto text-emerald-500 mb-3" />
            <div className="font-bold text-slate-900 dark:text-slate-100 text-lg">Feedback Sent</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Thanks. Your feedback was saved with the Ref OS version and device details.</p>
            <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold">Done</button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Feedback Type</div>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setType(key)}
                    className={`rounded-xl border px-2 py-3 text-xs font-semibold flex flex-col items-center gap-1.5 ${
                      type === key
                        ? "border-[#D7212B] bg-red-50 text-[#D7212B] dark:bg-red-950/30"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Tell Us What Happened</div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder={type === "bug" ? "What went wrong? What were you trying to do?" : type === "suggestion" ? "What would you like Ref OS to do?" : "Share your feedback…"}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
              />
              <div className="text-right text-[11px] text-slate-400">{message.length}/2000</div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400">
              Ref OS automatically includes app version, browser, platform, screen size, connection state, and whether you are using the installed app or browser. It does not attach photos or other personal files.
            </div>

            <button
              onClick={submit}
              disabled={busy || !message.trim()}
              className="w-full py-2.5 rounded-lg bg-[#D7212B] text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {busy ? "Sending…" : "Send Feedback"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
