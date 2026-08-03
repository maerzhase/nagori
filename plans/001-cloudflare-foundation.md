# Plan 001: Prove old-iPad compatibility and establish Cloudflare foundations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command before moving on. If a STOP condition occurs, stop and
> report; do not improvise. When done, update this plan's status row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a30058..HEAD -- package.json pnpm-workspace.yaml turbo.json apps/web apps/frame packages/core .github README.md`
> Compare changed files with the current-state notes below before proceeding.

## Status

- **Priority**: P1
- **Effort**: L (4–6 days including physical-device compatibility testing)
- **Risk**: HIGH — an original iPad Air runs a browser far below Next.js support.
- **Depends on**: none
- **Category**: architecture / tests / DX
- **Planned at**: commit `5a30058`, 2026-08-03

## Why this matters

The repository builds a generic Next.js app, but Next.js 16 officially targets
Safari 16.4+ while the worst-case tablet is an original iPad Air on iOS 12.5.7.
Before product work, prove a tiny standalone viewer on the physical tablet and
establish separate modern-dashboard and legacy-frame Workers with shared domain
services, D1/R2/Images bindings, tests, and preview-deploy checks.

## Current state

- `package.json:15-30` uses Turbo for `build`, `check`, lint, format, and
  typecheck. Keep those root entry points.
- `apps/web/package.json:22-30` has Next build/dev and Biome/TypeScript checks,
  but no test, Worker preview, or deploy scripts.
- `apps/web/next.config.ts:3-5` only transpiles `@acme/ui`.
- `.github/workflows/code-check.yml:24-28` installs with a frozen lockfile and
  runs `pnpm run check` plus build. Extend this workflow rather than adding a
  competing CI workflow.
- `pnpm check` cannot currently run in this checkout because dependencies are
  absent and the supply-chain policy requires installation first.
- Cloudflare's supported Next.js path uses `@opennextjs/cloudflare`, Wrangler,
  `nodejs_compat`, and an `.open-next/worker.js` entry.
- Apple model numbers: original Air A1474/A1475/A1476; Air 2 A1566/A1567.
  Until inspected, target iOS 12 Safari/WebKit behavior.
- Do not use Next.js or React in `apps/frame`. Its output must be conservative
  HTML/CSS plus one legacy-targeted IIFE with feature detection and fallbacks.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Static checks | `pnpm check` | exit 0, no lint/type/format errors |
| Unit/integration | `pnpm test` | exit 0, all tests pass |
| Next build | `pnpm build` | exit 0 |
| Dashboard Worker build | `pnpm --filter @acme/web cf:build` | exit 0; `.open-next/worker.js` exists |
| Frame legacy build | `pnpm --filter @nagori/frame build` | exit 0; one legacy IIFE and static assets exist |
| Frame compatibility check | `pnpm --filter @nagori/frame test:compat` | legacy syntax/API/CSS and budgets pass |
| D1 local migration | `pnpm --filter @nagori/core db:migrate:local` | exit 0 against local D1 |

## Scope

**In scope**:

- Root `package.json`, `turbo.json`, `pnpm-lock.yaml`, `README.md`, `.gitignore`,
  `.github/workflows/code-check.yml`, and `.env.example`.
- `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/wrangler.jsonc`,
  `apps/web/open-next.config.ts`, `apps/web/drizzle.config.ts`, and generated
  Cloudflare binding types.
