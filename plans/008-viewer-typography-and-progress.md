# Plan 008: Unify typography and add a compact viewer progress indicator

> Executor: read this entire plan before editing. Implement the requested viewer
> polish, run the gates, and record results below. This file is self-contained.
> Planned at commit `2e86723`, 2026-09-06. Priority P2; effort M; risk MED
> (slideshow timing); category bug/UX. Depends on current implemented viewer,
> not completion of the historical TODO rows in this directory.

## Outcome and decisions

Load **Inter for interface text** on the dashboard, viewer, and Storybook;
retain **Georgia for editorial headings, captions, and message slides**.
This preserves the app's existing visual language. “Consistent” means consistent
roles and shared declarations, not removing the intentional serif/sans pairing.
Keep monospace for codes where already intentional. Do not introduce Lora or
another display family in this modest improvement.

Fix the viewer's Safari 12 font-size failure and improve viewing-distance
readability. Add a small bottom-center pill containing `3 / 24`, a thin elapsed
bar, and a pause/resume button. Use plain DOM/CSS/TypeScript, no carousel library.
The counter describes playlist position; the bar describes time on this slide.

## Evidence and current state

- `apps/web/src/app/globals.css:19` names `Inter` first but no font is loaded.
  `apps/web/src/app/layout.tsx` imports only globals.css. The CSS repeats Georgia
  in font-family declarations and font shorthands throughout the dashboard.
- `packages/ui/src/styles/tokens.css:24` maps Tailwind `--font-serif` to Georgia.
  `theme.css` imports tokens; `styles.css` imports Tailwind and theme.
- `apps/frame/src/viewer.css:17` uses system sans. Caption line 61 uses
  `font-size: clamp(24px, 4vw, 42px)`; message line 75 uses a complete shorthand
  `font: 500 clamp(40px, 7vw, 82px) / 1.12 Georgia, serif`. H1 does likewise.
  On Safari 12 unsupported clamp invalidates the declaration, including the
  message's family/weight/line-height shorthand. This is a high-confidence
  code-level explanation for small text; it has not been reproduced on hardware.
- The viewer already documents why critical CSS must remain outside cascade
  layers. Other existing legacy traps: `.photo { inset: 0 }` and
  `form { width: min(25rem, 100%) }`. Fix these directly adjacent layout rules.
- `apps/frame/src/viewer.ts`: `renderCurrent()` updates captions before photos
  load, assigns src before onload, then starts a timeout immediately. A late
  onload can mutate a newer slide. `refresh()` resets current to zero on a new
  revision, leaves unchanged responses alone, and clears timeout on 401.
- `apps/frame/public/index.html`: two image buffers, message, caption, and
  pairing/empty states; no progress controls. The main element is a polite live
  region. Keep frequently changing progress outside that live region.
- `apps/frame/build.mjs` copies public to dist and bundles Safari 12 IIFEs.
  The Tailwind CLI compiles CSS; it does not copy referenced font binaries.
- `apps/frame/src/service-worker.ts` caches only media (30 entries), plus an
  automatic-update capability marker. Activation deletes other nagori caches.
  `worker.ts` uses same-origin CSP and asset revalidation. Preserve both.
- Caption/message limits in `apps/web/src/components/memory-form.tsx` are
  180/280 characters. The playlist supports 200 active slides.

Source-review typography score: **5/10**, provisional without browser inspection.
The target is shared loaded families, working legacy sizes, legible controls,
long-text containment, and verified font failure/zoom behavior. Do not claim a
10/10 or hardware compatibility until the visual acceptance gates pass.

## Research and rationale

References checked 2026-09-06:

