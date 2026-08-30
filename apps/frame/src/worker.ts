import { NagoriStore, type Database, type ObjectBucket } from "@nagori/core";

interface Env {
  DB: Database;
  PHOTOS: ObjectBucket;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function json(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}

function secure(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), geolocation=(), microphone=()");
  headers.set(
    "content-security-policy",
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  );
  return new Response(response.body, { status: response.status, headers });
}

function updateableAsset(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  // A kiosk may stay open for months. Every app-shell request must validate
  // against the current deployment when online. stale-if-error keeps the old
  // shell available to WebKit's HTTP cache during an offline restart.
  headers.set("cache-control", "max-age=0, stale-if-error=31536000");
  if (pathname === "/sw.js") {
    // The updater itself must never be satisfied by a stale HTTP cache entry.
    headers.set("cache-control", "no-cache, no-store, must-revalidate");
    headers.set("service-worker-allowed", "/");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function authenticatedDevice(request: Request, store: NagoriStore) {
  const token = cookieValue(request, "frame_session");
  return token ? store.findDevice(token) : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const store = new NagoriStore(env.DB);

    if (url.pathname === "/api/health" && request.method === "GET") {
      try {
        await env.DB.prepare("SELECT 1").first();
        return secure(json({ ok: true, service: "frame" }));
      } catch {
        return secure(
          json(
            { ok: false, service: "frame", error: "dependency_unavailable" },
            { status: 503 },
          ),
        );
      }
    }

    if (url.pathname === "/api/pair" && request.method === "POST") {
      const body = (await request.json()) as { code?: string; token?: string };
      const code = body.code;
      const token = body.token;
      if (!code && !token)
        return secure(json({ error: "invalid_code" }, { status: 400 }));
      // Only the six-digit path is guessable, so only it is rate limited. A
      // link is 128-bit, and throttling it would let attempts against the code
      // lock out the path the recipient actually uses.
      if (code) {
        const limit = await store.consumeRateLimit({
          scope: "pair",
          identifier:
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for") ??
            "unknown",
          maxAttempts: 10,
          windowMs: 15 * 60_000,
        });
        if (!limit.allowed) {
          return secure(
            json(
              { error: "too_many_attempts" },
              {
                status: 429,
                headers: { "retry-after": String(limit.retryAfterSeconds) },
              },
            ),
          );
        }
        if (!/^\d{6}$/.test(code))
          return secure(json({ error: "invalid_code" }, { status: 400 }));
      }
      const result = code
        ? await store.claimPairingCode(code)
        : await store.claimPairingLink(token as string);
      if (!result)
        return secure(json({ error: "invalid_code" }, { status: 401 }));
      return secure(
        json(
          { ok: true },
          {
            headers: {
              "set-cookie": `frame_session=${encodeURIComponent(result.token)}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=31536000`,
            },
          },
        ),
      );
    }

    if (url.pathname === "/api/manifest" && request.method === "GET") {
      const device = await authenticatedDevice(request, store);
      if (!device)
        return secure(json({ error: "not_paired" }, { status: 401 }));
      await store.touchDevice(device.id);
      const manifest = await store.getManifest(
        device.householdId,
        `${url.origin}/api/media`,
      );
      const etag = `W/"${manifest.revision}"`;
      if (request.headers.get("if-none-match") === etag) {
        return secure(new Response(null, { status: 304, headers: { etag } }));
      }
      return secure(json(manifest, { headers: { etag } }));
    }

    if (url.pathname.startsWith("/api/media/") && request.method === "GET") {
      const device = await authenticatedDevice(request, store);
      if (!device) return secure(new Response("Unauthorized", { status: 401 }));
      const slideId = decodeURIComponent(
        url.pathname.slice("/api/media/".length),
      );
      const media = await store.mediaForDevice(device.householdId, slideId);
      if (!media) return secure(new Response("Not found", { status: 404 }));
      const object = await env.PHOTOS.get(media.r2Key);
      if (!object) return secure(new Response("Not found", { status: 404 }));
      const headers = new Headers({
        "content-type": media.mediaType,
        "cache-control": "private, max-age=86400",
        etag: object.httpEtag,
      });
      object.writeHttpMetadata(headers);
      return secure(new Response(object.body, { headers }));
    }

    if (url.pathname.startsWith("/api/"))
      return secure(json({ error: "not_found" }, { status: 404 }));
    return secure(
      updateableAsset(await env.ASSETS.fetch(request), url.pathname),
    );
  },
};
