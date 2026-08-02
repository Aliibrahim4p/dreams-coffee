# Operations checklist — every file, every operation, every case

One file per section (`app/api` routes, `repository`, `services`, `types`). Inside each file,
one sub-heading per operation (exported HTTP handler / class method / schema). Inside each
operation, one checkbox per case. Check a box only after you've actually run that case, not
read the code.

Not committed — local working notes only.

---

# `src/app/api/**/route.ts` (routes / controllers)

## [auth/manager/login/route.ts](../src/app/api/auth/manager/login/route.ts)

### `POST`
- [ ] Malformed JSON body → `400 "Invalid JSON body"`
- [ ] `username` empty/missing → `400`
- [ ] `password` empty/missing → `400`
- [ ] Unknown `username` → `401 "Incorrect username or password"`
- [ ] Known `username`, `is_active=false` → same generic `401`
- [ ] Known + active, wrong `password` → same generic `401`
- [ ] Correct credentials → `200` with `manager_token`, `expires_at`, `manager` object (no `password_hash`)

## [auth/admin/login/route.ts](../src/app/api/auth/admin/login/route.ts) *(new)*

Exchanges the shared `ADMIN_SECRET_KEY` for a short-lived, signed `X-Admin-Token` — mirrors manager
login structurally, but there's no DB row/username: the "identity" is just possession of the secret.

### `POST`
- [ ] Malformed JSON body → `400`
- [ ] `admin_key` empty/missing → `400`
- [ ] Wrong `admin_key` → `401 "Incorrect admin key"`
- [ ] Correct `admin_key` → `200` with `admin_token`, `expires_at` (8h TTL, same as manager token)
- [ ] `admin_token` is signed with `ADMIN_JWT_SECRET` — a **different** secret from `MANAGER_JWT_SECRET` — confirm a manager token is never accepted as an admin token and vice versa
- [ ] This path is under `/api/auth/`, always public per `proxy.ts` — confirm it works with zero other auth headers present

## [categories/route.ts](../src/app/api/categories/route.ts)

### `POST`
- [ ] No `X-Manager-Token` → `401`
- [ ] Malformed JSON → `400`
- [ ] `name` empty → `400`
- [ ] `name` 41+ chars → `400`
- [ ] `name` 40 chars exactly → `201`
- [ ] Duplicate `name` → `409`
- [ ] Valid → `201 { category: { category_id, name, is_active: true } }`

### `GET`
- [ ] No token, no `?include` → `200` flat array (public route), inactive categories excluded
- [ ] `?include=products` → each category has `products[]` (inactive products excluded), each product has `sizes[]` (sizes whose `SizeModifier` is deactivated excluded)
- [ ] `?include=` anything else → treated same as no include (not validated/rejected)
- [ ] `?include_inactive=true` → deactivated categories included (and, combined with `?include=products`, deactivated products/sizes included too)

## [categories/[category_id]/route.ts](../src/app/api/categories/[category_id]/route.ts)

### `PATCH`
- [ ] No token → `401`
- [ ] Non-numeric `category_id` → `400`
- [ ] Empty/41+ char `name` → `400`
- [ ] Nonexistent `category_id` → `404`
- [ ] Rename to another category's existing `name` → `409`
- [ ] Valid → `200` with updated row

### `DELETE`
- [ ] No token → `401`
- [ ] Non-numeric `category_id` → `400`
- [ ] Nonexistent `category_id` → `404`
- [ ] Valid → `204`, no body
- [ ] Confirm the category's products are unaffected (still `is_active=true`)

## [categories/[category_id]/products/route.ts](../src/app/api/categories/[category_id]/products/route.ts)

### `GET`
- [ ] Non-numeric `category_id` → `400`
- [ ] Valid but nonexistent `category_id` → `404`
- [ ] Valid `category_id`, zero products → `200 []`
- [ ] Valid `category_id`, N active products → `200` array of N (deactivated products excluded by default)
- [ ] `?include_inactive=true` → deactivated products under this category included too
- [ ] No token required (public route)

## [products/route.ts](../src/app/api/products/route.ts)

### `POST`
- [ ] No token → `401`
- [ ] `category_id` non-integer/missing → `400`
- [ ] `name` empty → `400`
- [ ] `type` outside `recipe_based`/`reseller` → `400`
- [ ] `base_price` negative → `400`
- [ ] `base_price = 0` → `201` (nonnegative allows zero)
- [ ] `category_id` pointing to nonexistent category → `400 "Invalid category_id"`
- [ ] Valid → `201 { product }`
- [ ] Confirm there is genuinely no `GET` handler here (no unscoped product list)

## [products/[product_id]/route.ts](../src/app/api/products/[product_id]/route.ts)

### `PATCH`
- [ ] No token → `401`
- [ ] Non-numeric `product_id` → `400`
- [ ] Empty body `{}` → `400 "At least one field is required"`
- [ ] Only `category_id` → `200`, other fields untouched
- [ ] Only `name` → `200`
- [ ] Only `base_price` (negative) → `400`
- [ ] `category_id` pointing to nonexistent category → `400 "Invalid category_id"`
- [ ] Nonexistent `product_id` → `404`

### `DELETE`
- [ ] No token → `401`
- [ ] Nonexistent `product_id` → `404`
- [ ] Valid → `204`
- [ ] Confirm the product's recipes are unaffected

## [products/[product_id]/recipe/route.ts](../src/app/api/products/[product_id]/recipe/route.ts)

### `GET`
- [ ] Nonexistent `product_id` → `404`
- [ ] `?modifier_id=` non-numeric → `400`
- [ ] `?modifier_id=` for a size with no recipe row → `404 "No recipe seeded for this product"`
- [ ] `?modifier_id=` for a size whose `SizeModifier.is_active=false` → `404` (excluded from the query, same as no recipe)
- [ ] No `?modifier_id` → `200` array covering all modifiers for the product, deactivated modifiers excluded
- [ ] Ingredient `quantity` is a plain number in the response, not a Decimal object
- [ ] No token required (public route)

