import React, { useEffect, useRef, useState } from "react";
import { Camera, Lock, RefreshCw, RotateCcw, RotateCw, Unlock, X } from "lucide-react";

const STORAGE_KEY = "refosLiveFieldSetupOverlayV2";
const DEFAULT_OVERLAY = {
  xPct: 0,
  yPct: 0,
  scale: 1,
  rotation: 180, // Head Ref orientation: red Alliance is on the right.
  opacity: 52,
  locked: false,
};

function normalizeRotation(value) {
  return ((value % 360) + 360) % 360;
}

function loadSavedOverlay() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OVERLAY;
    const saved = JSON.parse(raw);
    return {
      ...DEFAULT_OVERLAY,
      ...saved,
      rotation: normalizeRotation(Number(saved.rotation ?? DEFAULT_OVERLAY.rotation)),
      scale: Math.min(2, Math.max(0.45, Number(saved.scale ?? 1))),
      opacity: Math.min(90, Math.max(10, Number(saved.opacity ?? 52))),
      xPct: Number(saved.xPct ?? 0),
      yPct: Number(saved.yPct ?? 0),
      locked: Boolean(saved.locked),
    };
  } catch {
    return DEFAULT_OVERLAY;
  }
}

// Admin-only camera alignment aid. This intentionally remains a visual reference tool,
// not a computer-vision inspection system or official field measurement.
export default function LiveFieldSetupCheck({ onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState(loadSavedOverlay);
  const [savedMessage, setSavedMessage] = useState("");

  const startCamera = async () => {
    setError("");
    setReady(false);
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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

  const updateOverlay = (patch) => {
    setOverlay((current) => ({ ...current, ...patch }));
    setSavedMessage("");
  };

  const rotateBy = (degrees) => {
    if (overlay.locked) return;
    updateOverlay({ rotation: normalizeRotation(overlay.rotation + degrees) });
  };

  const beginDrag = (event) => {
    if (overlay.locked) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startXPct: overlay.xPct,
      startYPct: overlay.yPct,
      width: rect.width,
      height: rect.height,
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || overlay.locked || drag.pointerId !== event.pointerId) return;
    const dxPct = ((event.clientX - drag.startX) / drag.width) * 100;
    const dyPct = ((event.clientY - drag.startY) / drag.height) * 100;
    setOverlay((current) => ({
      ...current,
      xPct: Math.max(-80, Math.min(80, drag.startXPct + dxPct)),
      yPct: Math.max(-80, Math.min(80, drag.startYPct + dyPct)),
    }));
  };

  const endDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const lockAndSave = () => {
    const next = { ...overlay, locked: true };
    setOverlay(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedMessage("Position saved on this device.");
    } catch {
      setSavedMessage("Locked for this session. This browser blocked saved settings.");
    }
  };

  const unlock = () => {
    const next = { ...overlay, locked: false };
    setOverlay(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    setSavedMessage("Position unlocked. Adjust it, then lock again to save.");
  };

  const resetOverlay = () => {
    if (overlay.locked) return;
    setOverlay(DEFAULT_OVERLAY);
    setSavedMessage("");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white">
      <div className="shrink-0 px-3 py-3 bg-[#0D0F32] flex items-center gap-2 border-b border-white/10">
        <Camera size={19} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">Live Field Setup Check</div>
          <div className="text-[11px] text-slate-300">ADMIN TEST • Head Ref field reference</div>
        </div>
        <button onClick={onClose} className="p-2" aria-label="Close"><X size={22}/></button>
      </div>

      <div ref={stageRef} className="relative flex-1 min-h-0 overflow-hidden bg-black touch-none">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-contain" />

        {ready && (
          <div
            className={`absolute w-full h-full select-none ${overlay.locked ? "cursor-default" : "cursor-move"}`}
            style={{
              left: `${50 + overlay.xPct}%`,
              top: `${50 + overlay.yPct}%`,
              transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${overlay.scale})`,
              transformOrigin: "center center",
              opacity: overlay.opacity / 100,
            }}
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img
              src="/field-setup/override-starting-field-headref.png"
              alt="Override starting field reference"
              draggable="false"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-md bg-black/80 px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 pointer-events-none">
          <span className={`w-2 h-2 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} /> LIVE CAMERA
        </div>
        <div className="absolute right-3 top-3 rounded-md bg-black/80 px-2.5 py-1.5 text-xs pointer-events-none">
          {overlay.locked ? "Overlay position locked" : "Drag the overlay to align it with the field"}
        </div>
        {error && <div className="absolute inset-x-3 bottom-3 rounded-md bg-red-950/95 border border-red-500 p-3 text-sm">{error}</div>}
      </div>

      <div className="shrink-0 bg-[#0D0F32] border-t border-white/10 p-3 space-y-3 max-h-[44vh] overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => rotateBy(-90)}
            disabled={overlay.locked}
            className="rounded-md border border-white/20 py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <RotateCcw size={16}/> Turn 90° left
          </button>
          <button
            onClick={() => rotateBy(90)}
            disabled={overlay.locked}
            className="rounded-md border border-white/20 py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <RotateCw size={16}/> Turn 90° right
          </button>
          <button
            onClick={resetOverlay}
            disabled={overlay.locked}
            className="rounded-md border border-white/20 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Head Ref default
          </button>
          <button onClick={startCamera} className="rounded-md border border-white/20 py-2 text-sm font-semibold flex items-center justify-center gap-2">
            <RefreshCw size={15}/> Restart camera
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold w-16">Opacity</span>
            <input
              className="flex-1 accent-red-600"
              type="range"
              min="10"
              max="90"
              value={overlay.opacity}
              disabled={overlay.locked}
              onChange={(e) => updateOverlay({ opacity: Number(e.target.value) })}
            />
            <span className="text-xs tabular-nums w-9 text-right">{overlay.opacity}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold w-16">Size</span>
            <input
              className="flex-1 accent-red-600"
              type="range"
              min="45"
              max="200"
              value={Math.round(overlay.scale * 100)}
              disabled={overlay.locked}
              onChange={(e) => updateOverlay({ scale: Number(e.target.value) / 100 })}
            />
            <span className="text-xs tabular-nums w-11 text-right">{Math.round(overlay.scale * 100)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {overlay.locked ? (
            <button onClick={unlock} className="rounded-md border border-amber-400/60 bg-amber-950/40 py-2.5 text-sm font-bold flex items-center justify-center gap-2">
              <Unlock size={16}/> Unlock position
            </button>
          ) : (
            <button onClick={lockAndSave} className="rounded-md border border-emerald-400/60 bg-emerald-950/50 py-2.5 text-sm font-bold flex items-center justify-center gap-2">
              <Lock size={16}/> Lock and save position
            </button>
          )}
          <div className="rounded-md border border-white/15 px-3 py-2 text-xs flex items-center justify-center text-slate-300">
            Rotation: {overlay.rotation}° • Position: {overlay.xPct.toFixed(1)}, {overlay.yPct.toFixed(1)}
          </div>
        </div>

        {savedMessage && (
          <div className="rounded-md border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
            {savedMessage}
          </div>
        )}

        <div className="rounded-md border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-[11px] leading-4 text-amber-100">
          Experimental setup aid only. The uploaded starting-field view is used as the live overlay. Head Ref default is rotated 180° so the red Alliance is on the Head Ref&apos;s right. Locking stores rotation, size, opacity, and alignment locally on this device for the next time this tool opens. Verify questionable setup against the current Game Manual and field specifications.
        </div>
      </div>
    </div>
  );
}
