# 007 — Design system consistency and sharing UX

Follow-up polish pass after the MVP. Seven changes, ordered so the design-system
work lands before the screens that consume it.

## Current state (verified)

- `@nagori/ui` exports exactly one component (`Button`, wrapping `@base-ui/react`).
  `packages/ui/src/index.ts`
- The dashboard is one 693-line server component using raw HTML elements styled by
  a 1027-line stylesheet with ad-hoc classes (`.primary-button`, `.secondary-button`,
  `.text-button`). `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`
- Sidebar nav is five `<a href="#…">` anchors with `class="active"` hardcoded on the
  first one. `page.tsx:255`
- Photo and note are two separate forms with two different transports: XHR to
  `/api/slides/photo` vs. the `createMessageAction` server action.
- Pairing codes and invite tokens are stored **hashed only** and the plaintext is
  surfaced once through a URL query param (`?pairing=`, `?invite=`).
  `store.ts:611`, `store.ts:225`

## Step 1 — Contrast-safe color tokens, and stop inheriting UA colors

Lands with the component set, because every later step consumes these tokens.

**The reported bug — light blue error text on cream — is not in our CSS.** There is no
blue value anywhere in `globals.css` or `viewer.css`. It came from a user-agent default
painted over a background we set explicitly. iOS system blue `#007aff` on `--paper`
measures **3.63:1**, consistent with the report. Three plausible mechanisms, all cheap
to close:

- `color-scheme` is declared only on `body` (`tokens.css:34`), never on `:root`, and
  `layout.tsx` sets no `colorScheme` metadata. UA-painted text — validation bubbles,
  autofill, `input` placeholder — can use dark-mode defaults over our light surfaces.
- No `format-detection` meta. iOS auto-links things that look like phone numbers or
  dates and styles them system blue; the six-digit pairing code and the date strings
  are prime candidates, and `a { color: inherit }` (`globals.css:39`) does not beat it.
- Any error surface rendered outside `.alert` / `.form-status.error` inherits whatever
  the UA supplies.

Work:

1. Add semantic token pairs to `tokens.css` — `--danger` / `--danger-foreground` /
   `--danger-surface`, and the same for `success` and `warning` — each defined as a
   foreground-on-surface pair, never a bare foreground. `.alert` (6.74:1) and
   `.form-status.error` (5.83:1) already pass; promote their values to tokens rather
   than inventing new ones.
2. Declare `color-scheme: light` on `:root` and set `colorScheme` in `layout.tsx`
   metadata. Add `<meta name="format-detection" content="telephone=no,date=no,address=no">`.
   Do the same in `apps/frame/public/index.html`.
3. Every text surface sets `color` explicitly. No component relies on inheritance
   reaching it from `body`.
4. Fix the measured failures below AA 4.5:1 for body text: `.eyebrow` `#9b6d58`
   (4.02), card muted `#9b9389` on `#fffdf9` (2.98, `globals.css:182`), `#867f76` on
   `#25231f` (3.97, `:147`). Coral `#d9684c` on paper is 3.15 — keep it for borders,
   focus rings, and large display type, but never for body text.

**Gate it, don't just fix it:** add a unit test in `packages/ui` that walks the
declared token pairs and asserts WCAG AA (4.5:1 body, 3:1 large text and UI borders),
so a new token can't ship unreadable. `@storybook/addon-a11y` is already a devDependency —
turn it on for the new component stories.

## Step 2 — Grow `@nagori/ui` into the actual component set

Add base-ui-backed components next to `Button`, following its cva + `cn` pattern:
`Field`/`Input`, `Textarea`, `Select`, `Checkbox`, `Tabs`, `Dialog`. Export all
from `index.ts` and add Storybook stories alongside `Button.stories.tsx`.

Then replace raw elements in `page.tsx`, `upload-form.tsx`, and `join/[token]/page.tsx`
and delete the now-dead `.primary-button` / `.secondary-button` / `.text-button` rules
from `globals.css`. Keep the editorial/layout CSS (`.auth-shell`, `.memory-grid`, …) —
only component-level styling moves into the package.

## Step 3 — Sidebar nav as animated tabs

