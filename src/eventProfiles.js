export const HIGHLANDER_EVENT_ID = "11111111-1111-4111-8111-111111111111";

export const DEFAULT_EVENT_PROFILE = {
  id: "generic",
  name: "Ref OS Event",
  shortName: "Ref OS",
  logo: "/refos-logo.svg",
  favicon: "/refos-logo.svg",
  highlander: false,
};

export const EVENT_PROFILES = {
  [HIGHLANDER_EVENT_ID]: {
    id: HIGHLANDER_EVENT_ID,
    name: "Highlander Summit",
    shortName: "Highlander Summit",
    logo: "/logo.svg",
    favicon: "/favicon.ico",
    highlander: true,
  },
};

export function getEventProfile(eventId, event = null) {
  const stored = EVENT_PROFILES[eventId];
  if (stored) return { ...stored, name: event?.name || stored.name };
  return { ...DEFAULT_EVENT_PROFILE, id: eventId, name: event?.name || DEFAULT_EVENT_PROFILE.name };
}
