import React, { useEffect, useMemo, useState } from "react";
import { ImageOff, MapPin, Palette, RotateCcw, Save, Settings, X } from "lucide-react";
import { HEX_COLOR_RE, isHttpUrl, normalizeHexColor } from "../../eventProfiles.js";

// Field keys are the stored/internal identifiers. Only the display names change.
const FIELD_KEYS = ["Field 1", "Field 2", "Field 3"];

const inputClass = "mt-1 w-full rounded-xl border bg-white dark:bg-slate-900 px-3 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600";
const inputBorder = (bad) => (bad ? "border-red-400 dark:border-red-500" : "border-slate-300 dark:border-slate-600");

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      <Icon size={14} /> {children}
    </div>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">{children}</p>;
}

export default function EventSettingsModal({ event, brand, fieldNames = {}, onSave, onClose }) {
  const initial = useMemo(() => ({
    name: String(event?.name || brand?.name || "").trim(),
    shortName: String(brand?.shortName || event?.name || "").trim(),
    logoUrl: brand?.savedLogoUrl || "",
    accent: brand?.accent || "#2563EB",
    fields: Object.fromEntries(FIELD_KEYS.map((key) => [key, fieldNames[key] || key])),
  }), [event?.name, brand?.name, brand?.shortName, brand?.savedLogoUrl, brand?.accent, fieldNames["Field 1"], fieldNames["Field 2"], fieldNames["Field 3"]]);

  const [name, setName] = useState(initial.name);
  const [shortName, setShortName] = useState(initial.shortName);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [accentText, setAccentText] = useState(initial.accent);
  const [fields, setFields] = useState(initial.fields);
  const [removeLegacyLogo, setRemoveLegacyLogo] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLogoBroken(false); }, [logoUrl]);

  const accent = normalizeHexColor(accentText);
  const legacyLogo = brand?.logoSource === "legacy" && !removeLegacyLogo;
  const cleanLogoUrl = logoUrl.trim();
  const previewLogo = isHttpUrl(cleanLogoUrl)
    ? cleanLogoUrl
    : legacyLogo
      ? brand.logo
      : (brand?.logoSource === "saved" || brand?.logoSource === "legacy")
        ? (brand.highlander ? "/logo.svg" : "/refos-logo.svg")
        : brand?.logo || "/refos-logo.svg";
  const previewShort = shortName.trim() || name.trim() || "Event";

  const validate = () => {
    const next = {};
    const cleanName = name.trim();
    const cleanShort = shortName.trim();
    if (!cleanName) next.name = "Enter the event name.";
    else if (cleanName.length > 100) next.name = "Keep the event name to 100 characters or fewer.";
    if (!cleanShort) next.shortName = "Enter a short name. It can match the event name.";
    else if (cleanShort.length > 40) next.shortName = "Keep the short name to 40 characters or fewer.";
    if (cleanLogoUrl && !isHttpUrl(cleanLogoUrl)) next.logoUrl = "Enter a full image address starting with http:// or https://, or leave it blank.";
    if (!HEX_COLOR_RE.test(accent)) next.accent = "Enter a 6 digit hex color, for example #D7212B.";
    const cleanedFields = Object.fromEntries(FIELD_KEYS.map((key) => [key, String(fields[key] || "").trim()]));
    FIELD_KEYS.forEach((key) => { if (!cleanedFields[key]) next[key] = `Enter a name for ${key}.`; });
    const lowered = FIELD_KEYS.map((key) => cleanedFields[key].toLowerCase()).filter(Boolean);
    if (!FIELD_KEYS.some((key) => next[key]) && new Set(lowered).size !== FIELD_KEYS.length) next.fields = "Each field needs a different name.";
    return { next, cleanName, cleanShort, cleanedFields };
  };

  const save = async () => {
    const { next, cleanName, cleanShort, cleanedFields } = validate();
    setErrors(next);
    setSaveError("");
    if (Object.keys(next).length) return;
    const identityChanged = {
      shortName: cleanShort !== initial.shortName,
      logoUrl: cleanLogoUrl !== initial.logoUrl,
      accent: accent !== normalizeHexColor(initial.accent),
      removeLegacyLogo,
    };
    const fieldsChanged = FIELD_KEYS.some((key) => cleanedFields[key] !== initial.fields[key]);
    const nameChanged = cleanName !== initial.name;
    if (!nameChanged && !fieldsChanged && !Object.values(identityChanged).some(Boolean)) { onClose(); return; }
    setSaving(true);
    try {
      await onSave({
        name: nameChanged ? cleanName : null,
        branding: Object.values(identityChanged).some(Boolean) ? {
          ...(identityChanged.shortName ? { shortName: cleanShort } : {}),
          ...(identityChanged.logoUrl ? { logoUrl: cleanLogoUrl } : {}),
          ...(identityChanged.accent ? { accent } : {}),
          removeLegacyLogo,
        } : null,
        fieldNames: fieldsChanged ? cleanedFields : null,
      });
    } catch (error) {
      setSaveError(error?.message || "Could not save event settings.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-end sm:items-center justify-center" onClick={saving ? undefined : onClose}>
      <div className="w-full sm:max-w-lg h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl bg-white dark:bg-slate-800 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <Settings size={19} className="text-slate-600 dark:text-slate-300" />
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Event Settings</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Only changes this event · updates for everyone at this event</p>
          </div>
          <button onClick={onClose} disabled={saving} className="ml-auto text-slate-400 disabled:opacity-40" aria-label="Close"><X size={22} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-6">
          {/* Live preview */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: accent || "#94A3B8" }} />
            <div className="p-3 flex items-center gap-3">
              {logoBroken
                ? <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 grid place-items-center text-slate-400 shrink-0"><ImageOff size={20} /></div>
                : <img src={previewLogo} alt="" onError={() => setLogoBroken(true)} className="w-12 h-12 object-contain rounded-lg shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{name.trim() || "Event name"}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{previewShort}</div>
              </div>
              <span className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: accent || "#94A3B8" }}>Preview</span>
            </div>
          </div>

          <section className="space-y-4">
            <SectionTitle icon={Settings}>Event identity</SectionTitle>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Event name</span>
              <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Highlander Summit Signature Event"
                className={`${inputClass} ${inputBorder(errors.name)}`} />
              <FieldError>{errors.name}</FieldError>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Event short name</span>
              <input value={shortName} maxLength={40} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. Highlander Summit"
                className={`${inputClass} ${inputBorder(errors.shortName)}`} />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Used where the full name is too long, such as the phone header.</p>
              <FieldError>{errors.shortName}</FieldError>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Event logo URL</span>
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                placeholder="https://example.org/event-logo.png" className={`${inputClass} ${inputBorder(errors.logoUrl)}`} />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Link to a PNG, JPG, or SVG image. Leave blank to use {brand?.highlander ? "the Highlander Summit logo" : "the Ref OS logo"}.
              </p>
              {logoBroken && isHttpUrl(cleanLogoUrl) && <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">This image did not load. Check the address, or that the site allows the image to be shown elsewhere.</p>}
              <FieldError>{errors.logoUrl}</FieldError>
            </label>
            {brand?.logoSource === "legacy" && (
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={removeLegacyLogo} onChange={(e) => setRemoveLegacyLogo(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <span>This event has a logo saved by the earlier event configurator. Check to remove it{cleanLogoUrl ? "" : " and use the default logo"}.</span>
              </label>
            )}
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Event accent color</span>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" aria-label="Pick accent color" value={(accent || normalizeHexColor(initial.accent) || "#2563EB").toLowerCase()}
                  onChange={(e) => setAccentText(e.target.value.toUpperCase())}
                  className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-1" />
                <input value={accentText} maxLength={7} onChange={(e) => setAccentText(e.target.value.toUpperCase())} autoCapitalize="characters" spellCheck={false}
                  placeholder="#D7212B" className={`${inputClass.replace("mt-1 ", "")} font-mono ${inputBorder(errors.accent)}`} />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Branding only: header, login, and event cards. Violation, warning, and success colors do not change.</p>
              <FieldError>{errors.accent}</FieldError>
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={MapPin}>Field settings</SectionTitle>
            <p className="text-sm text-slate-600 dark:text-slate-300 -mt-1">Display names only. Matches, field logs, and AWP history stay connected to Field 1, Field 2, and Field 3.</p>
            {FIELD_KEYS.map((key) => (
              <label key={key} className="block">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{key} name</span>
                <input value={fields[key] || ""} maxLength={40} onChange={(e) => setFields((cur) => ({ ...cur, [key]: e.target.value }))} placeholder={key}
                  className={`${inputClass} ${inputBorder(errors[key])}`} />
                <FieldError>{errors[key]}</FieldError>
              </label>
            ))}
            <FieldError>{errors.fields}</FieldError>
            <button type="button" onClick={() => { setFields(Object.fromEntries(FIELD_KEYS.map((key) => [key, key]))); setErrors((cur) => ({ ...cur, "Field 1": "", "Field 2": "", "Field 3": "", fields: "" })); }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <RotateCcw size={15} /> Restore Field 1, Field 2, and Field 3
            </button>
          </section>

          <div className="flex items-center gap-2 text-xs text-slate-400"><Palette size={13} /> Settings apply to this event only.</div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {(saveError || Object.values(errors).some(Boolean)) && (
            <p className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">{saveError || "Fix the highlighted settings before saving."}</p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold disabled:opacity-50">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-[#0D0F32] text-white py-2.5 font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={16} />{saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
