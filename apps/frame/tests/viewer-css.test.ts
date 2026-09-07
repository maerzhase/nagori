import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/**
 * The frame runs on iOS 12. Tailwind's minifier lowers CSS for Safari 16.4 and
 * once shipped `inset: 0`, which old WebKit ignores: the sleep overlay landed
 * off-screen and the caption scrim had no size. Build the stylesheet the way
 * the build script does and reject syntax that WebKit 12 cannot parse.
 */
test("built viewer.css contains no syntax iOS 12 lacks", () => {
  const output = join(mkdtempSync(join(tmpdir(), "nagori-css-")), "viewer.css");
  execFileSync(
    "pnpm",
    ["exec", "tailwindcss", "-i", "src/viewer.css", "-o", output],
    { cwd: new URL("..", import.meta.url), stdio: "ignore" },
  );
  const css = readFileSync(output, "utf8");
  // Tailwind's own preflight uses color-mix() in a placeholder fallback that
  // old WebKit drops harmlessly, so only the layout-breaking lowering is
  // rejected here.
  assert.doesNotMatch(css, /\binset\s*:/);
});
