import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Lock, RefreshCw, RotateCcw, RotateCw, Unlock, X } from "lucide-react";

const STORAGE_KEY = "refosLiveFieldSetupOverlayV3";
const OVERLAY_ASPECT = 1225 / 1202;
const DEFAULT_OVERLAY = {
  xPct: 0,
  yPct: 0,
  scale: 1,
  rotation: 180, // Head Ref orientation: red Alliance is on the right.
  opacity: 52,
  locked: false,
};

// Reference zones measured from the exact field-only overlay image supplied for this tool.
// This is intentionally a zone detector rather than an official object-counting system.
const DETECTION_ZONES = [
  { id: "top-left-load", x: 0.347, y: 0.040, label: "Top left starting group" },
  { id: "top-right-load", x: 0.645, y: 0.040, label: "Top right starting group" },
  { id: "toggle-a", x: 0.195, y: 0.184, label: "Upper left Toggle" },
  { id: "upper-left-pin", x: 0.345, y: 0.184, label: "Upper left Pin" },
  { id: "upper-blue-goal", x: 0.645, y: 0.184, label: "Upper blue Goal" },
  { id: "upper-right-pin", x: 0.800, y: 0.184, label: "Upper right Pin" },
  { id: "left-mid-object", x: 0.192, y: 0.342, label: "Left middle object" },
  { id: "toggle-b", x: 0.345, y: 0.342, label: "Upper middle Toggle" },
  { id: "center-upper", x: 0.496, y: 0.342, label: "Upper center object" },
  { id: "right-mid-pin", x: 0.645, y: 0.342, label: "Right middle Pin" },
  { id: "right-mid-goal", x: 0.795, y: 0.342, label: "Right middle Goal" },
  { id: "center-left", x: 0.345, y: 0.495, label: "Center left object" },
  { id: "center", x: 0.496, y: 0.495, label: "Center Pin" },
  { id: "center-right", x: 0.645, y: 0.495, label: "Center right object" },
  { id: "lower-left-goal", x: 0.195, y: 0.648, label: "Lower left Goal" },
  { id: "lower-left-pin", x: 0.345, y: 0.648, label: "Lower left Pin" },
  { id: "lower-center", x: 0.496, y: 0.648, label: "Lower center object" },
  { id: "toggle-c", x: 0.645, y: 0.648, label: "Lower middle Toggle" },
  { id: "lower-right-pin", x: 0.795, y: 0.648, label: "Lower right Pin" },
  { id: "bottom-left-pin", x: 0.195, y: 0.806, label: "Bottom left Pin" },
  { id: "bottom-left-goal", x: 0.345, y: 0.806, label: "Bottom left Goal" },
  { id: "bottom-mid-pin", x: 0.645, y: 0.806, label: "Bottom middle Pin" },
  { id: "toggle-d", x: 0.795, y: 0.806, label: "Bottom right Toggle" },
  { id: "bottom-left-load", x: 0.347, y: 0.955, label: "Bottom left starting group" },
  { id: "bottom-right-load", x: 0.645, y: 0.955, label: "Bottom right starting group" },
  { id: "left-side-upper", x: 0.055, y: 0.342, label: "Left upper perimeter group" },
  { id: "left-side-lower", x: 0.055, y: 0.648, label: "Left lower perimeter group" },
  { id: "right-side-upper", x: 0.935, y: 0.342, label: "Right upper perimeter group" },
  { id: "right-side-lower", x: 0.935, y: 0.648, label: "Right lower perimeter group" },
];

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

function getContainedSize(containerW, containerH, aspect) {
  if (!containerW || !containerH || !aspect) return { width: 0, height: 0, left: 0, top: 0 };
  let width = containerW;
  let height = width / aspect;
  if (height > containerH) {
    height = containerH;
    width = height * aspect;
  }
  return {
    width,
    height,
    left: (containerW - width) / 2,
    top: (containerH - height) / 2,
  };
}

function zoneToStage(zone, overlay, stageW, stageH) {
  const box = getContainedSize(stageW, stageH, OVERLAY_ASPECT);
  const localX = (zone.x - 0.5) * box.width * overlay.scale;
  const localY = (zone.y - 0.5) * box.height * overlay.scale;
  const radians = (overlay.rotation * Math.PI) / 180;
  const rotatedX = localX * Math.cos(radians) - localY * Math.sin(radians);
  const rotatedY = localX * Math.sin(radians) + localY * Math.cos(radians);
  return {
    x: stageW * (0.5 + overlay.xPct / 100) + rotatedX,
    y: stageH * (0.5 + overlay.yPct / 100) + rotatedY,
  };
}

