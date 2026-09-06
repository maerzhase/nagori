export interface SlideshowClock {
  now(): number;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
}

export interface SlideshowState {
  duration: number;
  remaining: number;
  paused: boolean;
  generation: number;
}

export function createSlideshowController(
  clock: SlideshowClock,
  onAdvance: () => void,
  onState: (state: SlideshowState) => void,
) {
  let timer = 0;
  let duration = 0;
  let remaining = 0;
  let deadline = 0;
  let generation = 0;
  const pauses = new Set<string>();

  function clear() {
    if (timer) clock.clearTimeout(timer);
    timer = 0;
  }

  function state(): SlideshowState {
    const value =
      pauses.size || !timer ? remaining : Math.max(0, deadline - clock.now());
    return { duration, remaining: value, paused: pauses.size > 0, generation };
  }

  function emit() {
    onState(state());
  }

  function schedule() {
    clear();
    if (pauses.size || remaining <= 0) {
      emit();
      return;
    }
    deadline = clock.now() + remaining;
    timer = clock.setTimeout(() => {
      timer = 0;
      remaining = 0;
      emit();
      onAdvance();
    }, remaining);
    emit();
  }

  return {
    commit(milliseconds: number) {
      duration = Math.max(0, milliseconds);
      remaining = duration;
      schedule();
    },
    pause(reason: string) {
      if (pauses.has(reason)) return;
      if (!pauses.size && timer)
        remaining = Math.max(0, deadline - clock.now());
      pauses.add(reason);
      clear();
      emit();
    },
    resume(reason: string) {
      if (!pauses.delete(reason)) return;
      schedule();
    },
    cancel() {
      clear();
      duration = 0;
      remaining = 0;
      generation += 1;
      emit();
    },
    invalidate() {
      generation += 1;
      return generation;
    },
    isCurrent(value: number) {
      return value === generation;
    },
    isPaused() {
      return pauses.size > 0;
    },
    getState: state,
  };
}

export function revisionChanged(current: number | null, next: number) {
  return current === null || current !== next;
}

export function commitSlideDwell(
  controller: ReturnType<typeof createSlideshowController>,
  slideCount: number,
  milliseconds: number,
) {
  if (slideCount > 1) controller.commit(milliseconds);
  else controller.cancel();
}

export function guardedDeferred(
  clock: Pick<SlideshowClock, "setTimeout" | "clearTimeout">,
  generation: number,
  isCurrent: (generation: number) => boolean,
  callback: () => void,
  delay: number,
) {
  return clock.setTimeout(() => {
    if (isCurrent(generation)) callback();
  }, delay);
}

export function guardedCallback(
  generation: number,
  isCurrent: (generation: number) => boolean,
  callback: () => void,
) {
  return () => {
    if (isCurrent(generation)) callback();
  };
}
