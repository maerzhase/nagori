import type { UserConfig } from "tsdown";

const isWatch = process.argv.includes("--watch");

const config: UserConfig = {
  entry: ["src/index.ts"],
  unbundle: true,
  format: "esm",
  dts: true,
  clean: !isWatch,
  outDir: "dist",
  platform: "browser",
  deps: {
    onlyBundle: false,
    neverBundle: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@base-ui/react",
      "@base-ui/react/*",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
    ],
  },
};

export default config;
