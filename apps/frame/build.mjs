import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await build({
  entryPoints: ["src/viewer.ts"],
  outfile: "dist/viewer.js",
  bundle: true,
  format: "iife",
  target: ["safari12"],
  minify: true,
  legalComments: "none",
});
