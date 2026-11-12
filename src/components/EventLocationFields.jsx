import React from 'react';
import { COUNTRIES } from '../geography.js';
import { US_STATES } from '../refereeLocations.js';

const field = 'mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900';
export default function EventLocationFields({ value, onChange, disabled }) {
  const { country, state } = value;
  return (
    <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium">Event country
        <select aria-label="Event country" className={field} value={country} onChange={event => onChange({ country: event.target.value, state: '' })}>
          <option value="">Choose country or territory</option>
          {COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">{country === 'US' ? 'Event state / district' : 'Event state / province / region'}
        {country === 'US' ? (
          <select aria-label="Event state / district" className={field} value={state} onChange={event => onChange({ country, state: event.target.value })}>
            <option value="">Choose state or district</option>
            {US_STATES.map(name => <option key={name}>{name}</option>)}
          </select>
        ) : (
          <input className={field} value={state} maxLength={80} onChange={event => onChange({ country, state: event.target.value })} placeholder="If applicable" />
        )}
      </label>
    </fieldset>
  );
}