### `POST` — build a recipe for a product+size (admin-only; no admin UI exists elsewhere, so this is the only non-seed way to create one)
- [ ] Gated by `X-Admin-Token` **only**, enforced entirely in `proxy.ts`'s dedicated `ADMIN_ROUTES` branch — a `X-Manager-Token` is neither required nor checked for this method+path, and is never combined with the admin check
- [ ] Get a token first: `POST /api/auth/admin/login` with `{ admin_key }` → `admin_token`
- [ ] No `X-Admin-Token` header at all → `401 "Admin authentication required"` (the route handler itself is never reached — confirm `ProductService.createRecipe` is not called)
- [ ] Invalid/expired/tampered `X-Admin-Token` → `401`, same message
- [ ] A **valid `X-Manager-Token` alone, with no `X-Admin-Token`** → still `401` — this is the key regression check: manager auth must never substitute for admin auth here
- [ ] Malformed JSON → `400`
- [ ] `ingredients: []` → `400` (min 1)
- [ ] `ingredients[].item_id` non-integer → `400`
- [ ] `ingredients[].unit` outside `g`/`ml`/`piece` → `400`
- [ ] `ingredients[].quantity` may be negative (schema note: "can be negative") → accepted
- [ ] Nonexistent `product_id` → `404`
- [ ] `product.type="reseller"` with non-null `modifier_id` → `400 "Reseller products cannot have a modifier_id"`
- [ ] `product.type="recipe_based"` with `modifier_id: null` → `400 "modifier_id is required for recipe_based products"`
- [ ] `modifier_id` pointing to a nonexistent `SizeModifier` → `400 "Invalid modifier_id"`
- [ ] An ingredient's `item_id` not in `inventory_item` → `400 "item_id not in the predefined list"`
- [ ] A recipe already exists for this `(product_id, modifier_id)` pair → `409` (`@@unique([product_id, modifier_id])`)
- [ ] Valid recipe_based request → `201 { recipe }` with resolved `product_name`/`modifier_name`/`item_name` per ingredient
- [ ] Valid reseller request (`modifier_id: null`) → `201`, `modifier_id`/`modifier_name` both `null` in the response
- [ ] Confirm the newly created recipe is immediately visible via `GET` on this same route and via `GET /products/{id}/sizes`

## [products/[product_id]/recipe/[recipe_id]/route.ts](../src/app/api/products/[product_id]/recipe/[recipe_id]/route.ts) *(new)*

### `PATCH` — admin-only, same gate as recipe creation
- [ ] Gated by `X-Admin-Token` **only**, same `ADMIN_ROUTES` branch in `proxy.ts` as recipe creation
- [ ] No `X-Admin-Token` → `401`; invalid/expired token → `401`
- [ ] A valid `X-Manager-Token` alone does not substitute for the admin token → `401`
- [ ] Malformed JSON → `400`
- [ ] Empty body `{}` → `400 "At least one field is required"`
- [ ] `ingredients: []` (present but empty) → `400`
- [ ] Non-numeric `product_id` or `recipe_id` → `400`
- [ ] `recipe_id` doesn't exist → `404`
- [ ] `recipe_id` exists but belongs to a **different** `product_id` than the one in the path → `404` (not a silent cross-product update)
- [ ] Reassigning `modifier_id` on a reseller product's recipe to non-null → `400`
- [ ] Setting `modifier_id: null` on a recipe_based product's recipe → `400`
- [ ] New `modifier_id` doesn't exist as a `SizeModifier` → `400 "Invalid modifier_id"`
- [ ] An ingredient's `item_id` not in `inventory_item` → `400`
- [ ] Reassigning `modifier_id` to one that already has a recipe for this product → `409` (compound unique constraint)
- [ ] `ingredients`-only update → **replaces** the full ingredient list (old ones deleted, not merged) — confirm an ingredient omitted from the new list is actually gone, not left behind
- [ ] `modifier_id`-only update → ingredients untouched
- [ ] Both fields together → both applied atomically (single `$transaction`)
- [ ] Confirm the change is immediately visible via `GET /products/{id}/recipe` and `GET /products/{id}/sizes`

## [products/[product_id]/sizes/route.ts](../src/app/api/products/[product_id]/sizes/route.ts)

### `GET`
- [ ] Nonexistent `product_id` → `404`
- [ ] Product with zero recipes → `200 []`
- [ ] `type=reseller` product → every size has `available: false`
- [ ] `type=recipe_based` product → every size has `available: true`
- [ ] `resolved_price` = `base_price + price_adjustment`, verified by hand-calculation
- [ ] A size whose `SizeModifier.is_active=false` is excluded from the response
- [ ] No token required (public route)

## [employees/route.ts](../src/app/api/employees/route.ts)

### `POST`
- [ ] No token → `401`
- [ ] `pos_id` non-integer → `400`
- [ ] `first_name`/`last_name` empty → `400`
- [ ] Duplicate `pos_id` → `409`
- [ ] Valid → `201 { employee }`

### `GET`
- [ ] No `?include_inactive` → only active employees
- [ ] `?include_inactive=true` → includes deactivated ones too

## [employees/[pos_id]/route.ts](../src/app/api/employees/[pos_id]/route.ts)

### `GET`
- [ ] Non-numeric `pos_id` → `400`
- [ ] Nonexistent `pos_id` → `404`
- [ ] Valid → `200`

### `PATCH`
- [ ] Empty body → `400`
- [ ] Nonexistent `pos_id` → `404`
- [ ] Only `first_name` → `200`
- [ ] Only `last_name` → `200`

### `DELETE`
- [ ] Nonexistent `pos_id` → `404`
- [ ] Valid → `204`

## [managers/route.ts](../src/app/api/managers/route.ts)

### `POST` — admin-only (so a regular manager can't provision more managers)
- [ ] Gated by `X-Admin-Token` **only**, via `proxy.ts`'s `ADMIN_ROUTES` branch — a regular `X-Manager-Token` grants no access here at all, combined or not
- [ ] No `X-Admin-Token` → `401 "Admin authentication required"` (route handler never reached — `ManagerService.createManager` must not be called)
- [ ] Invalid/expired `X-Admin-Token` → `401`
- [ ] A valid `X-Manager-Token` with no `X-Admin-Token` → `401` — confirm a logged-in manager genuinely cannot create other managers
- [ ] `username` empty → `400`
- [ ] `password` failing policy (short / missing upper / lower / digit / symbol — test each separately) → `400`
- [ ] Duplicate `username` → `409`
- [ ] Valid `X-Admin-Token` → `201 { manager }`, response has no `password_hash`

### `GET`
- [ ] No `?include_inactive` → only active managers
- [ ] `?include_inactive=true` → includes deactivated ones
- [ ] No row in either response includes `password_hash`

## [managers/[manager_id]/route.ts](../src/app/api/managers/[manager_id]/route.ts)

### `GET`
- [ ] Nonexistent `manager_id` → `404`
- [ ] Valid → `200`, no `password_hash`

