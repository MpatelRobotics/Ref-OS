import React, { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { loadExternalScript } from "../../utils/loadExternalScript.js";

export default function TeamScanner({ teams, onDetected, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is not supported on this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!live) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.setAttribute("playsinline", "true");
          await video.play().catch(() => setError("Safari could not start the camera preview. Close the scanner and try again."));
        }
      } catch {
        setError("Camera access was not available. Allow camera permission and try again.");
      }
    })();

    return () => {
      live = false;
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || busy) return;
    setBusy(true);
    setError("");

    const canvas = document.createElement("canvas");
    const maxWidth = 1400;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      let rawText = "";
      if ("TextDetector" in globalThis) {
        try {
          const found = await new TextDetector().detect(canvas);
          rawText = found.map((x) => x.rawValue || "").join(" ");
        } catch {}
      }

      if (!rawText.trim()) {
        let Tesseract;
        try {
          Tesseract = await loadExternalScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", "Tesseract");
        } catch {
          setError("Team number OCR support could not load. Use normal team search.");
          return;
        }
        const result = await Tesseract.recognize(canvas, "eng", { logger: () => {} });
        rawText = result?.data?.text || "";
      }

      const normalized = String(rawText).toUpperCase().replace(/[^0-9A-Z]/g, "");
      const match = [...teams]
        .sort((a, b) => String(b.number).length - String(a.number).length)
        .find((team) => normalized.includes(String(team.number).toUpperCase().replace(/[^0-9A-Z]/g, "")));

      if (!match) {
        setError("No known team number was detected. Move closer to the number and try again.");
        return;
      }
      onDetected(match.number);
    } catch {
      setError("Could not read a team number from that image. Try again closer to the number.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white">
      <div className="p-4 flex items-center">
        <div className="font-bold flex items-center gap-2"><Camera size={20}/> Scan team number</div>
        <button onClick={onClose} className="ml-auto p-2"><X size={24}/></button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 border-4 border-white rounded-2xl h-36 pointer-events-none"/>
      </div>
      <div className="p-4">
        {error && <div className="mb-3 rounded-lg bg-red-950/70 border border-red-700 p-2 text-sm">{error}</div>}
        <button disabled={busy || !!error && !videoRef.current?.videoWidth} onClick={capture}
          className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-60">
          {busy ? "Reading team number…" : "Read team number"}
        </button>
        <p className="text-xs text-slate-300 text-center mt-2">Center the robot team number in the box, then tap Read team number.</p>
      </div>
    </div>
  );
}
