import React, { useEffect, useRef, useState } from "react";
import { Camera, X, ScanSearch } from "lucide-react";
import { preloadTeamScannerOcr } from "./preloadTeamScannerOcr.js";

export default function TeamScanner({ teams, onDetected, onClose }) {
  const [status, setStatus] = useState("Starting camera…");
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stoppedRef = useRef(false);
  const scanningRef = useRef(false);
  const teamsRef = useRef(teams);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const workerRef = useRef(null);
  const workerReadyRef = useRef(false);
  const hiddenCanvasRef = useRef(null);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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

    const ensureCanvas = () => {
      if (!hiddenCanvasRef.current) {
        hiddenCanvasRef.current = document.createElement("canvas");
      }
      return hiddenCanvasRef.current;
    };

    const captureSmallFrame = () => {
      const video = videoRef.current;
      if (!video?.videoWidth || !video?.videoHeight) return null;

      const canvas = ensureCanvas();

      // Keep OCR lightweight on phones. The live video remains untouched.
      const targetWidth = 512;
      const scale = Math.min(1, targetWidth / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

      const ctx = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: false,
      });

      // Contrast is applied only to the offscreen OCR copy.
      // The visible camera preview is never filtered or redrawn.
      ctx.save();
      ctx.filter = "grayscale(1) contrast(1.35)";
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      return canvas;
    };

    const initOcrWorker = async () => {
      if (workerReadyRef.current || workerRef.current || stoppedRef.current) return;

      try {
        setStatus("Camera ready • preparing team scanner…");

        const Tesseract = await preloadTeamScannerOcr();

        if (!live || stoppedRef.current) return;

        // Create ONE OCR worker and reuse it for every frame.
        // Tesseract.recognize() on every pass can repeatedly create heavy work.
        const worker = await Tesseract.createWorker("eng", 1, {
          logger: () => {},
        });

        if (!live || stoppedRef.current) {
          await worker.terminate();
          return;
        }

        try {
          await worker.setParameters({
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
            preserve_interword_spaces: "0",
            tessedit_pageseg_mode: "11",
            user_defined_dpi: "150",
          });
        } catch {}

        workerRef.current = worker;
        workerReadyRef.current = true;
        setStatus("Searching for team number…");
      } catch {
        if (live && !stoppedRef.current) {
          setStatus("Camera ready • scanner loading failed");
        }
      }
    };

    const scanOnce = async () => {
      if (
        !live ||
        stoppedRef.current ||
        scanningRef.current ||
        !workerReadyRef.current ||
        !workerRef.current
      ) {
        return;
      }

      const canvas = captureSmallFrame();
      if (!canvas) return;

      scanningRef.current = true;

      try {
        const result = await workerRef.current.recognize(canvas);
        if (!live || stoppedRef.current) return;

        const rawText = result?.data?.text || "";
        const match = findTeam(rawText);

        if (match) {
          stoppedRef.current = true;
          setStatus(`Team ${match.number} found`);
          stopCamera();

          try {
            await workerRef.current?.terminate?.();
          } catch {}

          workerRef.current = null;
          workerReadyRef.current = false;

          window.setTimeout(() => {
            onDetectedRef.current?.(match.number);
          }, 200);
        }
      } catch {
        // Keep the preview alive even if an OCR pass fails.
      } finally {
        scanningRef.current = false;
      }
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is not supported on this browser.");
        setStatus("Scanner unavailable");
        return false;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });

        if (!live) {
          stream.getTracks().forEach((track) => track.stop());
          return false;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return false;

        video.srcObject = stream;
        video.muted = true;
        video.setAttribute("playsinline", "true");
        await video.play();

        // Camera becomes visible immediately. OCR initializes afterward.
        setStatus("Camera ready • preparing team scanner…");
        return true;
      } catch {
        setError("Camera access was not available. Allow camera permission and try again.");
        setStatus("Scanner unavailable");
        return false;
      }
    };

    let timer = null;

    (async () => {
      const cameraStarted = await startCamera();
      if (!cameraStarted || !live) return;

      // Initialize OCR only after the live preview is already running.
      // This prevents a heavy OCR startup from delaying the camera screen.
      initOcrWorker();

      // A faster scan cadence starts the next pass quickly without overlapping OCR jobs.
      timer = window.setInterval(() => {
        scanOnce();
      }, 650);
    })();

    return () => {
      live = false;
      stoppedRef.current = true;

      if (timer) window.clearInterval(timer);

      stopCamera();

      const worker = workerRef.current;
      workerRef.current = null;
      workerReadyRef.current = false;

      if (worker?.terminate) {
        worker.terminate().catch(() => {});
      }
    };
  }, []);

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
        <div className="absolute inset-2 sm:inset-3 border-4 border-white/90 rounded-2xl">
          <span className="absolute left-0 top-0 w-14 h-14 border-l-4 border-t-4 border-cyan-400 rounded-tl-xl" />
          <span className="absolute right-0 top-0 w-14 h-14 border-r-4 border-t-4 border-cyan-400 rounded-tr-xl" />
          <span className="absolute left-0 bottom-0 w-14 h-14 border-l-4 border-b-4 border-cyan-400 rounded-bl-xl" />
          <span className="absolute right-0 bottom-0 w-14 h-14 border-r-4 border-b-4 border-cyan-400 rounded-br-xl" />
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
          onClick={() => onCloseRef.current?.()}
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
              <Camera size={18} />
              {status}
            </div>
            <div className="text-xs text-white/70 mt-1">
              The camera stays live while Ref OS scans a lightweight copy of the frame
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
