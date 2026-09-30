import React, { useEffect, useState } from "react";
import { X, Server, Cloud, RefreshCw, Download, Wifi, AlertTriangle } from "lucide-react";
import { getSyncConfig, setSyncConfig, normalizeServerUrl, mixedContentProblem, DEFAULT_VENUE_URL } from "../../sync/syncConfig";
import * as venueSync from "../../sync/venueSync";

// Admin/Developer panel: choose Cloud or Local Venue Server for THIS device, test the venue
// server, see sync status, sync now, and export venue data. Referees only see a small badge.
const STATE_LABEL = { idle: "Idle", syncing: "Syncing", offline: "Offline", error: "Error" };
const ago = (ts) => {
  if (!ts) return "Never";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "Just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return new Date(ts).toLocaleString();
};

export default function SyncStatusModal({ eventId, eventName = "", onClose }) {
  const [cfg, setCfg] = useState(getSyncConfig);
  const [urlInput, setUrlInput] = useState(() => getSyncConfig().serverUrl || DEFAULT_VENUE_URL);
  const [urlError, setUrlError] = useState("");
  const [status, setStatus] = useState(venueSync.getStatus);
  const [test, setTest] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const venue = cfg.mode === "venue";

  useEffect(() => venueSync.onStatus(setStatus), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const applyUrl = () => {
    const checked = normalizeServerUrl(urlInput);
    if (checked.error) { setUrlError(checked.error); return null; }
    setUrlError("");
    setUrlInput(checked.url);
    return checked.url;
  };

  const chooseMode = async (mode) => {
    if (mode === cfg.mode) return;
    if (mode === "venue") {
      const url = applyUrl();
      if (!url) return;
      try { sessionStorage.setItem("refosOpenSyncStatus", "1"); } catch {}
      setCfg(setSyncConfig({ mode: "venue", serverUrl: url, source: "user" }));
      return;
    }
    const summary = await venueSync.localVenueSummary(eventId);
    if ((summary.pending || summary.records) && !confirm(
      `Switch this device to Cloud?\n\nVenue data is NOT copied to the cloud automatically in this version.` +
      `${summary.pending ? `\n• ${summary.pending} change(s) from this device have not reached the venue server yet.` : ""}` +
      `${summary.records ? `\n• ${summary.records} venue record(s) will not appear while in Cloud mode.` : ""}` +
      `\n\nNothing is deleted: it stays on this device and on the venue server, and reappears if you switch back. Use Export Venue Data first if you need a copy.`
    )) return;
    try { sessionStorage.setItem("refosOpenSyncStatus", "1"); } catch {}
    setCfg(setSyncConfig({ mode: "cloud", source: "user" }));
  };

  const saveUrl = () => {
    const url = applyUrl();
    if (!url || url === cfg.serverUrl) return;
    setTest(null);
    setCfg(setSyncConfig({ serverUrl: url, source: "user" }));
    setNotice("Server address saved.");
  };

  const runTest = async () => {
    const url = applyUrl();
    if (!url) return;
    setBusy("test");
    setTest(await venueSync.testConnection(url));
    setBusy("");
  };

  const runSync = async () => {
    setBusy("sync");
    const ok = await venueSync.syncNow(eventId);
    setNotice(ok ? "Sync complete." : "Sync did not complete. See the status below.");
    setBusy("");
  };

  const runExport = async () => {
    setBusy("export");
    try {
      const result = await venueSync.exportVenueData(eventId);
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = URL.createObjectURL(blob);
      link.download = `refos-venue-${eventId}-${result.source}-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      setNotice(result.source === "venue-server" ? "Exported the venue server's data for this event." : "The venue server was unreachable, so this device's copy was exported.");
    } catch (error) {
      setNotice(error?.message || "Export failed.");
    } finally {
      setBusy("");
    }
  };

  const connected = test ? test.ok : status.connected;
  const latency = test?.ok ? test.latencyMs : status.latencyMs;
  const mixed = mixedContentProblem(urlInput);
  const row = (label, value, tone = "") => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <b className={`text-right ${tone}`}>{value}</b>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="sync-status-title"
        className="bg-white dark:bg-slate-800 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="sync-status-title" className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Server size={18} /> Sync &amp; Venue Server</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">This device only{eventName ? ` · ${eventName}` : ""}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"><X size={22} /></button>
        </div>

        <div className="p-4 space-y-4 text-sm" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Sync mode</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { mode: "cloud", title: "Cloud", detail: "Supabase (default)", Icon: Cloud },
                { mode: "venue", title: "Local Venue Server", detail: "Venue network", Icon: Server },
              ].map(({ mode, title, detail, Icon }) => (
                <button key={mode} type="button" role="radio" aria-checked={cfg.mode === mode} onClick={() => chooseMode(mode)}
                  className={`rounded-xl border p-3 text-left flex items-center gap-3 ${cfg.mode === mode ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"}`}>
                  <span className={`h-5 w-5 rounded-full border-2 grid place-items-center shrink-0 ${cfg.mode === mode ? "border-blue-600" : "border-slate-300 dark:border-slate-500"}`}>{cfg.mode === mode && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}</span>
                  <Icon size={18} className="shrink-0 text-slate-500" />
                  <span className="min-w-0"><span className="block font-bold text-slate-900 dark:text-slate-100">{title}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{detail}</span></span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="venue-url" className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Server URL</label>
            <div className="mt-1 flex gap-2">
              <input id="venue-url" value={urlInput} onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); setTest(null); }} onBlur={() => urlInput && applyUrl()}
                inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={DEFAULT_VENUE_URL}
                className="min-w-0 flex-1 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {venue && <button type="button" onClick={saveUrl} className="px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold">Save</button>}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Host name or IP address and port, e.g. http://refos.local:8080 or http://192.168.1.50:8080. If .local names do not work on this network, use the IP address.</p>
            {urlError && <p className="text-xs text-red-600 mt-1">{urlError}</p>}
            {mixed && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>This page is loaded over https, so the browser will block an http:// venue server. Open Ref OS from the venue server's own address instead (for example {urlInput}).</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runTest} disabled={!!busy} className="flex-1 min-w-[9rem] py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              <Wifi size={16} /> {busy === "test" ? "Testing…" : "Test Connection"}
            </button>
            {venue && <button type="button" onClick={runSync} disabled={!!busy} className="flex-1 min-w-[9rem] py-2.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              <RefreshCw size={16} className={busy === "sync" ? "animate-spin" : ""} /> Sync Now
            </button>}
            {venue && <button type="button" onClick={runExport} disabled={!!busy} className="flex-1 min-w-[9rem] py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              <Download size={16} /> {busy === "export" ? "Exporting…" : "Export Venue Data"}
            </button>}
          </div>
          {notice && <p className="text-xs text-slate-600 dark:text-slate-300">{notice}</p>}
          {test && !test.ok && <p className="text-xs text-red-600">{test.error}</p>}

          <div className={`rounded-xl border p-3 ${venue && connected === false ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "border-slate-200 dark:border-slate-700"}`}>
            {venue && connected === false && <p className="mb-2 font-bold text-red-700 dark:text-red-300">Venue server disconnected. Changes are kept on this device and sync when it returns.</p>}
            {row("Mode", venue ? "Local Venue Server" : "Cloud")}
            {row("Server", venue || test ? (urlInput || cfg.serverUrl) : "Supabase")}
            {row("Connection", connected === true ? "Connected" : connected === false ? "Disconnected" : "Not checked", connected === true ? "text-emerald-600" : connected === false ? "text-red-600" : "text-slate-500")}
            {row("Latency", latency != null ? `${latency} ms` : "—")}
            {venue && row("Sync status", STATE_LABEL[status.state] || status.state, status.state === "error" || status.state === "offline" ? "text-red-600" : "")}
            {venue && row("Pending changes", String(status.pending), status.pending ? "text-amber-600" : "")}
            {venue && row("Last successful sync", ago(status.lastSuccessAt))}
            {venue && status.rejected > 0 && row("Rejected changes", `${status.rejected} (kept in export)`, "text-red-600")}
            {test?.ok && row("Server version", `${test.version} · API v${test.apiVersion}`)}
            {venue && status.lastError && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Last error: {status.lastError}</p>}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <p><b>Shared through the venue server:</b> violations (with photos kept on the venue server), field log entries (timeouts, field faults, replays, AWP checks, help requests, announcements), the volunteer roster, and who is online.</p>
            <p><b>Still needs Supabase / internet:</b> signing in, event setup and settings, access codes, Tournament Manager imports, teams and matches, judging, robot inspection photos, archive and deletion.</p>
            <p><b>Cloud copy:</b> venue data is not copied to Supabase automatically yet. Keep an Export Venue Data file after the event.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
