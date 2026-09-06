import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);
const appDirectory = new URL("..", import.meta.url);

async function buildWorker(releaseId: string) {
  // Never rebuild the directory Wrangler serves: build.mjs clears its output
  // and the CSS compiler is a separate step in the production build command.
  const outputDirectory = await mkdtemp(join(tmpdir(), "nagori-release-test-"));
  try {
    await execute(process.execPath, ["build.mjs"], {
      cwd: appDirectory,
      env: {
        ...process.env,
        NAGORI_RELEASE_ID: releaseId,
        NAGORI_BUILD_DIR: outputDirectory,
      },
    });
    return await readFile(join(outputDirectory, "sw.js"), "utf8");
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

test("each release ID changes the service worker bundle", async () => {
  const first = await buildWorker("release-id-one");
  const second = await buildWorker("release-id-two");

  assert.match(first, /release-id-one/);
  assert.match(second, /release-id-two/);
  assert.notEqual(first, second);
});
