# Plan 005: Complete slideshow lifecycle, messages, and scheduling UI

> **Executor instructions**: Follow every step and verification gate. Stop on a
> listed STOP condition. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 5a30058..HEAD -- apps/web apps/frame packages/core packages/ui/src`
> Plans 003 and 004 intentionally establish the slide/manifest contracts; confirm them first.

## Status

- **Priority**: P1
- **Effort**: L (4–6 days)
- **Risk**: MED — timezones and active-playlist rules create boundary bugs.
- **Depends on**: Plans 003 and 004
- **Category**: feature / correctness
- **Planned at**: commit `5a30058`, 2026-08-03

## Why this matters

Plan 003 prevents unbounded growth by giving every photo a display window,
defaulting to 30 days. This plan makes that lifecycle fully manageable: future
scheduling, extension, archive/restore, explicit favorites, settings, and
scheduled text messages. Behavior must remain predictable at timezone and
daylight-saving boundaries without becoming a calendar system.

## Current state

Plan 003 should provide `slides` with photo/message kinds and atomic playlist
revision. Plan 004 should provide a versioned manifest, deterministic ordering,
and a viewer state machine. Extend those seams; do not create a parallel
playlist engine in route components.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Checks/tests | `pnpm check && pnpm test` | exit 0 |
| Scheduling tests | `pnpm --filter @acme/web test:unit -- schedule` | all pass |
| E2E | `pnpm --filter @acme/web test:e2e -- schedule` | all pass |
| Builds | `pnpm build && pnpm --filter @acme/web cf:build` | exit 0 |

## Scope

**In scope**:

- Extended `viewer_settings` plus the existing `slides.display_from` /
  `slides.display_until` services/routes/tests.
- `/app/schedule` and relevant library create/edit affordances.
- Text-only message slides and viewer rendering.

**Out of scope**:

- Recurrence rules, calendars, weather, reminders/notifications, weighted
  campaigns, per-device schedules, video, or scheduling deletion itself.

## Git workflow

- Branch: `codex/005-schedules-and-messages`
- Commit settings, schedule engine, management UI, then viewer extension.
- Do not deploy unless instructed.

## Steps

### Step 1: Define settings and schedule invariants

Extend the `viewer_settings` row created in Plan 003: order `shuffle|newest`, duration
`8|12|20` seconds, fit `contain|cover`, captions boolean, and optional quiet
hours as local `HH:mm` start/end, and editable default visibility of 7/30/60/90
days. Continue using each slide's UTC start-inclusive/end-exclusive window and
source timezone. Custom windows may be at most one year; null end requires an
explicit “Keep in rotation” action. MVP supports one window per slide and no recurrence.

Use the household IANA timezone for form parsing/preview. Reject nonexistent
local times during DST spring-forward; when a local time is ambiguous, require
the UI to show/select the offset. Never use server or device local timezone.

**Verify**: migration/service tests cover constraints, normal dates, midnight,
end-exclusive behavior, DST gap/overlap, and household timezone changes.

### Step 2: Centralize active-playlist resolution

Extend the one pure playlist service in `packages/core`. Eligible slides are
active, ready (for photos), and within `[displayFrom, displayUntil)`, with null
end reserved for explicit keep-in-rotation items. Newly started scheduled slides
sort first on the first manifest after revision, then participate once per
rotation. Expired items are archived and absent. If zero eligible slides exist,
return the empty state. Quiet hours return the normal manifest plus an explicit
display-off flag; viewer dims to black and still polls.

All schedule/settings mutations validate capability and atomically bump playlist
revision. Define behavior with a truth table in service docs and tests.

**Verify**: table-driven tests cover before/start/during/end/after, default expiry,
future/custom/forever windows, settings changes, quiet hours crossing midnight,
150 warning, 200 hard cap, and 304.

### Step 3: Build text-only message slides

Allow contributors to create a message of 1–280 Unicode characters with one of
three accessible, predefined visual themes. Plain text only; do not render HTML,
Markdown, links, or user-controlled CSS. Record creator/time and support edit,
hide, soft-delete, restore, and mandatory display window using the same authorization
rules as photos.

Viewer rendering in the framework-free `apps/frame` legacy bundle uses large
responsive text, strong contrast, centered safe layout, and reduced motion.
Test long words, emoji, combining characters,
right-to-left text, and the configured household language.

**Verify**: injection strings render literally, length is counted consistently,
and screenshot/accessibility tests pass for all themes and edge strings.

### Step 4: Build the scheduling/settings UI

Create one simple screen plus Active/Scheduled/Archived library views with a
live plain-language summary: “This will appear
from Friday 08:00 until Sunday 22:00 in Europe/Lisbon.” Use native date/time
inputs with explicit timezone label. New photos default to the household setting
(initially 30 days). Allow archive now, extend, schedule again, or explicitly
keep; never “clear” a window into an accidental forever slide.

Settings use segmented/select controls with immediate preview but explicit Save.
Explain `contain` vs `cover` visually. Quiet hours are optional and preview the
next on/off transition. Contributors may schedule their own slides; admins/owners
may schedule any slide and change household viewer settings.

**Verify**: E2E creates a message, future-schedules a photo, previews timezone,
changes default duration, extends an expiring slide, archives/restores one,
explicitly keeps one, and verifies contributor/admin permissions.

### Step 5: Extend viewer behavior

Extend the existing shared manifest schema version deliberately. In `apps/frame`,
render message slides
and apply duration, fit, caption, order, and quiet-hours flags. When schema is
unsupported, continue the last valid cached manifest and show a maintainer-level
update warning rather than crashing. Schedule changes should appear on the next
poll without a page reload.

**Verify**: viewer E2E advances through photo/message, applies settings, enters
and exits quiet hours under a fake clock, and falls back on unknown schema.

## Test plan

- Table-driven timezone/DST and playlist eligibility unit tests.
- Integration tests for permission, input validation, atomic revision, and ETag.
- XSS/content tests for message slides; no `dangerouslySetInnerHTML`.
- E2E for create/edit/schedule/clear/settings and live viewer refresh.
- Visual tests for contain/cover, captions, message themes, quiet and empty states.

## Done criteria

- [ ] Every slide has an intentional start and either bounded end or explicit keep.
- [ ] Default visibility is 30 days and configurable to bounded presets.
- [ ] Schedule calculations use stored household timezone and UTC persistence.
- [ ] Active interval is start-inclusive/end-exclusive and DST cases pass.
- [ ] Messages are plain text, bounded to 280 characters, and meet contrast/readability checks.
- [ ] Settings and schedule mutations atomically increment revision.
- [ ] Viewer updates on next poll and survives unknown manifest schema.
- [ ] Legacy bundle compatibility/size checks still pass after message support.
- [ ] All checks/tests/builds pass and Plan 005 is marked DONE.

## STOP conditions

- The chosen timezone library does not run in Workers (timezone calculation is
  server-side; the frame consumes UTC manifest values only).
- A requested design introduces arbitrary recurrence; split that into a later plan.
- Quiet hours require relying on the iPad's incorrect/uncontrolled local clock.
- Message presentation requires rendering user HTML or CSS.
- Scheduling/message work introduces Next.js/React into `apps/frame`.

## Maintenance notes

Keep the schedule model deliberately narrower than RFC recurrence. If recurring
birthdays become important, add a separate design plan covering leap years,
DST, editing series, and preview—not a nullable recurrence string on this table.
