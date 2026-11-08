# RailRadar

Live map of trains in Sweden. `SPEC.md` describes the features, architecture and technical decisions. Update it when a larger decision changes.

## Workflow

- Never commit or push. The user reviews and commits. Pushing to `main` deploys.
- Larger changes go through a branch and PR, small fixes directly to `main`.
- Run typecheck, tests, lint, format and the app before handing over.

## Structure

- `apps/api`: Express + TS, run with `tsx`. Migrations in `apps/api/migrations/NNN_name.sql` run at startup.
- `apps/web`: React + Vite + Tailwind v4 + MapLibre. Vite proxies `/api` to `:3000`.
- `packages/shared`: zod schemas and types for the SSE payload and API responses. Exports TS source directly, with no build.
- `docker-compose.dev.yml`: Postgres for local development. `Dockerfile`, `docker-compose.yml` and `Caddyfile` are the API's production setup.

## Commands (Node 26, see `.nvmrc`)

- `npm run dev`: starts Postgres (docker), API and web
- `npm run typecheck` / `npm test` / `npm run lint` / `npm run format`
- `npm run db:down`: stops Postgres

## Code style

- Readable over compact: prefer a few extra lines with clear if statements to dense one-liners.
- No unnecessary abstractions or speculative code.
- Short, descriptive names. No single-letter variables except established ones (`e`, `i`).

## Conventions

- `.env` in the repo root is read by the API, see `.env.example`. Secrets never go in git or the frontend.
- API errors: `{ error: { code, message } }` via `HttpError`.
- Validate everything from Trafikverket with zod.
- Code, comments and docs in English, UI text in Swedish.
