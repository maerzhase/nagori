import type { SlideRow } from "@nagori/core";

export type SortKey = "newest" | "oldest" | "ending";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "ending", label: "Leaving soonest" },
];

export function isSortKey(value: unknown): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

/**
 * Sorts a copy, since the caller's array is also grouped by schedule status.
 * "Leaving soonest" puts slides kept forever last — they are never leaving.
 */
export function sortSlides(slides: SlideRow[], sort: SortKey): SlideRow[] {
  const sorted = [...slides];
  if (sort === "oldest")
    return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (sort === "ending")
    return sorted.sort((a, b) => {
      if (a.displayUntil === b.displayUntil) return 0;
      if (a.displayUntil === null) return 1;
      if (b.displayUntil === null) return -1;
      return a.displayUntil.localeCompare(b.displayUntil);
    });
  return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
