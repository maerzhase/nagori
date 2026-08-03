# Memory Screen implementation plans

Generated with the `improve` skill on 2026-08-03. The repository is a fresh
pnpm/Turborepo template, so these plans define the product and architecture as
well as the implementation order. Execute plans in order, read each plan in
full, honor its STOP conditions, and update the status table after each plan.

## Product in one sentence

Memory Screen turns an old iPad into a calm, remotely managed family photo
frame: invited relatives upload photos and short messages from their phones,
while the iPad continuously displays the current playlist without requiring
the grandparents to sign in or operate it.

## Product principles

1. **The recipient does nothing.** After one-time pairing, the viewer recovers
   from refreshes, lost connectivity, and app restarts without a login prompt.
2. **Sending a memory takes under a minute.** On a phone: choose photos, add an
   optional caption/date, upload, done.
3. **Private by default.** Media is never in a public bucket; every management
   mutation is authorized by household membership and every viewer read is
   authorized by a revocable device session.
4. **Designed for the oldest plausible hardware.** Until the model is confirmed,
   treat the tablet as a first-generation iPad Air on iOS 12.5.7. The viewer is
   a separate legacy-targeted bundle: no Next.js/React runtime, large client
   bundle, WebSocket, heavy animation, or full-library preloading.
5. **One excellent household experience before platform features.** The data
   model may support multiple households and frames, but billing, discovery,
   social feeds, native apps, and public sharing are not MVP work.

## Recommended MVP

### Family dashboard

- Invitation-only accounts with owner, admin, and contributor roles.
- Create a household, set its name and IANA timezone, invite relatives, revoke
  access, and see who uploaded each item.
- Mobile-first multi-photo upload from the iPhone camera or library, including
  HEIC input, upload progress, retry, optional caption, and captured date.
- Library with thumbnail grid, contributor/date metadata, edit caption, hide,
  restore, and delete.
- Default slideshow settings: shuffle or newest-first, 8/12/20-second duration,
  fit or fill, caption visibility, and optional daily quiet hours.
- Every slide has a visibility lifecycle. New uploads default to “show now for
  30 days”; family can choose a future start, custom end, or explicitly mark a
  favorite “keep in rotation.” Expired slides move to the archive, not deletion.
- Device screen showing pairing, last-seen time, software compatibility,
  playlist revision, and a revoke/re-pair action.

### iPad viewer

- One-time six-digit pairing flow; no family password is stored on the iPad.
- Full-screen photo/message loop with restrained crossfade, optional caption,
  clear offline/reconnecting state, clock only when the playlist is empty, and
  an unobtrusive “updated” indicator.
- Poll a lightweight manifest every 60 seconds and immediately when the page
  regains connectivity or visibility. No WebSocket/Durable Object in MVP.
- Cache the current slide, next five slides, and last known manifest. If the
  network disappears, continue the cached rotation indefinitely.
- Install as a Home Screen web app. Document iPad Auto-Lock and Apple Guided
  Access setup; Guided Access can restrict the tablet to the viewer app.

## Old-iPad compatibility baseline

The exact model number is the first implementation input. Apple identifies the
original iPad Air as A1474/A1475/A1476 and the iPad Air 2 as A1566/A1567. The
original Air received iOS 12.5.7; therefore the conservative target is iOS 12
WebKit until the back-cover model number and Settings > General > About version
prove otherwise.

This makes a single Next.js client inappropriate for both surfaces. Next.js 16
officially supports Safari 16.4+, far newer than either an iOS 12 original Air
or an iPadOS 15 Air 2. The family dashboard may remain modern Next.js because it
runs on current phones/computers, but the iPad frame must be separately compiled
and physically tested against the old WebKit engine.

Compatibility contract for the frame:

- Vanilla TypeScript and DOM APIs, compiled as one Safari 12-compatible IIFE;
  no React, RSC payload, hydration, dynamic import, or code splitting.
- Conservative CSS (flexbox/absolute positioning, opacity transitions, explicit
  vendor-tested full-screen/safe-area behavior); no reliance on modern-only CSS.
