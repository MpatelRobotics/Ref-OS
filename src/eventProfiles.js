export const HIGHLANDER_EVENT_ID = "11111111-1111-4111-8111-111111111111";

// Ref OS default accent matches the existing generic login blue (Tailwind blue-600).
export const REFOS_DEFAULT_ACCENT = "#2563EB";

export const DEFAULT_EVENT_PROFILE = {
  id: "generic",
  name: "Ref OS Event",
  shortName: "Ref OS",
  logo: "/refos-logo.svg",
  favicon: "/refos-logo.svg",
  accent: REFOS_DEFAULT_ACCENT,
  highlander: false,
};

export const EVENT_PROFILES = {
  [HIGHLANDER_EVENT_ID]: {
    id: HIGHLANDER_EVENT_ID,
    name: "Highlander Summit",
    shortName: "Highlander Summit",
    logo: "/logo.svg",
    favicon: "/favicon.ico",
    accent: "#D7212B",
    highlander: true,
  },
};

export function getEventProfile(eventId, event = null) {
  const stored = EVENT_PROFILES[eventId];
  if (stored) return { ...stored, name: event?.name || stored.name };
  return { ...DEFAULT_EVENT_PROFILE, id: eventId, name: event?.name || DEFAULT_EVENT_PROFILE.name };
}

/* ---- Phase 6: per event branding ----
   Branding lives in the existing event_settings row with key "event_branding":
     { shortName, logoUrl, accent }   (older rows may also carry logoData)
   Each value resolves in this order: saved event setting -> built-in profile -> Ref OS default. */
export const HEX_COLOR_RE = /^#[0-9A-F]{6}$/i;

export function normalizeHexColor(value) {
  const raw = String(value ?? "").trim().replace(/^#?/, "#").toUpperCase();
  return HEX_COLOR_RE.test(raw) ? raw : "";
}

export function isHttpUrl(value) {
  const raw = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const url = new URL(raw);
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

const cleanText = (value, max) => String(value ?? "").trim().slice(0, max);

// A legacy logo saved by the earlier configurator (inline image data).
const legacyLogoData = (value) => (/^data:image\//i.test(String(value ?? "")) ? String(value) : "");

export function resolveEventBranding(eventId, event = null, branding = null) {
  const profile = getEventProfile(eventId, event);
  const builtIn = EVENT_PROFILES[eventId] || null;
  const saved = branding && typeof branding === "object" ? branding : {};

  const name = cleanText(event?.name, 120) || profile.name;
  const savedShortName = cleanText(saved.shortName, 60);
  const savedLogoUrl = isHttpUrl(saved.logoUrl) ? String(saved.logoUrl).trim() : "";
  const savedLogoData = legacyLogoData(saved.logoData);
  const savedAccent = normalizeHexColor(saved.accent);

  return {
    id: eventId,
    name,
    shortName: savedShortName || builtIn?.shortName || name,
    hasSavedShortName: !!savedShortName,
    logo: savedLogoUrl || savedLogoData || profile.logo,
    logoSource: savedLogoUrl ? "saved" : savedLogoData ? "legacy" : builtIn ? "profile" : "default",
    savedLogoUrl,
    accent: savedAccent || profile.accent || REFOS_DEFAULT_ACCENT,
    accentSource: savedAccent ? "saved" : builtIn?.accent ? "profile" : "default",
    favicon: profile.favicon,
    highlander: !!profile.highlander,
  };
}
