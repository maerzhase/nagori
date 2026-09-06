import assert from "node:assert/strict";
import test from "node:test";
import {
  captionFactor,
  parsePosition,
  renderedRect,
  sampleRect,
  scrimOpacity,
} from "../src/scrim.ts";

const viewport = { width: 1000, height: 800 };

test("contain letterboxes a wide photo and samples only its visible bottom", () => {
  const natural = { width: 2000, height: 1000 };
  const rect = renderedRect("contain", "center", viewport, natural);
  assert.deepEqual(rect, { x: 0, y: 150, width: 1000, height: 500 });
  // Band starts inside the photo: sample from band top to photo bottom.
  const sample = sampleRect(rect, 560, viewport, natural);
  assert.deepEqual(sample, { x: 0, y: 820, width: 2000, height: 180 });
  // Band entirely in the letterbox below the photo: nothing to sample.
  assert.equal(sampleRect(rect, 700, viewport, natural), null);
});

test("cover crops toward the focal point", () => {
  const natural = { width: 1000, height: 2000 };
  const top = renderedRect("cover", "top", viewport, natural);
  assert.deepEqual(top, { x: 0, y: 0, width: 1000, height: 2000 });
  const sample = sampleRect(top, 570, viewport, natural);
  assert.deepEqual(sample, { x: 0, y: 570, width: 1000, height: 230 });
  const bottom = renderedRect("cover", "50% 100%", viewport, natural);
  assert.equal(bottom.y, -1200);
});

test("position parsing accepts keywords and percentages", () => {
  assert.deepEqual(parsePosition("center"), { x: 0.5, y: 0.5 });
  assert.deepEqual(parsePosition("left top"), { x: 0, y: 0 });
  assert.deepEqual(parsePosition("bottom"), { x: 0.5, y: 1 });
  assert.deepEqual(parsePosition("25% 75%"), { x: 0.25, y: 0.75 });
});

test("scrim opacity ranges from light on dark photos to full on white", () => {
  assert.equal(scrimOpacity(0), 0.4);
  assert.equal(scrimOpacity(0.15), 0.4);
  assert.equal(scrimOpacity(1), 1);
  assert.ok(Math.abs(scrimOpacity(0.45) - 0.7) < 1e-9);
});

test("caption factor grows with lines: haze for one, full band by three", () => {
  assert.equal(captionFactor(1), 0.3);
  assert.ok(Math.abs(captionFactor(2) - 0.65) < 1e-9);
  assert.equal(captionFactor(3), 1);
  assert.equal(captionFactor(7), 1);
});
