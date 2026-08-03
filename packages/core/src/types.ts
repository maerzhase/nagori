export type Role = "owner" | "editor" | "viewer";
export type SlideKind = "photo" | "message";
export type SlideState = "draft" | "published" | "archived";

export interface ViewerSettings {
  displaySeconds: number;
  fitMode: "contain" | "cover";
  showCaptions: boolean;
  defaultVisibilityDays: number;
}

export interface ViewerSlide {
  id: string;
  kind: SlideKind;
  caption: string | null;
  message: string | null;
  theme: string;
  mediaUrl: string | null;
  displayFrom: string;
  displayUntil: string | null;
}

export interface ViewerManifest {
  revision: number;
  generatedAt: string;
  settings: ViewerSettings;
  slides: ViewerSlide[];
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  householdId: string;
  householdName: string;
  role: Role;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface Database {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<D1Result<T>[]>;
}

export interface ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

export interface ObjectBucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<ObjectBody | null>;
  delete(key: string): Promise<void>;
}
