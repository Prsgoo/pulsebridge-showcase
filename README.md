# PulseBridge Showcase

> **Early development - not yet in alpha.** This is an active work-in-progress. APIs, configuration, and features are unstable and subject to change at any time.

A reference implementation of [PulseBridge](https://github.com/Prsgoo/pulsebridge): a config-driven integration server that loads plugins from npm, polls 20+ external APIs, reacts to data with a rule engine, and serves a real-time React dashboard.

## What it demonstrates

- **Config-driven setup** - plugins, polling intervals, and reactive rules are all declared in a single `pulsebridge.config.json`; the server loads and registers them at startup with no code changes
- **Live data aggregation** - weather, seismic activity, flight positions, cryptocurrency prices, stock quotes, news, wildfires, space data, CVEs, and more, all normalized to canonical records
- **Real-time push** - a server-sent events stream delivers view updates to the dashboard instantly as processors run; the webapp never polls
- **Reactive rules** - a declarative rule engine triggers outbound actions when views match conditions (current: significant earthquake detected → ntfy push notification, with deduplication)
- **Admin panel** - install, uninstall, enable, disable, and update plugins at runtime; provision API keys; trigger a graceful restart - all from the dashboard UI

## Structure

Nx monorepo:

- `apps/server` - Hono + PulseBridge core; loads plugins from public npm at startup, exposes a REST + SSE API, and runs the rule engine
- `apps/webapp` - React 19 + Vite + Tailwind dashboard; consumes the server API via SSE and REST
- `libs/api-types` - shared HTTP API contract and SSE event types, imported by both apps

## Server API

| Endpoint | Description |
| --- | --- |
| `GET /health` | Runtime health, plugin statuses, and core version |
| `GET /plugins` | All registered plugins with kind, version, and status |
| `GET /views` | List of available view names |
| `GET /views/:id` | Full view payload (supports `?limit=N`) |
| `GET /records/:type` | Raw canonical records by type |
| `GET /events` | SSE stream - plugin status changes and view updates |
| `POST /plugins/install` | Install a plugin package from npm (auth required) |
| `DELETE /plugins` | Uninstall a plugin (auth required) |
| `POST /plugins/update` | Update one or all plugins to latest (auth required) |
| `PUT /plugins/:id/secrets` | Provision secret values for a plugin (auth required) |
| `POST /plugins/:id/actions/:actionId` | Invoke an outbound action (auth required) |
| `POST /plugins/:id/webhook` | Receive an inbound webhook (plugin-verified) |
| `POST /restart` | Graceful shutdown for supervisor-managed restart (auth required) |

## Dashboard panels

- Weather feed - current conditions across multiple locations
- Crypto ticker - live price movement for configured coins
- Market quotes - stock prices for configured symbols
- Daily digest - combined weather + NASA APOD summary
- Seismic map - earthquake events plotted on a map
- Flight map - real-time aircraft positions
- Globe view - 3D globe with seismic, wildfire, and flight layers
- Wildfire map - NASA FIRMS active fire detections
- News feed - aggregated headlines from GDELT and RSS sources
- Source health panel - live status for every registered integration and processor
- Admin panel - plugin lifecycle management and secrets provisioning

## Plugins loaded

### Integrations

| Package | Data source |
| --- | --- |
| `@prsgoo/integration-openweather` | Current weather for configured cities |
| `@prsgoo/integration-coingecko` | Crypto prices |
| `@prsgoo/integration-finnhub-markets` | Stock quotes |
| `@prsgoo/integration-usgs-earthquakes` | Earthquake events (M2.5+) |
| `@prsgoo/integration-nasa-apod` | Astronomy Picture of the Day |
| `@prsgoo/integration-nasa-donki` | Solar and space weather events |
| `@prsgoo/integration-nasa-firms` | Active wildfire detections |
| `@prsgoo/integration-fred-economics` | Fed economic data series |
| `@prsgoo/integration-gdelt-news` | Global news event articles |
| `@prsgoo/integration-rss` | BBC News, The Guardian, Hacker News |
| `@prsgoo/integration-nvd-cve` | Critical and high-severity CVEs |
| `@prsgoo/integration-cloudflare-radar` | Internet anomalies and BGP events |
| `@prsgoo/integration-openaq-air` | Air quality measurements |
| `@prsgoo/integration-opensky` | ADS-B flight positions (OpenSky) |
| `@prsgoo/integration-adsbfi` | ADS-B flight positions (adsb.fi) |
| `@prsgoo/integration-airplaneslive` | ADS-B flight positions (AirplanesLive) |
| `@prsgoo/integration-open-elevation` | Terrain elevation queries (action) |
| `@prsgoo/integration-ntfy` | Push notification outbound actions |

### Processors

| Package | Output view |
| --- | --- |
| `@prsgoo/processor-weather-feed` | Per-location weather feed |
| `@prsgoo/processor-crypto-ticker` | Live crypto ticker with price movement |
| `@prsgoo/processor-daily-digest` | Combined weather and APOD digest |
| `@prsgoo/processor-seismic-feed` | Map-ready seismic event feed |
| `@prsgoo/processor-flight-feed` | Unified flight position feed |
| `@prsgoo/processor-news-feed` | Aggregated news feed |
| `@prsgoo/processor-wildfire-feed` | Unified wildfire detection feed |

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

## License

MIT
