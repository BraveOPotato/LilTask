# LilTask

Collaborative todo lists with real-time sync. Works offline. Stays fast.

## What it is

A PWA todo app built around a custom CRDT — no Yjs, no heavy deps. Multiple people can edit the same list simultaneously and changes merge without conflicts.

Data syncs through a Cloudflare Worker backed by D1 (SQLite). When you're offline, everything still works; it syncs when you reconnect.

## Stack

- **Frontend** — vanilla JS + CSS, no framework
- **Sync** — Cloudflare Worker + D1
- **CRDT** — custom implementation (`crdt.mjs`)
- **Offline** — service worker caches static assets

## Setup

**Frontend** — just serve the static files. No build step.

**Backend (Cloudflare Worker):**

1. Create a D1 database named `liltask-db`
2. Run the migration:
   ```
   wrangler d1 execute liltask-db --file=migrations/0001_init.sql
   ```
3. Deploy the worker:
   ```
   wrangler deploy
   ```
4. Point `script.js` at your worker URL

## Features

- Real-time collaborative editing (CRDT-based)
- Offline-first with service worker
- Calendar view
- Multiple lists
- Themes
- Installable as PWA

## Sharing

Each list has a room ID. Share the URL and collaborators sync automatically via the worker.
