# Nagori (名残)

Nagori (名残) is a private, self-updating family photo frame for an old iPad. Its name evokes the traces that remain after a season or a parting: warm, bittersweet reminders of the moments shared. Family members sign in from their phones to share photos or short notes; the paired iPad loops the active memories without requiring anyone at the frame to do anything.

The dashboard is a Next.js app adapted for Cloudflare Workers. The frame is a separate, deliberately tiny Worker: it has no React or Next.js client runtime, builds to a Safari 12-compatible IIFE, and uses an independent read-only device session.

## What is included

- Owner, editor, and viewer roles, with invitation links for additional family members.
- Private server-side session cookies; password hashes use Web Crypto PBKDF2.
- Private R2 photo storage and authenticated media delivery.
- A default 30-day display window, future scheduling, forever option, expiry grouping, and a 200-active-slide guardrail.
- Six-digit, 15-minute iPad pairing codes and independently revocable device credentials.
- Bounded offline caching of the frame's most recent 30 photos, plus upload progress and retry handling.
- Durable protection against repeated failed sign-ins and pairing-code guesses.
- A local D1/R2 development environment shared by the dashboard and the frame.
- A GitHub Actions workflow that migrates D1 then deploys the frame and dashboard.

## Run locally

Use Node 22+ (wrangler's floor) and pnpm 10.

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

Open the dashboard at the Next.js address printed by the command (normally `http://localhost:3000`) and complete first-run setup. Open `http://localhost:8788` on the device/browser intended to act as the frame, create a pairing code in the dashboard, and enter it there.

The local database and object storage live in `.wrangler/state/` and are intentionally ignored by Git. To reset local data, stop the development servers and remove that specific directory.

## Test and build

```bash
pnpm test
pnpm check
pnpm build
pnpm --filter @nagori/web build:cloudflare
```

`pnpm test` runs the focused schedule lifecycle tests. The Cloudflare build command validates the worker bundle used by production.

## Production deployment

Create these Cloudflare resources once:

```bash
pnpm --filter @nagori/web exec wrangler d1 create nagori
pnpm --filter @nagori/web exec wrangler r2 bucket create nagori-photos
```

Then add six `production` environment secrets to the GitHub repository:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_D1_DATABASE_ID`.
- `APP_URL` (dashboard HTTPS URL) and `FRAME_URL` (the iPad viewer HTTPS URL). These must match the `routes` in the worker configs.
- `INITIAL_OWNER_EMAIL`. In production, first-run setup only accepts this address, so a stranger cannot claim the dashboard before you do. Without it every registration attempt is rejected.

The token needs Workers Scripts edit, D1 edit, and R2 edit on the account, plus DNS edit on the zone so the deploy can create the custom-domain records. A push to `main` runs [deploy.yml](.github/workflows/deploy.yml): checks, tests, database migrations, then frame and dashboard deployment.

The installed viewer checks for a new application release every 15 minutes, as
well as whenever it comes online or returns to the foreground. A deployed
service worker takes control immediately and reloads the viewer once, so no one
needs to visit the device to accept an update. This updates an already running
viewer; iOS still cannot automatically relaunch a Home Screen web app after the
device itself reboots.

The one-time rollout from a viewer built before this updater can take up to the
browser's normal 24-hour service-worker refresh window. Its existing manifest
and media requests keep generating the events that trigger that check; once the
new worker is found, it navigates the old viewer into the automatic-update path.

Each worker config declares a Cloudflare custom domain: the dashboard serves `nagori.m3000.io` ([apps/web/wrangler.jsonc](apps/web/wrangler.jsonc)) and the frame serves `nagori-frame.m3000.io` ([apps/frame/wrangler.jsonc](apps/frame/wrangler.jsonc)). The first deploy creates the proxied DNS records automatically, so the zone must live in the same Cloudflare account as the workers. Change both `routes` and the matching `APP_URL`/`FRAME_URL` together to move to different hostnames.

The checked-in configs use a placeholder D1 ID by design; the workflow injects the production ID without committing it.

## Backup and recovery

Run a D1 export before schema changes and retain the generated SQL in private storage. R2 photo objects are private and should be copied to a second private bucket on a schedule.

```bash
pnpm --filter @nagori/web exec wrangler d1 export nagori --remote --output nagori-backup.sql
pnpm --filter @nagori/web exec wrangler r2 object get nagori-photos <object-key> --file <local-path>
```

To restore, first deploy the matching application revision, then import the D1 export into a new database or an approved recovery target and point a temporary worker configuration at it. Restore only the associated R2 objects; never make the bucket public. Exercise this procedure against a non-production database before relying on it.

If a frame is lost, revoke it from **Connected frames**. The next manifest or photo request from that iPad is denied. If an account is compromised, revoke its sessions by rotating its password once password-change support is added; until then, remove the membership directly through a controlled D1 maintenance operation.

## Compatibility

The frame is designed around the original iPad Air’s iOS 12.5.7 baseline: plain DOM APIs, an ES2017/Safari 12 bundle, and no optional viewer framework. The dashboard, component library, and frame self-host Inter for interface text, with system sans fallbacks for unsupported glyphs; editorial headings, captions, and notes use Georgia with Times New Roman as a fallback. Its generated CSS uses shared Tailwind design tokens but all critical viewer rules remain ordinary CSS outside Tailwind cascade layers, which older Safari ignores.

### Physical iPad acceptance checklist

After deployment, add the frame URL to the iPad Home Screen and verify:

- Pairing works and the iPad restarts directly into the frame.
- A new photo or note arrives within 75 seconds.
- Turn Wi-Fi off, force-close and reopen the frame, and confirm cached photos continue looping.
- Turn Wi-Fi back on and confirm the next update arrives without re-pairing.
- Leave it open overnight, then check the slideshow is still advancing and Safari has not shown an error or blank screen.
- Revoke the frame in the dashboard and confirm it returns to pairing on its next refresh.

The implementation roadmap and operating notes are in [plans/README.md](plans/README.md).
