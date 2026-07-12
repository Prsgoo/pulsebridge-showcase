# PulseBridge Showcase

A real-world usage example of [PulseBridge](https://github.com/Prsgoo/pulsebridge): a
config-driven integration **server** that polls APIs, reacts to data, and serves
canonical views, plus a live React **dashboard** that visualizes it.

Deployed two ways: day-to-day on a home server, and as a public demo at
`pulsebridge.prsgoo.com`.

## Structure

Nx monorepo:

- `apps/server` — Hono + PulseBridge core; loads plugins from public npm, exposes
  `/health`, `/plugins`, `/views`, `/records`, and an SSE `/events` stream.
- `apps/webapp` — React 19 + Vite + Tailwind dashboard.
- `libs/api-types` — the shared HTTP API contract, imported by both apps.

## Commands

```bash
npm install
npm run build       # nx run-many -t build
npm run typecheck
npm run test
npm run lint
npm run dev:server
npm run dev:webapp
```