- Feature-detect Service Worker, Cache Storage, IndexedDB, Page Visibility, and
  online/offline events. Each enhancement has a network/browser-cache fallback.
- Use `apple-mobile-web-app-capable` and `apple-touch-icon` in addition to a web
  manifest because older iOS predates newer manifest improvements.
- Baseline JPEG at bounded dimensions; render only current and next image.
- Hard budgets: initial compressed JS <= 35 KB, CSS <= 15 KB, no image over
  2048px long edge, and no more than two decoded full-size images at once.
- The actual iPad is a mandatory test target. Current Playwright WebKit is useful
  for behavior but is not evidence of compatibility with Safari 12/15.

Security caveat: an iPad that no longer receives OS/WebKit security updates can
never be made fully secure. Reduce exposure by using a dedicated read-only device
credential, an isolated frame subdomain, no human login/admin code, a strict CSP,
private derived media only, immediate revocation, and no access to originals.

Compatibility references:

- Apple model identification: https://support.apple.com/en-gb/108043
- Apple iOS 12.5.7 security release for the original iPad Air: https://support.apple.com/en-asia/103015
- Next.js supported browsers: https://nextjs.org/docs/architecture/supported-browsers
- WebKit Service Worker/Cache API introduction and 50 MiB quota: https://webkit.org/blog/8090/workers-at-your-service/

## Explicit non-goals for MVP

- Video, audio, reactions, comments, face recognition, Google/iCloud Photos
  sync, weather, calendar, per-device playlists, native iOS apps, public links,
  end-to-end encryption, and arbitrary recurring schedules.
- “Instant” push delivery. A one-minute update target is adequate and avoids a
  persistent connection on old hardware.
- Automatic relaunch after an iPad reboot. A browser app cannot guarantee this;
  the setup guide must state that a person may need to reopen it after reboot.

## Market-informed scope choices

Current frame products converge on remote family contribution, captions,
adjustable slideshow timing/order, simple pairing, and optional schedules.
Aura also emphasizes multiple contributors, captions, gift-style preloading,
and remote frame management; Frameo exposes captions, greetings, albums,
reactions, calendar widgets, and timed views. For this product, keep the first
five concepts and defer reactions, video, calendar, weather, and smart pairing.
They add surface area without improving the core “grandparents do nothing” job.

Primary references:

- Aura feature overview: https://help.auraframes.com/hc/en-us/articles/360053532493-Detailed-overview-of-the-Aura-app-features
- Aura current model/common-feature overview: https://help.auraframes.com/hc/en-us/articles/360049410694-Overview-of-Aura-Frame-Models
- Frameo plans and feature comparison: https://www.frameo.com/subscriptions/
- Apple Guided Access: https://support.apple.com/guide/ipad/lock-ipad-to-one-app-ipada16d1374/ipados

## Architecture decision

```text
Current iPhone / desktop              Original or Air 2 iPad
app.memory-screen.example             frame.memory-screen.example
Next.js dashboard Worker              tiny legacy Frame Worker
human session cookie                  read-only device cookie
            \                          /
             +---- shared packages/core ----+
                         |       |
                        D1     Images binding
                                  |
                              private R2
```

- Deploy two Cloudflare Workers from the monorepo. `apps/web` is the modern
  Next.js dashboard/API through OpenNext; `apps/frame` is the isolated static
  legacy viewer plus only pair, manifest, media, and heartbeat routes.
- Add a server-only `packages/core` for shared schema, repositories, playlist
  rules, authorization primitives, and safe API contracts used by both Workers.
- Use D1 through Drizzle for metadata. D1 provides binding-native access,
  transactions/batches, foreign keys, indexes, per-query row metrics, and no
  compute-hour billing.
- Use Better Auth only for human accounts/sessions. Implement household roles
  in the product schema rather than adopting a general organization plugin.
- Use a private R2 bucket for original assets. Upload directly through short
  presigned PUT URLs, then verify object metadata in a completion endpoint.
- Use the Images binding to normalize supported uploads, including HEIC, into
  bounded baseline JPEGs. Cache stable thumbnail/viewer variants and never serve
  an original to the old iPad.
