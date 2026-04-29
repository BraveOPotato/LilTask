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
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const roomId = url.pathname.slice(1); // /{roomId}

    if (!roomId || roomId.length < 4) {
      return new Response("Bad room ID", { status: 400, headers: CORS });
    }

    // GET — fetch latest state
    if (request.method === "GET") {
      const data = await env.TODO_KV.get(roomId, "arrayBuffer");
      if (!data) {
        return new Response(null, { status: 204, headers: CORS });
      }
      return new Response(data, {
        headers: { ...CORS, "Content-Type": "application/octet-stream" },
      });
    }

    // POST — merge update
    if (request.method === "POST") {
      const update = await request.arrayBuffer();
      const existing = await env.TODO_KV.get(roomId, "arrayBuffer");

      let merged;
      if (existing) {
        // Merge: concatenate updates — Yjs handles idempotent merge on client
        // For server-side merge we store all updates; client merges on load
        const combined = new Uint8Array(existing.byteLength + update.byteLength);
        combined.set(new Uint8Array(existing), 0);
        combined.set(new Uint8Array(update), existing.byteLength);
        merged = combined.buffer;
      } else {
        merged = update;
      }

      // Store with 30-day TTL
      await env.TODO_KV.put(roomId, merged, { expirationTtl: 60 * 60 * 24 * 30 });

      return new Response("OK", { headers: CORS });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS });
  },
};
