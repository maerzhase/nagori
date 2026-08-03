interface CloudflareEnv {
  DB: import("@memory-screen/core").Database;
  PHOTOS: import("@memory-screen/core").ObjectBucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  FRAME_URL: string;
  APP_URL: string;
  INITIAL_OWNER_EMAIL?: string;
}
