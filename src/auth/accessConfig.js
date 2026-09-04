export function latestRoleAccessConfig(entries) {
  const rows = (entries || [])
    .filter((e) => e.kind === "role_access_codes")
    .sort((a, b) => b.createdAt - a.createdAt);
  if (!rows[0]?.note) return { entry: rows[0] || null, config: { version: 1, codes: {} } };
  try {
    const parsed = JSON.parse(rows[0].note);
    return {
      entry: rows[0],
      config: parsed && typeof parsed === "object" ? parsed : { version: 1, codes: {} },
    };
  } catch {
    return { entry: rows[0], config: { version: 1, codes: {} } };
  }
}
