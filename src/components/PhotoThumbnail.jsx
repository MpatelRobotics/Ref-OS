import React, { useEffect, useRef, useState } from "react";
import { CloudOff, ImageOff } from "lucide-react";
import * as photoCache from "../photoCache";
import { photoUrlForDisplay } from "../api";
import { PHOTO_FAILURES } from "../photoFailures";

export default function PhotoThumbnail({ pkey, onOpen, full = false, compact = false }) {
  const [src, setSrc] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reason, setReason] = useState("unknown");
  const [retry, setRetry] = useState(0);
  const recoveryUsed = useRef(false);
  const refreshPath = useRef(null);
  useEffect(() => { recoveryUsed.current = false; }, [pkey]);
  useEffect(() => {
    let live = true;
    setSrc(null);
    setStatus("loading");
    setReason("unknown");
    const refresh = refreshPath.current === pkey;
    refreshPath.current = null;
    photoCache.loadPhoto(pkey, photoUrlForDisplay, { refresh }).then((result) => {
      if (!live) return;
      if (result.url) { setSrc(result.url); setStatus("ready"); }
      else { setReason(result.reason || "unknown"); setStatus(result.status || "missing"); }
    }).catch(() => { if (live) { setReason("unknown"); setStatus("missing"); } });
    return () => { live = false; };
  }, [pkey, retry]);
  useEffect(() => {
    if (status !== "offline") return undefined;
    const back = () => { recoveryUsed.current = false; refreshPath.current = pkey; setRetry((n) => n + 1); };
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [status, pkey]);
  const retryPhoto = () => { recoveryUsed.current = false; refreshPath.current = pkey; setRetry((n) => n + 1); };
  const failedImage = () => {
    setSrc(null);
    if (!recoveryUsed.current && navigator.onLine !== false) {
      recoveryUsed.current = true;
      setStatus("loading");
      refreshPath.current = pkey;
      setRetry((n) => n + 1);
    } else { setReason(navigator.onLine === false ? "offline" : "decode"); setStatus(navigator.onLine === false ? "offline" : "missing"); }
  };
  const size = full ? "w-full h-full" : compact ? "w-12 h-12" : "w-16 h-16";
  if (status === "offline" || status === "missing") return (
    <button type="button" onClick={retryPhoto} aria-label="Retry loading robot picture" title={PHOTO_FAILURES[reason]?.message || PHOTO_FAILURES.unknown.message}
      className={`${size} min-h-[44px] rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-600 dark:text-slate-300`}>
      {!compact && (status === "offline" ? <CloudOff size={18} aria-hidden="true" /> : <ImageOff size={18} aria-hidden="true" />)}
      <span className={full ? "text-sm px-3" : "text-xs"}>{full ? (PHOTO_FAILURES[reason]?.message || PHOTO_FAILURES.unknown.message) : (PHOTO_FAILURES[reason]?.label || PHOTO_FAILURES.unknown.label)}</span>
      <span className={`${full ? "text-sm px-4 py-2 rounded-lg border border-slate-400 dark:border-slate-500" : "text-xs"} font-semibold`}>Retry</span>
    </button>
  );
  if (!src) return <div role="status" aria-label="Loading robot picture" className={`${size} min-h-[44px] rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center motion-safe:animate-pulse`}><span className={full ? "text-sm text-slate-600 dark:text-slate-300" : "sr-only"}>Loading picture…</span></div>;
  const image = <img src={src} alt="robot" onError={failedImage} className={`${size} rounded-lg object-cover border border-slate-200 dark:border-slate-700`} />;
  if (!onOpen) return image;
  return <button type="button" onClick={() => onOpen(src)} className={`${size} shrink-0`}>{image}</button>;
}
