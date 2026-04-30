/**
 * Cloudflare Worker — CRDT Todo Sync
 * Deploy: wrangler deploy
 * KV namespace: TODO_KV (bind in wrangler.toml)
 *
 * wrangler.toml example:
 * name = "todo-crdt-worker"
 * compatibility_date = "2024-01-01"
 * [[kv_namespaces]]
 * binding = "TODO_KV"
 * id = "YOUR_KV_NAMESPACE_ID"
 *
 * Protocol: updates stored as concatenated length-framed chunks.
 * Each chunk: [4-byte big-endian uint32 length][update bytes]
 * Client reads all chunks, merges with Y.mergeUpdates, applies once.
 * Client sends incremental diffs (not full state), also length-framed.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Read a 4-byte big-endian uint32 from a DataView at offset */
function readU32(dv, offset) {
  return dv.getUint32(offset, false);
}

/** Write a 4-byte big-endian uint32 into a Uint8Array at offset */
function writeU32(arr, offset, value) {
  arr[offset]     = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>>  8) & 0xff;
  arr[offset + 3] =  value         & 0xff;
}

/**
 * Parse length-framed buffer into array of Uint8Array updates.
 * Silently drops malformed trailing bytes.
 */
function parseFramed(buf) {
  const data = new Uint8Array(buf);
  const dv   = new DataView(buf);
  const updates = [];
  let offset = 0;
  while (offset + 4 <= data.byteLength) {
    const len = readU32(dv, offset);
    offset += 4;
    if (offset + len > data.byteLength) break; // truncated — drop
    if (len > 0) updates.push(data.slice(offset, offset + len));
    offset += len;
  }
  return updates;
}

/**
 * Frame a single update Uint8Array with a 4-byte length prefix.
 */
function frameOne(update) {
  const framed = new Uint8Array(4 + update.byteLength);
  writeU32(framed, 0, update.byteLength);
  framed.set(update, 4);
  return framed;
}

/**
 * Concatenate two ArrayBuffers.
 */
function concat(a, b) {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), a.byteLength);
  return out.buffer;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url    = new URL(request.url);
    const roomId = url.pathname.slice(1); // /{roomId}

    if (!roomId || roomId.length < 4) {
      return new Response("Bad room ID", { status: 400, headers: CORS });
    }

    // ── GET — return all stored framed updates ────────────────
    if (request.method === "GET") {
      const data = await env.TODO_KV.get(roomId, "arrayBuffer");
      if (!data || data.byteLength === 0) {
        return new Response(null, { status: 204, headers: CORS });
      }
      return new Response(data, {
        headers: { ...CORS, "Content-Type": "application/octet-stream" },
      });
    }

    // ── POST — append new framed update ──────────────────────
    if (request.method === "POST") {
      const incoming = await request.arrayBuffer();
      if (incoming.byteLength === 0) {
        return new Response("Empty body", { status: 400, headers: CORS });
      }

      const incomingBytes = new Uint8Array(incoming);

      // Detect whether the client sent a framed payload (has valid length prefix)
      // or a legacy raw update (old clients before this fix).
      let newFramed;
      if (incoming.byteLength >= 4) {
        const dv = new DataView(incoming);
        const claimedLen = readU32(dv, 0);
        if (claimedLen === incoming.byteLength - 4) {
          // Already framed by the client — store as-is
          newFramed = incomingBytes;
        } else {
          // Legacy raw update — wrap it in a frame
          newFramed = frameOne(incomingBytes);
        }
      } else {
        newFramed = frameOne(incomingBytes);
      }

      // Append to existing stored frames
      const existing = await env.TODO_KV.get(roomId, "arrayBuffer");
      const merged = existing
        ? concat(existing, newFramed.buffer)
        : newFramed.buffer;

      // Store with 30-day TTL
      await env.TODO_KV.put(roomId, merged, {
        expirationTtl: 60 * 60 * 24 * 30,
      });

      return new Response("OK", { headers: CORS });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS });
  },
};
