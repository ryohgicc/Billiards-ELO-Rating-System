# AGENTS.md

This file is the project-specific adapter for the reusable workflow in `docs/agent-workflow.md`.

Follow `docs/agent-workflow.md` for:
- Work modes.
- Agent workflow.
- Schema and migration safety.
- Universal code style and UI guidance.
- Git safety.
- Documentation, changelog, deployment, and final handoff rules.

When copying this setup into another project, copy `docs/agent-workflow.md` as the reusable baseline and rewrite this file with that project's profile, commands, risk areas, and local conventions.

## Project Profile

This project is a Next.js + TypeScript billiards Elo rating system. It serves static assets through Cloudflare Workers and stores shared app data in Cloudflare D1.

Core capabilities:
- Manage players.
- Record match winners and losers.
- Rebuild Elo rankings from match history.
- Share data across users through Cloudflare D1.
- Export/import JSON backups.

Important paths:
- UI pages: `src/app`
- Client views: `src/components`
- Shared client logic: `src/lib`
- Cloudflare Worker API: `worker/index.ts`
- D1 migrations: `migrations`
- Static export config: `next.config.ts`
- Cloudflare deployment config: `wrangler.jsonc`

Production shape:
- This is not a traditional Next.js server app in production.
- `next build` creates static files in `out`.
- Cloudflare Worker handles `/api/*` requests.

## Data And Source Of Truth

D1 tables:
- `players`: player identity, name, created time, active status.
- `matches`: winner, loser, created time.
- `settings`: simple key/value settings such as title and K factor.

Rules:
- Rankings are derived from history.
- Do not treat current rating as the source of truth.
- Rebuild rankings from `players` and `matches` using `src/lib/rating.ts`.
- Do not persist computed rankings unless the architecture is intentionally changed.

## Command Matrix

Install:

```bash
npm install
```

Develop:

```bash
npm run dev
```

Targeted checks:

```bash
npm test
npm run lint
npm run build
```

Full completion gate:

```bash
npm test
npm run lint
npm run build
npx wrangler deploy --dry-run
```

D1 migrations:

```bash
npx wrangler d1 migrations list billiards-elo-db --remote
npm run db:migrate:local
npm run db:migrate:remote
npx wrangler d1 migrations list billiards-elo-db --remote
```

Run remote migrations only when schema changes are ready for the production Cloudflare D1 database.

## Schema And Migration Safety

Schema-sensitive areas:
- `worker/index.ts`
- `src/lib/types.ts`
- validation logic
- import/export logic
- anything under `migrations/`

A Worker that reads a column or table before the remote D1 migration is applied can make `/api/state` fail with 500.

Project-specific migration sequence:

```bash
npx wrangler d1 migrations list billiards-elo-db --remote
npm run db:migrate:remote
npx wrangler d1 migrations list billiards-elo-db --remote
```

## Deployment Notes

Cloudflare settings:
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Current D1 binding:
- Binding: `DB`
- Database name: `billiards-elo-db`

If cloning for another Cloudflare account, update `database_id` in `wrangler.jsonc`.

## Code Style

- Keep TypeScript strict and explicit.
- Prefer small focused helpers in `src/lib`.
- Keep Worker API responses as `AppState` when mutations succeed.
- Validate both client-side and Worker-side inputs.

## UI Guidance

- The visual direction is a yellow-black billiards command-center interface.
- Preserve horizontal mobile navigation.
- Avoid oversized hero blocks on mobile.
- Use existing CSS variables in `src/app/globals.css`.
- Prefer lucide icons for navigation and action affordances.
