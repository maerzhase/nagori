import assert from "node:assert/strict";
import test from "node:test";
import { loadPhoto } from "../src/photo-load.ts";

function photo(cached = false, synchronous = false) {
  return {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    complete: cached,
    naturalWidth: cached ? 100 : 0,
    set src(_value: string) {
      if (synchronous) this.onload?.();
    },
  };
}

for (const mode of ["network", "cached", "synchronous"] as const) {
  test(`commits a ${mode} image exactly once`, () => {
    const image = photo(mode === "cached", mode === "synchronous");
    let commits = 0;
    loadPhoto(image as unknown as HTMLImageElement, "/photo", () => commits++);
    const loaded = image.onload;
    loaded?.();
    loaded?.();
    assert.equal(commits, 1);
  });
}

test("cancelled loads cannot overwrite a later slide", () => {
  const image = photo();
  let commits = 0;
  const cancel = loadPhoto(
    image as unknown as HTMLImageElement,
    "/photo",
    () => commits++,
  );
  const lateLoad = image.onload;
  cancel();
  lateLoad?.();
  assert.equal(commits, 0);
});

test("a broken cached image does not commit", () => {
  const image = photo(true);
  image.naturalWidth = 0;
  let commits = 0;
  loadPhoto(image as unknown as HTMLImageElement, "/broken", () => commits++);
  const lateLoad = image.onload;
  image.onerror?.();
  lateLoad?.();
  assert.equal(commits, 0);
});
