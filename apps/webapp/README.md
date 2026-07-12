# PulseBridge Webapp

A React + Vite dashboard for a running [PulseBridge server](../pulsebridge-server). It shows plugin states, view snapshots (with a dedicated crypto-ticker layout), and record counts, and updates live over the server's SSE stream.

Not part of the published package set — it's a local demo/visualization tool.

## Run

```bash
# 1. Start the server (from ../pulsebridge-server)
node dist/index.js pulsebridge.config.demo.json

# 2. Start the dashboard
npm install
npm run dev          # http://localhost:8080
```

Set a different server URL from the input in the header (persisted in `localStorage`), or point at a remote server. The server has open CORS, so any origin works.

## Stack

- **Vite 6** + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 4** (via `@tailwindcss/vite`, no config file)
- No router, no state library — a single dashboard view backed by one data hook (`useDashboard`)

The app calls the server directly from the browser (`fetch` + `EventSource`); the Vite dev server only serves the bundle. It polls every 15s as a fallback and reacts instantly to `view:updated` / `plugin:status-changed` SSE events.

## Build

```bash
npm run build        # type-checks then emits static assets to dist/
npm run preview      # serve the production build
```
