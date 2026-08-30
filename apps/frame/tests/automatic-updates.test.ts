import assert from "node:assert/strict";
import test from "node:test";

import { startAutomaticUpdates } from "../src/automatic-updates.ts";

function harness(controlled = true) {
  const listeners = new Map<string, () => void>();
  const intervals: Array<() => void> = [];
  let updateCalls = 0;
  let reloads = 0;
  let capabilityMessages = 0;
  const registration = {
    async update() {
      updateCalls += 1;
    },
  };
  const serviceWorkers = {
    controller: controlled
      ? {
          postMessage(message: { type?: string }) {
            if (message.type === "NAGORI_AUTOMATIC_UPDATES") {
              capabilityMessages += 1;
            }
          },
        }
      : null,
    async register(scriptUrl: string) {
      assert.equal(scriptUrl, "/sw.js");
      return registration;
    },
    addEventListener(type: string, listener: () => void) {
      listeners.set(`sw:${type}`, listener);
    },
    removeEventListener(type: string) {
      listeners.delete(`sw:${type}`);
    },
  };
  const page = {
    hidden: false,
    addEventListener(type: string, listener: () => void) {
      listeners.set(`page:${type}`, listener);
    },
    removeEventListener(type: string) {
      listeners.delete(`page:${type}`);
    },
  };
  const browser = {
    location: {
      reload() {
        reloads += 1;
      },
    },
    addEventListener(type: string, listener: () => void) {
      listeners.set(`window:${type}`, listener);
    },
    removeEventListener(type: string) {
      listeners.delete(`window:${type}`);
    },
    setInterval(callback: () => void, delay: number) {
      assert.equal(delay, 15 * 60_000);
      intervals.push(callback);
      return intervals.length;
    },
    clearInterval() {},
  };

  return {
    browser,
    intervals,
    listeners,
    page,
    serviceWorkers,
    updateCalls: () => updateCalls,
    reloads: () => reloads,
    capabilityMessages: () => capabilityMessages,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("checks immediately, periodically, and when connectivity returns", async () => {
  const app = harness();
  startAutomaticUpdates(app.serviceWorkers, app.page, app.browser);
  await settle();
  assert.equal(app.updateCalls(), 1);
  assert.equal(app.capabilityMessages(), 1);

  app.intervals[0]();
  await settle();
  app.listeners.get("window:online")?.();
  await settle();
  app.listeners.get("page:visibilitychange")?.();
  await settle();
  assert.equal(app.updateCalls(), 4);
});

test("reloads once when an updated worker takes over", async () => {
  const app = harness(true);
  startAutomaticUpdates(app.serviceWorkers, app.page, app.browser);
  await settle();

  app.listeners.get("sw:controllerchange")?.();
  app.listeners.get("sw:controllerchange")?.();
  assert.equal(app.reloads(), 1);
});

test("does not reload when the first service worker is installed", async () => {
  const app = harness(false);
  startAutomaticUpdates(app.serviceWorkers, app.page, app.browser);
  await settle();

  app.serviceWorkers.controller = { postMessage() {} };
  app.listeners.get("sw:controllerchange")?.();
  assert.equal(app.reloads(), 0);
});
