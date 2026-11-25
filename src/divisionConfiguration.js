// Imported IDs stay stable so renaming never moves match or incident records.
export function mergeDivisions(saved = [], discovered = []) {
  const rows = new Map(saved.map(row => [Number(row.id), row]));
  for (const source of discovered) {
    const old = rows.get(Number(source.id));
    rows.set(Number(source.id), {...old, ...source,
      ...(source.name ? {name:source.name,customName:false} : {}),
      ...(old?.fieldNames ? {fieldNames: old.fieldNames, fieldCount: old.fieldCount} : {}),
    });
  }
  return [...rows.values()];
}
export function validateDivisions(rows) {
  if (!rows.length) throw Error('Keep at least one division.');
  const ids = new Set(), names = new Set();
  return rows.map(row => {
    const id = Number(row.id), name = String(row.name || '').trim();
    if (!Number.isSafeInteger(id) || id < 0 || ids.has(id)) throw Error('Each division needs a unique nonnegative ID.');
    if (!name || name.length > 100 || names.has(name.toLowerCase())) throw Error('Give each division a different name, up to 100 characters.');
    ids.add(id); names.add(name.toLowerCase());
    const fieldCount = Number(row.fieldCount ?? 3);
    if (![1,2,3].includes(fieldCount)) throw Error('Choose one, two, or three fields per division.');
    const fieldNames = {...row.fieldNames}, used = new Set();
    for (let n=1; n<=fieldCount; n++) {
      const key = `Field ${n}`, value = String(fieldNames[key] || '').trim();
      if (!value || value.length > 80 || used.has(value.toLowerCase())) throw Error(`${name}: give each active field a different name, up to 80 characters.`);
      used.add(value.toLowerCase()); fieldNames[key] = value;
    }
    return {...row, id, name, customName:true, fieldCount, fieldNames};
  });
}
// A synced schedule is authoritative; custom names are only a fallback.
export function divisionFieldNames(division, scheduled = []) {
  return scheduled.length ? {} : {...(division?.fieldNames || {})};
}