function analyzePatch(data, width, height) {
  if (!data?.length || !width || !height) return 0;
  let mean = 0;
  let meanSq = 0;
  let saturated = 0;
  let veryDark = 0;
  let veryBright = 0;
  let edges = 0;
  let samples = 0;
  const luminance = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      luminance[y * width + x] = lum;
      mean += lum;
      meanSq += lum * lum;
      if (max - min > 42) saturated += 1;
      if (lum < 58) veryDark += 1;
      if (lum > 212) veryBright += 1;
      samples += 1;
    }
  }

  for (let y = 1; y < height; y += 2) {
    for (let x = 1; x < width; x += 2) {
      const here = luminance[y * width + x];
      const left = luminance[y * width + x - 1];
      const up = luminance[(y - 1) * width + x];
      if (Math.abs(here - left) + Math.abs(here - up) > 48) edges += 1;
    }
  }

  mean /= samples;
  meanSq /= samples;
  const variance = Math.max(0, meanSq - mean * mean);
  const saturationRatio = saturated / samples;
  const darkRatio = veryDark / samples;
  const brightRatio = veryBright / samples;
  const edgeRatio = edges / Math.max(1, Math.floor((width - 1) / 2) * Math.floor((height - 1) / 2));

  // Gray foam tiles are usually low-saturation and comparatively low-detail. Objects add
  // color, black outlines, highlights, and strong edges. Score is intentionally conservative.
  return Math.min(
    1,
    saturationRatio * 1.9 +
      darkRatio * 1.15 +
      brightRatio * 0.55 +
      Math.min(1, variance / 1650) * 0.7 +
      edgeRatio * 1.2
  );
}

