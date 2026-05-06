# AGENTS.md

## Project Overview

This is a Next.js + TypeScript billiards Elo rating system. It serves static assets through Cloudflare Workers and stores shared app data in Cloudflare D1.

Core capabilities:
- Manage players.
- Record match winners and losers.
- Rebuild Elo rankings from match history.
- Share data across users through Cloudflare D1.
- Export/import JSON backups.

## Important Architecture

- UI pages live under `src/app`.
- Client views live under `src/components`.
- Shared client logic lives under `src/lib`.
- Cloudflare Worker API lives in `worker/index.ts`.
- D1 migrations live in `migrations`.
- Static export is enabled in `next.config.ts`.
- Cloudflare deployment is configured in `wrangler.jsonc`.

The app is not a traditional Next.js server app in production. `next build` creates static files in `out`, and Cloudflare Worker handles `/api/*` requests.

## Data Model

D1 tables:
- `players`: player identity, name, created time, active status.
- `matches`: winner, loser, created time.
- `settings`: simple key/value settings such as title and K factor.

The ranking is derived from history. Do not treat current rating as the source of truth. Rebuild rankings from `players` and `matches` using `src/lib/rating.ts`.

## Development Commands

Use these commands before claiming work is complete:

```bash
npm test
npm run lint
npm run build
npx wrangler deploy --dry-run
```

D1 migrations:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

Run the remote migration only when schema changes are ready for the production Cloudflare D1 database.

## Deployment Notes

Cloudflare settings should be:
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

The current D1 binding is:
- Binding: `DB`
- Database name: `billiards-elo-db`

If cloning for another Cloudflare account, update `database_id` in `wrangler.jsonc`.

## Code Style

- Keep TypeScript strict and explicit.
- Prefer small focused helpers in `src/lib`.
- Keep Worker API responses as `AppState` when mutations succeed.
- Validate both client-side and Worker-side inputs.
- Do not persist computed rankings to D1 unless the architecture is intentionally changed.
- Avoid unrelated refactors when making feature changes.
- Whenever code is changed, also update the changelog and README to reflect the change before claiming the work is complete.

## UI Guidance

The visual direction is a yellow-black billiards command-center interface.

When editing UI:
- Keep mobile dense and fast to scan.
- Preserve horizontal mobile navigation.
- Avoid oversized hero blocks on mobile.
- Use existing CSS variables in `src/app/globals.css`.
- Prefer lucide icons for navigation and action affordances.

## Git Safety

This repo may have user or agent work in progress. Before editing or committing:

```bash
git status -sb
```

Never revert unrelated changes. If committing, stage only files that belong to the current task.