- Serve derivatives through the frame Worker's authenticated same-origin media
  route. Never expose the R2 bucket or long-lived signed GET URLs.
- Increment `households.playlist_revision` in the same D1 batch/transaction as
  every mutation that can change the active manifest. The viewer uses revision
  and ETag to avoid downloading an unchanged manifest.
- Use UTC in storage. Convert schedule form values with the household's IANA
  timezone and test daylight-saving boundaries.

Cloudflare references:

- Next.js on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Images pricing: https://developers.cloudflare.com/images/pricing/

## Expected Cloudflare usage and cost guardrails

For one household and one frame, the MVP should fit the current free allowances:

- One 60-second manifest poll is 1,440 Worker requests/day. Even with media and
  dashboard traffic, this is well below Workers Free's 100,000 requests/day.
- At the 200-active-slide cap, a deliberately simple indexed manifest query is
  approximately 288,000 D1 rows read/day, below the 5 million/day free limit.
- D1 includes 100,000 rows written/day and 5 GB total storage on Workers Free;
  metadata/captions should be far below both.
- R2 Standard includes 10 GB-month storage, 1 million writes/month, 10 million
  reads/month, and free egress. R2—not D1—is the first likely cost if thousands
  of originals are retained indefinitely.
- Images Free includes 5,000 unique transformations/month. Use exactly two stable
  variants per asset (thumbnail and viewer), avoid dimension-per-request URLs,
  and alert before 4,000 unique transformations in a month.

Add dashboard/admin usage warnings at 8 GB R2 storage, 4,000 monthly unique image
transforms, 80,000 Worker requests/day, and 4 million D1 rows read/day. These are
early-warning thresholds, not product limits. Scheduling controls rotation size;
archive/delete/retention controls R2 storage size.

## Core data model

All IDs are opaque text IDs (UUIDv7 or equivalent); all timestamps are UTC ISO
strings or integer milliseconds, chosen once and used consistently.

| Table | Purpose and important fields |
|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Better Auth-managed identity/session data. |
| `households` | `id`, `name`, `timezone`, `playlist_revision`, timestamps. |
| `memberships` | `(household_id,user_id)` unique, role `owner/admin/contributor`, status. |
| `invitations` | household, normalized email, role, token hash, expiry, inviter, accepted/revoked timestamps. |
| `devices` | household, name, secret hash, created/last-seen/revoked timestamps, user-agent capability summary. |
| `pairing_codes` | device/household, code hash, expiry, attempts, consumed timestamp. |
| `media_assets` | household, uploader, R2 key, MIME, byte size, dimensions, checksum, processing state, timestamps. |
| `slides` | household, kind, optional asset, caption/message, `display_from`, nullable `display_until`, source timezone, state, creator, timestamps. |
| `viewer_settings` | household, order, seconds, fit, captions, quiet hours, `default_visibility_days` (30). |
| `audit_events` | actor user/device, household, action, target type/id, safe metadata, timestamp. No secrets or captions. |

Authorization rule: every query for household-owned data includes the resolved
`household_id`; never fetch by object ID and authorize afterward. Owners manage
owners and deletion, admins manage members/devices/content/settings, and
contributors manage their own uploads plus create slides. Devices can only read
their household's active viewer manifest and derived media.

## Route and API map

```text
Modern dashboard Worker                   Legacy frame Worker
/login                                    /pair
/invite/[token]                           /view
/app                                      /api/viewer/pair
/app/upload                               /api/viewer/manifest
/app/library                              /api/viewer/media/[id]
/app/schedule                             /api/viewer/heartbeat
/app/family
/app/devices
/api/auth/[...all]
/api/uploads/*
/api/slides/*
/api/settings
/api/invitations/*
/api/devices/*
```

## Execution order and status

| Plan | Title | Priority | Effort | Depends on | Status |
|---|---|---:|---:|---|---|
| 001 | Prove old-iPad compatibility and establish Cloudflare foundations | P1 | L | — | TODO |
| 002 | Add accounts, households, roles, and secure device pairing | P1 | L | 001 | TODO |
| 003 | Build the private photo ingestion and library pipeline | P1 | L | 002 | TODO |
| 004 | Build the resilient old-iPad viewer PWA | P1 | L | 002, 003 | TODO |
| 005 | Complete slideshow lifecycle, messages, and scheduling UI | P1 | L | 003, 004 | TODO |
| 006 | Harden, observe, document, and release the MVP | P1 | M | 001–005 | TODO |

