# RailRadar – Spec

A mobile-first live map of trains in Sweden, built on the open API from Trafikverket, the Swedish Transport Administration. You explore the map freely, click a train and see where it is, where it's going and whether it's delayed.

Live at [railradar.se](https://www.railradar.se).

## Features

- **Live map:** every train that reports a position and has an advertised train number. Icons rotate with the direction of travel and update live.
- **Selected train:** the train's stations and the order it calls at them are drawn on the map.
- **Info panel:** origin and destination, status, delay, next station, stop list and deviations. Compact with swipe gestures on mobile, expanded on desktop.
- **Map:** light and dark mode that follow the system, a "my location" button, and the map view is remembered between visits.

Status and delay are read directly from Trafikverket's data. A train whose position is older than 2 minutes is dimmed, and after 30 minutes it is removed.

## Architecture

```
Trafikverket API ──SSE──▶ Backend (Node/Express, TS) ──SSE──▶ Frontend (React)
                           │  in-memory: latest state per train
                           ▼
                        Postgres (stations)
```

Monorepo with npm workspaces:

- `apps/api`: Express and TypeScript.
- `apps/web`: React, Vite, Tailwind and MapLibre GL.
- `packages/shared`: zod schemas and types for the stream and API responses, shared by both.

## Technical decisions

- **One stream in, one stream out.** The backend holds a single SSE subscription to Trafikverket and fans the data out to all clients, so the number of visitors doesn't affect the calls to Trafikverket.
- **Train state lives in memory.** Only the latest state is needed, and after a restart it is rebuilt with a regular query followed by the stream.
- **Postgres is only used for stations.** They are synced once a day, so the API doesn't depend on Trafikverket at startup.
- **Small payloads.** A client first gets a snapshot and then only the changed trains every two seconds, with short keys to save mobile data.
- **Reconnection on both sides.** Backend and frontend both detect dropped and silent streams and reconnect with backoff. The map shows a notice if the connection stays lost.
- **Train data is decoupled from the map.** The data lives in its own store that knows nothing about the map, and all map code is kept together so that style and icons can be changed in one place.
- **Colors as tokens.** All colors, including the map's, are semantic OKLCH variables in `index.css`. Recurring UI becomes React components with Tailwind classes.
- **All external data is validated.** Responses from Trafikverket are parsed with zod and tested against recorded responses.

## Deployment

- **Frontend:** Vercel, at `www.railradar.se`.
- **Backend:** a free Oracle Cloud VM running `api`, `postgres` and `caddy` with Docker Compose. Caddy handles HTTPS for `api.railradar.se`.
- **CI/CD:** GitHub Actions runs typecheck, tests, lint and format checks on pull requests and on push to `main`. If they pass, the API is deployed over SSH, and Vercel deploys the frontend.
- **Secrets:** the API key and database password exist only in `.env` on the server, never in the frontend or in git.

## API

| Method | Endpoint          | Description                                             |
| ------ | ----------------- | ------------------------------------------------------- |
| GET    | `/api/health`     | Status of the server, database and Trafikverket stream  |
| GET    | `/api/stream`     | SSE events: `snapshot`, `update`, `remove`, `heartbeat` |
| GET    | `/api/trains/:id` | Details for the info panel                              |

Errors are returned as `{ "error": { "code": "...", "message": "..." } }`.

## Future ideas

- Search by train number and station, with departures and arrivals per station
- Position history with a speed graph
- Smooth movement and route lines along the rails, using a custom track graph from OSM
- Disruption information from Trafikverket and highlighting of likely disruptions
- Accounts, saved trains and delay notifications
