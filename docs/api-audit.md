# API implementation audit

## Full re-audit — race condition and dead seed credentials found and fixed

Went through every layer again from scratch: all 21 route handlers, all 9 repositories, all
10 services, all 10 zod schemas, `proxy.ts` against the contract's full security matrix,
`Api Contract.yaml` for dangling refs, the Prisma schema/migration/DB three-way sync, and a
security sweep (secrets, raw SQL surface, timing-safe comparisons, `npm audit`). Two real
bugs found and fixed; everything else re-verified clean.

### 10. Race condition: concurrent inventory counts for the same item could 500 instead of 409
`InventoryCountEntryRepository.createEntry` checked for an existing entry
(`item_id` + current business date) and then called `create` with no transaction and no
`catch` around the create call. Two requests arriving close together for the same item on
the same business date could both pass the "does one exist" check before either had
written its row — the loser's `create()` then hit the DB's own
`@@unique([item_id, entry_date])` constraint and threw a raw `PrismaClientKnownRequestError`
(P2002) that nothing downstream recognized, falling through to a generic 500 instead of the
409 + `count_id` this endpoint exists to return.

**Fix:** wrapped the `create()` call in a `try/catch`; on a unique-constraint hit, it now
re-reads the row that won the race and throws `DuplicateCountEntryException` with that
row's `count_id`, same as the pre-check path. Added a test that simulates the race (pre-check
sees nothing, `create` rejects with P2002, repository recovers the winning row).

### 11. Seed script wrote non-functional password hashes — seeded managers could never log in
`src/prisma/seed.ts` set `password_hash: "admin"` for the `admin` manager and
`password_hash: "$2b$10$examplehashedpassword1"` for `rghosn` — plain/placeholder strings,
not `hashPassword()` output. `verifyPassword` splits the stored value on `:`; neither string
contains one, so `salt`/`hash` come back `undefined` and it returns `false` unconditionally
— **no password would ever have logged either seeded manager in**, silently. This predates
the login endpoint (the seed script was written before manager auth existed), so it was
never previously exercised end-to-end.

**Fix:** both now go through the real `hashPassword()`. Seeded credentials for manual
testing: `admin` / `Admin123!` and `rghosn` / `Shift123!`. Not re-run against the live DB as
part of this audit — the seed script deletes and recreates everything, so applying it is
your call, not something to do silently mid-audit.

### Everything else re-verified, no drift found
- **Routes:** all 15 write routes still use `parseJsonBody` (survived the business-day
  revert cleanly); every dynamic route still validates path params via `parseIdParam`; every
  query param is validated before use; response envelopes and status codes unchanged.
- **Repositories/services:** exception mapping (`Unique`/`NotFound`/`BadRequest` →
  409/404/400) intact everywhere; services remain thin delegation with no logic drift.
- **Zod schemas:** all 10 still match the contract's field constraints and enum values;
  `PasswordSchema`'s unanchored lookahead regex was checked by hand — functionally correct
  despite lacking `^`/`$`, since a match at position 0 is strictly the best case and the
  string is otherwise rejected by `.min(8)` if empty.
- **Auth:** cross-checked all 36 built operations against `proxy.ts` again — still an exact
  match, no gaps either direction. Added a standalone `tests/types/manager-login.test.ts`
  (previously only covered indirectly through the route test) that also documents that
  login intentionally does *not* enforce the password complexity policy — that's a
  create/update-only rule.
- **Contract:** parses cleanly, 25 schemas / 36 paths / 0 dangling `$ref`s — fully back to
  its pre-business-day state as expected.
- **Prisma:** schema, the 2 remaining migrations, and the live DB are in sync;
  `migrate status` clean; generated client matches current schema exactly.
