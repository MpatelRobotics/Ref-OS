import React, { useState } from 'react';

export default function RobotCheckIn({ teams, checkIn, onOpen }) {
  const [filter, setFilter] = useState('all');
  const roster = new Map(teams.map(team => [team.number, team]));
  const rows = (checkIn?.rows || []).filter(row => roster.has(row.number)).map(row => ({ ...roster.get(row.number), checkedIn: row.checkedIn })).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  const checked = rows.filter(row => row.checkedIn === true).length;
  const visible = rows.filter(row => filter === 'all' || filter === 'checked' && row.checkedIn === true || filter === 'not-checked' && row.checkedIn === false || filter === 'unknown' && row.checkedIn == null);
  return <details className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
    <summary className="min-h-[44px] cursor-pointer p-4 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">TM check-in status <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{rows.length ? `· ${checked} of ${rows.length} checked in` : '· Waiting for TM sync'}</span></summary>
    <div className="px-4 pb-4">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">With TM sync running, check-in status refreshes every 5 seconds while Robots is open and visible on the connector device. Manage check-in in Tournament Manager.</p>
      {checkIn?.importedAt && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Last TM check-in update: {new Date(checkIn.importedAt).toLocaleString()}</p>}
      <label className="block mb-3 text-sm font-semibold">Show teams
        <select value={filter} onChange={event => setFilter(event.target.value)} className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2">
          <option value="all">All TM teams</option><option value="checked">Checked in</option><option value="not-checked">Not checked in</option><option value="unknown">Check-in unknown</option>
        </select>
      </label>
      {!rows.length ? <p className="text-sm text-slate-500">Connect TM and sync the selected division to load check-in status.</p> : !visible.length ? <p className="text-sm text-slate-500">No teams match this filter.</p> : <ul className="space-y-2">{visible.map(team => <li key={team.number}><button type="button" onClick={() => onOpen(team.number)} className="w-full min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">
        <span className="block font-semibold">{team.number} {team.name}</span>
        <span className={`block text-sm ${team.checkedIn === true ? 'text-emerald-700 dark:text-emerald-300' : team.checkedIn === false ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}`}>{team.checkedIn === true ? 'Checked in' : team.checkedIn === false ? 'Not checked in' : 'Check-in unknown'}</span>
      </button></li>)}</ul>}
    </div>
  </details>;
}
