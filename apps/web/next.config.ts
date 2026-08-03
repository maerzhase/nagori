import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev({ persist: { path: "../../.wrangler/state/v3" } });

const nextConfig: NextConfig = {
  transpilePackages: ["@memory-screen/core"],
};

export default nextConfig;
