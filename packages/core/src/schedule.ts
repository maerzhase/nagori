export const DEFAULT_VISIBILITY_DAYS = 30;
export const ACTIVE_SLIDE_WARNING = 150;
export const ACTIVE_SLIDE_LIMIT = 200;

export type ScheduleStatus = "upcoming" | "active" | "expired" | "draft";

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function defaultSchedule(
  now = new Date(),
  visibilityDays = DEFAULT_VISIBILITY_DAYS,
) {
  return {
    displayFrom: now.toISOString(),
    displayUntil: addDays(now, visibilityDays).toISOString(),
  };
}

export function scheduleStatus(
  slide: { state: string; displayFrom: string; displayUntil: string | null },
  now = new Date(),
): ScheduleStatus {
  if (slide.state !== "published") return "draft";
  const timestamp = now.getTime();
  if (new Date(slide.displayFrom).getTime() > timestamp) return "upcoming";
  if (
    slide.displayUntil &&
    new Date(slide.displayUntil).getTime() <= timestamp
  ) {
    return "expired";
  }
  return "active";
}

export function isVisible(
  slide: { state: string; displayFrom: string; displayUntil: string | null },
  now = new Date(),
): boolean {
  return scheduleStatus(slide, now) === "active";
}

export function clampDisplaySeconds(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.min(60, Math.max(5, Math.round(value)));
}

/**
 * "Forever" travels through the stack as a falsy value: the upload form sends an
 * empty `x-display-until` header for it, and `isValidScheduleWindow` accepts
 * that. The active-slide queries match on `display_until IS NULL`, though, so an
 * empty string stored verbatim hides the slide from every one of them. Collapse
 * it before it reaches the database.
 */
export function normalizeDisplayUntil(
  displayUntil: string | null | undefined,
): string | null {
  const trimmed = displayUntil?.trim();
  return trimmed ? trimmed : null;
}

export function isValidScheduleWindow(
  displayFrom: string,
  displayUntil: string | null,
): boolean {
  if (!displayUntil) return !Number.isNaN(new Date(displayFrom).getTime());
  const from = new Date(displayFrom).getTime();
  const until = new Date(displayUntil).getTime();
  return !Number.isNaN(from) && !Number.isNaN(until) && until > from;
}