- **Security:** `.env*` gitignored and untracked; no `$queryRaw`/`$executeRawUnsafe` usage
  anywhere in application code (only in Prisma's own generated type definitions); no
  `eval`/`child_process`; `verifyPassword`/`verifyManagerToken` both short-circuit before
  calling `timingSafeEqual` only when buffer lengths are already guaranteed equal by
  construction, so there's no exploitable timing gap; `npm audit` reports 0 vulnerabilities.

Final state: 399/399 tests passing (up from 392), `tsc --noEmit` clean, `eslint` clean.

## Business date: simplified to a pure timezone calculation

A manual open/close `BusinessDay` table (with its own migration and three endpoints) was
built and then deliberately scrapped in favor of something much simpler, per your
direction: `src/lib/business-date.ts` — `getCurrentBusinessDate()` is a pure function with
no DB table, no migration. It returns today's calendar date in whatever timezone
`BUSINESS_TIMEZONE` is set to (falls back to `Asia/Beirut` if unset), computed fresh on
every call via `Intl.DateTimeFormat`. `InventoryCountEntryRepository` uses it in place of
the old UTC-midnight `startOfToday()`. `Delivery.date_received` remains client-supplied,
unchanged. Set `BUSINESS_TIMEZONE` to any IANA zone name to run this in a different
timezone with no code change.

## Fresh audit — malformed body handling and auth coverage re-verified

Re-audited the whole app end to end: every route handler, every repository/service,
auth coverage against the contract, and the Prisma schema. Two real bugs found and fixed;
everything else checked out.

### 8. Critical: every POST/PATCH/PUT route parsed `req.json()` outside its `try/catch`
This was the exact bug from the very start of this project ("i sent empty json" → 500
crash), but it turned out the original fix only wrapped the *service call* in `try/catch`
— `const body = await req.json();` was left outside it in the Category route, and every
route built afterward copied that same shape. Confirmed empirically:
```
new NextRequest(url, { method: "POST", body: "" }).json()
// throws SyntaxError: Unexpected end of JSON input — uncaught, in all 15 routes
```
An empty body, a truncated request, or a non-JSON payload on **any** write endpoint
(`Category`, `Product`, `Employee`, `Manager`, `Supplier`, `InventoryItem`,
`InventoryCountEntry`, `Delivery`, `ExchangeRate` PUT, manager login) produced a 500
(or Next's unhandled-rejection crash) instead of a clean 400.

**Fix:** added `src/lib/parse-json-body.ts` — `parseJsonBody(req)` mirrors the existing
`validateBody` result shape (`{success, data} | {success: false, response}`) and catches
the parse failure as a 400 `"Invalid JSON body"`. Applied to all 15 routes, ahead of the
existing `validateBody` call. Added a "malformed JSON body → 400" test to every one of
those routes' test files, plus a standalone unit test for the helper.

### 9. `Delivery.date_received` had no format validation on the write path
`DeliveryCreateSchema.date_received` was a bare `z.string()` — unlike the GET query-string
version of the same field, which already went through `parseDateParam`. An invalid date
string in the POST body (e.g. `"not-a-date"`) reached `new Date(...)` in
`DeliveryRepository.createDelivery` and then Prisma, and `new Date("not-a-date")` throws
`RangeError: Invalid time value` the moment anything tries to serialize it — uncaught,
so this also surfaced as a 500 instead of 400. `InventoryCountEntry` has no equivalent
gap since its `entry_date` is server-set, never client-supplied.

**Fix:** the POST `/deliveries` route now calls `parseDateParam(validation.data.date_received,
"date_received")` right after resolving `managerId`, before calling the service — same
boundary-validation pattern already used for the GET query param. Added a test case.

### Auth coverage re-verified against the contract (no gaps found)
Cross-checked every implemented route's method+path against the contract's `security`
field for all 36 built operations, and against `src/proxy.ts`'s allowlist:
- Every `managerToken`-marked operation in the contract is gated by the proxy (no token →
  401, invalid/expired token → 401, deactivated manager → 401).
- Every operation the contract leaves with no security requirement (`GET /categories`,
  `GET /categories/{id}/products`, `GET /products/{id}/sizes`, `GET /products/{id}/recipe`,
  `GET /config/exchange-rate`, `POST /auth/manager/login`) is in the proxy's public
  allowlist and nowhere else.
- No route exists that the contract protects but the proxy leaves open, and no route is
  gated that the contract leaves open.
This matches manual testing: catalog browsing (`GET /categories`, product sizes/recipe)
works with no token; everything else (`Employee`, `Manager`, `Supplier`, `InventoryItem`,
`InventoryCountEntry`, `Delivery`, all writes) requires a valid manager token first.

### Orders/Refunds — confirmed still out of scope, not a bug
`Order`/`OrderLineItem` already exist in `schema.prisma` (`transaction_type: sale | refund`,
`total_due` negative for refunds, `order_type` null for refunds — the schema already
models "a refund is an order with a negative total and no dine-in/take-out type," matching
how it was described). But no repository/service/controller was ever built for
`/orders`, `/orders/{id}/*`, `/shift-sessions`, `/reports/daily-sales`, `/sync/*`, or
`/auth/manager/pin/verify` — this was flagged as out of scope in the original audit and
still is. Hitting any of those routes 404s (no handler registered), which is expected,
not a misconfiguration.

### Minor: orphaned `TerminalUnlockSession` table
The contract's terminal-unlock concept was removed per your direction, but the
`TerminalUnlockSession` Prisma model (and its migration) is still in `schema.prisma` —
nothing references it anymore. Harmless (unused table), but worth dropping next time a
migration touches this area, rather than now as a standalone destructive change.

## Update: manager auth landed

The two items below that depended on "once manager auth exists" are now resolved:

- **`manager_id` workaround (Contract compliance notes, item 1)** — resolved. `POST
  /api/auth/manager/login` (`src/app/api/auth/manager/login/route.ts`) verifies
  username/password and issues a signed manager token (`src/lib/jwt.ts` — HMAC-SHA256,
  stateless, no new table). `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`; it
  always runs in the Node.js runtime now, so it can call Prisma directly) verifies
  `X-Manager-Token` on every managerToken-gated route from the contract, confirms the manager
  is still active, and forwards `X-Manager-Id` downstream. `manager_id` has been removed from
  the `InventoryCountEntryCreateSchema`/`DeliveryCreateSchema` request bodies entirely —
  `InventoryCountEntryService.createEntry`/`DeliveryService.createDelivery` now take it as a
  separate `managerId` argument read from the verified header (`src/lib/get-manager-id.ts`),
  not a client-supplied claim.
- **Manager password policy (Contract compliance notes, item 3)** — resolved. `PasswordSchema`
  in `src/types/manager.ts` now requires 8+ characters with at least one uppercase, one
  lowercase, one digit, and one symbol.

Also: the contract's separate "terminal unlocked today" check (`TerminalUnlockSession`, the
`423 TerminalLocked` responses) has been removed from `Api Contract.yaml` at the user's
direction — holding a valid `manager_token` now *is* what "the terminal is unlocked" means,
serving both the POS interface and the manager-admin interface through the same credential.
The PIN-gated Manager Panel (`panelToken`) and the cashier's active-cash-session check
(`activeSession`/`shift_session`) are untouched — those are still separate, unbuilt concerns.

