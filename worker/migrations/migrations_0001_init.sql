-- LilTask D1 schema
-- Run: wrangler d1 execute liltask-db --file=migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS room_updates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     TEXT    NOT NULL,
  update_data BLOB    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_room_updates_room_id
  ON room_updates(room_id);
