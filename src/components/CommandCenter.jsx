import React, {useState} from "react";
import { AlertTriangle, Archive, BarChart3, Bell, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Clock, CloudOff, Contact, Download, Flag, KeyRound, ListOrdered, Mail, MapPin, RefreshCw, Server, Settings, ShieldCheck, Trash2, Trophy, Users, Wifi, X } from "lucide-react";
import EventLogo from "./EventLogo.jsx";

const fmtTime = (ms) => ms ? new Date(ms).toLocaleString() : "—";

// Standard tool button (two per row on wider screens, one per row on phones).
const tool = "w-full min-h-[2.75rem] py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-sm text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700";
// A subtle labelled group of tools, separated by a divider (no extra card).
function ToolSection({ title, children, first = false, danger = false }) {
  return (
    <section aria-label={title} className={first ? "mt-4" : "mt-4 pt-4 border-t border-slate-200 dark:border-slate-700"}>
      <h3 className={`mb-2 text-[11px] font-bold uppercase tracking-wide ${danger ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

export default function CommandCenter({ extraTools, readinessTools, group:controlledGroup, onGroupChange, matches, viols, fieldLog, presence, roster, eventMembers = [], meName = "", onSetAdmin, alertStats, alertStatsLoading, onRefreshAlertStats, onResetAlertStats, onAlertDelivery, alertDeliveryLabel = "Push only", failedSyncItems = [], onRetryFailedSync, onDiscardFailedSync, countdown, countdownText, onCountdown, onClearCountdown, onOfflineTest, onAnnouncement, onDeleteAnnouncement, onClearAnnouncements, onContactDirectory, onRoleCodes, onPreEventTest, onTwoDeviceSyncTest, onDiagnosticReport, onTMSync, onVexSync, onExportViolations, onExportNominations, onExportEventReport, onBackupAll, onActivityFeed, onRankings, onAwpHistory, onClearData, onResetVolunteerSignIns, brand = null, onEventSettings, onEventManagement, onSyncStatus, syncModeLabel = "Cloud", league = null, onLeagueSessions, onClose }) {
  const [localGroup,setLocalGroup]=useState('');
  const group=controlledGroup??localGroup;
  const setGroup=onGroupChange||setLocalGroup;
  const accent = brand?.accent || "#0D0F32";
  const all = Object.values(matches);
  const replays = fieldLog.filter(e=>e.kind==="replay").length;
  const faults = fieldLog.filter(e=>e.kind==="field_fault").length;
  const announcementEntries = fieldLog.filter(e=>e.kind==="announcement").sort((a,b)=>b.createdAt-a.createdAt);
  const announcements = announcementEntries.length;
  const awps = fieldLog.filter(e=>e.kind==="awp").length;
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
  const volunteerStatus=(
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
                        <span className="text-xs text-slate-500 dark:text-slate-400">{memberForName(person.name)?.role === "admin" ? (memberForName(person.name)?.developer === true ? "Developer" : "Admin") : (person.role || memberForName(person.name)?.role)}</span>
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
                        {(memberForName(person.name)?.role || person.role) && <span className="text-xs text-slate-500 dark:text-slate-400">{memberForName(person.name)?.role === "admin" ? (memberForName(person.name)?.developer === true ? "Developer" : "Admin") : (person.role || memberForName(person.name)?.role)}</span>}
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
  );
  const groups={
    volunteers:{title:'Volunteer Access',icon:KeyRound,hint:'Access codes, roles, sign-ins and volunteer status'},
    sync:{title:'Event Data & Sync',icon:RefreshCw,hint:'VEX sync, Tournament Manager, imports and venue connections'},
    readiness:{title:'Event Readiness',icon:ClipboardCheck,hint:'Check this device, test syncing and prepare for the event'},
    reports:{title:'Backups & Reports',icon:Download,hint:'Download reports, save backups and view diagnostics'},
  };
  const action=(handler,label,Icon=ChevronRight,hint='')=>handler&&<button onClick={handler} className={tool}><Icon size={18} className="shrink-0"/><span className="flex-1"><span className="block">{label}</span>{hint&&<span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">{hint}</span>}</span></button>;
  if(groups[group])return <div className="fixed inset-0 z-[65] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col" role="dialog" aria-modal="true" aria-label={groups[group].title}>
    <header className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2 shrink-0" style={{paddingTop:'max(0.75rem,env(safe-area-inset-top))'}}>
      <button onClick={()=>setGroup('')} className="min-h-[44px] flex items-center gap-1 font-semibold"><ChevronLeft size={20}/>Back</button>
      <h2 className="font-bold flex-1">{groups[group].title}</h2><button onClick={onClose} className="min-h-[44px] min-w-[44px] grid place-items-center" aria-label="Close"><X size={22}/></button>
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto"><div className="max-w-2xl mx-auto p-4 space-y-4" style={{paddingBottom:'max(1rem,env(safe-area-inset-bottom))'}}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{groups[group].hint}</p>
      {group==='volunteers'&&<>
        {action(onRoleCodes,'Manage access codes',KeyRound,'Set or change the codes used by event volunteers.')}
        {volunteerStatus}
        {onResetVolunteerSignIns&&<section className="rounded-xl border border-red-200 dark:border-red-900 p-4"><h3 className="font-bold">Reset volunteer sign-ins</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Require volunteers to enter their profile again. Saved event data is kept.</p><button onClick={()=>{if(confirm("Sign out every volunteer and require everyone to enter their nickname, first name, and last name again? Teams, matches, violations, pictures, and event data will not be deleted."))onResetVolunteerSignIns();}} className={tool+' mt-3 text-red-700 dark:text-red-300'}><Users size={18}/>Reset Volunteer Sign Ins</button></section>}
      </>}
      {group==='sync'&&<>
        {action(onVexSync,'Sync everything',RefreshCw,'Import available VEX event data and keep it updated.')}
        {action(onTMSync,'Tournament Manager connection & imports',RefreshCw,'Connect with the Windows app or Chrome extension, or import TM files.')}
        {action(onSyncStatus,'Sync & Venue Server',Server,'Connection mode: '+syncModeLabel)}
      </>}
      {group==='readiness'&&<>
        <ol className="space-y-4">
          <li className="rounded-xl border border-slate-200 dark:border-slate-700 p-4"><h3 className="font-bold">1. Check this device</h3><p className="my-2 text-sm">Confirm saved information is available when this device goes offline.</p>{action(onOfflineTest,'Run offline readiness test',CloudOff)}</li>
          <li className="rounded-xl border border-slate-200 dark:border-slate-700 p-4"><h3 className="font-bold">2. Check the event</h3><p className="my-2 text-sm">Review event access, shared data and the pre-event checks.</p>{action(onPreEventTest,'Run pre-event system test',ClipboardCheck)}</li>
          <li className="rounded-xl border border-slate-200 dark:border-slate-700 p-4"><h3 className="font-bold">3. Check a second device</h3><p className="my-2 text-sm">Confirm that a test entry reaches another device.</p>{action(onTwoDeviceSyncTest,'Run two-device sync test',Wifi)}</li>
        </ol>
        {readinessTools}
      </>}
      {group==='reports'&&<>
        <section className="space-y-3"><h3 className="font-bold">Reports</h3>
          {action(onExportViolations,'Export Violations',Download)}
          {action(onExportNominations,'Export Nominations',Trophy)}
          {action(onExportEventReport,'Export Event Report',BarChart3)}
          {action(onDiagnosticReport,'Admin Diagnostics',ShieldCheck,'Review device, connection and event diagnostics.')}
        </section>
        <section className="space-y-3"><h3 className="font-bold">Backups</h3>{action(onBackupAll,'Backup All JSON',Download)}</section>
        {extraTools}
      </>}
    </div></div>
  </div>;
  return (
    <div className="fixed inset-0 z-[65] bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2"><BarChart3 size={20}/><div><h2 className="font-bold">Event Command Center</h2><p className="text-xs text-slate-400">Admin operations overview</p></div><button onClick={onClose} className="ml-auto"><X size={22}/></button></div>
      <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto p-4 space-y-3">
        {brand && (
          <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: brand.accent }} />
            <div className="p-3 flex items-center gap-3">
              <EventLogo src={brand.logo} fallback={brand.highlander ? "/logo.svg" : "/refos-logo.svg"} alt="" className="w-11 h-11 object-contain rounded-lg shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{brand.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{brand.shortName}</div>
              </div>
            </div>
          </div>
        )}
        {league && (
          <div className="bg-white dark:bg-slate-800 border rounded-xl p-3">
            <div className="text-[11px] uppercase text-slate-400 font-semibold">League</div>
            <div className="font-bold truncate">{league.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <CalendarDays size={14} className="text-slate-400" />
              <span className="font-semibold">{league.sessionName}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${league.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"}`}>{league.sessionStatus}</span>
              {league.date && <span className="text-xs text-slate-500 dark:text-slate-400">{league.date}</span>}
            </div>
            {!league.isActive && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{league.activeName ? `${league.activeName} is the Active session.` : "No session is Active."} The counts below are for {league.sessionName}.</p>}
          </div>
        )}
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
          <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[#D7212B]"/>
              <div className="font-bold text-sm">Event alert counter</div>
              <button onClick={onRefreshAlertStats} disabled={alertStatsLoading} className="ml-auto p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50" title="Refresh alert totals"><RefreshCw size={15} className={alertStatsLoading ? "animate-spin" : ""}/></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                ["Total sent", alertStats?.totalAlerts, Bell],
                ["Requests", alertStats?.requests, Users],
              ].map(([label, value, Icon]) => (
                <div key={label} className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5">
                  <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400"><Icon size={12}/>{label}</div>
                  <div className="text-xl font-bold mt-1">{alertStatsLoading && value == null ? "…" : (value ?? 0)}</div>
                </div>
              ))}
            </div>
            <button onClick={() => {
              if (confirm("Reset the event alert counter to zero? This only clears alert totals and cannot be undone.")) onResetAlertStats?.();
            }} disabled={alertStatsLoading} className="mt-2 w-full py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Trash2 size={15}/> Reset count</button>
          </div>
          <ToolSection title="Event Setup & Management" first>
            {onEventSettings && <button onClick={onEventSettings} className={tool}><Settings size={16}/> Event Setup &amp; Settings</button>}
            {Object.entries(groups).map(([key,item])=><button key={key} onClick={()=>setGroup(key)} className={tool}><item.icon size={18}/><span className="flex-1"><span className="block">{item.title}</span><span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-1">{item.hint}</span></span><ChevronRight size={18}/></button>)}
            {onEventManagement && <button onClick={onEventManagement} className={tool}><Archive size={16}/> Event Management</button>}
            {onLeagueSessions && <button onClick={onLeagueSessions} className={tool}><CalendarDays size={16}/> League Sessions</button>}
          </ToolSection>
          <ToolSection title="Event Operations">
            <button onClick={onContactDirectory} className={tool}><Contact size={16}/> Event Contact Directory</button>
            <button onClick={onRankings} className={tool}><BarChart3 size={16}/> Rankings</button>
            <button onClick={onActivityFeed} className={tool}><ListOrdered size={16}/> Activity Feed</button>
            {onAwpHistory && <button onClick={onAwpHistory} className={tool}><ClipboardCheck size={16}/> AWP History and Analytics</button>}
            {onAlertDelivery && <button onClick={onAlertDelivery} className={tool}><Mail size={16}/> Alert delivery <span className="ml-auto text-[10px] font-bold text-slate-400">{alertDeliveryLabel}</span></button>}
          </ToolSection>
          <ToolSection title="Danger Zone" danger>
            <button onClick={onClearData} className="sm:col-span-2 w-full min-h-[44px] py-2.5 px-3 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-semibold text-sm text-left flex items-center gap-2"><Trash2 size={16}/> Clear Event Data</button>
          </ToolSection>
        </div>
        <div className="bg-white dark:bg-slate-800 border rounded-xl p-4">
          <div className="font-bold flex items-center gap-2"><Flag size={17}/> Event activity</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">{onAwpHistory && <div>AWP checks <b className="float-right">{awps}</b></div>}<div>Announcements <b className="float-right">{announcements}</b></div></div>
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
              <button onClick={() => {
                if (confirm("Remove the Event Countdown for everyone?")) onClearCountdown();
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
              <button onClick={() => {
                if (confirm("Remove the Event Countdown for everyone?")) onClearCountdown();
              }} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-semibold text-sm">
                Remove
              </button>
            )}
          </div>
        </div>
      </div></div>
    </div>
  );
}



