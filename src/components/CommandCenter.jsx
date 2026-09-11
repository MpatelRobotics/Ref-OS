import React from "react";
import { AlertTriangle, BarChart3, CalendarDays, ClipboardCheck, Clock, CloudOff, Contact, Download, Flag, Camera, KeyRound, ListOrdered, RefreshCw, ShieldCheck, Trash2, Trophy, Users, Wifi, X } from "lucide-react";

const fmtTime = (ms) => ms ? new Date(ms).toLocaleString() : "—";

export default function CommandCenter({ matches, viols, fieldLog, presence, roster, eventMembers = [], meName = "", onSetAdmin, deviceStatuses = [], currentDeviceId = "", failedSyncItems = [], onRetryFailedSync, onDiscardFailedSync, countdown, countdownText, onCountdown, onClearCountdown, onOfflineTest, onAnnouncement, onDeleteAnnouncement, onClearAnnouncements, onContactDirectory, onRoleCodes, onPreEventTest, onTwoDeviceSyncTest, onDiagnosticReport, onLiveFieldSetupCheck, onEventSetup, onTMSync, onExportViolations, onExportNominations, onExportEventReport, onBackupAll, onActivityFeed, onRankings, onClearData, onClose }) {
  const all = Object.values(matches);
  const replays = fieldLog.filter(e=>e.kind==="replay").length;
  const faults = fieldLog.filter(e=>e.kind==="field_fault").length;
  const announcementEntries = fieldLog.filter(e=>e.kind==="announcement").sort((a,b)=>b.createdAt-a.createdAt);
  const announcements = announcementEntries.length;
  const awps = fieldLog.filter(e=>e.kind==="awp").length;
  const [showDeviceSync, setShowDeviceSync] = React.useState(false);
  const presenceDeviceIds = new Set((presence || []).map((p) => p?.device_id).filter(Boolean));
  const livePresenceByDevice = new Map((presence || []).filter((p) => p?.device_id).map((p) => [p.device_id, p]));
  const mergedDevices = (() => {
    const map = new Map();
    for (const row of deviceStatuses || []) map.set(row.device_id, { ...row });
    for (const row of presence || []) {
      if (!row?.device_id) continue;
      map.set(row.device_id, { ...(map.get(row.device_id) || {}), ...row, lastSeen: Date.now() });
    }
    return [...map.values()].sort((a, b) => {
      const aLive = presenceDeviceIds.has(a.device_id) ? 1 : 0;
      const bLive = presenceDeviceIds.has(b.device_id) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return (b.lastSeen || b.last_seen ? new Date(b.lastSeen || b.last_seen).getTime() : 0) - (a.lastSeen || a.last_seen ? new Date(a.lastSeen || a.last_seen).getTime() : 0);
    });
  })();
  const syncAttentionCount = mergedDevices.filter((d) => {
    const live = presenceDeviceIds.has(d.device_id);
    return !live || d.cloud_reachable === false || Number(d.queued_writes || 0) > 0 || Number(d.failed_writes || 0) > 0;
  }).length;
  const ago = (value) => {
    const ms = typeof value === "number" ? value : (value ? new Date(value).getTime() : 0);
    if (!ms) return "Never";
    const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (sec < 10) return "Just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    return `${hr}h ago`;
  };
  const onlinePeople = Array.from(
    new Map((presence || []).filter((p) => p?.name).map((p) => [p.name, p])).values()
  ).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const onlineNames = new Set(onlinePeople.map((p) => p.name));
  const presenceForName = (name) => (presence || []).find((p) => String(p.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase());
  const memberForName = (name) => {
    const person = presenceForName(name);
    return eventMembers.find((m) =>
      (person?.user_id && m.user_id === person.user_id) ||
      String(m.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
    );
  };
  const adminButton = (name) => {
    const person = presenceForName(name);
    const member = memberForName(name) || (person?.user_id ? { user_id: person.user_id, role: String(person.role || "").toLowerCase() } : null);
    if (!onSetAdmin || !member || !onlineNames.has(name) || name === meName) return null;
    const isAdmin = member.role === "admin";
    return (
      <button
        onClick={() => {
          const verb = isAdmin ? "Remove Admin access from" : "Give Admin access to";
          if (confirm(`${verb} ${name}?`)) onSetAdmin(member, !isAdmin);
        }}
        className={`text-[11px] font-semibold px-2 py-1 rounded-lg border shrink-0 ${isAdmin ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}`}
      >
        {isAdmin ? "Remove Admin" : "Make Admin"}
      </button>
    );
  };
  return (
    <div className="fixed inset-0 z-[65] bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2"><BarChart3 size={20}/><div><h2 className="font-bold">Event Command Center</h2><p className="text-xs text-slate-400">Admin operations overview</p></div><button onClick={onClose} className="ml-auto"><X size={22}/></button></div>
      <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[["Matches",all.length],["Violations",viols.length],["Replays",replays],["Field faults",faults]].map(([l,v])=><div key={l} className="bg-white dark:bg-slate-800 border rounded-xl p-3"><div className="text-[11px] uppercase text-slate-400 font-semibold">{l}</div><div className="text-2xl font-bold">{v}</div></div>)}
        </div>
        {failedSyncItems.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-4">
            <div className="font-bold text-red-700 dark:text-red-300 flex items-center gap-2"><AlertTriangle size={17}/> Failed Sync Items <span className="ml-auto">{failedSyncItems.length}</span></div>
            <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">These writes were rejected by the server and were retained instead of being deleted.</p>
            <div className="space-y-2 mt-3">
              {failedSyncItems.map((item) => (
                <div key={item.failedId} className="rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 p-3">
                  <div className="text-sm font-semibold">{item.op?.kind || "Unknown write"}{item.op?.number ? ` · Team ${item.op.number}` : item.op?.row?.team ? ` · Team ${item.op.row.team}` : ""}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">{item.message}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => onRetryFailedSync?.(item.failedId)} className="flex-1 rounded-lg bg-slate-900 text-white py-2 text-xs font-bold">Retry</button>
                    <button onClick={() => onDiscardFailedSync?.(item.failedId)} className="flex-1 rounded-lg border border-red-300 text-red-700 dark:text-red-300 py-2 text-xs font-bold">Discard</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-slate-800 border rounded-xl p-4">
          <div className="font-bold flex items-center gap-2"><KeyRound size={17}/> Admin tools</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">These controls are only available in Admin mode.</p>
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            <button onClick={onContactDirectory} className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Contact size={16}/> Event Contact Directory</button>
            <button onClick={onRoleCodes} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><KeyRound size={16}/> Volunteer Access Codes</button>
            <button onClick={onPreEventTest} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><ClipboardCheck size={16}/> Pre Event System Test</button>
            <button onClick={onTwoDeviceSyncTest} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><Wifi size={16}/> Two Device Sync Test</button>
            <button onClick={onDiagnosticReport} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><ShieldCheck size={16}/> Admin Diagnostics</button>
            <button onClick={onLiveFieldSetupCheck} className="py-2.5 px-3 rounded-lg border border-amber-300 dark:border-amber-800 font-semibold text-sm text-left flex items-center gap-2"><Camera size={16}/> Live Field Setup Check <span className="ml-auto text-[10px] text-amber-600">TEST</span></button>
            <button onClick={onEventSetup} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><CalendarDays size={16}/> Event setup</button>
            <button onClick={onTMSync} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><RefreshCw size={16}/> TM Sync Center</button>
            <button onClick={onExportViolations} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><Download size={16}/> Export violations</button>
            <button onClick={onExportNominations} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><Trophy size={16}/> Export nominations</button>
            <button onClick={onExportEventReport} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><BarChart3 size={16}/> Export event report</button>
            <button onClick={onBackupAll} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><Download size={16}/> Backup all JSON</button>
            <button onClick={onActivityFeed} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><ListOrdered size={16}/> Activity feed</button>
            <button onClick={onRankings} className="py-2.5 px-3 rounded-lg border font-semibold text-sm text-left flex items-center gap-2"><BarChart3 size={16}/> Rankings</button>
          </div>
          <button onClick={onClearData} className="mt-2 w-full py-2.5 px-3 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-semibold text-sm text-left flex items-center gap-2"><Trash2 size={16}/> Clear event data</button>
        </div>
        <div className="bg-white dark:bg-slate-800 border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold flex items-center gap-2"><Wifi size={17}/> Device Sync Dashboard</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {mergedDevices.length} recent {mergedDevices.length === 1 ? "device" : "devices"} · {presenceDeviceIds.size} connected
                {syncAttentionCount > 0 ? ` · ${syncAttentionCount} need attention` : " · All healthy"}
              </div>
            </div>
            <button onClick={() => setShowDeviceSync((v) => !v)} className="shrink-0 py-2 px-3 rounded-lg border font-semibold text-sm">
              {showDeviceSync ? "Hide" : "Open"}
            </button>
          </div>

          {showDeviceSync && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{presenceDeviceIds.size}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Connected</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                  <div className="text-xl font-bold text-emerald-600">{Math.max(0, mergedDevices.length - syncAttentionCount)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Healthy</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                  <div className={`text-xl font-bold ${syncAttentionCount ? "text-amber-600" : "text-slate-400"}`}>{syncAttentionCount}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Attention</div>
                </div>
              </div>

              {mergedDevices.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">No device status has been reported yet.</div>
              ) : (
                <div className="space-y-2">
                  {mergedDevices.map((device) => {
                    const live = presenceDeviceIds.has(device.device_id);
                    const liveMeta = livePresenceByDevice.get(device.device_id) || {};
                    const queued = Number(liveMeta.queued_writes ?? device.queued_writes ?? 0);
                    const failed = Number(liveMeta.failed_writes ?? device.failed_writes ?? 0);
                    const cloudOk = liveMeta.cloud_reachable ?? device.cloud_reachable;
                    const isSyncing = !!(liveMeta.syncing ?? device.syncing);
                    const lastSync = liveMeta.last_synced_at ?? device.lastSyncedAt ?? device.last_synced_at;
                    const needsAttention = !live || cloudOk === false || queued > 0 || failed > 0;
                    const statusText = !live ? "Offline" : isSyncing ? "Syncing" : cloudOk === false ? "Cloud unavailable" : queued > 0 ? `${queued} queued` : failed > 0 ? `${failed} failed` : "Synced";
                    const dotClass = !live ? "bg-slate-400" : needsAttention ? "bg-amber-500" : "bg-emerald-500";
                    return (
                      <div key={device.device_id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">{device.name || liveMeta.name || "Unknown volunteer"}</span>
                              {device.device_id === currentDeviceId && <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">This device</span>}
                              <span className={`text-[11px] font-bold uppercase tracking-wide ${needsAttention ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>{statusText}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {liveMeta.device_label || device.device_label || "Unknown device"}
                              {(liveMeta.browser || device.browser) ? ` · ${liveMeta.browser || device.browser}` : ""}
                              {(liveMeta.display_mode || device.display_mode) ? ` · ${liveMeta.display_mode || device.display_mode}` : ""}
                              {(liveMeta.viewport || device.viewport) ? ` · ${liveMeta.viewport || device.viewport}` : ""}
                            </div>
                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs">
                              <div><span className="text-slate-400">Last sync</span> <b className="ml-1">{ago(lastSync)}</b></div>
                              <div><span className="text-slate-400">Queued</span> <b className={queued ? "ml-1 text-amber-600" : "ml-1"}>{queued}</b></div>
                              <div><span className="text-slate-400">Failed</span> <b className={failed ? "ml-1 text-red-600" : "ml-1"}>{failed}</b></div>
                              <div><span className="text-slate-400">Version</span> <b className="ml-1">v{liveMeta.app_version || device.app_version || "—"}</b></div>
                            </div>
                            {!live && <div className="mt-1 text-[11px] text-slate-400">Last seen {ago(device.lastSeen || device.last_seen)}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-[11px] text-slate-400">Offline devices show their last reported sync state. Queued changes created after a device loses its connection cannot be seen by another device until it reconnects.</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 border rounded-xl p-4">
          <div className="font-bold flex items-center gap-2"><Users size={17}/> Key Volunteer Status</div>
          <div className="mt-2 text-sm">{onlineNames.size} currently online · {(roster||[]).length} known volunteers</div>
          <div className="mt-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Online now</div>
            {onlinePeople.length > 0 ? (
              <div className="space-y-2">
                {onlinePeople.map((person) => (
                  <div key={person.name} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{person.name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {(memberForName(person.name)?.role || person.role) && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{memberForName(person.name)?.role === "admin" ? "Admin" : (person.role || memberForName(person.name)?.role)}</span>
                      )}
                      {adminButton(person.name)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">No volunteers are currently online.</div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Known volunteers</div>
            {(roster || []).length > 0 ? (
              <div className="space-y-2">
                {[...(roster || [])].sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""))).map((person) => {
                  const isOnline = onlineNames.has(person.name);
                  return (
                    <div key={person.id || person.name} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{person.name || "Unknown volunteer"}</span>
                      <div className="ml-auto flex items-center gap-2">
                        {(memberForName(person.name)?.role || person.role) && <span className="text-xs text-slate-500 dark:text-slate-400">{memberForName(person.name)?.role === "admin" ? "Admin" : (person.role || memberForName(person.name)?.role)}</span>}
                        <span className={`text-[11px] font-semibold ${isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                          {isOnline ? "ONLINE" : "OFFLINE"}
                        </span>
                        {isOnline && adminButton(person.name)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">No known volunteers yet.</div>
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border rounded-xl p-4">
          <div className="font-bold flex items-center gap-2"><Flag size={17}/> Event activity</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-sm"><div>AWP checks <b className="float-right">{awps}</b></div><div>Announcements <b className="float-right">{announcements}</b></div></div>
          <button onClick={onAnnouncement} className="mt-3 w-full py-2 rounded-lg border font-semibold text-sm">Send Key Volunteer Announcement</button>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Announcement management</div>
              {announcementEntries.length > 0 && (
                <button onClick={() => {
                  if (confirm("Delete all Key Volunteer Announcements for everyone?")) onClearAnnouncements();
                }} className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700">
                  Delete all
                </button>
              )}
            </div>
            {announcementEntries.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No announcements have been sent.</p>
            ) : (
              <div className="space-y-2">
                {announcementEntries.map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex gap-2 items-start">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{a.note}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{a.by ? `From ${a.by} · ` : ""}{fmtTime(a.createdAt)}</div>
                      </div>
                      <button onClick={() => {
                        if (confirm("Delete this Key Volunteer Announcement for everyone?")) onDeleteAnnouncement(a.id);
                      }} className="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete for everyone">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border rounded-xl p-4">
          <div className="flex items-center gap-2">
            <div className="font-bold flex items-center gap-2"><Clock size={17}/> Countdown management</div>
            {countdown && (
              <button onClick={async () => {
                if (!confirm("Remove the Event Countdown for everyone?")) return;
                try { await onClearCountdown(); } catch {}
              }} className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700">
                Remove countdown
              </button>
            )}
          </div>

          {countdown ? (
            <div className="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-3">
              <div className="text-[11px] uppercase tracking-wide font-bold text-indigo-600 dark:text-indigo-300">Active countdown</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{countdown.label}</div>
              <div className="font-mono text-xl font-bold text-indigo-800 dark:text-indigo-200 mt-1">{countdownText || "Complete"}</div>
              {countdown.target && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Target: {new Date(countdown.target).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">No countdown is currently set.</p>
          )}

          <div className="flex gap-2 mt-3">
            <button onClick={onCountdown} className="flex-1 py-2 rounded-lg border font-semibold text-sm">
              {countdown ? "Edit countdown" : "Set countdown"}
            </button>
            {countdown && (
              <button onClick={async () => {
                if (!confirm("Remove the Event Countdown for everyone?")) return;
                try { await onClearCountdown(); } catch {}
              }} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-semibold text-sm">
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border rounded-xl p-4">
          <div className="font-bold flex items-center gap-2"><CloudOff size={17}/> Offline readiness</div>
          <p className="text-sm text-slate-500 mt-2">Test this admin device before competition begins.</p>
          <button onClick={onOfflineTest} className="mt-3 w-full py-2 rounded-lg border font-semibold text-sm">Run offline readiness test</button>
        </div>
      </div></div>
    </div>
  );
}

