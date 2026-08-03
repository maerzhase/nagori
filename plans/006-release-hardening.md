# Plan 006: Harden, observe, document, and release the MVP

> **Executor instructions**: This is a release gate. Follow every step and
> verification gate, stop on any STOP condition, and update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a30058..HEAD -- apps/web apps/frame packages/core packages/ui .github README.md docs`
> Plans 001–005 are expected to account for the product changes.

## Status

- **Priority**: P1
- **Effort**: M (3–5 days plus beta soak)
- **Risk**: MED — configuration and recovery mistakes can break access or lose data.
- **Depends on**: Plans 001–005
- **Category**: security / operations / docs / tests
- **Planned at**: commit `5a30058`, 2026-08-03

## Why this matters

This service holds private family photos and runs unattended in another home on
an operating system that may no longer receive WebKit security fixes.
An MVP is not complete until access revocation, recovery, data retention,
observability, accessibility, and deployment are exercised rather than assumed.

## Current state

Plans 001–005 should provide a Workers deployment, D1/R2 storage, human/device
auth, upload/library management, an offline viewer, and scheduling. D1 Time
Travel offers point-in-time recovery, but Worker deploy versions do not include
D1/R2 state; rollback procedures must address code and data separately.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Full gate | `pnpm check && pnpm test && pnpm build` | exit 0 |
| Worker build | `pnpm --filter @acme/web cf:build` | exit 0 |
| Browser suite | `pnpm test:e2e` | all pass |
| Dependency audit | `pnpm audit --prod` | no unresolved high/critical runtime advisory |
| D1 migration dry run | documented preview migration command | exit 0 on disposable preview DB |

## Scope

**In scope**:

- Security headers/policies, rate limits, structured logs/metrics, error handling,
  CI release gates, operational docs, privacy/retention docs, accessibility and
  compatibility remediation, preview deployment, and production checklist.

**Out of scope**:

- New product features, analytics profiling of grandparents, native apps,
  third-party error tooling that uploads captions/photos, billing, and marketing.

## Git workflow

- Branch: `codex/006-release-hardening`
- Commit by hardening, observability, docs/runbooks, and release gates.
- Production deploy and destructive recovery drills require operator approval.

## Steps

### Step 1: Run a threat-model review and close gaps

Document assets, actors, trust boundaries, and abuse cases: credential stuffing,
invite/code brute force, CSRF, IDOR/cross-tenant access, upload spoofing/storage
abuse, stolen iPad, exploitation of an obsolete WebKit engine, cached-media
exposure, log leakage, and accidental deletion.
Verify each mitigation in code/tests. Apply CSP without `unsafe-eval`, HSTS in
production, `nosniff`, frame restrictions, strict referrer policy, secure cookies,
origin/CSRF validation, schema validation, and resource-specific rate limits.

Search logs/errors for captions, emails, tokens, R2 keys, and signed URLs. Retain
only operational IDs and coarse events. Ensure error responses are generic and
server traces do not reach clients.

**Verify**: security test matrix passes; targeted searches find no secret/media
content logging; headers are asserted in preview responses.

### Step 2: Add privacy-respecting observability

Emit structured events for request outcome/latency, upload state, transform
failure, manifest revision/304, last-seen heartbeat, rate limit, cleanup result,
and auth/device revocation. Use request IDs and opaque entity IDs. Create a small
admin health view showing each device's last seen, last manifest revision,
cached/offline capability report, and generic latest error code.

Define alerts for elevated 5xx/auth failures, upload-processing backlog, cleanup
failure, and a device offline longer than a configurable interval. Do not alert
the grandparents; notify only family admins by email and make this opt-in for MVP.
Add usage warnings at 80,000 Worker requests/day, 4 million D1 rows read/day,
8 GB R2 storage, and 4,000 monthly unique Images transformations so the family
has time to adjust retention or upgrade before free-tier limits are reached.

**Verify**: preview test produces expected safe events and redaction tests reject
known sensitive field names/values. Confirm the frame subdomain has no human
session cookie, management route, original-media route, or dashboard asset.

### Step 3: Exercise backup, restore, deletion, and rollback

Write runbooks for D1 Time Travel restore, pre-migration bookmark, migration
forward-fix, Worker version rollback, R2 lifecycle/soft deletion, lost iPad
revocation, compromised human account, email-provider failure, and owner recovery.
Use a disposable preview database/bucket to perform one restore and one expired
media purge. Never test destructive restore against production.

Document that Worker version rollback does not roll back D1/R2. Add a migration
checklist requiring backward-compatible expand/contract migrations.

**Verify**: preview restore returns known seeded rows, purge removes only expired
soft-deleted objects, and runbook records commands/results without secret values.

### Step 4: Complete accessibility and old-device review

Run automated accessibility checks and manual keyboard/VoiceOver checks on all
management routes. Verify 44px touch targets, visible focus, labels, errors tied
to inputs, color contrast, reduced motion, zoom/reflow, and non-toast feedback.
Repeat the viewer 24-hour soak on the production candidate and exact recorded
iPad model/iOS. Verify legacy bundle syntax/API/CSS budgets and confirm the frame
still contains no Next.js/React code. Then verify Guided
Access/Home Screen instructions with a non-developer family member.

**Verify**: zero serious/critical automated violations; manual checklist and
soak report are stored under `docs/` with device/iPadOS version.

### Step 5: Add production release gates

Require frozen install, static checks, tests, builds, E2E against preview, D1
migration validation, dependency audit, and a smoke test for health/login/pair/
upload/manifest/revoke. Document secrets/bindings by name, least-privilege API
tokens, custom domain/TLS, R2 CORS, email DNS, Turnstile, quotas, and cost alerts.

Deploy first to preview. The operator manually approves production after the
family beta and checklist. Seed no real photos into preview; use licensed test
fixtures. Take a D1 bookmark before production migrations.

**Verify**: one preview candidate passes the release checklist from a clean
checkout, then production smoke passes without exposing content.

### Step 6: Run a one-week family beta

Invite at least two relatives with different roles, upload from two iPhone/Safari
versions, pair the real iPad, and run for seven days. Track only: upload success
and duration, content freshness, viewer crashes/reloads, offline recovery,
confusing steps reported by family, and admin interventions. Fix release-blocking
issues; put feature requests into follow-up plans rather than expanding MVP.

**Verify**: no unresolved data exposure/loss, viewer crash loop, inaccessible
core flow, or repeated manual recipient intervention remains.

## Test plan

- Security regression matrix for auth, role, tenant, CSRF/origin, rate limit,
  pairing, upload, content delivery, cache, and revocation.
- Clean-checkout CI and preview deployment smoke.
- Disposable D1 restore and R2 purge drill.
- Automated plus manual accessibility review.
- Production-candidate 24-hour device soak and seven-day family beta.

## Done criteria

- [ ] No unresolved high/critical runtime dependency advisory.
- [ ] No known cross-tenant, public-media, token-leak, missing-revocation, or
  frame-to-dashboard privilege path.
- [ ] Preview backup/restore and deletion/purge drills succeed.
- [ ] Serious/critical accessibility findings are zero.
- [ ] Release pipeline passes from a clean checkout.
- [ ] Physical-device soak and family beta meet README success metrics.
- [ ] Runbooks cover lost device, compromised account, rollback, migration, and provider outage.
- [ ] Production approval/deploy is explicitly recorded; Plan 006 is marked DONE.

## STOP conditions

- Any high-confidence data exposure, auth bypass, or destructive migration risk
  is found; fix and re-run the entire affected test matrix before release.
- A production mutation/deploy/restore lacks explicit operator approval.
- The target iPad requires routine grandparent interaction during the soak/beta.
- Observability would transmit photo bytes, captions, tokens, or full email addresses.
- Backup/restore has not been proven on disposable infrastructure.
- The exact physical iPad was replaced by current-browser emulation in the
  compatibility or soak gate.

## Maintenance notes

Review access quarterly, revoke lost/retired devices promptly, test restoration
at least twice yearly, and keep an owner-recovery path. Re-run the device soak
after major service-worker, image, legacy compiler, or frame dependency changes.
Next/OpenNext updates require dashboard regression tests but must not alter the
frame bundle.
