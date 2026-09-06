import assert from "node:assert/strict";
import test from "node:test";
import { createSlideshow } from "../src/slideshow.ts";

function harness(sync = false) {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const requests: Array<{
    index: number;
    ready: () => void;
    fail: () => void;
    cancelled: boolean;
  }> = [];
  const visible: number[] = [];
  let unavailable = 0;
  const player = createSlideshow(
    {
      now: () => now,
      setTimeout(run, delay) {
        timers.set(++id, { at: now + delay, run });
        return id;
      },
      clearTimeout(key) {
        timers.delete(key);
      },
    },
    {
      prepare(index, ready, fail) {
        const request = {
          index,
          ready: () => ready(() => visible.push(index)),
          fail,
          cancelled: false,
        };
        requests.push(request);
        if (sync) request.ready();
        return () => {
          request.cancelled = true;
        };
      },
      unavailable() {
        unavailable++;
      },
    },
  );
  function tick(ms: number) {
    const end = now + ms;
    for (let steps = 0; steps < 1000; steps++) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) {
        now = end;
        return;
      }
      now = next[1].at;
      timers.delete(next[0]);
      next[1].run();
    }
    throw new Error("unbounded timer loop");
  }
  return {
    player,
    requests,
    visible,
    timers,
    tick,
    unavailable: () => unavailable,
  };
}

test("a slow photo receives its entire dwell after committing", () => {
  const h = harness();
  h.player.replace(2, 12);
  h.tick(9000);
  assert.deepEqual(h.visible, []);
  h.requests[0].ready();
  h.tick(11999);
  assert.equal(h.requests.length, 1);
  h.tick(1);
  assert.equal(h.requests[1].index, 1);
  assert.deepEqual(h.visible, [0]);
  h.requests[1].ready();
  h.tick(12000);
  assert.equal(h.requests[2].index, 0);
});

test("cached photos and messages commit synchronously with one dwell timer", () => {
  const h = harness(true);
  h.player.replace(200, 1);
  h.tick(200000);
  assert.equal(h.visible.length, 201);
  assert.equal(h.visible[200], 0);
  assert.equal(h.timers.size, 1);
});

test("replacement and stop reject stale successes, failures, and timers", () => {
  const h = harness();
  h.player.replace(2, 1);
  const oldTimeout = [...h.timers.values()][0].run;
  h.player.replace(3, 2);
  h.requests[0].ready();
  h.requests[0].fail();
  oldTimeout();
  assert.deepEqual(h.visible, []);
  h.requests[1].ready();
  h.player.stop();
  h.tick(60000);
  assert.equal(h.requests.length, 2);
  assert.equal(h.timers.size, 0);
});

test("failed and hung images are bounded, then retry after a full failed pass", () => {
  const h = harness();
  h.player.replace(2, 1);
  h.requests[0].fail();
  h.tick(0);
  assert.equal(h.requests[1].index, 1);
  h.tick(10000);
  assert.equal(h.unavailable(), 1);
  h.requests[1].ready();
  assert.deepEqual(h.visible, []);
  h.tick(59999);
  assert.equal(h.requests.length, 2);
  h.tick(1);
  h.requests[2].ready();
  assert.deepEqual(h.visible, [0]);
});

test("backgrounding preserves remaining dwell, including repeated lifecycle events", () => {
  const h = harness(true);
  h.player.replace(2, 12);
  h.tick(5000);
  h.player.setPaused(true);
  h.player.setPaused(true);
  h.tick(100000);
  assert.deepEqual(h.visible, [0]);
  h.player.setPaused(false);
  h.player.setPaused(false);
  h.tick(6999);
  assert.deepEqual(h.visible, [0]);
  h.tick(1);
  assert.deepEqual(h.visible, [0, 1]);
});

test("loading while hidden commits without spending the dwell", () => {
  const h = harness();
  h.player.replace(2, 12);
  h.player.setPaused(true);
  h.requests[0].ready();
  h.tick(60000);
  assert.equal(h.requests.length, 1);
  h.player.setPaused(false);
  h.tick(12000);
  assert.equal(h.requests.length, 2);
});

test("empty playlists cancel pending work and single slides do not reload", () => {
  const h = harness(true);
  h.player.replace(1, 1);
  h.tick(60000);
  assert.equal(h.requests.length, 1);
  assert.equal(h.timers.size, 0);
  h.player.replace(0, 1);
  assert.equal(h.unavailable(), 1);
  h.tick(60000);
  assert.equal(h.requests.length, 1);
});

test("a timeout queued before backgrounding cannot advance after resuming", () => {
  const h = harness(true);
  h.player.replace(2, 12);
  const stale = [...h.timers.values()][0].run;
  h.tick(4000);
  h.player.setPaused(true);
  h.player.setPaused(false);
  stale();
  assert.deepEqual(h.visible, [0]);
  h.tick(8000);
  assert.deepEqual(h.visible, [0, 1]);
});

test("a replacement while paused also waits for foreground time", () => {
  const h = harness(true);
  h.player.replace(2, 12);
  h.player.setPaused(true);
  h.player.replace(3, 5);
  h.tick(60000);
  assert.deepEqual(h.visible, [0, 0]);
  h.player.setPaused(false);
  h.tick(5000);
  assert.deepEqual(h.visible, [0, 0, 1]);
});
