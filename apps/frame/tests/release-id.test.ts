import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const appDirectory = new URL("..", import.meta.url);

async function buildWorker(releaseId: string) {
  await execute(process.execPath, ["build.mjs"], {
    cwd: appDirectory,
    env: { ...process.env, NAGORI_RELEASE_ID: releaseId },
  });
  return readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
}

test("each release ID changes the service worker bundle", async () => {
  const first = await buildWorker("release-id-one");
  const second = await buildWorker("release-id-two");

  assert.match(first, /release-id-one/);
  assert.match(second, /release-id-two/);
  assert.notEqual(first, second);
});
