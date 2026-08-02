# Dreams Coffee — POS Backend

Backend API for a single-terminal, dual-currency (LBP-native) point-of-sale system for a
coffee shop. Built with Next.js route handlers (no rendered frontend in this repo — the
actual POS terminal is a separate offline-first PWA that talks to this API and keeps its
own local IndexedDB store). The full intended behavior is specified in
[`Api Contract.yaml`](./Api%20Contract.yaml) (OpenAPI 3.0); this repo implements it
incrementally, and deliberate deviations are called out in code comments and in
[`docs/operations-checklist.md`](./docs/operations-checklist.md).

> **Note:** this project runs a customized build of Next.js with breaking changes from
> upstream. Read the relevant guide under `node_modules/next/dist/docs/` before making
> framework-level changes — see [`AGENTS.md`](./AGENTS.md).

## Tech stack

- **Next.js 16** (App Router, route handlers only — `src/app/api/**/route.ts`)
- **Prisma 7** + `@prisma/adapter-pg` against **PostgreSQL**
- **Zod** for request validation
- **Winston** for logging (`src/util/logger.ts`) — every request (`proxy.ts`), every
  route error (`handle-route-error.ts`), and every state-changing service call is logged
- **Jest** for unit/integration tests (repository, service, and route layers)
- **TypeScript**

## Features implemented

- **Auth**: manager login (username/password), admin login (shared secret), Manager
  Panel PIN gate, shift-session tokens
- **Shift sessions**: open a cashier shift, cash out (by id or a panel-only recovery
  path for whatever's currently open)
- **Catalog**: categories, products, size modifiers, recipes (ingredients per
  product+size, admin-authored)
- **People**: employees (cashiers), managers
- **Inventory**: items, pack configurations, deliveries (stock intake), physical count
  entries with a same-day edit lock
- **Config**: LBP/USD exchange rate
- **Offline sync**: connectivity heartbeat, batch order sync from the PWA's local
  IndexedDB store

## Order building lives on the frontend

Opening a basket, adding/editing/voiding line items, clearing it, and checkout all
happen client-side in the terminal PWA's local IndexedDB — not as backend endpoints.
The backend only ever sees an order once it's already resolved: `POST
/sync/records` accepts orders the frontend has completed (sales and refunds alike) and
persists them. There's no server-side "build the order" flow to call into, and no
void/refund/clear endpoints — those are frontend basket operations that either never
reach the server at all, or arrive pre-resolved as a finished sync record. See
`Api Contract.yaml`'s `Orders`/`Receipts`/`Refunds` tag descriptions for the original
target design this superseded.

## Not yet implemented

- `/reports/daily-sales` — live daily totals, described in `Api Contract.yaml` but no
  route exists yet.

## Architecture

**No RBAC — four fixed credential types**, each a header checked by `src/proxy.ts`
(Next.js middleware) before a route handler ever runs:

| Header | Issued by | Scope |
|---|---|---|
| `X-Manager-Token` | `POST /api/auth/manager/login` (username + password) | Admin-PC surface: inventory, deliveries, config, catalog writes |
| `X-Admin-Token` | `POST /api/auth/admin/login` (shared `ADMIN_SECRET_KEY`) | Manager provisioning, recipe authoring — never combined with a manager token |
| `X-Panel-Token` | `POST /api/auth/manager/pin/verify` (shared PIN) | Manager Panel on the terminal: open a shift, cash out. A static, non-expiring shared secret — the PIN check itself is the security boundary |
| `X-Session-Token` | `POST /api/shift-sessions` (issued on shift open) | "Is there an open, un-cashed-out shift on this terminal" — the whole check for a sale. Not a personal credential |

PIN verification is deliberately **public** (no prior token required): it's the only way
to obtain a panel token, and opening the first shift session of the day requires one, so
it can never itself require an active session without deadlocking. See `src/proxy.ts` for
the exact per-route gating logic and `docs/operations-checklist.md` for the reasoning
behind every deviation from `Api Contract.yaml`.

**Offline-first orders:** the terminal PWA builds and completes baskets entirely
client-side in local IndexedDB (including crash recovery of an in-progress basket) and
pushes finished orders to `POST /api/sync/records` once connectivity allows — see
**Order building lives on the frontend** above.

## Getting started

1. Copy `.env` and set:
   - `DATABASE_URL` — PostgreSQL connection string
   - `MANAGER_JWT_SECRET`, `ADMIN_JWT_SECRET`, `SESSION_JWT_SECRET` — HMAC signing secrets
   - `ADMIN_SECRET_KEY` — shared admin login secret
   - `PANEL_SECRET_KEY` — shared Manager Panel token (handed back verbatim on correct PIN)
2. Install dependencies and apply migrations:
   ```bash
   npm install
   npx prisma migrate deploy
   npx prisma db seed   # manual-testing data — see src/prisma/seed.ts for credentials/PIN
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
   API is served under `http://localhost:3000/api/*`.
4. Run tests:
   ```bash
   npm test
   ```

## Project structure

```
src/app/api/        route handlers (thin: parse → validate → call service → map errors)
src/services/       business logic; thin passthroughs unless noted otherwise
src/repository/     all Prisma access
src/types/          zod schemas + inferred types
src/lib/            auth/token helpers, shared route utilities
src/proxy.ts         auth middleware — the source of truth for what each route requires
src/util/logger.ts   winston logger — logs/*.log, plus console in development
src/prisma/          schema, migrations, seed script
docs/operations-checklist.md   manual test checklist + documented contract deviations
Api Contract.yaml    OpenAPI spec — target behavior for the full system
```

## Next steps

- Build `/reports/daily-sales`, per **Not yet implemented** above.
- **Analytics** — for both the backend (sales/inventory/session reporting endpoints) and
  the frontend (terminal- and admin-facing dashboards consuming them).
