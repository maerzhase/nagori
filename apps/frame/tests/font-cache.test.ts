import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function harness(fetcher: (request: unknown) => Promise<Response>) {
  interface WorkerEvent {
    data?: { type?: string };
    request?: Request;
    waitUntil?(value: Promise<unknown>): void;
    respondWith?(value: Promise<Response>): void;
  }
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const key = (request: unknown) =>
    typeof request === "string" ? request : (request as Request).url;
  const caches = {
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async open(name: string) {
      const store = stores.get(name) || new Map<string, Response>();
      stores.set(name, store);
      return {
        async put(request: unknown, response: Response) {
          store.set(key(request), response);
        },
        async match(request: unknown) {
          return store.get(key(request));
        },
        async keys() {
          return [...store.keys()].map(
            (url) => new Request(url, { method: "GET" }),
          );
        },
        async delete(request: unknown) {
          return store.delete(key(request));
        },
      };
    },
  };
  const self = {
    location: { origin: "https://frame.test" },
    clients: {
      async claim() {},
      async matchAll() {
        return [];
      },
    },
    async skipWaiting() {},
    addEventListener(type: string, listener: (event: WorkerEvent) => void) {
      listeners.set(type, listener);
    },
  };
  const source = await readFile(
    new URL("../src/service-worker.ts", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(source.replace("// @ts-nocheck", ""), {
    self,
    caches,
    fetch: fetcher,
    Response,
    Request,
    URL,
    Promise,
    __NAGORI_RELEASE_ID__: "test-release",
  });
  return { listeners, stores, caches };
}

test("warms successful fonts without failing install on network errors", async () => {
  let calls = 0;
  const app = await harness(async () => {
    calls += 1;
    if (calls === 1) throw new Error("offline");
    return new Response("font");
  });
  let pending: Promise<unknown> = Promise.resolve();
  app.listeners.get("install")?.({
    waitUntil(value: Promise<unknown>) {
      pending = value;
    },
  });
  await pending;
  assert.equal(app.stores.get("nagori-fonts-inter-4.5.15")?.size, 7);
});

test("serves cached font offline and retains only the current font cache", async () => {
  const app = await harness(async () => {
    throw new Error("offline");
  });
  const cache = await app.caches.open("nagori-fonts-inter-4.5.15");
  const request = new Request(
    "https://frame.test/fonts/inter-4.5.15-latin-400-normal.woff2",
  );
  await cache.put(request, new Response("cached"));
  app.stores.set("nagori-fonts-old", new Map());
  let response: Promise<Response> = Promise.resolve(new Response("unset"));
  app.listeners.get("fetch")?.({
    request,
    respondWith(value: Promise<Response>) {
      response = value;
    },
  });
  assert.equal(await (await response).text(), "cached");
  let activation: Promise<unknown> = Promise.resolve();
  app.listeners.get("activate")?.({
    waitUntil(value: Promise<unknown>) {
      activation = value;
    },
  });
  await activation;
  assert.equal(app.stores.has("nagori-fonts-inter-4.5.15"), true);
  assert.equal(app.stores.has("nagori-fonts-old"), false);
});

test("does not cache unsuccessful font responses", async () => {
  const app = await harness(
    async () => new Response("missing", { status: 404 }),
  );
  const request = new Request(
    "https://frame.test/fonts/inter-4.5.15-latin-500-normal.woff2",
  );
  let response: Promise<Response> = Promise.resolve(new Response("unset"));
  app.listeners.get("fetch")?.({
    request,
    respondWith(value: Promise<Response>) {
      response = value;
    },
  });
  assert.equal((await response).status, 404);
  assert.equal(app.stores.get("nagori-fonts-inter-4.5.15")?.size, 0);
});

test("media caching remains network-first and bounded to 30 entries", async () => {
  const app = await harness(async () => new Response("photo"));
  for (let index = 0; index < 31; index += 1) {
    const request = new Request(`https://frame.test/api/media/${index}`);
    let response = Promise.resolve(new Response("unset"));
    app.listeners.get("fetch")?.({
      request,
      respondWith(value: Promise<Response>) {
        response = value;
      },
    });
    assert.equal((await response).status, 200);
  }
  const media = app.stores.get("nagori-media-v1");
  assert.equal(media?.size, 30);
  assert.equal(media?.has("https://frame.test/api/media/0"), false);
  assert.equal(media?.has("https://frame.test/api/media/30"), true);
});

test("automatic-update capability marker and cache survive activation", async () => {
  const app = await harness(async () => new Response("unused"));
  let message: Promise<unknown> = Promise.resolve();
  app.listeners.get("message")?.({
    data: { type: "NAGORI_AUTOMATIC_UPDATES" },
    waitUntil(value: Promise<unknown>) {
      message = value;
    },
  });
  await message;
  let activation: Promise<unknown> = Promise.resolve();
  app.listeners.get("activate")?.({
    waitUntil(value: Promise<unknown>) {
      activation = value;
    },
  });
  await activation;
  const capabilities = app.stores.get("nagori-capabilities-v1");
  assert.equal(app.stores.has("nagori-capabilities-v1"), true);
  assert.equal(capabilities?.has("/__nagori/automatic-updates"), true);
});