Replace the anchor list with a client `Tabs` shell (base-ui `Tabs` with an indicator
element animated via `transform`/`transition` between the active tab's box). Sections
stay server-rendered and are passed in as `children` per panel, so no data fetching
moves to the client.

**Decided: tabs switch views** (Today / Library / Family / Frame / Settings) rather
than scroll to sections. Consequences to handle:

- The hardcoded `active` class at `page.tsx:256` goes away.
- The existing hash redirects in `actions.ts` (`#library`, `#frame`) no longer land
  anywhere, since the target section may not be mounted. Convert them to a `?tab=`
  search param that the shell reads as its initial value — `rescheduleSlideAction`,
  `renewSlideAction`, `revokeDeviceAction`.
- `<a href="#compose">Add a memory</a>` (`page.tsx:319`) becomes a tab switch too.
- Keep `?tab=` as the source of truth so a server-action redirect can return the
  user to the panel they were working in.

## Step 4 — "Save settings" as a real button

`page.tsx:602` uses `.text-button` for the playback-settings submit. Make it a proper
`Button variant="primary"`, right-aligned in a form footer, with pending state via
`useFormStatus` and a "Saved" confirmation instead of the current `?saved=settings`
redirect banner-less round trip.

## Step 5 — One "share a memory" form

Merge the photo pane and note pane into a single form: caption/note field, schedule
fields, and a **background** control offering `Photo` or one of the existing themes
(`paper`, `sunset`, `garden`).

Keep both backends — choosing a photo submits through the existing XHR upload path,
a theme submits through `createMessageAction`. The client form picks the transport.
A note on a photo slide is already supported (`caption`), so the merged model is:
one slide = text + background, where background is an image or a theme.

## Step 6 — Live slide preview in the form

Show the selected image immediately via `URL.createObjectURL`, and render a full
slide preview — background, caption typography, frame aspect ratio — so the sender
sees what the iPad will show. Extract the preview into `@nagori/ui` so it can share
tokens with `memory.css`; the frame viewer keeps its own legacy-safe CSS (it must
stay React-free per `plans/README.md`).

## Step 7 — Shareable frame connect links

**Decided: two secrets per device row, not one.** The 15-minute TTL exists only because
the secret is six digits, and that constraint comes from typing it on an iPad. A link
has no such constraint, so it should not inherit the short window — the frame is the
grandparents' entry point and a dead link means resending.

| | Typed code | Link token |
|---|---|---|
| Shape | 6 digits | `randomId("frame")`, 128-bit |
| TTL | 15 min (unchanged) | 30 days, or none until used/revoked |
| Entered by | someone in the room | recipient clicking a link |

Both point at the same `devices` row and both stay single-use.

Implementation:

- Migration: add `devices.pair_link_hash` and `devices.pair_link_expires_at`, both
  nullable. `createPairingCode` issues code *and* link token, returning both plaintexts.
- `/api/pair` accepts `{ code }` (existing `/^\d{6}$/` branch) or `{ token }`, and
  `claimPairingCode` gains a by-token lookup. Both clear all pairing columns on success.
- Link is `${FRAME_URL}/#t=<token>`, read by `viewer.ts` from `location.hash` — the
  **hash**, not a query string, so the secret never reaches the server or a Referer
  header. Prefill and show a single Connect button; on success, strip the hash via
  `history.replaceState` so a reload doesn't retry a spent token.

**Single-use stays**, and it is load-bearing on the data model, not just security: a
pairing secret belongs to one `devices` row and claiming it writes `token_hash` onto
that row (`store.ts:673`). A reusable secret would let a second iPad overwrite the
first one's token — silently killing the first frame and collapsing two physical
devices into one row with meaningless last-seen and revoke.

Brute-force notes, now that lifetimes diverge:

- `/api/pair` is IP-rate-limited to 10 attempts / 15 min (`worker.ts:59`). That is
  ~960/day per IP against a 1M code space — adequate for a 15-minute code, which is
  exactly why the 6-digit path keeps its short window. A 128-bit token needs no TTL.
- `devices.pairing_attempts` exists (`0001_initial.sql:56`) but `claimPairingCode`
  never increments it, so there is no per-code counter to complement the per-IP limit.
  Wire it up for the code path: increment on a failed claim against a live code, refuse
  the code past a small threshold.

## Step 8 — Pending invites and frame codes in their tables

Both need new store methods (`listPendingInvitations`, and unpaired devices already
come back from `listDevices` with `paired = 0`) plus table rows showing email/name,
role, and expiry.

The original token/code cannot be displayed — only its SHA-256 hash is stored.
**Decided: rotation, no plaintext at rest.** Each pending row gets a "Create new
link" action that issues a fresh secret, invalidates the old one, and reveals the new
link once for copying.

Implementation:

- `store.listPendingInvitations(householdId)` — email, role, `expiresAt`, `createdAt`,
  where `accepted_at IS NULL`. No token column selected.
- `store.rotateInvitationToken({ householdId, userId, invitationId })` — new
  `randomId("invite")`, overwrite `token_hash`, reset `expires_at` to +7 days, audit
  event. Returns the plaintext once.
- `store.rotatePairingCode({ householdId, userId, deviceId })` — same shape for
  unpaired devices (`token_hash IS NULL`): new 6-digit code, overwrite
  `pairing_code_hash`, reset `pairing_expires_at`, audit event.
- Both revealed secrets render through a small client `CopyField` (in `@nagori/ui`)
  fed from the action result — **not** through `?invite=` / `?pairing=` query params.
  Once every reveal path goes through the action result, drop those two params from
  `page.tsx` and from `createInvitationAction` / `createPairingCodeAction`, so
  secrets stop landing in browser history and server access logs.
- Server actions that return a value can't use `redirect()`; these two become
  `useActionState`-driven client forms rather than plain `<form action={…}>`.
- Owner-only, same guard as `revokeDeviceAction` / `createInvitationAction`.

## Order and dependencies

1, 2 → 3, 4, 5 (all consume the tokens and component set) → 6 (consumes 5) → 7, 8 (independent of 1–6).

## Out of scope

The hardcoded `"Monday, August 3"` and `"Good evening"` strings in `page.tsx:311`,
and the hardcoded `Europe/Lisbon` timezone at `page.tsx:102`.
