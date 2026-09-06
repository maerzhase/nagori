import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

const outputDirectory = process.env.NAGORI_BUILD_DIR || "dist";

const releaseId =
  process.env.NAGORI_RELEASE_ID ||
  process.env.GITHUB_SHA ||
  `local-${Date.now().toString(36)}`;

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp("public", outputDirectory, { recursive: true });
await cp("../../packages/ui/src/styles/fonts", join(outputDirectory, "fonts"), {
  recursive: true,
});
await build({
  entryPoints: ["src/viewer.ts"],
  outfile: join(outputDirectory, "viewer.js"),
  bundle: true,
  format: "iife",
  target: ["safari12"],
  minify: true,
  legalComments: "none",
});
await build({
  entryPoints: ["src/service-worker.ts"],
  outfile: join(outputDirectory, "sw.js"),
  bundle: true,
  format: "iife",
  target: ["safari12"],
  minify: true,
  legalComments: "none",
  define: {
    __NAGORI_RELEASE_ID__: JSON.stringify(releaseId),
  },
});
