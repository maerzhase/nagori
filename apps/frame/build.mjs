import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const releaseId =
  process.env.NAGORI_RELEASE_ID ||
  process.env.GITHUB_SHA ||
  `local-${Date.now().toString(36)}`;

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await cp("../../packages/ui/src/styles/fonts", "dist/fonts", {
  recursive: true,
});
await build({
  entryPoints: ["src/viewer.ts"],
  outfile: "dist/viewer.js",
  bundle: true,
  format: "iife",
  target: ["safari12"],
  minify: true,
  legalComments: "none",
});
await build({
  entryPoints: ["src/service-worker.ts"],
  outfile: "dist/sw.js",
  bundle: true,
  format: "iife",
  target: ["safari12"],
  minify: true,
  legalComments: "none",
  define: {
    __NAGORI_RELEASE_ID__: JSON.stringify(releaseId),
  },
});
