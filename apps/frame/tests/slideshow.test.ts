import assert from "node:assert/strict";
import test from "node:test";

import {
  commitSlideDwell,
  createSlideshowController,
  guardedCallback,
  guardedDeferred,
  revisionChanged,
} from "../src/slideshow.ts";

function harness() {
  let now = 0;
  let nextId = 1;
  let advances = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const states: Array<{
    remaining: number;
    paused: boolean;
    generation: number;
  }> = [];
  const clock = {
    now: () => now,
    setTimeout(callback: () => void, delay: number) {
      const id = nextId++;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
  };
  const controller = createSlideshowController(
    clock,
    () => advances++,
    (state) => states.push(state),
  );
  return {
    controller,
    advances: () => advances,
    states,
    tick(milliseconds: number) {
      now += milliseconds;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    timerCount: () => timers.size,
  };
}

test("commits one authoritative deadline and advances once", () => {
  const app = harness();
  app.controller.commit(12_000);
  assert.equal(app.timerCount(), 1);
  app.tick(11_999);
  assert.equal(app.advances(), 0);
  app.tick(1);
  assert.equal(app.advances(), 1);
  assert.equal(app.timerCount(), 0);
});

test("pause and resume preserve the remaining dwell", () => {
  const app = harness();
  app.controller.commit(12_000);
  app.tick(6_000);
  app.controller.pause("manual");
  assert.equal(app.controller.getState().remaining, 6_000);
  app.tick(20_000);
  assert.equal(app.advances(), 0);
  app.controller.resume("manual");
  app.tick(5_999);
  assert.equal(app.advances(), 0);
  app.tick(1);
  assert.equal(app.advances(), 1);
});

test("independent hidden and manual pauses do not resume each other", () => {
  const app = harness();
  app.controller.commit(1_000);
  app.controller.pause("manual");
  app.controller.pause("hidden");
  app.controller.resume("hidden");
  assert.equal(app.controller.isPaused(), true);
  assert.equal(app.timerCount(), 0);
  app.controller.resume("manual");
  assert.equal(app.timerCount(), 1);
});

test("cancel and revision generations invalidate stale work", () => {
  const app = harness();
  const first = app.controller.invalidate();
  assert.equal(app.controller.isCurrent(first), true);
  app.controller.commit(1_000);
  app.controller.cancel();
  assert.equal(app.controller.isCurrent(first), false);
  app.tick(2_000);
  assert.equal(app.advances(), 0);
});

test("photo content and position commit only after the current load", () => {
  const app = harness();
  const generation = app.controller.invalidate();
  let caption = "previous";
  let counter = "1 / 2";
  const loaded = guardedCallback(generation, app.controller.isCurrent, () => {
    caption = "new caption";
    counter = "2 / 2";
  });
  assert.equal(caption, "previous");
  assert.equal(counter, "1 / 2");
  loaded();
  assert.equal(caption, "new caption");
  assert.equal(counter, "2 / 2");
});

test("late photo load and queued failed-photo skip are ignored after cancel", () => {
  const app = harness();
  const generation = app.controller.invalidate();
  let paints = 0;
  let queued = () => {};
  const loaded = guardedCallback(
    generation,
    app.controller.isCurrent,
    () => paints++,
  );
  guardedDeferred(
    {
      setTimeout: (callback) => {
        queued = callback;
        return 99;
      },
      clearTimeout() {},
    },
    generation,
    app.controller.isCurrent,
    () => paints++,
    0,
  );
  app.controller.cancel();
  loaded();
  queued();
  assert.equal(paints, 0);
});

test("unchanged revision preserves the active deadline", () => {
  const app = harness();
  app.controller.commit(12_000);
  app.tick(6_000);
  assert.equal(revisionChanged(7, 7), false);
  assert.equal(app.controller.getState().remaining, 6_000);
  app.tick(6_000);
  assert.equal(app.advances(), 1);
});

test("single slide cancels dwell so progress stays static and does not loop", () => {
  const app = harness();
  commitSlideDwell(app.controller, 1, 12_000);
  assert.equal(app.timerCount(), 0);
  app.tick(20_000);
  assert.equal(app.advances(), 0);
});
