import React, { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";
import jsQR from "jsqr";
import * as api from "../api";
import { APP_VERSION } from "../appVersion";

export default function LoginScreen({ eventId, onUnlock }) {
  const [mode, setMode] = useState("password");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerVideoRef = useRef(null);
  const scannerStreamRef = useRef(null);

  const finishServerLogin = async (credential) => {
    setCheckingCode(true);
    setErr("");
    try {
      const result = await api.claimEventAccess(eventId, credential);
      onUnlock(result.role, result.isAdmin, result.serverRole);
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

  const stopLoginScanner = () => { scannerStreamRef.current?.getTracks?.().forEach((t)=>t.stop()); scannerStreamRef.current=null; setScanning(false); };
  const handleLoginQrText = (raw) => {
    let scannedCode="";
    try { const payload=JSON.parse(raw); if(payload?.type==="refos-login"&&payload?.eventId===eventId) scannedCode=payload.code||""; } catch { scannedCode=String(raw||""); }
    scannedCode=String(scannedCode).toUpperCase().trim();
    if(!/^\d[A-D]\d\d$/.test(scannedCode)){setErr("That QR code is not a valid Ref OS event login.");return false;}
    stopLoginScanner(); setCode(scannedCode); setMode("code"); return true;
  };
  const startLoginScanner = async () => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Camera access is not supported by this browser. Use the event code instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      scannerStreamRef.current = stream;
      setScanning(true);
    } catch {
      stopLoginScanner();
      setErr("Camera access was not available. Allow camera permission and try again.");
    }
  };

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let frameId = 0;

    const startPreviewAndScan = async () => {
      const video = scannerVideoRef.current;
      const stream = scannerStreamRef.current;
      if (!video || !stream) return;

      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");

      try {
        await video.play();
      } catch {
        if (!cancelled) setErr("The camera opened, but Safari could not start the preview. Close the scanner and try again.");
        return;
      }

      let detector = null;
      if ("BarcodeDetector" in globalThis) {
        try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch {}
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let lastScan = 0;

      const scan = async (now = 0) => {
        if (cancelled || !scannerStreamRef.current) return;
        if (now - lastScan < 140) {
          frameId = requestAnimationFrame(scan);
          return;
        }
        lastScan = now;

        try {
          if (detector) {
            const found = await detector.detect(video);
            if (found?.[0]?.rawValue && handleLoginQrText(found[0].rawValue)) return;
          } else if (video.videoWidth && video.videoHeight) {
            const maxWidth = 900;
            const scale = Math.min(1, maxWidth / video.videoWidth);
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
            if (result?.data && handleLoginQrText(result.data)) return;
          }
        } catch {}

        frameId = requestAnimationFrame(scan);
      };

      frameId = requestAnimationFrame(scan);
    };

    startPreviewAndScan();

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      const video = scannerVideoRef.current;
      if (video) video.srcObject = null;
    };
  }, [scanning]);

  useEffect(() => () => {
    scannerStreamRef.current?.getTracks?.().forEach((track) => track.stop());
  }, []);


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
    <div className="min-h-screen bg-[#0D0F32] text-white grid place-items-center p-6 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/logo.svg" alt="Highlander Summit" className="h-52 sm:h-64 w-52 sm:w-64 object-contain mb-3" />
          <span className="font-bold text-lg">Highlander Summit — Violation Log</span>
        </div>

        {mode === "password" ? (
          <>
            <p className="text-sm text-slate-300 mb-4 text-center">Enter the referee, judge advisor, emcee, or admin password to open the log.</p>
            <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="Password" autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full px-3 py-3 rounded-lg bg-[#1b1f4d] border border-[#2c3168] text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D7212B]" />
            {err && <p className="text-sm text-red-400 mt-2 text-center">{err}</p>}
            <button onClick={submit} disabled={!pw}
              className="w-full mt-3 py-3 rounded-lg font-semibold bg-[#D7212B] text-white hover:bg-[#B42024] disabled:bg-[#2c3168] disabled:text-slate-400">Enter</button>
            <button onClick={() => { setMode("code"); setErr(""); setPw(""); }}
              className="w-full mt-3 py-3 rounded-lg font-semibold border border-[#4a4f82] bg-[#171b45] hover:bg-[#202657]">
              Use event access code
            </button>
            <button onClick={startLoginScanner} className="w-full mt-3 py-3 rounded-lg font-semibold border border-[#4a4f82] bg-[#171b45] hover:bg-[#202657] flex items-center justify-center gap-2"><ScanLine size={18}/> Scan QR code</button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-300 text-center">Enter the 4 character access code provided by event leadership.</p>
            <div className="flex justify-center gap-3 my-5">
              {[0,1,2,3].map((i) => (
                <div key={i} className={`w-14 h-14 rounded-xl border grid place-items-center text-2xl font-bold ${code.length > i ? "bg-white text-[#0D0F32] border-white" : "bg-[#171b45] border-[#4a4f82] text-slate-500"}`}>
                  {code.length > i ? code[i] : (i === 1 ? "A" : "0")}
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-400 text-center mb-3">Format: number · A/B/C/D · number · number</div>
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
                      key === "Enter" ? "bg-[#D7212B] border-[#D7212B] text-white"
                      : isLetter ? "bg-[#252b63] border-[#4a51a0] text-xl"
                      : key === "Delete" ? "bg-[#171b45] border-[#353a73] text-sm"
                      : "bg-[#1b1f4d] border-[#353a73] text-xl"
                    }`}>
                    {key === "Enter" && checkingCode ? "…" : key}
                  </button>
                );
              })}
            </div>
            {err && <p className="text-sm text-red-400 mt-3 text-center">{err}</p>}
            <button onClick={() => { setMode("password"); setCode(""); setErr(""); }}
              className="w-full mt-4 py-3 rounded-lg font-semibold border border-[#4a4f82] bg-[#171b45] hover:bg-[#202657]">
              Use password instead
            </button>
          </>
        )}

        {scanning && <div className="fixed inset-0 z-[100] bg-black flex flex-col"><div className="p-4 flex items-center"><div className="font-bold flex items-center gap-2"><ScanLine size={20}/> Scan Ref OS login QR</div><button onClick={stopLoginScanner} className="ml-auto p-2"><X size={24}/></button></div><div className="flex-1 relative overflow-hidden"><video ref={scannerVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"/><div className="absolute inset-0 grid place-items-center pointer-events-none"><div className="w-64 h-64 border-4 border-white rounded-3xl"/></div></div><div className="p-5 text-center text-sm text-slate-300">Point the camera at a Ref OS volunteer login QR code.</div></div>}
        <div className="flex flex-col items-center gap-2 mt-8">
          <img src="/logo.svg" alt="Highlander Summit" className="h-12 w-12 object-contain" />
          <p className="text-center text-xs text-slate-400">
            Made by Maharshi Patel ·{" "}
            <a href="https://www.instagram.com/mpatel_ref/" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white underline">@mpatel_ref</a>{" · "}v{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- NAME (ref identity) ---------------------- */