The routes that were already gated only by the contract's `managerToken` requirement
(Category/Product writes, Employee, Manager, Supplier, InventoryItem, exchange-rate PUT) needed
no code changes beyond the proxy itself — they never took `manager_id` in the body, so there
was nothing to remove.


Scope: every resource built out from `Api Contract.yaml` this branch — Category, Product,
Employee, Manager, Supplier, InventoryItem, InventoryCountEntry, Delivery, ExchangeRate.
Reviewed layer by layer (types/zod → repository → service → controller) against the contract
and against each other for consistency. Auth-dependent resources (Auth, Shift Sessions, Orders,
Refunds, Receipts, Reports, Sync) are out of scope — they were never built (see main thread for
why).

Status legend: **Fixed** = changed in this pass. **Noted** = flagged here, not changed (judgment
call, needs your call). **OK** = checked, no issue.

## Bugs found and fixed

### 1. Path params weren't validated — malformed IDs returned 500 instead of 400
Every dynamic route did `Number(product_id)` etc. straight into the service call. A non-numeric
segment (`GET /api/products/abc`) produces `NaN`, which isn't caught by `isNotFoundError` /
`isUniqueConstraintError` (those only match Prisma's `P2025`/`P2002` codes), so it fell through
to `handleRouteError`'s generic 500 branch instead of a clean `400`.

**Fix:** added `src/lib/parse-id-param.ts` — `parseIdParam(value, label)` throws
`BadRequestException` for non-integer input. Applied to every numeric path param: `category_id`,
`product_id` (all three routes), `pos_id`, `manager_id`, `supplier_id`, `item_id`. UUID path
params (`delivery_id`, `count_id`) don't need it — any string is a syntactically valid UUID
lookup key, a bad one just legitimately 404s.

### 2. List/query-param GET handlers had no error handling at all
`GET /categories`, `/employees`, `/managers`, `/suppliers`, `/inventory-items`,
`/inventory-count-entries`, `/deliveries` called the service directly with no `try/catch`. Any
unexpected failure (bad query param reaching Prisma, DB hiccup) would propagate as an unhandled
rejection instead of our `{error: "..."}` JSON shape — worse than the 500 case above, since
Next's own error handling takes over instead of ours.

**Fix:** wrapped all of them in `try/catch` → `handleRouteError`, matching every other handler.

### 3. Query params reached Prisma unvalidated
- `count_frequency` on `/inventory-items` was cast straight through (`as CountFrequency`) with
  no check it's actually `"daily" | "monthly"` — an invalid value would only fail once it hit
  Postgres.
- `entry_date` (`/inventory-count-entries`) and `date_received` (`/deliveries`) were passed to
  `new Date(str)` with no validity check — a malformed date silently becomes `Invalid Date` and
  fails inside Prisma instead of at the boundary.

**Fix:** both now validate at the route boundary and return `400` via `BadRequestException`
before reaching the repository.

### 4. `manager_id` wasn't checked against the `Manager` table
`InventoryCountEntry.manager_id` and `Delivery.manager_id` are `manager_id` (see [notes on the
missing auth](#manager_id-and-supplier-vs-category-id-validation) below) that are real foreign
keys per the Prisma schema, but only `Delivery`'s `supplier_id` and `Product`'s `category_id`
were pre-validated for existence. An unknown `manager_id` would hit Postgres's FK constraint
(uncaught `P2003`) and surface as a bare 500.

**Fix:** both repositories now check the manager exists first and throw `BadRequestException`
("Invalid manager_id"), consistent with how `category_id`/`supplier_id` are already handled.

### 5. Empty-body validation errors had a stray leading `": "`
`ProductUpdateSchema`, `EmployeeUpdateSchema`, `ManagerUpdateSchema` all use
`.refine(data => Object.keys(data).length > 0, ...)` for "at least one field required". Zod
gives refine issues an empty `path: []`, and `validateBody` unconditionally did
`` `${issue.path.join(".")}: ${issue.message}` ``, producing the message `": At least one field
is required"` instead of `"At least one field is required"`. Confirmed empirically:
```
z.object({...}).refine(...).safeParse({}).error.issues[0] // { path: [], message: "..." }
```
This was never asserted in any test — every "empty body" test only checked `res.status === 400`,
never the message text, so it slipped through.

**Fix:** `validateBody` now omits the `"path: "` prefix when `issue.path` is empty.

### 6. `Product` PATCH response envelope didn't match every other PATCH
Every other PATCH handler (`Category`, `Employee`, `Manager`, `Supplier`) returns the updated
resource bare: `NextResponse.json(resource, { status: 200 })`. Product's PATCH wrapped it:
`NextResponse.json({ product }, { status: 200 })` — the one outlier, and it doesn't match the
contract either (contract shows a bare schema for all PATCH responses).

**Fix:** unwrapped to match the rest.

### 7. `CategoryRepository.createCategory` used fragile string-matching instead of the shared helper
Every other repository checks unique-constraint violations via `isUniqueConstraintError(error,
field)` (checks `error.code === "P2002"` and `meta.target`). `CategoryRepository.createCategory`
was the one holdout still doing
`error.message.includes("Unique constraint failed on the fields: (\`name\`)")` — brittle (ties
detection to Postgres's exact wording) and inconsistent with the rest of the codebase.

**Fix:** switched to `isUniqueConstraintError(error, "name")`, matching every other repository.

## Contract compliance notes (not bugs — flagging for your awareness)

### `manager_id` and supplier/category-id validation
The contract has `InventoryCountEntry` and `Delivery` creation attributed to a manager via
`X-Manager-Token`, not a body field — but no auth/session infrastructure exists yet (no token
table in the schema at all). Both create schemas add `manager_id` as an explicit required body
field instead, documented with a comment at the point of definition. This is a deliberate,
visible deviation, not an oversight — worth resolving for real once manager auth exists, at
which point `manager_id` should come off the request schema entirely and be read from the
verified token.

### `ExchangeRate.updated_at` cannot be populated
The contract's `ExchangeRate` schema includes `updated_at`, but `AppConfig` (`config_key`,
`config_value`) has no timestamp column at all. The response only returns `rate_value`. Adding
`updated_at` needs a schema migration, which wasn't made unprompted.

### Manager password has no minimum length — resolved, see Update above
`PasswordSchema` now enforces 8+ characters, upper, lower, digit, and symbol on both create and
update. The contract itself still doesn't specify a policy — this is a deliberate hardening
beyond what's written there, done at the user's request.

### `InventoryCountEntry.entry_date` "today" is UTC-midnight, not a configured business day
The contract discusses a "business date" concept but never defines a timezone. `startOfToday()`
uses UTC-midnight as the day boundary. Fine for V1 given no timezone is specified anywhere in the
contract or schema, but worth a real decision if the terminal runs in a non-UTC timezone — near
midnight UTC, "today" could disagree with the cashier's wall clock.

### Response envelopes: POST wraps, GET/PATCH don't (intentional, now consistent)
Every `POST` response is wrapped in `{ <resource>: {...} }` (matches the existing `Category`
POST this was modeled on); every `GET`/`PATCH` response returns the resource directly. The
contract itself has no envelope at all (bare schemas everywhere) — this wrapping is this
codebase's own convention, carried from the original `Category` implementation. Documenting it
here so it reads as a decision, not drift.

## Layer-by-layer check

| Resource | Types (zod) match contract constraints | Repo exception coverage | Controller status codes match contract |
|---|---|---|---|
| Category | Yes | Unique, NotFound | 201/200/204/400/404/409 — matches |
| Product | Yes (no `base_price` minimum in contract; `.nonnegative()` added defensively) | NotFound, BadRequest (category_id) | 201/200/204/400/404 — matches (no 409 in contract, none thrown) |
| Employee | Yes | Unique (pos_id), NotFound | matches |
| Manager | Yes (password policy now enforced beyond the contract, see Update above) | Unique (username), NotFound | matches |
| Supplier | Yes (no unique constraint on `name` in schema, none in contract either) | NotFound | matches |
| InventoryItem | Yes | Unique (name) | matches (no PATCH/DELETE in contract, none built) |
| InventoryCountEntry | Yes (`manager_id` no longer in the body — read from the verified `X-Manager-Id` header, see Update above) | BadRequest (item_id, manager_id), NotFound, custom 409 shape (`code`/`count_id`) | matches, including the contract's one-off 409 body shape |
| Delivery | Yes (`manager_id` no longer in the body — read from the verified `X-Manager-Id` header, see Update above) | BadRequest (supplier_id, item/config pairing, manager_id) | matches |
| ExchangeRate | Yes | NotFound (not configured) | matches except missing `updated_at`, see above |

## Test coverage added after this audit

Every fix above got new tests (happy path already existed from the original build; this pass
adds the error paths that were previously unverified):
- `parseIdParam` — valid/invalid/negative/decimal input, unit tested standalone
- Every dynamic route with a numeric path param — 400 on non-numeric ID, in addition to the
  existing 404/200 cases
- Every list GET route — 200 happy path plus a repository-level thrown error now surfacing as a
  clean 500 through the route (previously untested since there was no `try/catch` to hit)
- `count_frequency`/`entry_date`/`date_received` — invalid value → 400, valid value → passed
  through
- `manager_id` referential check — missing manager → 400, in both `InventoryCountEntry` and
  `Delivery` repositories
- `validateBody` — refine-based ("at least one field") message no longer has the stray `": "`
  prefix
- `CategoryRepository.createCategory` — unique-violation path re-verified against the
  `isUniqueConstraintError` helper instead of the old string match
