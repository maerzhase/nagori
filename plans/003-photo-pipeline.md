# Plan 003: Build the private photo ingestion and library pipeline

> **Executor instructions**: Follow every step and verification gate. Stop on a
> listed STOP condition. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 5a30058..HEAD -- apps/web apps/frame packages/core packages/ui/src`
> Plans 001 and 002 are expected to change these paths; verify both are DONE.

## Status

- **Priority**: P1
- **Effort**: L (4–7 days)
- **Risk**: HIGH — private uploads combine untrusted files, storage, and tenancy.
- **Depends on**: `plans/002-identity-households-devices.md`
- **Category**: security / feature
- **Planned at**: commit `5a30058`, 2026-08-03

## Why this matters

Phone upload is the family's primary action. It must accept common iPhone
formats, survive weak networks, avoid routing large bodies through Worker memory,
and never expose one household's objects to another. Each upload must also get a
bounded display window so the active slideshow does not grow forever.

## Current state

Plan 002 should provide authenticated users, household authorization, D1
repositories, audit events, and tests. Plan 001 should provide a private R2
binding named `MEDIA` and Images binding named `IMAGES`. Cloudflare supports
direct browser PUT via short R2 presigned URLs; CORS still must restrict the app
origin. Cloudflare Images accepts HEIC input and can emit baseline JPEG.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Checks | `pnpm check` | exit 0 |
| Tests | `pnpm test` | all pass |
| Upload E2E | `pnpm --filter @acme/web test:e2e -- upload` | all pass |
| Worker build | `pnpm --filter @acme/web cf:build` | exit 0 |

## Scope

**In scope**:

- `media_assets`, `slides`, and the initial `viewer_settings` lifecycle fields in
  schema/migrations/shared services/tests in
  `packages/core`, with human management routes in `apps/web`.
- Direct upload intent and completion flow; private media delivery helpers.
- `/app/upload` and `/app/library` mobile-first UI.
- R2 CORS example/config documentation and orphan cleanup job.

**Out of scope**:

- Video/audio, client-side facial analysis, public bucket access, public share
  links, albums, bulk ZIP, external photo-library sync, recurring schedules, and
  text-only messages.
- Viewer slideshow rendering (Plan 004).

## Git workflow

- Branch: `codex/003-photo-pipeline`
- Keep schema/service, upload protocol, processing/delivery, and UI as separate
  logical commits. Do not deploy or mutate production buckets unless instructed.

## Steps

### Step 1: Add asset and slide schemas

Create `media_assets` with immutable household/uploader/R2 key, declared and
verified MIME/size, optional dimensions/checksum, processing state
`pending|ready|failed|deleted`, and timestamps. Create `slides` with household,
kind `photo|message`, nullable asset FK, caption/message fields, state, creator,
`display_from` (UTC, inclusive), nullable `display_until` (UTC, exclusive), the
source timezone used for entry, and timestamps. Add constraints so photo slides
require an asset, and `display_until` is null or later than `display_from`. Add
indexes supporting household/state/display-window queries.

Create an initial `viewer_settings` row per household with
`default_visibility_days = 30`. Null `display_until` means explicitly “keep in
rotation,” never an accidental missing value. An expired window archives the
slide by query semantics without deleting it or requiring a cron mutation.

Any successful mutation that changes visible slides increments
`households.playlist_revision` in the same D1 batch/transaction.

**Verify**: migration/repository tests cover constraints, tenant scoping, state
transitions, default 30-day window, start-inclusive/end-exclusive eligibility,
explicit forever, expiry-to-archive, and atomic revision increments.

### Step 2: Implement two-phase direct upload

`POST /api/uploads/presign` validates membership, count (max 20), per-file size
(default 25 MB), declared type (`image/jpeg`, `image/png`, `image/webp`,
`image/heic`, `image/heif`), and household storage quota. Generate unpredictable
keys under `households/<id>/originals/<asset-id>` and short PUT URLs restricted
to key and Content-Type. Persist pending asset rows before returning URLs.

The phone uploads directly to R2. `POST /api/uploads/complete` uses the R2 binding
to HEAD each object, verifies key/type/size/checksum where available, rejects
mismatches, checks that Images can decode it, records dimensions, creates the
photo slide, assigns the requested/default visibility window, marks ready, and
bumps the revision. Make completion idempotent. Validate custom local dates using
the household IANA timezone and store UTC. If 200 slides are already eligible,
finish the asset but create its slide as archived/draft and return a clear code
requiring the family to expire or reschedule items; never silently truncate.
Never trust a filename or client-supplied R2 key.

**Verify**: integration tests cover valid JPEG/PNG/HEIC fixtures, default/custom/
future/forever windows, active-cap behavior, spoofed type,
oversize, missing object, key substitution, repeated completion, partial batch,
and cross-household asset IDs.

### Step 3: Implement private image delivery

Add a server-only function that resolves a ready asset using both asset ID and
authorized household ID, reads from R2, and transforms through Images. Define
only two stable variants initially: thumbnail (480px) and viewer (max 2048px,
bounded quality, auto orientation, baseline JPEG). Stream bodies; do not buffer
large originals in Worker memory. Set `Cache-Control: private`, an ETag derived
from immutable asset identity/variant, `nosniff`, and a safe content disposition.

The management thumbnail route in `apps/web` requires a human session. The
viewer media route in `apps/frame` is added in Plan 004 and must call this same
server-only `packages/core` resolver after device authorization.

**Verify**: tests prove authorization precedes R2 access, both variants are
bounded, HEIC becomes JPEG, 304 works, and deleted/foreign assets return 404.

### Step 4: Build the phone upload experience

Use `<input type="file" accept="image/*" multiple capture>` with camera/library
fallback. Show previews without decoding every full-size photo simultaneously.
Allow optional caption and captured date. Show a prominent “Display” control
defaulted to “Now for 30 days,” with simple 7/30/90-day, custom dates, and
explicit “Keep in rotation” choices. Then show per-file queued/uploading/
processing/done/failed status, retry only failed files, and permit leaving after
server-confirmed completion. Preserve user-entered captions across retry.

Target a one-handed flow: one dominant “Add photos” action, progressive details,
44px minimum targets, and no drag-and-drop requirement. Explain HEIC processing
briefly only when it takes longer.

**Verify**: Playwright uploads one/default and one future-scheduled fixture at a
narrow viewport, selects “keep” only after explicit confirmation, simulates one
failed PUT/retry, and sees correct dates/status in the library.

### Step 5: Build library management and deletion lifecycle

Render a paginated thumbnail grid (cursor, max 50/page) with Active, Scheduled,
Archived, Hidden, and All filters plus caption, contributor, display window,
state, and selection. Support caption edit, quick extend (7/30/90 days), keep,
archive now, hide/show, and soft delete. Warn at 150 eligible slides and show
specific remediation at the 200-slide cap.
Default deletion retention is 30 days: exclude immediately from viewer, retain
metadata/object for restore, then purge via a scheduled cleanup Worker. Also
clean stale pending uploads older than 24 hours. R2 deletion is idempotent and
cleanup logs counts/IDs, never captions or signed URLs.

**Verify**: tests cover pagination stability, edit permissions, hide/revision,
delete/restore/revision, expired purge, and orphan cleanup retry.

## Test plan

- Small checked-in image fixtures including rotated JPEG and HEIC; document
  origin/license of fixtures.
- Service tests for limits, state machine, tenant authorization, scheduling/
  expiry boundaries, active cap, and revision.
- R2/Images integration tests or faithful binding fakes plus one preview smoke.
- E2E for camera/library-style selection, batch progress, retry, library edit,
  hide, delete, and restore.
- Confirm no test snapshot contains bearer URLs or user captions.

## Done criteria

- [ ] R2 bucket is private and documented CORS allows only required methods and origins.
- [ ] Worker never buffers full upload bodies; uploads go browser-to-R2.
- [ ] HEIC fixture completes and a baseline JPEG viewer transform is produced.
- [ ] Every object lookup is household scoped and negative isolation tests pass.
- [ ] Every created slide has an intentional display window; default is 30 days.
- [ ] Active/scheduled/archive filters and cap warning/remediation work.
- [ ] Upload, retry, scheduling, library edit, hide, delete, restore E2E tests pass.
- [ ] `pnpm check && pnpm test && pnpm build && pnpm --filter @acme/web cf:build` exits 0.
- [ ] Plan 003 is marked DONE.

## STOP conditions

- Presigned PUT generation requires shipping R2 credentials to the browser.
- Current Images behavior cannot decode the selected iPhone HEIC fixtures; report
  and propose a bounded server-side conversion spike rather than silently dropping HEIC.
- R2 CORS requires wildcard production origins.
- D1 writes and revision increment cannot be made atomic with the chosen API.
- A delivery design requires making originals publicly readable.

## Maintenance notes

Changing image variants affects cache keys and old-device bandwidth. Keep
originals immutable; edits should create new derived behavior, not overwrite an
R2 object in place. Monitor stale pending rows and failed transforms before
raising batch limits or adding video.
