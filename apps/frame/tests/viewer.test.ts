import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: [new URL("../src/viewer.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  format: "iife",
  target: "safari12",
});
const script = bundled.outputFiles[0].text;
const manifest = {
  revision: 1,
  settings: {
    displaySeconds: 12,
    showCaptions: true,
    fitMode: "contain",
    focalPoint: "center",
  },
  slides: [
    { id: "1", kind: "photo", mediaUrl: "/one", caption: "First" },
    { id: "2", kind: "photo", mediaUrl: "/two", caption: "Second" },
    {
      id: "3",
      kind: "message",
      message: "Hello",
      theme: "garden",
      caption: "Third",
    },
  ],
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function harness() {
  const elements = new Map<
    string,
    {
      hidden: boolean;
      className: string;
      textContent: string;
      style: object;
      dataset: object;
      src: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
      addEventListener: () => void;
    }
  >();
  for (const id of [
    "pairing",
    "empty",
    "slide",
    "caption",
    "message",
    "connection",
    "gallery-progress",
    "gallery-counter",
    "gallery-fill",
    "gallery-toggle",
    "photo-a",
    "photo-b",
    "pair-form",
  ]) {
    elements.set(id, {
      hidden: true,
      className: "photo",
      textContent: "",
      style: {},
      dataset: {},
      src: "",
      onload: null,
      onerror: null,
      addEventListener() {},
    });
  }
  let now = 0;
  let id = 0;
  const timers = new Map<number, { run: () => void; delay: number }>();
  const polls: Array<() => void> = [];
  const responses: Array<(value: unknown) => void> = [];
  vm.runInNewContext(script, {
    document: {
      hidden: false,
      getElementById: (key: string) => elements.get(key),
      addEventListener() {},
    },
    navigator: {},
    performance: { now: () => now },
    localStorage: { getItem: () => JSON.stringify(manifest), setItem() {} },
    fetch: (url: string) =>
      url.startsWith("/api/manifest")
        ? new Promise((resolve) => responses.push(resolve))
        : Promise.resolve({}),
    window: {
      location: { hash: "" },
      addEventListener() {},
      setTimeout(run: () => void, delay: number) {
        timers.set(++id, { run, delay });
        return id;
      },
      clearTimeout(key: number) {
        timers.delete(key);
      },
      setInterval(run: () => void) {
        polls.push(run);
      },
    },
  });
  return {
    element(key: string) {
      const element = elements.get(key);
      assert.ok(element, `Missing element ${key}`);
      return element;
    },
    timers,
    polls,
    responses,
    advance() {
      assert.equal(timers.size, 1);
      const [key, timer] = [...timers.entries()][0];
      timers.delete(key);
      now += timer.delay;
      timer.run();
    },
  };
}

test("viewer changes photo and caption together, preserves dwell on unchanged refresh, then shows a message", async () => {
  const h = harness();
  const a = h.element("photo-a");
  const b = h.element("photo-b");
  const caption = h.element("caption");
  assert.equal(b.src, "/one");
  assert.equal(caption.textContent, "");
  b.onload?.();
  assert.equal(caption.textContent, "First");
  assert.equal(b.className, "photo active");
  const timer = [...h.timers.keys()][0];
  h.responses[0]({ status: 304 });
  await settle();
  assert.equal([...h.timers.keys()][0], timer);
  h.advance();
  assert.equal(a.src, "/two");
  assert.equal(caption.textContent, "First");
  a.onload?.();
  assert.equal(caption.textContent, "Second");
  assert.equal(a.className, "photo active");
  h.advance();
  assert.equal(h.element("message").textContent, "Hello");
  assert.equal(caption.textContent, "Third");
});

test("401 prevents a pending photo from painting over pairing", async () => {
  const h = harness();
  const lateLoad = h.element("photo-b").onload;
  h.responses[0]({ status: 401 });
  await settle();
  lateLoad?.();
  assert.equal(h.element("pairing").hidden, false);
  assert.equal(h.element("slide").hidden, true);
  assert.equal(h.timers.size, 0);
});

test("an older manifest response cannot reset the current session", async () => {
  const h = harness();
  h.polls[0]();
  h.responses[1]({ status: 304 });
  await settle();
  h.element("photo-b").onload?.();
  h.responses[0]({ status: 401 });
  await settle();
  assert.equal(h.element("pairing").hidden, true);
  assert.equal(h.element("slide").hidden, false);
  assert.equal(h.timers.size, 1);
});
