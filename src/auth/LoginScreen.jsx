import React, { useEffect, useState } from "react";
import * as api from "../api";
import { APP_VERSION } from "../appVersion";

export default function LoginScreen({ eventId, eventName, onUnlock, onChooseEvent }) {
  const highlander = eventId === "11111111-1111-4111-8111-111111111111";
  const [mode, setMode] = useState("code");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);

  const finishServerLogin = async (credential) => {
    setCheckingCode(true);
    setErr("");
    try {
      const cleanCredential = String(credential || "").trim().toUpperCase();
      if (highlander && (cleanCredential === "2B23" || cleanCredential === "2C23")) {
        const result = await api.claimActiveSecondaryEvent(cleanCredential);
        onUnlock(result.role, result.isAdmin, result.serverRole, cleanCredential, result.eventId);
        return;
      }
      const result = await api.claimEventAccess(eventId, credential);
      onUnlock(result.role, result.isAdmin, result.serverRole, credential);
    } catch (e) {
      setCode("");
      setErr(e?.message?.includes("Invalid event credential") ? "Incorrect event credential." : (e.message || "Could not sign in."));
    } finally {
      setCheckingCode(false);
    }
  };

  const submit = () => {
    if (!pw) return;
    finishServerLogin(pw);
  };

  const enterCodeKey = (value) => {
    if (checkingCode) return;
    const key = String(value || "").toUpperCase();
    setErr("");
    setCode((cur) => {
      if (cur.length >= 4) return cur;
      const position = cur.length;
      const expectsLetter = position === 1;
      if (expectsLetter && !["A","B","C","D"].includes(key)) return cur;
      if (!expectsLetter && !/^\d$/.test(key)) return cur;
      return cur + key;
    });
  };



  const submitCode = async (candidate = code) => {
    const clean = String(candidate || "").toUpperCase().replace(/[^0-9A-D]/g, "").slice(0, 4);
    if (!/^\d[A-D]\d\d$/.test(clean)) {
      setErr("Code format must be number, letter, number, number.");
      return;
    }
    await finishServerLogin(clean);
  };

  useEffect(() => {
    if (mode === "code" && code.length === 4) submitCode(code);
  }, [code, mode]);

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-[#11172F] grid place-items-center p-6 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-7 sm:px-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={highlander ? "/logo.svg" : "/refos-logo.svg"} alt={highlander ? "Highlander Summit" : "Ref OS"} className={highlander ? "h-40 sm:h-48 w-40 sm:w-48 object-contain mb-2" : "h-24 sm:h-28 w-24 sm:w-28 object-contain mb-4"} />
          <span className="font-bold text-xl text-[#11172F]">{eventName || (highlander ? "Highlander Summit — Violation Log" : "Ref OS Event")}</span>
          {highlander && <span className="mt-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700">Highlander Summit Release</span>}
        </div>

        {mode === "code" ? (
          <>
            <p className="text-sm text-slate-600 text-center">Enter the 4 character access code provided by event leadership.</p>
            <div className="flex justify-center gap-3 my-5">
              {[0,1,2,3].map((i) => (
                <div key={i} className={`w-14 h-14 rounded-xl border grid place-items-center text-2xl font-bold ${code.length > i ? (highlander ? "bg-[#11172F] text-white border-[#11172F]" : "bg-slate-900 text-white border-slate-900") : "bg-slate-50 border-slate-300 text-slate-400"}`}>
                  {code.length > i ? code[i] : (i === 1 ? "A" : "0")}
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-500 text-center mb-3">Format: number · A/B/C/D · number · number</div>
            <div className="grid grid-cols-4 gap-3">
              {["1","2","3","A","4","5","6","B","7","8","9","C","Delete","0","Enter","D"].map((key) => {
                const expectsLetter = code.length === 1;
                const isLetter = ["A","B","C","D"].includes(key);
                const isDigit = /^\d$/.test(key);
                const disabled = checkingCode
                  || (isLetter && !expectsLetter)
                  || (isDigit && expectsLetter)
                  || (key === "Delete" && !code.length)
                  || (key === "Enter" && code.length !== 4);
                const action = () => {
                  if (key === "Delete") { setCode((cur) => cur.slice(0,-1)); setErr(""); return; }
                  if (key === "Enter") { submitCode(); return; }
                  enterCodeKey(key);
                };
                return (
                  <button key={key} disabled={disabled} onClick={action}
                    className={`h-14 rounded-xl border font-bold active:scale-[0.98] disabled:opacity-30 ${
                      key === "Enter" ? (highlander ? "bg-[#D7212B] border-[#D7212B] text-white" : "bg-blue-600 border-blue-600 text-white")
                      : isLetter ? (highlander ? "bg-indigo-50 border-indigo-200 text-[#303A8C] text-xl" : "bg-blue-50 border-blue-200 text-blue-700 text-xl")
                      : key === "Delete" ? "bg-slate-100 border-slate-200 text-slate-700 text-sm"
                      : "bg-white border-slate-300 text-[#11172F] text-xl"
                    }`}>
                    {key === "Enter" && checkingCode ? "…" : key}
                  </button>
                );
              })}
            </div>
            {err && <p className="text-sm text-red-400 mt-3 text-center">{err}</p>}
            <button onClick={() => { setMode("password"); setCode(""); setErr(""); }}
              className="w-full mt-4 py-3 rounded-lg font-semibold border border-slate-300 bg-white text-[#11172F] hover:bg-slate-50">
              Admin login
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-4 text-center">Enter the admin password.</p>
            <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="Admin password" autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className={`w-full px-3 py-3 rounded-lg bg-white border border-slate-300 text-[#11172F] placeholder-slate-400 focus:outline-none focus:ring-2 ${highlander ? "focus:ring-[#D7212B]" : "focus:ring-blue-500"}`} />
            {err && <p className="text-sm text-red-400 mt-2 text-center">{err}</p>}
            <button onClick={submit} disabled={!pw}
              className={`w-full mt-3 py-3 rounded-lg font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400 ${highlander ? "bg-[#D7212B] hover:bg-[#B42024]" : "bg-blue-600 hover:bg-blue-700"}`}>Enter</button>
            <button onClick={() => { setMode("code"); setPw(""); setErr(""); }}
              className="w-full mt-3 py-3 rounded-lg font-semibold border border-slate-300 bg-white text-[#11172F] hover:bg-slate-50">
              Back
            </button>
          </>
        )}
        <button onClick={onChooseEvent} className="w-full mt-5 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-[#11172F]">Choose or configure an event</button>
        <div className="flex flex-col items-center gap-2 mt-8">
          <img src={highlander ? "/logo.svg" : "/refos-logo.svg"} alt={highlander ? "Highlander Summit" : "Ref OS"} className="h-12 w-12 object-contain" />
          <p className="text-center text-xs text-slate-500">
            Made by Maharshi Patel ·{" "}
            <a href="https://www.instagram.com/mpatel_ref/" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-[#11172F] underline">@mpatel_ref</a>{" · "}v{APP_VERSION}{highlander ? " · Highlander Summit Release" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- NAME (ref identity) ---------------------- */
