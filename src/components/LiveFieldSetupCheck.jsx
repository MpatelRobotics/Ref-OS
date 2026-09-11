import React, { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RefreshCw, X } from "lucide-react";

// Experimental Admin-only alignment assistant.
// It intentionally uses the official starting-field reference as a visual overlay rather
// than claiming computer-vision certainty. This makes it useful for live setup testing
// without presenting an approximate detector as an official field inspection result.
export default function LiveFieldSetupCheck({ onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [opacity, setOpacity] = useState(48);
  const [mirrored, setMirrored] = useState(false);
  const [ready, setReady] = useState(false);

  const startCamera = async () => {
    setError("");
    setReady(false);
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch (e) {
      setError(e?.message || "Camera access failed.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => streamRef.current?.getTracks?.().forEach((t) => t.stop());
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white">
      <div className="shrink-0 px-3 py-3 bg-[#0D0F32] flex items-center gap-2 border-b border-white/10">
        <Camera size={19} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">Live Field Setup Check</div>
          <div className="text-[11px] text-slate-300">ADMIN TEST • Override starting configuration</div>
        </div>
        <button onClick={onClose} className="p-2" aria-label="Close"><X size={22}/></button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted className={`absolute inset-0 w-full h-full object-contain ${mirrored ? "scale-x-[-1]" : ""}`} />
        {ready && (
          <img
            src="/field-setup/override-starting-field.png"
            alt="Official Override starting field reference overlay"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${mirrored ? "scale-x-[-1]" : ""}`}
            style={{ opacity: opacity / 100 }}
          />
        )}
        <div className="absolute left-3 top-3 rounded-md bg-black/75 px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} /> LIVE CAMERA
        </div>
        <div className="absolute right-3 top-3 rounded-md bg-black/75 px-2.5 py-1.5 text-xs">Align the field perimeter with the reference</div>
        {error && <div className="absolute inset-x-3 bottom-3 rounded-md bg-red-950/95 border border-red-500 p-3 text-sm">{error}</div>}
      </div>

      <div className="shrink-0 bg-[#0D0F32] border-t border-white/10 p-3 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold w-20">Overlay</span>
          <input className="flex-1 accent-red-600" type="range" min="10" max="85" value={opacity} onChange={(e)=>setOpacity(Number(e.target.value))}/>
          <span className="text-xs tabular-nums w-9 text-right">{opacity}%</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setMirrored((v)=>!v)} className="rounded-md border border-white/20 py-2 text-sm font-semibold">Flip reference</button>
          <button onClick={startCamera} className="rounded-md border border-white/20 py-2 text-sm font-semibold flex items-center justify-center gap-2"><RefreshCw size={15}/> Restart camera</button>
        </div>
        <div className="rounded-md border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-[11px] leading-4 text-amber-100">
          Experimental setup aid only. Green visual alignment is not an official ruling or measurement. Verify questionable objects against the current Game Manual and field specifications.
        </div>
      </div>
    </div>
  );
}
