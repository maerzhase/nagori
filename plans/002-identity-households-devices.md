# Plan 002: Add accounts, household authorization, and secure device pairing

> **Executor instructions**: Follow every step and verification gate. Stop on a
> listed STOP condition. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 5a30058..HEAD -- apps/web apps/frame packages/core`
> Plan 001 is expected to add these paths; verify its status is DONE first.

## Status

- **Priority**: P1
- **Effort**: L (4–7 days)
- **Risk**: HIGH — authorization mistakes expose private family data.
- **Depends on**: `plans/001-cloudflare-foundation.md`
- **Category**: security / architecture
- **Planned at**: commit `5a30058`, 2026-08-03

## Why this matters

Human contributors need normal secure sessions, while the unattended iPad
needs a narrower identity that cannot upload, invite, or administer. Household
tenancy must be enforced in server code from the first feature rather than
retrofitted after content exists.

## Current state

At the planned commit there is no authentication or product schema. Plan 001
must provide D1/Drizzle, typed bindings, Vitest Workers integration, and route
tests. UI conventions are Tailwind v4 plus components exported by `@acme/ui`;
match `packages/ui/src/components/button.tsx` for variant construction and the
`cn` helper.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Static checks | `pnpm check` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Auth integration tests | `pnpm --filter @acme/web test:unit -- auth` | all pass |
| Migration | `pnpm --filter @acme/web db:migrate:local` | exit 0 |
| Browser auth flow | `pnpm --filter @acme/web test:e2e -- auth` | all pass |

## Scope

**In scope**:

- Better Auth server/client configuration in `apps/web` and generated auth tables.
- `households`, `memberships`, `invitations`, `devices`, `pairing_codes`, and
  `audit_events` schemas, repositories, services, migrations, and tests.
- Login, invite acceptance, household switcher shell, family management, and
  device management in `apps/web`; `/pair` plus device-only endpoints in
  `apps/frame`; shared schema/services in server-only `packages/core`.
- Email-provider interface plus a fetch-based provider adapter and test double.

**Out of scope**:

- Photos, slides, viewer manifest, schedules, social login, MFA, passkeys, open
  registration, billing, and public sharing.
- Storing a family user's session or password on the iPad viewer.

## Git workflow

- Branch: `codex/002-identity-households-devices`
- Prefer commits by security boundary: schema, human auth, authorization,
  invitations, device pairing.
- Do not push or deploy unless instructed.

## Steps

### Step 1: Integrate human authentication

Use Better Auth with its Drizzle SQLite adapter and secure, HttpOnly, SameSite
cookies. Enable email/password, verified email, password reset, session expiry,
and session revocation. Send mail through an `EmailProvider` interface using a
direct HTTPS API so tests never contact a real service. Normalize email
addresses. Do not log passwords, tokens, cookies, email bodies, or reset URLs.

Registration is invitation-only except `INITIAL_OWNER_EMAIL`: the first verified
account matching that configured email may create the initial household. Protect
login, reset, and invite acceptance with server-verified Turnstile and Worker
rate-limit bindings in production; use explicit fakes in tests.

**Verify**: auth integration tests cover sign-in, invalid credentials, verified
email requirement, reset token single use/expiry, logout, and rate limiting.

### Step 2: Create the tenant and role model

Add household and membership tables with foreign keys and unique constraints.
Define one central authorization service with named capabilities; route handlers
must ask it to resolve `(session user, household, capability)` before querying
domain objects. Owner: all capabilities and ownership transfer. Admin: invite,
device, content, settings. Contributor: create content and edit/delete only own
content. Prevent removing/demoting the final owner.

Every household-owned repository method must require `householdId` as a named
argument and include it in SQL predicates. Do not export raw generic `findById`
helpers for tenant objects.

**Verify**: a role/tenant matrix test proves allowed actions succeed, denied
actions return 403, and cross-household IDs return 404 without revealing existence.

### Step 3: Implement invitation lifecycle

Create 32-byte random invite tokens, store only a SHA-256 hash, expire after
seven days, and invalidate on accept/revoke. Bind each invite to normalized
email, household, and role. Owners/admins can list, resend (new token), revoke,
and invite; only owners can invite another owner. Accepting creates/links the
account and membership transactionally. Record safe audit events.

**Verify**: tests cover happy path, wrong email, expired/revoked/used token,
duplicate membership, last-owner guard, and cross-household access.

### Step 4: Implement viewer device pairing

From dashboard `/app/devices`, an admin creates a pending named device and a random
six-digit code valid for ten minutes. Store only a keyed hash of the code, cap
attempts, and rate limit by IP and pending device. The frame Worker's `/pair`
exchanges the code for
a random 32-byte device secret once. Store its hash on `devices`; set the raw
secret only in a Secure, HttpOnly, SameSite=Lax cookie on the isolated frame
subdomain, scoped to viewer routes.
Make it 90-day rolling and rotate it on a controlled cadence. Revocation must
invalidate the next request. A device is read-only and belongs to exactly one
household.

Persist `last_seen_at` at most once per 15 minutes to avoid a D1 write per poll.
Capture only a coarse user-agent/capability summary, not a fingerprint.

**Verify**: pairing tests cover success, expiry, replay, attempt cap, rotation,
cookie flags, revocation, and inability to call any human mutation endpoint.

### Step 5: Build the minimum management UI

Create calm mobile-first screens for login, invite acceptance, the authenticated
shell, family list, and devices. Primary actions must be obvious; destructive
actions require confirmation and explain impact. Pairing instructions must be
large enough to read while handling another device. Add accessible validation,
loading, empty, error, and success states without toast-only feedback.

**Verify**: Playwright completes owner bootstrap, relative invitation, contributor
denial, and device management at phone/tablet widths; the physical iPad completes
pairing without loading any Next.js/React dashboard asset.

## Test plan

- Service/integration tests with real local D1 for every token and role edge.
- Negative tenant-isolation tests for every repository exposed in this plan.
- Cookie attribute assertions and CSRF/origin rejection tests on mutations.
- E2E for bootstrap, invitation, login/logout, pair, and revoke.
- Static dependency/network assertion: frame pairing loads no dashboard, Better
  Auth, Next.js, React, email-provider, or human-session code.
- Accessibility scan on login, invite, family, devices, and pair pages.

## Done criteria

- [ ] Open registration is impossible; bootstrap/invite paths work.
- [ ] All auth and pairing secrets are hashed or encrypted as appropriate and
  absent from logs/database reads after issuance.
- [ ] Cross-household tests cover every tenant-owned repository.
- [ ] Revoked human sessions and devices fail on the next protected request.
- [ ] `pnpm check && pnpm test && pnpm build` exits 0.
- [ ] Only in-scope files changed; Plan 002 is marked DONE.

## STOP conditions

- Plan 001 is incomplete or tests cannot run against a local D1 binding.
- Better Auth's current version is incompatible with the Worker runtime/Drizzle
  adapter; report exact failure and evaluate a pinned supported release.
- Email delivery requires exposing an API secret to client code.
- Any proposed authorization path depends only on a client-side check.
- Implementing an action requires weakening cross-household 404 behavior.
- Pairing requires redirecting the legacy iPad to the modern dashboard origin.

## Maintenance notes

Treat role changes, invite changes, and device revocations as audit-worthy. Any
new household-owned table must adopt the same required-household repository
shape and negative isolation tests. Device cookies are credentials: support
rotation and never display or export them.