### `PATCH` — admin-only *(fixed: was reachable by any manager token, letting any manager overwrite any other manager's password)*
- [ ] Gated by `X-Admin-Token` **only**, via `proxy.ts`'s `ADMIN_ROUTES` branch — a `X-Manager-Token` (even a valid one) grants no access here at all
- [ ] No `X-Admin-Token` → `401 "Admin authentication required"` (route handler never reached — `ManagerService.updateManager` must not be called)
- [ ] A valid `X-Manager-Token` alone, no `X-Admin-Token` → `401` — confirm a manager genuinely cannot PATCH their own or anyone else's record this way
- [ ] Empty body → `400`
- [ ] New `password` (valid, meets policy) → `200`; confirm the **old** password no longer authenticates on `/auth/manager/login`
- [ ] New `password` (weak) → `400`
- [ ] Update without `password` → `password_hash` unchanged (old password still works)
- [ ] New `username` colliding with another manager → `409`
- [ ] Nonexistent `manager_id` → `404`

### `DELETE` — admin-only *(same fix as `PATCH`)*
- [ ] Gated by `X-Admin-Token` **only**, same `ADMIN_ROUTES` branch — a `X-Manager-Token` alone → `401`
- [ ] Nonexistent `manager_id` → `404`
- [ ] Valid → `204`
- [ ] Deactivated manager's **existing, unexpired token** is rejected on the *next* request (proxy re-checks `is_active` live, not just at login) — this still applies to their manager token; irrelevant to the admin token used to deactivate them
- [ ] Deactivating the account behind the currently-used admin session doesn't apply here — admin auth isn't tied to a manager row at all, so there is no "admin locks themselves out" case

## [suppliers/route.ts](../src/app/api/suppliers/route.ts)

### `GET`
- [ ] No token → `401` (supplier list is NOT public, unlike categories)
- [ ] No `?include_inactive` → `200`, deactivated suppliers excluded (`is_active` is a non-nullable column with a `true` default — no more null-handling to worry about)
- [ ] `?include_inactive=true` → deactivated suppliers included

### `POST`
- [ ] No token → `401`
- [ ] `name` empty → `400`
- [ ] Two suppliers with the identical `name` → confirm both succeed with `201` (no uniqueness constraint on supplier name — verify this is actually true, not assumed)
- [ ] Valid → `201`, `is_active: true` from the column default (not client-settable — not in `SupplierCreateSchema`)

## [suppliers/[supplier_id]/route.ts](../src/app/api/suppliers/[supplier_id]/route.ts)

### `PATCH`
- [ ] `name` empty → `400`
- [ ] Nonexistent `supplier_id` → `404`
- [ ] Valid → `200`

### `DELETE`
- [ ] Nonexistent `supplier_id` → `404`
- [ ] Valid → `204`

## [inventory-items/route.ts](../src/app/api/inventory-items/route.ts)

### `POST`
- [ ] No token → `401`
- [ ] `name` empty → `400`
- [ ] `unit` outside `g`/`ml`/`piece` → `400`
- [ ] each of `g`, `ml`, `piece` individually → `201`
- [ ] `count_frequency` outside `daily`/`monthly` → `400`
- [ ] each of `daily`, `monthly` individually → `201`
- [ ] Duplicate `name` → `409`
- [ ] Valid → `201`, `current_stock: 0`, `is_negative_flag: false`

### `GET`
- [ ] `?count_frequency=garbage` → `400 "Invalid count_frequency"` (checked in the route itself, not zod — confirm it actually fires)
- [ ] `?count_frequency=daily` / `monthly` → filters correctly
- [ ] `?negative_only=true` → only flagged items
- [ ] `?negative_only=false` (explicit) → same as omitted, i.e. NOT filtered to non-negative-only (confirm this asymmetry is expected)
- [ ] No `?include_inactive` → deactivated items excluded by default
- [ ] `?include_inactive=true` → deactivated items included
- [ ] All params together → compose correctly

## [inventory-items/[item_id]/pack-configurations/route.ts](../src/app/api/inventory-items/[item_id]/pack-configurations/route.ts)

