import React, { useEffect, useState } from "react";

// Phase 6: shows an event logo, falling back to the built-in logo when a configured
// logo URL fails to load (bad address, site blocks hotlinking, offline).
export default function EventLogo({ src, fallback = "/refos-logo.svg", alt = "", className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return (
    <img
      src={failed || !src ? fallback : src}
      alt={alt}
      className={className}
      onError={() => { if (!failed) setFailed(true); }}
    />
  );
}