## Dependency notes

- Plan 001 first proves a minimal frame on the actual iPad, then establishes the
  two-Worker runtime, shared core, tests, and deploy previews required by all plans.
- Plan 002 creates tenant authorization and viewer device identity. No content
  route may land before these boundaries exist.
- Plan 003 supplies normalized images and the mandatory 30-day slide lifecycle;
  Plan 004 consumes only currently eligible slides in its manifest.
- Plan 005 completes custom/future scheduling, archive management, messages, and
  settings through the same eligibility service and viewer end-to-end tests.
- Plan 006 is a release gate, not optional cleanup. Private family media and a
  remotely unattended device make recovery, revocation, and logging core work.

## Release milestones

1. **Compatibility gate:** identify the model/iOS, run the legacy viewer probe,
   and reject or adjust the web approach before implementing product features.
2. **Technical alpha:** one owner, one paired iPad, ten seeded images, deploy
   preview, and a 24-hour soak test on the actual tablet.
3. **Family beta:** invitations, phone upload, delete/restore, offline playback,
   and device health; invite two relatives and run for one week.
4. **MVP:** scheduled photo/message slides, quiet hours, accessibility review,
   runbook, backup/restore drill, and production deployment.

## Success metrics

- Median signed-in path from choosing one photo to accepted upload under 60s.
- A completed upload appears on an online viewer within 75s at p95.
- A normal upload leaves the active rotation after 30 days unless a family member
  explicitly changes its window or marks it to remain.
- The dashboard warns at 150 active slides and prevents silent growth beyond the
  configured hard cap (default 200) until items are rescheduled/archived.
- Viewer continues for at least 24h with the network disabled after warm cache.
- No normal viewer state exposes a family login or requires recipient action.
- Revoking a device blocks its next manifest/media request within 60s.
- All state-changing endpoints have authentication, tenant authorization,
  schema validation, rate limiting where abuse is plausible, and an audit event.

## Decisions to confirm before or during Plan 001

- Record the back-cover model number and Settings > General > About software
  version. Until confirmed, implementation targets original iPad Air/iOS 12.5.7.
- Confirm the production household timezone and language. Store both so copy
  and schedule previews match the grandparents' context.
- Select an email sender/domain. The default plan uses an `EmailProvider`
  interface backed by Resend's HTTP API for verification, reset, and invites.
- Decide retention after deletion. Default: 30-day soft delete, then purge R2.

## Findings considered and rejected

- **Native iOS application:** rejected for MVP because a Home Screen web app and
  Guided Access cover the kiosk use case without App Store/device signing work.
- **WebSockets for instant updates:** rejected because 60-second conditional
  polling is sufficient and more robust on old Safari.
- **Split Vercel + Cloudflare infrastructure:** rejected because it adds
  cross-provider credentials, database compute behavior, and image-processing
  plumbing while this workload fits comfortably in native Worker bindings.
- **On-request transformation without stable variants:** rejected; use stable
  cached thumbnail/viewer transformations so the old frame path is predictable.
- **Video:** deferred until photo delivery has proven reliable; codec, sound,
  memory, bandwidth, and autoplay behavior materially expand the test matrix.
- **Calendar/weather/reactions:** deferred as market-adjacent features that do
  not improve the core one-way sharing workflow enough for the first release.
- **Multiple different playlists per household:** deferred; multiple paired
  devices mirror one household playlist in MVP.

## Audit scope

The fresh template was reviewed for framework, package-manager, CI, styling,
and verification conventions. There is no product code to audit yet. Dependency
installation/audit and browser compatibility could not be verified because the
workspace has no installed dependencies; `pnpm check` currently exits with
`ERR_PNPM_VERIFY_DEPS_BEFORE_RUN` and must be baselined in Plan 001.