### `GET`
- [ ] No token → `401`
- [ ] Nonexistent `item_id` → `404`
- [ ] Item with zero configs → `200 []`
- [ ] Item with N configs → `200` array of N
- [ ] Confirm there is no `POST` handler in this file (none exists — don't test for one)

## [deliveries/route.ts](../src/app/api/deliveries/route.ts)

### `POST`
- [ ] No token → `401`
- [ ] `supplier_id` non-integer → `400`
- [ ] A `date_received` field in the request body is silently ignored (not in `DeliveryCreateSchema` at all — always server-derived as today's business date via `getCurrentBusinessDate()`; confirm sending a garbage value like `"not-a-date"` does **not** cause a `400`, since it's just an unknown key)
- [ ] `line_items: []` → `400` (min 1)
- [ ] a line's `qty_received` = 0 or negative → `400`
- [ ] a line's `total_cost` negative → `400` (this replaced `cost_per_unit` as the input field — the manager enters what they paid in total for the line, not a per-pack figure)
- [ ] `supplier_id` pointing to nonexistent supplier → `400 "Invalid supplier_id"`
- [ ] a line's `config_id` doesn't exist at all → `400`
- [ ] a line's `config_id` exists but belongs to a **different** `item_id` than stated → `400`
- [ ] Valid single-line delivery → `201`; `inventory_item.current_stock` for that item increased by exactly `qty_received × base_unit_qty`
- [ ] Response `cost_per_unit` for that line = `total_cost ÷ qty_received`, hand-verified (e.g. 3 boxes for a `total_cost` of 30 → `cost_per_unit: 10`)
- [ ] Response/DB `date_received` = today's business date, not any client-supplied value
- [ ] Valid multi-line delivery, two different items → both stocks increment correctly, each line's `cost_per_unit` derived independently
- [ ] Valid multi-line delivery, **same** `item_id` under two different `config_id`s → both increments apply additively, not overwritten
- [ ] Force one bad line among several valid ones → entire request fails `400`/`500`, and confirm via `GET` that **no** delivery row and **no** stock increment persisted from the valid lines (transaction rollback)
- [ ] Response `base_units_added` per line matches hand-calculated `qty_received × base_unit_qty`

### `GET`
- [ ] No `?date_received`/`?supplier_id` → all deliveries
- [ ] `?date_received=` only → filters
- [ ] `?supplier_id=` only → filters
- [ ] Both together → composes
- [ ] Bad `date_received` → `400`
- [ ] Non-numeric `supplier_id` → `400`

## [deliveries/[delivery_id]/route.ts](../src/app/api/deliveries/[delivery_id]/route.ts)

### `GET`
- [ ] Nonexistent (but well-formed UUID) `delivery_id` → `404`
- [ ] Garbage, non-UUID-shaped `delivery_id` string → `404`, **not** `500` (this id is never run through `parseIdParam`/format validation — confirm Prisma's lookup fails cleanly)
- [ ] Valid → `200` with nested `supplier_name`, `line_items[]` (each with `item_name`, `pack_name`)

## [inventory-count-entries/route.ts](../src/app/api/inventory-count-entries/route.ts)

### `POST`
- [ ] No token → `401`
- [ ] `item_id` non-integer → `400`
- [ ] `physical_count` negative → `400`
- [ ] `physical_count = 0` → `201` (nonnegative allows zero)
- [ ] `item_id` pointing to nonexistent item → `400 "item_id not in the predefined list"`
- [ ] Valid, first entry of the day for that item → `201`, `entry_date` = today in `BUSINESS_TIMEZONE`
- [ ] Second `POST` for the **same** `item_id`, same business day → `409 { code: "CONFLICT", message, count_id }` matching the first entry's `count_id` exactly
- [ ] Two concurrent `POST`s for the same `item_id` (fired together, not sequential) → exactly one `201`, one `409` with matching `count_id` — no double `201`, no `500`
- [ ] Response `variance` = `physical_count − expected_stock`, hand-verified
- [ ] Sending an extra `entry_date` field in the body → silently ignored, server-derived date wins (schema has no such field)

### `GET`
- [ ] No `?entry_date` → defaults to **today's** business date only, not all-time history
- [ ] `?entry_date=` explicit past date → returns that day's entries
- [ ] `?item_id=` filter composes with date
- [ ] Bad `entry_date` → `400`
- [ ] Non-numeric `item_id` → `400`

## [inventory-count-entries/[count_id]/route.ts](../src/app/api/inventory-count-entries/[count_id]/route.ts)

### `GET`
- [ ] Nonexistent `count_id` → `404`
- [ ] Garbage non-UUID string → `404`, not `500`
- [ ] Valid → `200`

### `PATCH` — closes the gap the old `409`'s "PATCH it instead" message pointed at, but which didn't exist until now
- [ ] No token → `401`
- [ ] Malformed JSON → `400`
- [ ] `physical_count` negative → `400`
- [ ] Nonexistent `count_id` → `404`
- [ ] `count_id` for an entry whose `entry_date` is **not** today's business date → `400 "Count entry can only be modified on the day it was submitted"`
- [ ] `count_id` for an entry submitted **today** → `200`, `physical_count` updated, `variance` recomputed against current `current_stock`
- [ ] Confirm this only ever updates `physical_count` — `item_id`, `manager_id`, `entry_date` are untouched

## [sync/records/route.ts](../src/app/api/sync/records/route.ts) *(new — offline PWA order sync)*

Batch **insert** for orders written offline (PWA + IndexedDB, POS orders only). All order writes
happen client-side first (IndexedDB); sync's only job is to insert the finished order once. There
is no edit-after-submit path — a sync is a one-time `order.create`, not an upsert, and there is no
`PATCH` here at all. No other resource gets offline support; everything else still requires a live
connection to its own endpoint.

### `POST`
- [ ] No `X-Manager-Token` → `401` (default proxy fallback — this route is neither public nor admin)
- [ ] Malformed JSON → `400`
- [ ] `records: []` → `400` (min 1)
- [ ] A record missing `order_id`/`session_id`/`total_due`/`created_at`/`line_items` → `400`
- [ ] `status="completed"` without `completed_at` → `400`
- [ ] `status="completed"` with `completed_at` set → accepted
- [ ] A line item's `quantity` ≤ 0 → `400`
- [ ] A line item's `unit_price` negative → `400`
- [ ] `total_due` negative (refund) → accepted, not rejected
- [ ] Empty `line_items: []` on a record (freshly opened, still-empty basket) → accepted
- [ ] One record in the batch has an unknown `session_id`, the rest are valid → `200` overall, the bad one comes back `{ sync_status: "failed", synced_at: null }`, the others `"synced"` — confirm the whole batch never fails as a unit over one bad record
- [ ] A line item's `product_id` or `modifier_id` doesn't exist → that record's result is `"failed"`, nothing persisted for it
- [ ] Re-POST the exact same `order_id` a second time → `create` throws (duplicate PK), that record comes back `"failed"` — confirm this is **not** treated as an edit/update; the first-synced version is left untouched
- [ ] Response shape is `{ results: [{ order_id, sync_status, synced_at }] }` and nothing else per the spec — no extra fields, no error messages
- [ ] Confirm `synced_at` in a `"synced"` result is a real timestamp (not the client's `created_at`/`completed_at`)

## [sync/heartbeat/route.ts](../src/app/api/sync/heartbeat/route.ts) *(new, matches `Api Contract.yaml`'s `/sync/heartbeat`)*

Plain connectivity ping for the PWA to check it can actually reach the server (not just that the
device thinks it's online), polled on an interval client-side to drive offline-mode detection. No
DB call, no auth — deliberately just "did the request make it here."

### `GET`
- [ ] No token required (public route)
- [ ] Always → `200 { server_time }`, an ISO datetime string close to request time

## [config/exchange-rate/route.ts](../src/app/api/config/exchange-rate/route.ts)

### `GET`
- [ ] Against a fresh/unseeded DB (row never created) → `404 "Exchange rate not configured"`
- [ ] Seeded → `200 { rate_value }`
- [ ] No token required (public route)

### `PUT`
- [ ] No token → `401`
- [ ] `rate_value = 0` → `400` (positive, not nonnegative)
- [ ] `rate_value` negative → `400`
- [ ] First-ever PUT on a fresh DB (row doesn't exist) → `200`, row created via upsert
- [ ] PUT again with a different value → `200`, row updated, not duplicated
- [ ] Decimal value (e.g. `89500.75`) round-trips through GET with no precision loss

---

# `src/repository/*.ts`

## [category-repository.ts](../src/repository/category-repository.ts) *(filename typo fixed — was `category-repoistory.ts`)*

### `createCategory`
- [ ] Success → `{ category_id, name, is_active }` via `mapCategory`, same shape every other method in this file returns *(fixed — used to return `{ id, name }`, missing `is_active` and the wrong id key)*
- [ ] Duplicate `name` → `UniqueException`

### `listCategories`
- [ ] `includeProducts=false` → flat `mapCategory` shape only, `is_active=true` filter applied by default
- [ ] `includeProducts=true` → nested `products[]` each with `sizes[]`, reusing `mapProduct`/`resolveProductSizes` imported from `product-repository.ts` (confirm no duplicated logic drift between the two files)
- [ ] `includeInactive=true` → no `is_active` filter on categories, or (when `includeProducts` is also true) on nested products/recipes either

### `updateCategory`
- [ ] Not found → `NotFoundException`
- [ ] Duplicate `name` → `UniqueException`
- [ ] Success → mapped row

### `deactivateCategory`
- [ ] Not found → `NotFoundException`
- [ ] Success → `is_active=false`, no other columns touched

## [product-repository.ts](../src/repository/product-repository.ts)

### `resolveProductSizes` (pure helper)
- [ ] `recipe.modifier=null` → `modifier_id`/`modifier_name` null, `price_adjustment=0`
- [ ] `recipe.modifier` present → `price_adjustment` and `resolved_price` match hand-calculation
- [ ] `product.type="reseller"` → `available=false` for every size
- [ ] `product.type="recipe_based"` → `available=true`

### `mapRecipe` (pure helper) *(new — extracted from `getProductRecipe`/`createRecipe`/`updateRecipe`, which each used to hand-build this shape separately)*
- [ ] `recipe.modifier=null` → `modifier_id`/`modifier_name` both `null`
- [ ] `recipe.modifier` present → `modifier_name` from `recipe.modifier.name`
- [ ] `ingredients` mapped with `item_name` from `ingredient.item.name`, `quantity` converted from `Decimal` to `number`
- [ ] `product_name` comes from the `productName` argument, not looked up internally — confirm all three call sites pass it in rather than re-querying

### `createProduct`
- [ ] Invalid `category_id` → `BadRequestException` (checked before insert attempt)
- [ ] Valid → mapped row

### `updateProduct`
- [ ] `category_id` present, invalid → `BadRequestException`
- [ ] `category_id` omitted → check skipped entirely, other fields still update
- [ ] Not found → `NotFoundException`

### `deactivateProduct`
- [ ] Not found → `NotFoundException`

### `listCategoryProducts`
- [ ] Category not found → `NotFoundException`
- [ ] Category found, zero products → `[]`
- [ ] `includeInactive` false/undefined → only `is_active=true` products; `true` → all

### `getProductSizes`
- [ ] Product not found → `NotFoundException`
- [ ] Product found, zero recipes → `[]`
- [ ] Recipe whose `modifier.is_active=false` excluded from the query (`OR: [{modifier_id:null},{modifier:{is_active:true}}]`); reseller recipes (`modifier_id=null`) always kept

### `getProductRecipe`
- [ ] Product not found → `NotFoundException`
- [ ] `modifierId` given, no matching recipe → `NotFoundException "No recipe seeded for this product"`
- [ ] `modifierId` given but that modifier is deactivated → same `NotFoundException` (filtered out by the same active-modifier `OR` clause as `getProductSizes`)
- [ ] `modifierId` omitted → all modifiers' recipes returned, deactivated modifiers excluded
- [ ] Ingredient `quantity` Decimal→number conversion correct

### `createRecipe`
- [ ] Product not found → `NotFoundException`
- [ ] `product.type="reseller"` + non-null `modifier_id` → `BadRequestException`
- [ ] `product.type!="reseller"` + `modifier_id=null` → `BadRequestException`
- [ ] `modifier_id` set but doesn't exist → `BadRequestException "Invalid modifier_id"` (skipped entirely when `modifier_id=null`)
- [ ] An ingredient's `item_id` not in `inventory_item` → `BadRequestException`
- [ ] Duplicate `(product_id, modifier_id)` → `UniqueException` (compound unique constraint)
- [ ] Success → `recipe` created with its `recipe_ingredient` rows in one call, mapped response includes `product_name`/`modifier_name`/`item_name`
- [ ] Reseller path (`modifier_id: null`) never calls `sizeModifier.findUnique` — confirm that lookup is skipped, not just harmless

### `updateRecipe`
- [ ] Recipe not found → `NotFoundException`
- [ ] Recipe found but `recipe.product_id` != the `productId` argument → `NotFoundException` (path/resource mismatch guard)
- [ ] Reseller product + `modifier_id` reassigned non-null → `BadRequestException`
- [ ] Recipe_based product + `modifier_id` explicitly set to `null` → `BadRequestException`
- [ ] `modifier_id` provided, doesn't exist → `BadRequestException`
- [ ] `modifier_id` **omitted** → no `sizeModifier.findUnique` call, existing `modifier_id` carried forward for the consistency check
- [ ] An ingredient's `item_id` not in `inventory_item` → `BadRequestException`
- [ ] `modifier_id` reassignment collides with another recipe on the same product → `UniqueException`
- [ ] `$transaction`: `ingredients` provided → `recipeIngredient.deleteMany` then `.createMany` for the recipe; `recipe.update` **not** called if `modifier_id` wasn't in the payload
- [ ] `$transaction`: `modifier_id` provided → `recipe.update` called; `recipeIngredient.deleteMany`/`.createMany` **not** called if `ingredients` wasn't in the payload
- [ ] Response `product_name` comes from the recipe's product (fetched once up front), not re-queried after the transaction

## [employee-repository.ts](../src/repository/employee-repository.ts)

### `createEmployee`
- [ ] Duplicate `pos_id` → `UniqueException`
- [ ] Success → mapped row

### `listEmployees`
- [ ] `includeInactive=false` → only `is_active=true`
- [ ] `includeInactive=true` → all rows

### `getEmployee`
- [ ] Not found → `NotFoundException`

### `updateEmployee`
- [ ] Not found → `NotFoundException`

### `deactivateEmployee`
- [ ] Not found → `NotFoundException`

## [manager-repository.ts](../src/repository/manager-repository.ts)

### `createManager`
- [ ] Password is hashed before insert — confirm raw plaintext never touches the DB (inspect the row directly)
- [ ] Duplicate `username` → `UniqueException`

### `listManagers`
- [ ] `includeInactive=false`/`true` same pattern as employees

### `getManager`
- [ ] Not found → `NotFoundException`

### `findByUsername`
- [ ] Unknown username → `null` (no throw)
- [ ] Known username → full row **including** `password_hash` — confirm this method's result is only ever consumed internally by `manager-auth-service.ts`, never returned from a route as-is

### `findManager` *(new — a raw existence lookup, `null` if not found, no throw)*
- [ ] Unknown `manager_id` → `null`
- [ ] Known `manager_id` → the raw row — used by `delivery-repository.ts`/`inventory-count-entry-repository.ts` in place of their own duplicated `prisma.manager.findUnique` calls; each caller still decides its own error (`BadRequestException`) on `null`

### `isActiveManager`
- [ ] Unknown `manager_id` → `false` (doesn't throw)
- [ ] Active manager → `true`
- [ ] Inactive manager → `false`

### `updateManager`
- [ ] `password` provided → re-hashed with a **new** salt
- [ ] `password` omitted → `password_hash` column untouched
- [ ] Duplicate `username` → `UniqueException`
- [ ] Not found → `NotFoundException`

### `deactivateManager`
- [ ] Not found → `NotFoundException`

## [supplier-repository.ts](../src/repository/supplier-repository.ts)

`is_active` is a non-nullable `Boolean @default(true)` column (migration `supplier_is_active_not_null` backfilled old `NULL` rows to `true`) — no more null-handling in this file.

### `mapSupplier` (helper)
- [ ] Passes `is_active` straight through — confirm the param type is `boolean`, not `boolean | null`

### `createSupplier`
- [ ] Does **not** pass `is_active` explicitly — relies on the column default; confirm a created row still comes back `is_active: true`
- [ ] Two suppliers with identical `name` → both succeed (no unique check exists on this table/method — confirm deliberately)

### `listSuppliers`
- [ ] `includeInactive` false/undefined → `where: { is_active: true }`
- [ ] `includeInactive=true` → no filter, deactivated suppliers included

### `updateSupplier`
- [ ] Not found → `NotFoundException`

### `deactivateSupplier`
- [ ] Not found → `NotFoundException`

## [inventory-item-repository.ts](../src/repository/inventory-item-repository.ts)

### `createInventoryItem`
- [ ] Duplicate `name` → `UniqueException`
- [ ] Success → `current_stock=0`, `is_negative_flag=false` from DB defaults (not client-settable)

### `listInventoryItems`
- [ ] `countFrequency` undefined → unfiltered on that axis
- [ ] `countFrequency="daily"`/`"monthly"` → filters
- [ ] `negativeOnly=true` → filters `is_negative_flag=true`
- [ ] `negativeOnly=false` → treated identically to `undefined` (not filtered) — confirm this asymmetric behavior
- [ ] `includeInactive` false/undefined → `is_active=true` filter applied; `true` → no `is_active` filter

### `getPackConfigurations`
- [ ] Item not found → `NotFoundException`
- [ ] Item found, zero configs → `[]`

## [delivery-repository.ts](../src/repository/delivery-repository.ts)

### `createDelivery`
- [ ] Invalid `supplier_id` → `BadRequestException`
- [ ] Invalid `manager_id` → `BadRequestException` via `ManagerRepository.findManager` (not the raw `prisma.manager` call directly anymore — same lookup `inventory-count-entry-repository.ts` now shares) *(not reachable via the real API — `managerId` always comes pre-verified from the proxy; only testable by calling the repository directly, e.g. in a unit test)*
- [ ] Line's `config_id` doesn't exist → `BadRequestException`
- [ ] Line's `config_id` exists but `item_id` mismatch → `BadRequestException`
- [ ] `date_received` written is `getCurrentBusinessDate()` — confirm nothing in this method reads `data.date_received` (the field no longer exists on `DeliveryCreate` at all)
- [ ] Each line's persisted `cost_per_unit` = `line.total_cost / line.qty_received`, not a client-supplied value
- [ ] All checks pass → `$transaction` creates `delivery` + `delivery_line_item` rows AND increments each line's `inventory_item.current_stock`
- [ ] Force a mid-transaction failure → confirm **nothing** persists (no orphaned delivery row, no partial stock increment) — this is the highest-value case in the whole file, don't skip it
- [ ] Two lines, same `item_id`, different `config_id` → increments sum correctly, not overwritten

### `listDeliveries`
- [ ] No filters, `dateReceived` only, `supplierId` only, both together

### `getDelivery`
- [ ] Not found → `NotFoundException`
- [ ] Found → full nested shape verified field-by-field against the DB row

## [inventory-count-entry-repository.ts](../src/repository/inventory-count-entry-repository.ts)

### `createEntry`
- [ ] Invalid `item_id` → `BadRequestException`
- [ ] Invalid `manager_id` → `BadRequestException` via `ManagerRepository.findManager`, same shared lookup as `delivery-repository.ts` *(not reachable via the real API, same note as deliveries)*
- [ ] Pre-check finds an existing same-day entry → `DuplicateCountEntryException` with that entry's `count_id`
- [ ] **Race**: two concurrent calls for the same `item_id`/business-date — the loser's `create` throws P2002, is caught, re-queried via `findUniqueOrThrow`, and re-thrown as `DuplicateCountEntryException` with the **winner's** `count_id` (not its own) — verify the `count_id` in the 409 actually matches the row that made it into the DB
- [ ] Success → `entry_date` set from `getCurrentBusinessDate()`, never from client input

### `updateEntry` — now a real time-based lock, not a same-calendar-day check *(fixed — `is_locked` was a dead column nothing ever read)*
- [ ] Not found → `NotFoundException`
- [ ] `new Date() >= getCountEntryLockDeadline(entry.entry_date)` → `BadRequestException` — for an Aug 2 entry, that deadline is Aug 3 03:00 Beirut time, not "any time after the calendar day rolls over"
- [ ] One second before the deadline → still editable
- [ ] Exactly at / one second after the deadline → locked
- [ ] Updates `physical_count` only, returns freshly-mapped entry with recomputed `variance`
- [ ] Confirm `item_id`/`manager_id`/`entry_date` are unchanged after the update

### `mapEntry` (helper)
- [ ] `is_locked` in the response is **computed** from `getCountEntryLockDeadline`, not read from the DB column — confirm this overrides the raw column in both directions (locked-by-time but column says `false`; column says `true` but not actually past deadline yet)

### `listEntries`
- [ ] `entryDate` omitted → defaults to `getCurrentBusinessDate()`, not unfiltered/all-time
- [ ] `entryDate` explicit + `itemId` compose correctly

### `getEntry`
- [ ] Not found → `NotFoundException`

## [exchange-rate-repository.ts](../src/repository/exchange-rate-repository.ts)

### `getExchangeRate`
- [ ] Key `exchange_rate` never seeded → `NotFoundException`
- [ ] Seeded → `{ rate_value: number }`

### `updateExchangeRate`
- [ ] Row doesn't exist → upsert **creates** it
- [ ] Row exists → upsert **updates** it (confirm no duplicate/second row is created)
- [ ] Decimal precision preserved end-to-end (write `89500.75`, read it back identical)

## [sync-repository.ts](../src/repository/sync-repository.ts) *(new)*

One `order.create` per record — plain insert, no upsert, no separate pre-validation queries. Sync
is one-time: an order is written client-side (IndexedDB), synced once, and never edited afterward,
so there's no update path to support here at all. An invalid `session_id`/`product_id`/
`modifier_id`, or a resend of an `order_id` that's already synced, is caught the same way any
other write failure is: the FK/PK constraint rejects the `create`, the `catch` maps it to
`"failed"`. Deliberately not pre-checked/batched, to keep this a plain per-record loop.

### `syncOrderRecords`
- [ ] Batch is processed via `Promise.all` over each record's independent `syncOne` call, not a sequential `for` loop *(fixed — was awaiting one record at a time, so total latency scaled linearly with batch size)*
- [ ] Results array is length N, **same order as the input**, regardless of which record's DB call actually resolves first
- [ ] Valid record → `order.create` called once with `line_items: { create: [...] }` nested (single Prisma call, no `$transaction` needed — Prisma nests the write itself)
- [ ] Unknown `session_id`, or a line item's `product_id`/`modifier_id` not in the DB → `order.create` throws (FK constraint), caught, that record's result is `{ sync_status: "failed", synced_at: null }` — nothing persisted
- [ ] Re-synced `order_id` (already exists) → `create` throws (PK unique constraint), same `"failed"` result — confirm this does **not** update the existing row in any way
- [ ] One record's `create` throws, others succeed → only that record comes back `"failed"`; the rest are `"synced"` — confirm each record is its own try/catch, not a shared transaction for the whole batch
- [ ] Omitted optional fields (`transaction_type`, `order_type`, `status`, `cash_tendered`, `change_given`, `completed_at`) → defaulted (`"sale"`, `null`, `"completed"`, `null`, `null`, `null`) before being sent to Prisma
- [ ] `line_items: []` on the record → nested `create: []` — no line items, no error
- [ ] Success → returned `synced_at` is a fresh `Date`, matching the value persisted as `sync_status: "synced"`
- [ ] A batch of N records with a mix of outcomes → results array is length N, same order as the input, each with its own correct `order_id`

---

# `src/services/*.ts`

Thin delegation layer — for every method below, the single case to verify is: **calls the
matching repository method with the same arguments, returns its result/throws its errors
unmodified, and adds no extra logic.** List each one so nothing gets skipped; check the box
once you've diffed the method body against its repository counterpart.

## [category-service.ts](../src/services/category-service.ts)
- [ ] `createCategory` → `CategoryRepository.createCategory`
- [ ] `listCategories` → `CategoryRepository.listCategories`
- [ ] `updateCategory` → `CategoryRepository.updateCategory`
- [ ] `deactivateCategory` → `CategoryRepository.deactivateCategory`

## [product-service.ts](../src/services/product-service.ts)
- [ ] `createProduct` → `ProductRepository.createProduct`
- [ ] `updateProduct` → `ProductRepository.updateProduct`
- [ ] `deactivateProduct` → `ProductRepository.deactivateProduct`
- [ ] `listCategoryProducts` → `ProductRepository.listCategoryProducts` (`includeInactive` forwarded)
- [ ] `getProductSizes` → `ProductRepository.getProductSizes`
- [ ] `getProductRecipe` → `ProductRepository.getProductRecipe` (both with and without `modifierId`)
- [ ] `createRecipe` → `ProductRepository.createRecipe`
- [ ] `updateRecipe` → `ProductRepository.updateRecipe`

## [employee-service.ts](../src/services/employee-service.ts)
- [ ] `createEmployee`, `listEmployees`, `getEmployee`, `updateEmployee`, `deactivateEmployee` — each a pure passthrough

## [manager-service.ts](../src/services/manager-service.ts)
- [ ] `createManager`, `listManagers`, `getManager`, `updateManager`, `deactivateManager` — each a pure passthrough

## [manager-auth-service.ts](../src/services/manager-auth-service.ts)

Not a thin passthrough — has real branching logic. Verify directly:

### `login`
- [ ] Unknown `username` → `UnauthorizedException "Incorrect username or password"`
- [ ] Known `username`, `is_active=false` → same exception/message (indistinguishable from unknown)
- [ ] Known + active, wrong `password` → same exception/message
- [ ] Correct credentials → `{ manager_token, expires_at, manager }`, token TTL is exactly `8 * 60 * 60` seconds
- [ ] `manager` object in the response excludes `password_hash`
- [ ] Timing: compare response latency for an unknown-username request vs. a valid-username-wrong-password request — the former skips `scrypt` entirely, the latter doesn't; confirm the gap is measurable if you're evaluating this as a real risk

## [supplier-service.ts](../src/services/supplier-service.ts)
- [ ] `createSupplier`, `listSuppliers`, `updateSupplier`, `deactivateSupplier` — each a pure passthrough

## [inventory-item-service.ts](../src/services/inventory-item-service.ts)
- [ ] `createInventoryItem`, `listInventoryItems` (both params forwarded), `getPackConfigurations` — each a pure passthrough

## [delivery-service.ts](../src/services/delivery-service.ts)
- [ ] `createDelivery` (data + managerId forwarded), `listDeliveries`, `getDelivery` — each a pure passthrough

## [inventory-count-entry-service.ts](../src/services/inventory-count-entry-service.ts)
- [ ] `createEntry` (data + managerId forwarded), `updateEntry`, `listEntries`, `getEntry` — each a pure passthrough

## [exchange-rate-service.ts](../src/services/exchange-rate-service.ts)
- [ ] `getExchangeRate`, `updateExchangeRate` — each a pure passthrough

## [sync-service.ts](../src/services/sync-service.ts) *(new)*
- [ ] `syncOrderRecords` → `SyncRepository.syncOrderRecords`, a pure passthrough

---

# `src/types/*.ts` (zod schemas)

Each schema's "operations" are its field-level validation rules. Test each rule in isolation
(one invalid field at a time) plus one fully-valid payload.

## [category.ts](../src/types/category.ts)
### `CategoryValidationSchema` (POST)
- [ ] `name=""` → rejected
- [ ] `name` = 41 chars → rejected
- [ ] `name` = 40 chars → accepted
- [ ] `name` missing → rejected
- [ ] Fully valid payload → accepted
### `CategoryUpdateSchema` (PATCH)
- [ ] Same rules as above — `name` is still required (not optional/partial), since it's the only field

## [product.ts](../src/types/product.ts)
### `ProductCreateSchema`
- [ ] `category_id` non-integer (e.g. `1.5`) → rejected
- [ ] `category_id` missing → rejected
- [ ] `name=""` → rejected
- [ ] `type` outside enum → rejected
- [ ] `type="recipe_based"` → accepted
- [ ] `type="reseller"` → accepted
- [ ] `base_price` negative → rejected
- [ ] `base_price=0` → accepted
- [ ] Fully valid payload → accepted
### `ProductUpdateSchema`
- [ ] `{}` → rejected ("At least one field is required")
- [ ] Only `category_id` → accepted
- [ ] Only `name` → accepted
- [ ] Only `base_price` → accepted
- [ ] `base_price` negative → rejected

## [employee.ts](../src/types/employee.ts)
### `EmployeeCreateSchema`
- [ ] `pos_id` non-integer → rejected
- [ ] `first_name`/`last_name` empty → rejected
- [ ] Fully valid payload → accepted
### `EmployeeUpdateSchema`
- [ ] `{}` → rejected
- [ ] Only `first_name` → accepted
- [ ] Only `last_name` → accepted

## [manager.ts](../src/types/manager.ts)
### `PasswordSchema` (shared by Create/Update)
- [ ] < 8 chars → rejected
- [ ] Missing uppercase → rejected
- [ ] Missing lowercase → rejected
- [ ] Missing digit → rejected
- [ ] Missing symbol → rejected
- [ ] Exactly 8 chars, all classes present → accepted
### `ManagerCreateSchema`
- [ ] `username` empty → rejected
- [ ] Weak `password` → rejected
- [ ] `first_name`/`last_name` empty → rejected
- [ ] Fully valid payload → accepted
### `ManagerUpdateSchema`
- [ ] `{}` → rejected
- [ ] Only `username` → accepted
- [ ] Only valid `password` → accepted
- [ ] Only weak `password` → rejected
- [ ] Only `first_name`/`last_name` → accepted

## [manager-login.ts](../src/types/manager-login.ts)
### `ManagerLoginSchema`
- [ ] `username` empty → rejected
- [ ] `password` empty → rejected
- [ ] Both present, **any** non-empty password (policy NOT enforced here, unlike create) → accepted by the schema (auth outcome is a separate concern, see service section)

## [supplier.ts](../src/types/supplier.ts)
### `SupplierCreateSchema` / `SupplierUpdateSchema`
- [ ] `name=""` → rejected (both schemas)
- [ ] Valid `name` → accepted (both schemas)

## [inventory-item.ts](../src/types/inventory-item.ts)
### `InventoryItemCreateSchema`
- [ ] `name=""` → rejected
- [ ] `unit` outside `g`/`ml`/`piece` → rejected
- [ ] each of `g`, `ml`, `piece` → accepted
- [ ] `count_frequency` outside `daily`/`monthly` → rejected
- [ ] each of `daily`, `monthly` → accepted
- [ ] Confirm there is genuinely no `InventoryItemUpdateSchema` in this file at all (items are create-only via the API)

## [delivery.ts](../src/types/delivery.ts)
### `DeliveryLineItemSchema` (nested in create)
- [ ] `item_id`/`config_id` non-integer → rejected
- [ ] `qty_received` ≤ 0 → rejected
- [ ] `total_cost` negative → rejected (this field replaced `cost_per_unit` — it's what the manager actually paid for `qty_received` packs; `cost_per_unit` is derived server-side, see `delivery-repository.ts`)
- [ ] `total_cost=0` → accepted
### `DeliveryCreateSchema`
- [ ] `supplier_id` non-integer → rejected
- [ ] There is no `date_received` field on this schema at all anymore — confirm one sent in the body is just stripped as an unknown key, not validated or used (delivery date is always `getCurrentBusinessDate()`)
- [ ] `notes` omitted → accepted
- [ ] `notes=null` → accepted
- [ ] `line_items=[]` → rejected
- [ ] One invalid line among several valid ones → whole payload rejected

## [inventory-count-entry.ts](../src/types/inventory-count-entry.ts)
### `InventoryCountEntryCreateSchema`
- [ ] `item_id` non-integer → rejected
- [ ] `physical_count` negative → rejected
- [ ] `physical_count=0` → accepted
- [ ] Extra `entry_date` key in the payload → silently stripped (zod default), doesn't cause a rejection or get used
### `InventoryCountEntryUpdateSchema` (PATCH)
- [ ] `physical_count` negative → rejected
- [ ] `physical_count=0` → accepted
- [ ] `item_id` in the body is ignored — it's not part of this schema, `count_id` comes from the path only

## [exchange-rate.ts](../src/types/exchange-rate.ts)
### `ExchangeRateUpdateSchema`
- [ ] `rate_value=0` → rejected (positive, not nonnegative)
- [ ] `rate_value` negative → rejected
- [ ] Positive decimal → accepted

## [recipe.ts](../src/types/recipe.ts) *(new — backs the recipe-creation endpoint)*
### `RecipeIngredientSchema` (nested)
- [ ] `item_id` non-integer → rejected
- [ ] `unit` outside `g`/`ml`/`piece` → rejected
- [ ] `quantity` negative → accepted (schema deliberately allows this — see `recipe_ingredient.quantity` comment in `schema.prisma`)
### `RecipeCreateSchema`
- [ ] `modifier_id` omitted entirely → rejected (must be present, even if `null`)
- [ ] `modifier_id=null` → accepted at the schema level (business-rule check that resellers *must* be null happens in the repository, not here)
- [ ] `ingredients=[]` → rejected (min 1)
- [ ] Fully valid payload (recipe_based, with `modifier_id`) → accepted
- [ ] Fully valid payload (reseller, `modifier_id: null`) → accepted
### `RecipeUpdateSchema`
- [ ] `{}` → rejected ("At least one field is required")
- [ ] Only `modifier_id` (including explicit `null`) → accepted
- [ ] Only `ingredients` → accepted
- [ ] `ingredients: []` (present but empty) → rejected (`.min(1)`)

## [sync.ts](../src/types/sync.ts) *(new — backs the offline order sync endpoint)*
### `OrderLineItemSyncSchema` (nested)
- [ ] `product_id` non-integer → rejected
- [ ] `quantity` ≤ 0 → rejected
- [ ] `unit_price` negative → rejected
- [ ] `modifier_id` omitted/`null` → accepted (reseller line items have no size)
### `OrderSyncRecordSchema`
- [ ] `order_id`/`session_id` missing or empty → rejected
- [ ] `created_at` missing → rejected (this is the client's local basket-open time, never server-derived — unlike `delivery.date_received`)
- [ ] `total_due` negative → accepted (refunds)
- [ ] `status` omitted → accepted, defaults applied downstream (not in the schema itself)
- [ ] `status="completed"` without `completed_at` → rejected (cross-field `.refine`)
- [ ] `status="completed"` with `completed_at` → accepted
- [ ] `status="open"` (or omitted) with `completed_at` omitted → accepted
- [ ] `line_items: []` → accepted (an opened, still-empty basket is valid)
- [ ] `transaction_type`/`order_type` outside their enums → rejected
- [ ] Fully valid payload → accepted
### `SyncRecordsRequestSchema`
- [ ] `records: []` → rejected (`.min(1)`)
- [ ] One invalid record among several valid ones → whole payload rejected (schema-level; per-record failure only happens after this, in the repository)
