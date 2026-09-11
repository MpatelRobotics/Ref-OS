import React, { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, ScanSearch, X } from "lucide-react";

export default function LiveFieldSetupCheck({ onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [cameraInfo, setCameraInfo] = useState({ width: 0, height: 0 });

  const startCamera = async () => {
    setError("");
    setReady(false);
    try {
      streamRef.current?.getTracks?.().forEach((track) => track.stop());

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported in this browser.");
      }

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
        setCameraInfo({
          width: videoRef.current.videoWidth || 0,
          height: videoRef.current.videoHeight || 0,
        });
        setReady(true);
      }
    } catch (e) {
      setError(e?.message || "Camera access failed.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white">
      <div className="shrink-0 px-3 py-3 bg-[#0D0F32] flex items-center gap-2 border-b border-white/10">
        <Camera size={19} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">Live Field Setup Check</div>
          <div className="text-[11px] text-slate-300">ADMIN TEST • Camera only</div>
        </div>
        <button onClick={onClose} className="p-2" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-contain"
        />

        <div className="absolute left-3 top-3 rounded-md bg-black/80 px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 pointer-events-none">
          <span className={`w-2 h-2 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} />
          LIVE CAMERA
        </div>

        {ready && cameraInfo.width > 0 && (
          <div className="absolute right-3 top-3 rounded-md bg-black/80 px-2.5 py-1.5 text-xs pointer-events-none">
            {cameraInfo.width} × {cameraInfo.height}
          </div>
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-md bg-black/75 px-4 py-3 text-sm text-slate-200">
              Starting camera…
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-x-3 bottom-3 rounded-md bg-red-950/95 border border-red-500 p-3 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="shrink-0 bg-[#0D0F32] border-t border-white/10 p-3 space-y-3 max-h-[42vh] overflow-y-auto">
        <button
          onClick={startCamera}
          className="w-full rounded-md border border-white/20 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} />
          Restart camera
        </button>

        <div className="rounded-md border border-cyan-400/30 bg-cyan-950/30 p-3">
          <div className="flex items-center gap-2 font-bold text-sm text-cyan-100">
            <ScanSearch size={17} />
            Model based detection ready for integration
          </div>
          <div className="mt-1.5 text-xs leading-5 text-cyan-50/80">
            The field overlay, alignment controls, rotation controls, opacity controls, saved position, and zone based detector have been removed. The next detector can run directly on the live camera feed and draw bounding boxes around Pins, Cups, Goals, and Toggles without requiring an overlay.
          </div>
        </div>

        <div className="rounded-md border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-[11px] leading-4 text-amber-100">
          Experimental Admin tool. No trained Override object detection model is installed in this build yet, so Ref OS does not claim to identify field objects. Once the custom model is added, detections can be rendered directly over the live camera feed.
        </div>
      </div>
    </div>
  );
}
