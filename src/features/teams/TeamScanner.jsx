import React, { useEffect, useRef, useState } from "react";
import { Camera, X, ScanSearch } from "lucide-react";
import { loadExternalScript } from "../../utils/loadExternalScript.js";

export default function TeamScanner({ teams, onDetected, onClose }) {
  const [status, setStatus] = useState("Starting camera…");
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);
  const stoppedRef = useRef(false);
  const tesseractRef = useRef(null);
  const teamsRef = useRef(teams);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    let live = true;
    stoppedRef.current = false;

    const stopCamera = () => {
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const normalize = (value) =>
      String(value || "").toUpperCase().replace(/[^0-9A-Z]/g, "");

    const findTeam = (rawText) => {
      const normalized = normalize(rawText);
      if (!normalized) return null;

      return [...teamsRef.current]
        .sort((a, b) => String(b.number).length - String(a.number).length)
        .find((team) => {
          const number = normalize(team.number);
          return number && normalized.includes(number);
        });
    };

    const getFrame = () => {
      const video = videoRef.current;
      if (!video?.videoWidth || !video?.videoHeight) return null;

      const canvas = document.createElement("canvas");
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Increase contrast slightly to improve OCR on printed robot number plates.
      try {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = image.data;
        for (let i = 0; i < data.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            const v = data[i + c];
            data[i + c] = Math.max(0, Math.min(255, (v - 128) * 1.18 + 128));
          }
        }
        ctx.putImageData(image, 0, 0);
      } catch {}

      return canvas;
    };

    const readText = async (canvas) => {
      // Fast path where the browser provides native text detection.
      if ("TextDetector" in globalThis) {
        try {
          const found = await new TextDetector().detect(canvas);
          const text = found.map((x) => x.rawValue || "").join(" ");
          if (text.trim()) return text;
        } catch {}
      }

      // Fallback OCR. Loaded once and then reused for subsequent scans.
      if (!tesseractRef.current) {
        setStatus("Loading AI scanner…");
        tesseractRef.current = await loadExternalScript(
          "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
          "Tesseract"
        );
      }

      setStatus("Searching for team number…");
      const result = await tesseractRef.current.recognize(canvas, "eng", {
        logger: () => {},
      });
      return result?.data?.text || "";
    };

    const scanOnce = async () => {
      if (
        stoppedRef.current ||
        !live ||
        scanningRef.current ||
        !videoRef.current?.videoWidth
      ) {
        return;
      }

      scanningRef.current = true;
      setError("");
      setStatus("Searching for team number…");

      try {
        const canvas = getFrame();
        if (!canvas) return;

        const rawText = await readText(canvas);
        const match = findTeam(rawText);

        if (match && !stoppedRef.current) {
          stoppedRef.current = true;
          setStatus(`Team ${match.number} found`);
          stopCamera();
          window.setTimeout(() => onDetected(match.number), 250);
        }
      } catch {
        if (!stoppedRef.current) {
          setStatus("Searching for team number…");
        }
      } finally {
        scanningRef.current = false;
      }
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is not supported on this browser.");
        setStatus("Scanner unavailable");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
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
          await video.play();
          setStatus("Searching for team number…");
        }
      } catch {
        setError("Camera access was not available. Allow camera permission and try again.");
        setStatus("Scanner unavailable");
        return;
      }

      // Continuously scan the whole camera view. A new pass begins after
      // the previous OCR pass finishes, preventing overlapping OCR jobs.
      while (live && !stoppedRef.current) {
        await scanOnce();
        await new Promise((resolve) => window.setTimeout(resolve, 650));
      }
    })();

    return () => {
      live = false;
      stoppedRef.current = true;
      stopCamera();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-2 sm:inset-3 border-4 border-white/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.12)]">
          <span className="absolute left-0 top-0 w-14 h-14 border-l-4 border-t-4 border-cyan-400 rounded-tl-xl" />
          <span className="absolute right-0 top-0 w-14 h-14 border-r-4 border-t-4 border-cyan-400 rounded-tr-xl" />
          <span className="absolute left-0 bottom-0 w-14 h-14 border-l-4 border-b-4 border-cyan-400 rounded-bl-xl" />
          <span className="absolute right-0 bottom-0 w-14 h-14 border-r-4 border-b-4 border-cyan-400 rounded-br-xl" />
          <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.85)] animate-pulse" />
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 p-3 sm:p-4 flex items-start gap-3 bg-gradient-to-b from-black/75 to-transparent">
        <div className="min-w-0">
          <div className="font-bold flex items-center gap-2 text-base sm:text-lg">
            <ScanSearch size={21} />
            AI Team Scanner
          </div>
          <div className="text-xs sm:text-sm text-white/80 mt-0.5">
            Point the camera at a robot team number
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-2 rounded-md bg-black/40 border border-white/20"
          aria-label="Close scanner"
        >
          <X size={24} />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 bg-gradient-to-t from-black/80 via-black/55 to-transparent">
        {error ? (
          <div className="mx-auto max-w-md rounded-lg bg-red-950/85 border border-red-600 p-3 text-sm text-center">
            {error}
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-lg bg-black/55 backdrop-blur-sm border border-white/20 px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-2 font-semibold">
              <Camera size={18} className="animate-pulse" />
              {status}
            </div>
            <div className="text-xs text-white/70 mt-1">
              The entire camera view is being scanned automatically
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
