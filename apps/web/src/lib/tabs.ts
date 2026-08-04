/**
 * Shared by the server page (to read `?tab=`) and the client shell (to render
 * the tabs), so it cannot live in either — a "use client" module's functions
 * are not callable from the server.
 */

export type TabKey = "home" | "library" | "family" | "frame" | "settings";

export const TAB_KEYS: readonly TabKey[] = [
  "home",
  "library",
  "family",
  "frame",
  "settings",
];

export const TAB_LABELS: Record<TabKey, string> = {
  home: "Share Memory",
  library: "Library",
  family: "Family",
  frame: "Frames",
  settings: "Settings",
};

export function isTabKey(value: unknown): value is TabKey {
  return TAB_KEYS.includes(value as TabKey);
}
