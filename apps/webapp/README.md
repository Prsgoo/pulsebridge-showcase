# PulseBridge Webapp

A React + Vite dashboard for a running [PulseBridge server](../server). It shows plugin states, view snapshots (with a dedicated crypto-ticker layout), and record counts, and updates live over the server's SSE stream.

Not part of the published package set — it's a local demo/visualization tool.

## Run

```bash
# 1. Start the server (from ../server)
node dist/index.js pulsebridge.config.demo.json

# 2. Start the dashboard
npm install
npm run dev          # http://localhost:8080
```

## Configuration

The server URL the dashboard talks to is resolved at build time:

- **`VITE_API_URL`** (optional) — when set, the app targets this server. The Vercel demo build points it at the public demo server. Set it via a `.env` file (`VITE_API_URL=https://api-demo.prsgoo.com`) or the build environment.
- **Unset** (local dev) — defaults to the host the app is served from on port 3000, so hitting the machine's LAN/Tailscale IP from a phone targets that machine's server, not the phone.

The URL can still be overridden at runtime from the header input (persisted in `localStorage`). The server has open CORS by default.

## Stack

- **Vite 7** + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 4** (via `@tailwindcss/vite`, no config file)
- No router, no state library — a single dashboard view backed by one data hook (`useDashboard`)

The app calls the server directly from the browser (`fetch` + `EventSource`); the Vite dev server only serves the bundle. It polls every 15s as a fallback and reacts instantly to `view:updated` / `plugin:status-changed` SSE events.

## Build

```bash
npm run build        # type-checks then emits static assets to dist/
npm run preview      # serve the production build
```
