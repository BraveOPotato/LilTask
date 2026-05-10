/**
 * Cloudflare Worker — CRDT Todo Sync (D1 backend)
 * Deploy: wrangler deploy
 *
 * D1 database: liltask_db (bind in wrangler.toml)
 * Schema (run once — see migrations/0001_init.sql):
 *
 *   CREATE TABLE IF NOT EXISTS room_updates (
 *     id         INTEGER PRIMARY KEY AUTOINCREMENT,
 *     room_id    TEXT    NOT NULL,
 *     update     BLOB    NOT NULL,
 *     created_at INTEGER NOT NULL DEFAULT (unixepoch())
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_room_updates_room_id
 *     ON room_updates(room_id);
 *
 * Protocol: each client update is stored as a separate BLOB row.
 * GET  /{roomId} — returns all updates as length-framed concatenated blob.
 * POST /{roomId} — appends one (framed or raw-legacy) update row.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function readU32(dv, offset) {
  return dv.getUint32(offset, false);
}

function writeU32(arr, offset, value) {
  arr[offset]     = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>>  8) & 0xff;
  arr[offset + 3] =  value         & 0xff;
}

function frameOne(update) {
  const framed = new Uint8Array(4 + update.byteLength);
  writeU32(framed, 0, update.byteLength);
  framed.set(update, 4);
  return framed;
}

function ensureFramed(bytes, buf) {
  if (buf.byteLength >= 4) {
    const dv = new DataView(buf);
    if (readU32(dv, 0) === buf.byteLength - 4) return bytes; // already framed
  }
  return frameOne(bytes);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url    = new URL(request.url);
    const roomId = url.pathname.slice(1);

    if (!roomId || roomId.length < 4 || roomId.length > 128 || roomId.includes('/') || roomId.includes('..')) {
      return new Response("Bad room ID", { status: 400, headers: CORS });
    }

    // ── GET — return all stored updates as one concatenated blob ──────
    if (request.method === "GET") {
      const { results } = await env.liltask_db.prepare(
        "SELECT update_data FROM room_updates WHERE room_id = ? ORDER BY id ASC"
      ).bind(roomId).all();

      if (!results || results.length === 0) {
        return new Response(null, { status: 204, headers: CORS });
      }

      const parts    = results.map(r => new Uint8Array(r.update_data));
      const totalLen = parts.reduce((s, p) => s + p.byteLength, 0);
      const out      = new Uint8Array(totalLen);
      let   offset   = 0;
      for (const p of parts) { out.set(p, offset); offset += p.byteLength; }

      return new Response(out.buffer, {
        headers: { ...CORS, "Content-Type": "application/octet-stream" },
      });
    }

    // ── POST — insert one update row ──────────────────────────────────
    if (request.method === "POST") {
      const incoming = await request.arrayBuffer();
      if (incoming.byteLength === 0) {
        return new Response("Empty body", { status: 400, headers: CORS });
      }

      const framed = ensureFramed(new Uint8Array(incoming), incoming);

      await env.liltask_db.prepare(
        "INSERT INTO room_updates (room_id, update_data) VALUES (?, ?)"
      ).bind(roomId, framed).run();

      return new Response("OK", { headers: CORS });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS });
  },
};
