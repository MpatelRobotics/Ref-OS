// Ref OS Venue Server storage (SQLite via Node's built-in node:sqlite).
//
// Tables
//   venue_events  one row per Ref OS event UUID this server has been paired with. Stores only a
//                 SHA-256 hash of the event's venue sync key (never the key, never access codes).
//   records       current state of each synchronized record (event-scoped).
//   changes       append-only change log; clients pull by seq. change_id makes writes idempotent.
//   devices       devices seen per event (id, label, last seen) for status/export.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const SCHEMA_VERSION = 1;

export function openStore(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, "refos-venue.sqlite");
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS venue_events (
      event_id      TEXT PRIMARY KEY,
      key_hash      TEXT NOT NULL,
      registered_at INTEGER NOT NULL,
      registered_by TEXT
    );
    CREATE TABLE IF NOT EXISTS records (
      event_id   TEXT NOT NULL,
      kind       TEXT NOT NULL,
      record_id  TEXT NOT NULL,
      data       TEXT NOT NULL,
      deleted    INTEGER NOT NULL DEFAULT 0,
      version    INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      updated_by TEXT,
      PRIMARY KEY (event_id, kind, record_id)
    );
    CREATE TABLE IF NOT EXISTS changes (
      seq        INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id   TEXT NOT NULL,
      change_id  TEXT NOT NULL,
      kind       TEXT NOT NULL,
      record_id  TEXT NOT NULL,
      op         TEXT NOT NULL,
      data       TEXT,
      version    INTEGER NOT NULL,
      status     TEXT NOT NULL,
      device_id  TEXT,
      client_ts  INTEGER,
      server_ts  INTEGER NOT NULL,
      UNIQUE (event_id, change_id)
    );
    CREATE INDEX IF NOT EXISTS changes_event_seq ON changes (event_id, seq);
    CREATE TABLE IF NOT EXISTS devices (
      event_id  TEXT NOT NULL,
      device_id TEXT NOT NULL,
      label     TEXT,
      last_seen INTEGER NOT NULL,
      PRIMARY KEY (event_id, device_id)
    );
  `);
  db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));

  const q = {
    getEvent: db.prepare("SELECT event_id, key_hash, registered_at FROM venue_events WHERE event_id = ?"),
    insertEvent: db.prepare("INSERT INTO venue_events(event_id, key_hash, registered_at, registered_by) VALUES (?, ?, ?, ?)"),
    deleteEvent: db.prepare("DELETE FROM venue_events WHERE event_id = ?"),
    listEvents: db.prepare(`SELECT e.event_id, e.registered_at,
        (SELECT COUNT(*) FROM records r WHERE r.event_id = e.event_id AND r.deleted = 0) AS records,
        (SELECT MAX(seq) FROM changes c WHERE c.event_id = e.event_id) AS latest_seq
      FROM venue_events e ORDER BY e.registered_at`),
    getRecord: db.prepare("SELECT data, deleted, version FROM records WHERE event_id = ? AND kind = ? AND record_id = ?"),
    upsertRecord: db.prepare(`INSERT INTO records(event_id, kind, record_id, data, deleted, version, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id, kind, record_id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted,
        version = excluded.version, updated_at = excluded.updated_at, updated_by = excluded.updated_by`),
    getChange: db.prepare("SELECT seq, status, version FROM changes WHERE event_id = ? AND change_id = ?"),
    insertChange: db.prepare(`INSERT INTO changes(event_id, change_id, kind, record_id, op, data, version, status, device_id, client_ts, server_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    changesSince: db.prepare(`SELECT seq, change_id, kind, record_id, op, data, version, status, device_id, server_ts
      FROM changes WHERE event_id = ? AND seq > ? AND status IN ('applied', 'applied_conflict') ORDER BY seq LIMIT ?`),
    latestSeq: db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM changes WHERE event_id = ?"),
    exportRecords: db.prepare("SELECT kind, record_id, data, deleted, version, updated_at, updated_by FROM records WHERE event_id = ? ORDER BY kind, updated_at"),
    countRecords: db.prepare("SELECT kind, COUNT(*) AS n FROM records WHERE event_id = ? AND deleted = 0 GROUP BY kind"),
    countChanges: db.prepare("SELECT COUNT(*) AS n FROM changes WHERE event_id = ?"),
    touchDevice: db.prepare(`INSERT INTO devices(event_id, device_id, label, last_seen) VALUES (?, ?, ?, ?)
      ON CONFLICT(event_id, device_id) DO UPDATE SET label = COALESCE(excluded.label, devices.label), last_seen = excluded.last_seen`),
    listDevices: db.prepare("SELECT device_id, label, last_seen FROM devices WHERE event_id = ? ORDER BY last_seen DESC"),
  };

  // Apply one validated change atomically. Returns { status, seq, version }.
  //   duplicate          the same change_id was already applied (retry): nothing new is stored
  //   unchanged          an upsert identical to the current record (e.g. a create retried with a
  //                      new change id): nothing new is stored
  //   applied            stored; other devices receive it
  //   applied_conflict   stored (last writer wins) but it was based on an older version
  //   rejected_deleted   an upsert for a record that was deleted: the deletion is kept
  function applyChange(eventId, deviceId, change, now) {
    const existingChange = q.getChange.get(eventId, change.changeId);
    if (existingChange) return { status: "duplicate", seq: existingChange.seq, version: existingChange.version };

    const current = q.getRecord.get(eventId, change.kind, change.recordId);
    const dataText = change.op === "upsert" ? JSON.stringify(change.data) : null;
    let status = "applied";
    let version = current ? current.version + 1 : 1;

    if (change.op === "upsert") {
      if (current && current.deleted) status = "rejected_deleted";
      else if (current && current.data === dataText) status = "unchanged";
      else if (current && Number.isInteger(change.baseVersion) && change.baseVersion < current.version) status = "applied_conflict";
    } else if (change.op === "delete") {
      if (!current) status = "applied"; // tombstone for a record this server never saw
      else if (current.deleted) status = "unchanged";
    }

    if (status === "rejected_deleted" || status === "unchanged") {
      // Record the outcome so a retry of the same change id is answered identically.
      const info = q.insertChange.run(eventId, change.changeId, change.kind, change.recordId, change.op, dataText,
        current.version, status, deviceId, change.clientTs ?? null, now);
      return { status, seq: Number(info.lastInsertRowid), version: current.version };
    }

    const storedData = change.op === "upsert" ? dataText : (current ? current.data : "{}");
    q.upsertRecord.run(eventId, change.kind, change.recordId, storedData, change.op === "delete" ? 1 : 0, version, now, deviceId);
    const info = q.insertChange.run(eventId, change.changeId, change.kind, change.recordId, change.op, dataText,
      version, status, deviceId, change.clientTs ?? null, now);
    return { status, seq: Number(info.lastInsertRowid), version };
  }

  return {
    file,
    db,
    getEvent: (eventId) => q.getEvent.get(eventId) || null,
    registerEvent(eventId, keyHash, deviceId, now) {
      q.insertEvent.run(eventId, keyHash, now, deviceId || null);
    },
    forgetEvent(eventId, purge = false) {
      db.exec("BEGIN");
      try {
        q.deleteEvent.run(eventId);
        if (purge) {
          db.prepare("DELETE FROM records WHERE event_id = ?").run(eventId);
          db.prepare("DELETE FROM changes WHERE event_id = ?").run(eventId);
          db.prepare("DELETE FROM devices WHERE event_id = ?").run(eventId);
        }
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    listEvents: () => q.listEvents.all(),
    applyChanges(eventId, deviceId, changes, now) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = changes.map((change) => ({ changeId: change.changeId, ...applyChange(eventId, deviceId, change, now) }));
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    changesSince(eventId, since, limit) {
      return q.changesSince.all(eventId, since, limit).map((row) => ({
        seq: row.seq, changeId: row.change_id, kind: row.kind, recordId: row.record_id, op: row.op,
        data: row.data ? JSON.parse(row.data) : null, version: row.version, deviceId: row.device_id, serverTs: row.server_ts,
      }));
    },
    latestSeq: (eventId) => q.latestSeq.get(eventId).seq,
    exportRecords: (eventId) => q.exportRecords.all(eventId),
    counts(eventId) {
      const byKind = Object.fromEntries(q.countRecords.all(eventId).map((r) => [r.kind, r.n]));
      return { records: byKind, changes: q.countChanges.get(eventId).n };
    },
    touchDevice: (eventId, deviceId, label, now) => q.touchDevice.run(eventId, deviceId, label || null, now),
    listDevices: (eventId) => q.listDevices.all(eventId),
    close: () => db.close(),
  };
}