- `apps/web/src/db/**`, `apps/web/src/env/**`, `apps/web/src/app/api/health/**`.
- `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, test setup, and
  one smoke test at each layer.
- New `apps/frame/**`: a separate static/Worker package, legacy build config,
  compatibility probe, Wrangler config, and its unit/browser tests.
- New server-only `packages/core/**`: initial safe shared contracts and binding
  types used by both Workers. Do not add browser dependencies to this package.

**Out of scope**:

- Product authentication, household tables, uploads, production viewer UI,
  production secrets, and creating/deleting production Cloudflare resources.
- Publishing `@acme/ui`; it remains a workspace package.

## Git workflow

- Branch: `codex/001-cloudflare-foundation`
- Use conventional commits, matching the repository's automation messages;
  e.g. `chore: configure Cloudflare previews`.
- Do not push, deploy, or provision Cloudflare resources without operator approval.

## Steps

### Step 1: Identify the device and run a compatibility spike

Record the model number from the back cover and the exact version from Settings
> General > About in `docs/device-compatibility.md`. Map A1474/A1475/A1476 to
original Air and A1566/A1567 to Air 2. Do not record serial number, Apple ID, or
other identifiers.

Create the minimum `apps/frame` spike: static HTML/CSS, one TypeScript entry
compiled as a single IIFE targeting Safari/iOS 12 syntax, a 10-second two-image
loop, JSON fetch/poll, online/offline indicator, feature detection, and an
allowlisted Service Worker cache with a browser-cache fallback. Use no framework,
dynamic import, code splitting, user content, or authentication yet. Include
`apple-mobile-web-app-capable` and `apple-touch-icon` alongside a manifest.

Serve the spike over HTTPS, add it to the actual iPad Home Screen, then verify:
initial load, full-screen launch, one-hour loop, background/foreground, offline
reload after warm cache, reconnect, orientation, and timer recovery. Record the
result and WebKit user agent. This physical-device gate cannot be replaced by
current Playwright WebKit.

**Verify**: every row in `docs/device-compatibility.md` is PASS, or stop and
record the smallest failing capability and proposed fallback.

### Step 2: Baseline dependencies and tests

Install the frozen lockfile. Add Vitest with the Cloudflare Workers pool for
server/service tests and Playwright for browser smoke tests. Add `test`,
`test:unit`, and `test:e2e` scripts to both apps, expose `test` through Turbo,
and add root `test`/`test:e2e` scripts. Keep Biome as formatter/linter.

Create a trivial pure unit test and modern browser tests for both surfaces. Add
a static compatibility checker for `apps/frame/dist`: parse the emitted JS at
the selected legacy target, reject dynamic imports/module scripts, enforce JS/CSS
budgets, and grep for a denylist of unsupported APIs unless behind approved
feature-detection wrappers. Pin versions per `syncpack.config.json`.

**Verify**: `pnpm test && pnpm check` -> exit 0, at least one unit test passes.

### Step 3: Configure two Workers and a shared core

Add compatible versions of `@opennextjs/cloudflare` and Wrangler. Configure
`apps/web` as the Next.js dashboard Worker with `nodejs_compat`, static assets,
and D1 `DB`, private R2 `MEDIA`, and Images `IMAGES` bindings. Configure
`apps/frame` as a separate Worker/static-assets project on an isolated subdomain
with the same storage bindings but only frame routes. Keep local, preview, and
production resources separate and never commit real resource IDs or secrets.

Establish `packages/core` as a server-only shared package with no browser entry.
Both Workers declare it as a workspace dependency, and neither imports the
other app. Keep custom domains and remote resource provisioning in documented,
explicit deployment steps.

**Verify**: both Worker builds exit 0; `.open-next/worker.js` exists for the
dashboard, and frame output contains one Safari 12-compatible IIFE/no Next chunks.

### Step 4: Establish typed environment access

Create a small server-only environment module that exposes only validated
bindings/configuration. Add `.env.example` with names and safe descriptions for
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `INITIAL_OWNER_EMAIL`, email provider
credentials and Turnstile values; use blank example values. R2 presigning may
use narrowly scoped S3 credentials stored only as Worker secrets. Add a startup/test
failure for missing required production values while permitting explicit local
test doubles.

**Verify**: run its unit tests -> missing required production configuration is
rejected; test/local configuration is accepted without real secrets.

### Step 5: Add D1/Drizzle and migration mechanics

Configure Drizzle for SQLite/D1. Create an initial migration containing only a
small `system_metadata` table so migration behavior can be exercised without
preempting Plan 002's domain schema. Add deterministic local and remote migration
scripts; remote commands must require an explicit environment argument. Use a
local D1 database in tests—never production.

**Verify**: recreate local D1, apply migrations twice, and query
`system_metadata` -> both applies exit 0 and the table exists once.

### Step 6: Add runtime health endpoints

Create safe health endpoints in both Workers returning build SHA/version and
checks for runtime and D1 reachability. Do not expose resource IDs, stack traces,
or secrets. R2/Images checks should be
deployment smoke tests, not writes on
every health request.

**Verify**: integration test -> healthy response is 200 with the documented
schema; simulated D1 failure is 503 with a generic error code.

### Step 7: Extend CI and documentation

Update the existing code-check workflow to run static checks, unit/integration
tests, both Worker builds, legacy bundle checks, and browser smoke tests with
dependency/browser caching. Document local setup, resource prerequisites,
environment names, migrations, preview, and deploy commands. Add a manual deploy checklist;
do not auto-deploy production in this plan.

**Verify**: run every CI command locally in workflow order -> all exit 0.

## Test plan

- Pure unit smoke test for the test runner.
- Environment validation success/failure tests.
- D1 migration idempotency test against a local database.
- Health route success and dependency-failure integration tests.
- Playwright smoke at an iPhone-like viewport and 1024x768 tablet viewport.
- Physical-device compatibility checklist for exact iPad model/iOS, including
  Home Screen, offline cache, reconnect, orientation, timers, and one-hour loop.
- Emitted legacy bundle syntax/API/CSS and size-budget checks.

## Done criteria

- [ ] Exact model/iOS is recorded without unique device identifiers.
- [ ] The compatibility spike passes on the physical iPad for one hour.
- [ ] `apps/frame` contains no Next.js/React dependency and its built JS is a
  single Safari 12-compatible IIFE within the agreed size budget.
- [ ] `pnpm check`, `pnpm test`, `pnpm build`, and both Worker builds exit 0.
- [ ] CI runs those same commands from a frozen install.
- [ ] Local D1 migrations are repeatable and documented.
- [ ] No secret or real Cloudflare resource ID is tracked by git.
- [ ] `git status --short` contains only in-scope files and expected lockfile changes.
- [ ] `plans/README.md` marks Plan 001 DONE.

## STOP conditions

- A required Cloudflare capability needs a paid or beta product the operator has
  not chosen.
- The physical iPad fails the minimal slideshow, fetch, timer, or warm offline
  test even after a bounded fallback attempt; compatibility is a product blocker.
- The frame Worker requires importing Next.js/React or serving their client runtime.
- The only working pairing/session approach requires a human dashboard login on the iPad.
- A command would create, mutate, deploy, or delete remote resources without
  explicit operator authorization.

## Maintenance notes

Keep the legacy compatibility document and budget in CI permanently; current
Playwright is not a substitute for the physical iPad. Keep compatibility dates,
OpenNext, Wrangler, and binding types tested. Worker rollback does not roll back
D1 rows or R2 objects, so code and data recovery remain separate procedures.
