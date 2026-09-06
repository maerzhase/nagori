// @ts-nocheck

const CACHE_NAME = "nagori-media-v1";
const FONT_CACHE_NAME = "nagori-fonts-inter-4.5.15";
const CAPABILITY_CACHE_NAME = "nagori-capabilities-v1";
const AUTOMATIC_UPDATES_MARKER = "/__nagori/automatic-updates";
const RELEASE_ID = __NAGORI_RELEASE_ID__;
const MAX_MEDIA_ENTRIES = 30;
const FONT_PATHS = [
  "/fonts/inter-4.5.15-latin-400-normal.woff2",
  "/fonts/inter-4.5.15-latin-500-normal.woff2",
  "/fonts/inter-4.5.15-latin-600-normal.woff2",
  "/fonts/inter-4.5.15-latin-700-normal.woff2",
  "/fonts/inter-4.5.15-latin-ext-400-normal.woff2",
  "/fonts/inter-4.5.15-latin-ext-500-normal.woff2",
  "/fonts/inter-4.5.15-latin-ext-600-normal.woff2",
  "/fonts/inter-4.5.15-latin-ext-700-normal.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      self.skipWaiting(),
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        await Promise.all(
          FONT_PATHS.map(async (path) => {
            try {
              const response = await fetch(path);
              if (response.ok) await cache.put(path, response);
            } catch {
              // Fonts remain optional: system fallbacks keep install usable.
            }
          }),
        );
      }),
    ]),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys(),
      caches
        .open(CAPABILITY_CACHE_NAME)
        .then((cache) => cache.match(AUTOMATIC_UPDATES_MARKER)),
    ]).then(async (results) => {
      const keys = results[0];
      const automaticUpdates = results[1];
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("nagori-") &&
              key !== CACHE_NAME &&
              key !== FONT_CACHE_NAME &&
              key !== CAPABILITY_CACHE_NAME,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
      if (automaticUpdates) return;

      // This deploy may be taking over a viewer bundle from before automatic
      // updates existed. That old page cannot react to controllerchange, so
      // navigate it once to bootstrap the new updater without device access.
      const windows = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      await Promise.all(
        windows.map((client) =>
          "navigate" in client
            ? client.navigate(client.url)
            : Promise.resolve(),
        ),
      );
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "NAGORI_AUTOMATIC_UPDATES") return;
  event.waitUntil(
    caches
      .open(CAPABILITY_CACHE_NAME)
      .then((cache) =>
        cache.put(AUTOMATIC_UPDATES_MARKER, new Response(RELEASE_ID)),
      ),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(
    keys
      .slice(0, Math.max(0, keys.length - MAX_MEDIA_ENTRIES))
      .map((key) => cache.delete(key)),
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    FONT_PATHS.indexOf(url.pathname) !== -1
  ) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          return new Response("Offline", { status: 503 });
        }
      }),
    );
    return;
  }
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith("/api/media/")
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          await trim(cache);
        }
        return response;
      } catch {
        return (
          (await cache.match(request)) ||
          new Response("Offline", { status: 503 })
        );
      }
    }),
  );
});
