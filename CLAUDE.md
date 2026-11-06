# RailRadar

Livekarta över tåg i Sverige. `SPEC.md` är facit – uppdatera den när ett beslut ändras.

## Arbetssätt

- Committa eller pusha aldrig. Användaren granskar och committar själv. Push till `main` deployar.
- Större ändringar går via branch och PR, små fixar direkt till `main`.
- Jobba i milstolpar (se SPEC). Avsluta varje med typecheck, tester och en körning av appen, och lämna sedan över för granskning.

## Struktur

- `apps/api` – Express + TS. Körs med `tsx`. Migrationer i `apps/api/migrations/NNN_namn.sql` körs vid start.
- `apps/web` – React + Vite + Tailwind v4 (+ MapLibre). Vite proxar `/api` till `:3000`.
- `packages/shared` – zod-scheman och typer för SSE-payload och API-svar. Exporterar TS-källkod direkt (ingen build).
- `Dockerfile`, `docker-compose.yml`, `Caddyfile` – produktion av API:t (Oracle). `docker-compose.dev.yml` – bara Postgres för lokal utveckling. Frontend deployas av Vercel.

## Kommandon (Node 26, se `.nvmrc`)

- `npm run dev` – startar Postgres (docker), API och web
- `npm run typecheck` / `npm test` / `npm run lint` / `npm run format`
- `npm run db:down` – stoppa Postgres

## Kodstil

- Läsbart före kompakt: hellre några extra rader med tydliga if-satser än täta one-liners.
- Men inte uppblåst: inga onödiga abstraktioner eller spekulativ kod.
- Korta, beskrivande namn. Inga enbokstavsvariabler förutom etablerade (`e`, `i`). ESLint varnar.
- Prettier formaterar, ESLint lintar. Kör båda innan överlämning.

## Konventioner

- `.env` i repo-roten (läses av API:t). Se `.env.example`. Hemligheter aldrig i git eller frontend.
- Fel från API:t: `{ error: { code, message } }` via `HttpError`.
- Validera allt från Trafikverket med zod.
- Kod och kommentarer på engelska, UI-text på svenska.
