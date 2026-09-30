// Official VEX resources per game season, keyed by the same ruleset key the default rules
// template uses (refos_rulesets.key, recorded on each new event as event_settings.rules_template).
// Next season: add a new entry and point DEFAULT_RULESET_KEY at it. No component hardcodes a URL.
export const OFFICIAL_RESOURCES = {
  "v5rc-override-2026-2027": {
    game: "V5RC Override",
    season: "2026-2027",
    // Official Q&A on VEX Events (formerly RobotEvents).
    qaUrl: "https://events.vex.com/V5RC/2026-2027/QA",
    qaLabel: "Official Q&A · Override 2026-2027",
  },
};

export const DEFAULT_RULESET_KEY = "v5rc-override-2026-2027";

// Official resources for an event's ruleset, falling back to the current default season.
export function officialResourcesFor(rulesetKey) {
  return OFFICIAL_RESOURCES[rulesetKey] || OFFICIAL_RESOURCES[DEFAULT_RULESET_KEY];
}