- [MDN browser compatibility data](https://github.com/mdn/browser-compat-data/blob/main/css/types/clamp.json)
  records Safari support starting at 13.1. Use ordinary sizes/media queries here.
- [Splide v4 autoplay](https://splidejs.com/guides/autoplay/) provides an elapsed
  progress bar and pause/resume model. Adapt that behavior, not its library.
- [Splide carousel progress](https://splidejs.com/tutorials/carousel-progress/)
  shows playlist-position progress. Keep position and elapsed time distinct.
  A counter scales to 200 items; a dot/segment per photo does not. The pill
  dimensions below are a Nagori design choice, not a copied library theme.
- [Fontsource installation](https://fontsource.org/docs/getting-started/install)
  supports downloading static files and loading selected weights.
  [Inter](https://fontsource.org/fonts/inter) is already named by this app.

## Scope and constraints

Allowed source edits:

- `packages/ui/src/styles/typography.css` (new shared declarations),
  `packages/ui/src/styles/fonts/` (new assets, license, provenance),
  `packages/ui/src/styles/theme.css`, `packages/ui/src/styles/tokens.css`,
  `packages/ui/.storybook/preview.css` if needed for body inheritance.
- `apps/web/src/app/globals.css` (font references only).
- `apps/frame/src/viewer.css`, `apps/frame/src/viewer.ts`,
  `apps/frame/src/slideshow.ts` (new small testable timing/controller module),
  `apps/frame/public/index.html`, `apps/frame/build.mjs`,
  `apps/frame/src/service-worker.ts` (font caching only).
- `apps/frame/tests/slideshow.test.ts`,
  `apps/frame/tests/font-cache.test.ts` (new), `README.md` compatibility notes,
  this plan and its index row. `pnpm-lock.yaml` only for the existing install
  mismatch if necessary and narrowly explained; no dependency upgrades.

No React in viewer, new runtime dependencies, schema/API/settings changes,
navigation gestures, thumbnail strip, upload redesign, or general refactoring.
Do not alter automatic-updates.ts, weaken CSP, or change media-cache behavior.
Keep JS gzip <=35 KB and CSS gzip <=15 KB. Added font files total <=200 KB.
Use a `codex/viewer-typography-progress` branch if creating a branch. No push,
deployment, or PR unless requested. Match current double quotes, semicolons,
Biome formatting and descriptive `feat:`/`fix:` commit style if committing.

## Step 0 — Drift and baseline

Run `git status --short`, then:

```sh
git diff --stat 2e86723..HEAD -- apps/frame apps/web/src/app/globals.css packages/ui/src/styles packages/ui/.storybook/preview.css README.md plans
pnpm --filter @nagori/frame test
pnpm --filter @nagori/frame typecheck
```

Compare changed files to the current-state excerpts before implementing. At plan
time both pnpm commands stopped with `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN` because
lockfile overrides were outdated. No install or lockfile edit was performed.
`node --experimental-strip-types --test apps/frame/tests/*.test.ts` passed all
three existing automatic-update tests. Node 22+ and pnpm 10 are required.
Use `pnpm install` to restore dependencies if needed; inspect any lockfile diff,
do not upgrade packages to silence failures. Record unresolved baseline errors.

## Step 1 — Share and actually load the existing font roles

1. Download static Inter WOFF2 normal weights 400, 500, 600, 700 from one exact
   Fontsource release into `packages/ui/src/styles/fonts/`. Include Latin and
   Latin-ext subsets for each weight, upstream license, version, source URLs,
   and checksums in a provenance README. Retain system fallback for Japanese
   `名残` and other glyphs; do not claim Inter covers every language.
2. Create typography.css with unlayered @font-face declarations, relative
   `./fonts/<versioned-name>.woff2` URLs, the matching upstream unicode ranges,
   explicit weights/styles, and font-display: swap. Never use a runtime CDN or
   local() source that would make font version unpredictable.
3. In an unlayered :root define `--nagori-font-sans: "Inter", -apple-system,
   BlinkMacSystemFont, "Segoe UI", sans-serif` and
   `--nagori-font-serif: Georgia, "Times New Roman", serif`.
   Import typography.css from theme.css. Map Tailwind --font-sans and
   --font-serif to these variables in tokens.css's @theme inline block.
4. Replace app/viewer hardcoded sans and Georgia families with these roles,
   including Georgia in dashboard font shorthands. Preserve dashboard sizes,
   line heights, weights, spacing, and intentional font-mono. Set the shared
   unlayered root font-family to the sans role so Storybook also inherits it.
   Explicitly inherit font-family on viewer controls; do not use `font: inherit`
   after their size declarations and accidentally erase the enlarged sizes.
5. Extend frame build.mjs to copy the canonical font directory to dist/fonts.
   These paths satisfy the compiled CSS's relative URLs at /viewer.css. Web and
   Storybook should bundle the same relative assets through their CSS pipelines.
   Avoid two manually maintained font directories. No preload needed initially.
6. Add a dedicated versioned font cache in service-worker.ts, allowlisted to
   the exact font paths. Cache-first for successful same-origin font GETs; do
   not cache failed responses or HTML fallbacks. Preserve this cache during
   activation; remove obsolete font versions via existing cleanup. Warm the
   small allowlist best-effort at install using caught failures, without
   blocking skipWaiting on successful connectivity. Fonts must never count
   against the 30-media limit. Preserve updater markers and takeover behavior.

Verify: `pnpm build` exits 0; `pnpm --filter @nagori/ui build-storybook` exits 0.
Inspect generated viewer.css and dist/fonts: every font URL resolves to a real
font file. In each app's browser network panel, Inter loads from that app's
origin, with no third-party font requests or CSP errors. Computed styles alone
are insufficient: inspect rendered fonts or successful FontFaceSet loading.

## Step 2 — Set readable sizes that Safari 12 can render

Use separate family, size, weight and line-height declarations in the viewer.
Replace clamp sizing with these explicit mobile/tablet breakpoints (CSS pixels):

| Role | <600px viewport width | >=600px | >=1000px | Line-height |
|---|---:|---:|---:|---:|
| Caption | 24 | 32 | 36 | 1.3 |
| Message (preferred size) | 36 | 48 | 56 | 1.2 |
| Pairing/empty heading | 36 | 48 | 56 | 1.1 |
| Hint/empty explanation | 18 | 22 | 22 | 1.5 |
| Label/error/button | 18 | 20 | 20 | 1.4 |
| Connection status | 16 | 16 | 16 | 1.4 |
| Eyebrow | 14 | 16 | 16 | 1.4 |

Keep pairing input 36px, weight 400. Use Georgia 400 for editorial roles (do
not rely on a nonexistent Georgia 500 face). Set body to 18px/1.5. Replace inset
with explicit top/right/bottom/left and min() form width with width:100% plus
max-width:25rem. Keep all essential rules unlayered; no flex gap, :where(),
container queries, modern viewport units, or clamp-dependent fallbacks.

Reserve a bottom strip of 80px plus env(safe-area-inset-bottom) for the pill,
using an ordinary 80px declaration before the enhanced calc/env declaration.
Captions end above it, retaining their gradient. Use overflow-wrap:break-word.
Message content must also avoid any visible caption. Fit 280-character notes
without truncation: after showing the content and setting preferred size,
measure available bounds and reduce message font-size by 2px until it fits or
reaches 24px (18px on <600px screens). Fit the caption similarly only if its
180 characters exceed the available caption region, down to 24px (20px mobile).
Use bounded loops, real scrollWidth/scrollHeight measurements, and rerun only
on content changes, resize/orientation, and font load completion when supported.
If minimum-size text still overflows, allow that text region to scroll; never
silently hide text. Do not use character count alone to infer text height.

Verify: `pnpm --filter @nagori/frame build` and typecheck exit 0. Browser-check
all size rows at 390x844, 768x1024, 1024x768; long content does not overlap the
indicator. Verify fallback rendering with font requests blocked and 200% zoom.

## Step 3 — Add the bounded progress pill and synchronize playback

Markup: a sibling after main (outside its live region), initially hidden, with
id=gallery-progress. Contents: counter, decorative track/fill (aria-hidden),
and a real type=button pause toggle with an accessible action label. Counter
text updates only on committed slide changes, aria-live=off. Pill is hidden in
pairing/empty states; hide it for one slide, with no pointless looping animation.

Style: fixed bottom center, translateX(-50%), bottom 16px with safe-area
enhancement; dark rgba(23,21,18,.88) background, warm-white foreground, 1px
subtle border, full radius, 8px horizontal padding. Counter 16px Inter with
tabular-nums; 64x3px rounded track and warm-white fill; 10px spacing via margins.
Pause button 44x44px, transparent background, 18px icon, visible keyboard focus.
Scope existing broad `button` rules to the pairing form or override every
affected property on this button. No blur, bounce, pulsing, canvas, or per-slide
DOM nodes. Keep pill under 240px wide even at `200 / 200`.

Extract only playback timing/commit logic into slideshow.ts, with injected
clock/timeouts for tests (follow automatic-updates.ts's dependency-injection
style and tests/automatic-updates.test.ts's node:test harness). Define one
controller owning timeout, remaining duration, pause reasons, and generation.

- One advance timeout is authoritative; progress never advances the playlist.
  On commit set start/deadline from the same clock and displaySeconds*1000.
  Fill uses a linear CSS transform scaleX(0..1), with transition duration equal
  to remaining time. Reset with transition disabled and one bounded layout
  flush before starting; do not run a JS animation loop or a second interval.
- Load photo handlers before assigning src. Each render request gets a new
  generation; timeout/onload/onerror handlers must verify it before mutating
  DOM. Invalidate generations and remove handlers when changing state.
  Keep at most the existing two decoded image elements.
- Commit photo, its caption, counter, and new interval together on successful
  load. Messages commit synchronously. During a pending photo load retain the
  previous slide/counter and stop its bar at full; do not claim the next photo
  is already visible. Initial load keeps the pill hidden until a commit.
- Use a bounded image-load deadline of 10 seconds. Failure/timeout skips to
  the next candidate. After one entire failed pass, show empty with the existing
  reconnecting status, hide progress, and retry after 60 seconds. New manifests
  cancel that retry. A successful commit resets the consecutive-failure count.
  A single failed photo must not create an immediate recursion/retry loop.
- Unchanged 200/304 manifest refreshes must not restart timing. Preserve the
  existing new-revision behavior: cancel old work, reset index to zero, render.
  Empty and 401 cancel timers, loads, and progress and cannot be overwritten by
  a stale callback. Successful pairing starts fresh from the selected manifest.
- Pause toggles remaining time, actual advance timeout, and fill together;
  resume uses the saved remaining time. Hidden documents pause too; becoming
  visible resumes only if not manually paused and still refreshes manifest.
  If a pending image completes while paused/hidden, it may commit but its dwell
  must not run until resumed. Manual pause survives refresh revisions in this
  page session; pairing/reload clears it. No localStorage preference required.
- prefers-reduced-motion hides the continuously animated fill, keeping the
  static counter and pause control. Preserve existing reduced-motion crossfade
  behavior. Do not change normal autoplay merely because reduced motion is set.

Verify: `pnpm --filter @nagori/frame test` and typecheck exit 0. Manually confirm
a 12-second slide has half a bar after six seconds, pause freezes both, resume
finishes the remaining six, and unchanged manifest polls do not reset either.

## Step 4 — Regression tests and acceptance

Add behavior tests in slideshow.test.ts using fake time/load callbacks, no new
DOM framework. Test: initial commit; message/photo mix; wraparound; 0/1/200
slides; new revision cancels old timers; unchanged revision preserves deadline;
late photo completion is ignored; caption/counter waits for load; load failure
and deadline skip; all-failure backoff; manual pause/resume; hidden-page pause
with manual pause preserved; pause during loading; 401/empty cancellation.
Exercise actual controller callbacks, not a duplicate formula in the tests.

In font-cache.test.ts evaluate the actual worker with stubbed self/caches/fetch
(node:vm is sufficient). Test successful font caching, cached offline response,
failed network warm-up does not reject installation, failures aren't cached,
font cache survives activation, stale font cache is removed, and media/updater
marker behavior remains unchanged. Do not add snapshots of incidental CSS.

Run gates from repo root:

```sh
pnpm --filter @nagori/frame test
pnpm --filter @nagori/frame typecheck
pnpm test
pnpm check
pnpm build
pnpm --filter @nagori/ui build-storybook
pnpm --filter @nagori/web build:cloudflare
git diff --check
```

Expect all exits 0. Record any demonstrably pre-existing failure separately.
Measure gzip viewer.js/viewer.css and summed WOFF2 bytes against scope budgets.
Use `pnpm dev` with existing local data (README explains setup); never reset
the household/database. Frame dev builds once, so restart it after source edits.

Visual acceptance: capture before/after on a current browser and test on the
physical iOS 12.5.7 iPad, portrait and landscape. Include 180-character caption,
280-character note, multiline and long unbroken words, German accents, Japanese
fallback, all three message themes, light/dark photos, caption disabled,
pairing errors, empty, offline and 200 slides. Check rendered fonts in dashboard
and Storybook too, especially buttons/dialogs/previews and narrow labels.
Check warmed fonts offline and cold font failure. Verify keyboard pause button,
no continual screen-reader announcements, no caption overlap, and 200% zoom.
Current WebKit cannot certify Safari 12. If hardware is unavailable, explicitly
record that acceptance as pending instead of claiming it passed.

## Done criteria / execution record

- [ ] Shared Inter assets actually load on all three surfaces; Georgia and
  intentional monospace roles preserved; no third-party runtime font requests.
- [ ] Essential viewer CSS works without clamp/min/inset/cascade layers.
- [ ] Caption/message sizes and full long-text visibility verified.
- [ ] Bounded pill and controller tests pass, including failure and pause paths.
- [ ] Font caching leaves 30-media cache and automatic updates intact.
- [ ] All commands above pass or baseline blockers are explicitly recorded.
- [ ] Size budgets pass; no out-of-scope files changed.
- [ ] Browser screenshots/results and physical iPad result recorded here.
- [ ] README compatibility paragraph updated to describe shared self-hosted
  Inter plus Georgia fallback roles (it currently promises system fonts).
- [ ] Plan index status updated only when required verification is complete.

STOP and report if drift changes the rendering/API contract, dependency repair
requires broad upgrades, font assets cannot meet the budget/license conditions,
or implementation needs files outside scope. After two reasonable attempts at
a failing gate, report the concrete failure rather than bypassing it.

Maintenance: keep font filenames/cache allowlist in sync when updating assets.
Future navigation must use the same commit/clock path. Review asynchronous
image races and pause reasons carefully; they are the main implementation risk.
This is a scoped typography/viewer review, not a security or whole-repo audit.