export default function LiveFieldSetupCheck({ onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const detectCanvasRef = useRef(null);
  const detectionBusyRef = useRef(false);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState(loadSavedOverlay);
  const [savedMessage, setSavedMessage] = useState("");
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [detectionResults, setDetectionResults] = useState({});
  const [sensitivity, setSensitivity] = useState(52);

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

  useEffect(() => {
    if (!detectionEnabled || !ready || !overlay.locked) {
      setDetectionResults({});
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (detectionBusyRef.current) return;
      const video = videoRef.current;
      const stage = stageRef.current;
      const canvas = detectCanvasRef.current;
      if (!video || !stage || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

      detectionBusyRef.current = true;
      try {
        const stageRect = stage.getBoundingClientRect();
        const stageW = stageRect.width;
        const stageH = stageRect.height;
        const videoAspect = video.videoWidth / video.videoHeight;
        const videoBox = getContainedSize(stageW, stageH, videoAspect);

        const scanW = 640;
        const scanH = Math.max(1, Math.round(scanW / videoAspect));
        canvas.width = scanW;
        canvas.height = scanH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, scanW, scanH);

        const next = {};
        for (const zone of DETECTION_ZONES) {
          const point = zoneToStage(zone, overlay, stageW, stageH);
          const insideVideo =
            point.x >= videoBox.left &&
            point.x <= videoBox.left + videoBox.width &&
            point.y >= videoBox.top &&
            point.y <= videoBox.top + videoBox.height;

          if (!insideVideo) {
            next[zone.id] = { status: "outside", score: 0, x: point.x, y: point.y };
            continue;
          }

          const videoX = ((point.x - videoBox.left) / videoBox.width) * scanW;
          const videoY = ((point.y - videoBox.top) / videoBox.height) * scanH;
          const radius = Math.max(7, Math.round(Math.min(scanW, scanH) * 0.026));
          const sx = Math.max(0, Math.round(videoX - radius));
          const sy = Math.max(0, Math.round(videoY - radius));
          const sw = Math.min(scanW - sx, radius * 2);
          const sh = Math.min(scanH - sy, radius * 2);
          if (sw < 4 || sh < 4) continue;
          const patch = ctx.getImageData(sx, sy, sw, sh);
          const score = analyzePatch(patch.data, sw, sh);
          const threshold = 0.74 - (sensitivity / 100) * 0.34;
          const margin = 0.09;
          let status = "uncertain";
          if (score >= threshold + margin) status = "detected";
          else if (score < threshold - margin) status = "missing";
          next[zone.id] = { status, score, x: point.x, y: point.y };
        }
        setDetectionResults(next);
      } finally {
        detectionBusyRef.current = false;
      }
    }, 420);

    return () => window.clearInterval(timer);
  }, [detectionEnabled, ready, overlay, sensitivity]);

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
      setSavedMessage("Position saved on this device. Object detection can now use this alignment.");
    } catch {
      setSavedMessage("Locked for this session. This browser blocked saved settings.");
    }
  };

  const unlock = () => {
    const next = { ...overlay, locked: false };
    setOverlay(next);
    setDetectionEnabled(false);
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

  const detectionSummary = useMemo(() => {
    const values = Object.values(detectionResults);
    return values.reduce(
      (acc, item) => {
        if (item.status === "detected") acc.detected += 1;
        else if (item.status === "missing") acc.missing += 1;
        else if (item.status === "uncertain") acc.uncertain += 1;
        return acc;
      },
      { detected: 0, missing: 0, uncertain: 0 }
    );
  }, [detectionResults]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white">
      <div className="shrink-0 px-3 py-3 bg-[#0D0F32] flex items-center gap-2 border-b border-white/10">
        <Camera size={19} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">Live Field Setup Check</div>
          <div className="text-[11px] text-slate-300">ADMIN TEST • Live object detection</div>
        </div>
        <button onClick={onClose} className="p-2" aria-label="Close"><X size={22}/></button>
      </div>

      <div ref={stageRef} className="relative flex-1 min-h-0 overflow-hidden bg-black touch-none">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-contain" />
        <canvas ref={detectCanvasRef} className="hidden" />

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
              src="/field-setup/override-starting-field-overlay.png"
              alt="Override starting field reference"
              draggable="false"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        )}

        {detectionEnabled && overlay.locked && DETECTION_ZONES.map((zone) => {
          const result = detectionResults[zone.id];
          if (!result || result.status === "outside") return null;
          const style = result.status === "detected"
            ? "border-emerald-300 bg-emerald-500/25"
            : result.status === "missing"
              ? "border-red-300 bg-red-500/25"
              : "border-amber-300 bg-amber-400/25";
          return (
            <div
              key={zone.id}
              className={`absolute z-20 w-8 h-8 sm:w-10 sm:h-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${style} pointer-events-none shadow-[0_0_0_2px_rgba(0,0,0,0.35)]`}
              style={{ left: result.x, top: result.y }}
              title={`${zone.label}: ${result.status}`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black drop-shadow">
                {result.status === "detected" ? "✓" : result.status === "missing" ? "×" : "?"}
              </span>
            </div>
          );
        })}

        <div className="absolute left-3 top-3 rounded-md bg-black/80 px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 pointer-events-none">
          <span className={`w-2 h-2 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} /> LIVE CAMERA
        </div>
        <div className="absolute right-3 top-3 rounded-md bg-black/80 px-2.5 py-1.5 text-xs pointer-events-none">
          {detectionEnabled && overlay.locked
            ? `${detectionSummary.detected} detected • ${detectionSummary.uncertain} uncertain • ${detectionSummary.missing} missing`
            : overlay.locked
              ? "Overlay position locked"
              : "Drag the overlay to align it with the field"}
        </div>
        {error && <div className="absolute inset-x-3 bottom-3 rounded-md bg-red-950/95 border border-red-500 p-3 text-sm">{error}</div>}
      </div>

      <div className="shrink-0 bg-[#0D0F32] border-t border-white/10 p-3 space-y-3 max-h-[48vh] overflow-y-auto">
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
          <button
            onClick={() => setDetectionEnabled((value) => !value)}
            disabled={!overlay.locked || !ready}
            className={`rounded-md border py-2.5 text-sm font-bold disabled:opacity-40 ${
              detectionEnabled
                ? "border-emerald-400/70 bg-emerald-950/50 text-emerald-100"
                : "border-white/20 bg-white/5"
            }`}
          >
            Object detection {detectionEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {overlay.locked && (
          <div className="rounded-md border border-white/15 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold w-20">Sensitivity</span>
              <input
                className="flex-1 accent-emerald-500"
                type="range"
                min="20"
                max="85"
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
              />
              <span className="text-xs tabular-nums w-9 text-right">{sensitivity}%</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
              <span><b className="text-emerald-300">Green</b> object-like detail detected</span>
              <span><b className="text-amber-300">Amber</b> uncertain</span>
              <span><b className="text-red-300">Red</b> expected zone looks empty</span>
            </div>
          </div>
        )}

        {savedMessage && (
          <div className="rounded-md border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
            {savedMessage}
          </div>
        )}

        <div className="rounded-md border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-[11px] leading-4 text-amber-100">
          Experimental object detection. Lock the overlay only after it is aligned with the real field. Ref OS then checks the live camera around expected starting-object zones using local color, contrast, and edge detail. Green means the zone appears occupied, red means it appears empty, and amber means the camera result is uncertain. Lighting, perspective, robots, people, shadows, or a poor alignment can produce incorrect results. This is not an official field measurement, object count, or ruling tool; confirm any questionable setup against the current Game Manual and field specifications.
        </div>
      </div>
    </div>
  );
}
