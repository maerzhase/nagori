interface CloudflareEnv {
  DB: import("@nagori/core").Database;
  PHOTOS: import("@nagori/core").ObjectBucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  FRAME_URL: string;
  APP_URL: string;
  BUILD_SHA?: string;
  INITIAL_OWNER_EMAIL?: string;
}
