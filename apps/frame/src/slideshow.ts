interface Clock {
  now(): number;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
}

interface Playback {
  /** Prepare without changing the visible slide; ready supplies its commit. */
  prepare(
    index: number,
    ready: (commit: () => void) => void,
    fail: () => void,
  ): () => void;
  unavailable(): void;
}

/** Owns loading and dwell deadlines; every asynchronous callback is cancellable. */
export function createSlideshow(clock: Clock, playback: Playback) {
  let count = 0;
  let duration = 12_000;
  let index = 0;
  let failures = 0;
  let generation = 0;
  let timer = 0;
  let timerVersion = 0;
  let cancelLoad = () => {};
  let paused = false;
  let remaining = 0;
  let deadline = 0;
  let action: (() => void) | null = null;

  function cancel() {
    generation++;
    timerVersion++;
    clock.clearTimeout(timer);
    cancelLoad();
    cancelLoad = () => {};
    action = null;
  }

  function arm() {
    if (paused || !action) return;
    const token = generation;
    const version = ++timerVersion;
    deadline = clock.now() + remaining;
    timer = clock.setTimeout(() => {
      if (token !== generation || version !== timerVersion || paused) return;
      const next = action;
      action = null;
      next?.();
    }, remaining);
  }

  function schedule(next: () => void, delay: number) {
    action = next;
    remaining = delay;
    arm();
  }

  function load() {
    cancel();
    if (!count) return;
    const token = generation;
    let settled = false;
    const finish = () => {
      if (token !== generation || settled) return false;
      settled = true;
      clock.clearTimeout(timer);
      cancelLoad();
      cancelLoad = () => {};
      return true;
    };
    const fail = () => {
      if (!finish()) return;
      failures++;
      index = (index + 1) % count;
      if (failures >= count) {
        playback.unavailable();
        failures = 0;
        schedule(load, 60_000);
      } else {
        // Queue even synchronous cache failures instead of recursing.
        schedule(load, 0);
      }
    };
    timer = clock.setTimeout(fail, 10_000);
    const cleanup = playback.prepare(
      index,
      (commit) => {
        if (!finish()) return;
        failures = 0;
        commit();
        if (count > 1)
          schedule(() => {
            index = (index + 1) % count;
            load();
          }, duration);
      },
      fail,
    );
    // prepare may have completed synchronously for a cached photo or message.
    if (settled || token !== generation) cleanup();
    else cancelLoad = cleanup;
  }

  return {
    replace(length: number, displaySeconds: number) {
      cancel();
      count = length;
      duration =
        Number.isFinite(displaySeconds) && displaySeconds > 0
          ? displaySeconds * 1000
          : 12_000;
      index = 0;
      failures = 0;
      if (count) load();
      else playback.unavailable();
    },
    stop() {
      cancel();
      count = 0;
    },
    setPaused(value: boolean) {
      if (paused === value) return;
      paused = value;
      if (action) {
        if (paused) {
          remaining = Math.max(0, deadline - clock.now());
          timerVersion++;
          clock.clearTimeout(timer);
        } else arm();
      }
    },
  };
}
