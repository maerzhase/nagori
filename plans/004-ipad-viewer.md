# Plan 004: Build the resilient old-iPad viewer web app

> **Executor instructions**: Follow every step and verification gate. Stop on a
> listed STOP condition. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 5a30058..HEAD -- apps/frame packages/core apps/web/src packages/ui/src`
> Plans 001–003 are expected to have changed these paths; confirm their status.

## Status

- **Priority**: P1
- **Effort**: L (4–7 days plus device soak test)
- **Risk**: HIGH — the target is unattended old hardware on unreliable Wi-Fi.
- **Depends on**: Plans 002 and 003
- **Category**: feature / performance / accessibility
- **Planned at**: commit `5a30058`, 2026-08-03

## Why this matters

The viewer is the product for the grandparents. It must stay useful during
network interruption, avoid memory growth over days, recover without a login,
and render photos legibly without controls or notifications taking over.

## Current state

Plan 001 must have proved `apps/frame` on the actual iPad and recorded its exact
model/iOS. Plan 002 should supply a device-authenticated Secure HttpOnly cookie and
revocation. Plan 003 should supply ready photo slides, a household playlist
revision, and a private transformed-image resolver. Assume original iPad Air /
iOS 12.5.7 unless the compatibility record proves a newer target. `apps/frame`
must remain independent of Next.js and React.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Checks/tests | `pnpm check && pnpm test` | exit 0 |
| Viewer E2E | `pnpm --filter @nagori/frame test:e2e` | all pass |
| Frame Worker build | `pnpm --filter @nagori/frame build` | exit 0 |
| Compatibility | `pnpm --filter @nagori/frame test:compat` | legacy syntax/API/CSS and budgets pass |

## Scope

**In scope**:

- `apps/frame/**`: `/view`, pair/manifest/media/heartbeat endpoints, state machine,
  PWA manifest/icons, service worker/cache, viewer-focused tests and setup docs.
- Photo slides and fallback empty/offline/revoked states.

**Out of scope**:

- Editing controls in viewer, family login on iPad, video/audio, reactions,
  push notifications, WebSockets, custom schedule editing/messages (Plan 005), native app,
  and automatic relaunch after device reboot.

## Git workflow

- Branch: `codex/004-ipad-viewer`
- Separate API contract, state machine, caching, and presentation commits.
- Do not deploy or register a production service worker without instruction.

## Steps

### Step 1: Define the versioned viewer manifest

Implement the pure service in `packages/core` and expose it from the frame Worker
as `GET /api/viewer/manifest`. Authenticate the device first, resolve only ready,
active photo slides whose `display_from <= now` and whose `display_until` is null
or `now < display_until`,
and return a versioned minimal shape: schema version, playlist revision,
generated time, viewer settings, and slides containing opaque slide ID, media
route URL, optional caption, and stable content version. Never return R2 keys,
uploader email, user IDs, or original filenames.

Support `If-None-Match` and 304. Enforce the product cap of 200 eligible slides
and treat an over-cap result as an observable server invariant violation rather
than silently truncating. Define
deterministic shuffle using revision plus device ID so order is stable between
polls but changes when content changes. Heartbeat/last-seen writes are throttled.

**Verify**: contract tests cover 200/304, revoked device, empty playlist,
foreign/deleted/pending/expired/future asset exclusion, exact start/end
boundaries, explicit forever inclusion, stable shuffle, and response size cap.

### Step 2: Implement a finite viewer state machine

Implement a framework-free TypeScript state machine compiled into the legacy
IIFE. Model explicit states: `booting`, `pairing-required`, `ready-online`,
`ready-offline`, `empty`, `recoverable-error`, and `revoked`. Events include
manifest success/not-modified/failure, online/offline, visibility change, timer,
media load failure, and device revocation. Keep scheduling/timers in one module
with cleanup; do not scatter intervals across components.

Poll every 60 seconds with backoff plus jitter after failures (up to 10 minutes),
and immediately on return online/visible. Continue the last valid playlist on
transient errors. A 401/403 moves to pairing-required/revoked; it must not erase
the last images before showing a clear maintainer-only recovery screen.

**Verify**: fake-timer unit tests cover every transition, timer cleanup, retry
backoff, manifest replacement only after validation, and no duplicate poll loop.

### Step 3: Add bounded offline media caching

Feature-detect and use a small versioned Cache Storage namespace. Prefer plain
local storage for the small non-secret manifest unless the physical spike proves
IndexedDB more reliable on this exact iOS version. Use either storage only
for non-secret manifest/preferences. The HttpOnly device credential remains in
the cookie. Preload current plus next five media responses; retain the last good
manifest and its available media. Evict old revision entries and place a hard
entry/estimated-byte cap. If Cache Storage is unavailable, degrade to browser
HTTP cache without breaking playback.

Do not precache the full library. Never cache auth endpoints or dashboard HTML.
Service-worker fetch handling must be allowlisted to viewer media and static
viewer assets.

**Verify**: E2E loads a playlist online, disables network, reloads, and continues
cached rotation; cache eviction and service-worker update tests pass.

### Step 4: Build the full-screen presentation

Build plain DOM nodes from the legacy IIFE, not a client island or dashboard
bundle. Render one current image
and at most one decoded next image. Use CSS opacity crossfade only, honor
`prefers-reduced-motion`, prevent layout shifts, and release obsolete object
URLs/listeners. Fit/fill defaults to `contain` to avoid cropping faces. Captions
use a high-contrast bottom scrim, large readable text, and safe-area insets.

Empty state: warm neutral clock/date plus “Waiting for family photos.” Offline:
small persistent icon/text that does not obscure the photo. Pairing/revoked
states use very large text and a simple code/instruction for a family maintainer.
No hover dependency, tiny controls, auto-playing sound, or flashing animation.

**Verify**: screenshot tests at 1024x768 landscape/portrait and actual target
resolution; automated checks confirm only two large images are mounted/decoded.

### Step 5: Add Home Screen/kiosk setup

Add `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, a
direct `apple-touch-icon`, plus a web app manifest and standalone metadata,
theme color, and viewport/safe-area behavior compatible with the target Safari.
Write a one-page setup guide: connect power/Wi-Fi, open `/pair`, add to Home
Screen, set Display Auto-Lock appropriately, start Apple Guided Access, and
recover after Wi-Fi loss, cookie expiry, revoke, update, or reboot.

**Verify**: installability metadata is present; manual checklist passes on the
physical iPad without remote dev tools left attached.

### Step 6: Run a 24-hour soak test

Use at least 50 mixed portrait/landscape images. During the run: upload new
photos, hide one, cycle Wi-Fi twice, leave offline for at least one hour, restore
network, background/foreground the app, and let the screen run overnight. Record
Safari crashes, visible stalls, memory trend if inspectable, battery/heat, stale
content duration, and recovery behavior in `docs/viewer-soak-test.md`.

**Verify**: no manual page refresh/login is required; all new photos appear
within 75 seconds online; cached playback survives the offline hour.

## Test plan

- Manifest contract and tenant/device authorization integration tests.
- State-machine unit tests with fake timers and malformed/stale manifests.
- Service-worker cache allowlist, offline reload, eviction, and upgrade tests.
- Screenshot/accessibility tests for ready, empty, offline, pairing, revoked,
  portrait, landscape, long caption, and reduced motion.
- Physical iPad 24-hour soak report is a release artifact; current browser
  emulation does not count as the legacy compatibility result.

## Done criteria

- [ ] Paired viewer starts without human account credentials.
- [ ] Online content update p95 target is verified at <=75 seconds.
- [ ] Warm viewer reloads offline and loops cached media for 24 hours.
- [ ] Cache is bounded and dashboard/auth responses are never stored by SW.
- [ ] Revocation blocks new manifest/media responses within one poll interval.
- [ ] Viewer JS budget is defined and met; only current/next image are decoded.
- [ ] `apps/frame` has no Next.js/React runtime, module script, or dynamic import.
- [ ] Legacy compatibility checks and physical-device test pass.
- [ ] All checks/builds/tests pass and Plan 004 is marked DONE.

## STOP conditions

- Exact target device/Safari version cannot run the built viewer bundle or has
  an unresolvable service-worker/cache regression.
- Service-worker caching requires exposing or persisting the raw device secret.
- Safari repeatedly kills the viewer during the soak test; capture evidence and
  reduce bundle/decoded-media/cache behavior before adding features.
- Any approach depends on Wake Lock, Web Push, WebSockets, or unsupported APIs
  without a tested progressive fallback.

## Maintenance notes

The physical-device test is authoritative; current Playwright WebKit is not
Safari 12/15. Keep
the viewer dependency graph intentionally small. Any future video, transition,
or realtime feature must re-run memory, offline, autoplay, and 24-hour tests.
