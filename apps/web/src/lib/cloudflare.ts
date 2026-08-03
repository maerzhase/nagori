import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NagoriStore } from "@nagori/core";

export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env as CloudflareEnv;
}

export function getStore(): NagoriStore {
  return new NagoriStore(getEnv().DB);
}
