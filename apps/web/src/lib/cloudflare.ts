import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MemoryScreenStore } from "@memory-screen/core";

export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env as CloudflareEnv;
}

export function getStore(): MemoryScreenStore {
  return new MemoryScreenStore(getEnv().DB);
}
