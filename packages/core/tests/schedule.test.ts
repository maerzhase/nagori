import { describe, expect, it } from "vitest";
import {
  defaultSchedule,
  isValidScheduleWindow,
  isVisible,
  normalizeDisplayUntil,
  scheduleStatus,
} from "../src/schedule";

const now = new Date("2026-08-03T12:00:00.000Z");

describe("slide scheduling", () => {
  it("defaults new slides to a thirty day window", () => {
    expect(defaultSchedule(now)).toEqual({
      displayFrom: "2026-08-03T12:00:00.000Z",
      displayUntil: "2026-09-02T12:00:00.000Z",
    });
  });

  it("separates upcoming, active, expired, and draft slides", () => {
    expect(
      scheduleStatus(
        {
          state: "published",
          displayFrom: "2026-08-04T00:00:00Z",
          displayUntil: null,
        },
        now,
      ),
    ).toBe("upcoming");
    expect(
      scheduleStatus(
        {
          state: "published",
          displayFrom: "2026-08-01T00:00:00Z",
          displayUntil: null,
        },
        now,
      ),
    ).toBe("active");
    expect(
      scheduleStatus(
        {
          state: "published",
          displayFrom: "2026-07-01T00:00:00Z",
          displayUntil: "2026-08-03T11:00:00Z",
        },
        now,
      ),
    ).toBe("expired");
    expect(
      scheduleStatus(
        {
          state: "draft",
          displayFrom: "2026-08-01T00:00:00Z",
          displayUntil: null,
        },
        now,
      ),
    ).toBe("draft");
  });

  it("only exposes currently active slides", () => {
    expect(
      isVisible(
        {
          state: "published",
          displayFrom: "2026-08-01T00:00:00Z",
          displayUntil: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("stores a forever slide as null rather than an empty string", () => {
    // The upload form sends an empty x-display-until header for "forever". Left
    // as "", the slide matches neither branch of `display_until IS NULL OR
    // display_until > ?`, so it counts as zero active and never reaches the frame.
    expect(normalizeDisplayUntil("")).toBeNull();
    expect(normalizeDisplayUntil("   ")).toBeNull();
    expect(normalizeDisplayUntil(undefined)).toBeNull();
    expect(normalizeDisplayUntil(null)).toBeNull();
    expect(normalizeDisplayUntil("2026-09-02T12:00:00.000Z")).toBe(
      "2026-09-02T12:00:00.000Z",
    );
  });

  it("treats a forever slide as active regardless of empty or null", () => {
    for (const until of ["", null]) {
      expect(
        isVisible(
          {
            state: "published",
            displayFrom: "2026-08-01T00:00:00Z",
            displayUntil: normalizeDisplayUntil(until),
          },
          now,
        ),
      ).toBe(true);
    }
  });

  it("rejects a schedule that ends before or at its start", () => {
    expect(
      isValidScheduleWindow("2026-08-03T12:00:00Z", "2026-08-03T12:00:00Z"),
    ).toBe(false);
    expect(
      isValidScheduleWindow("2026-08-03T12:00:00Z", "2026-08-03T12:00:01Z"),
    ).toBe(true);
  });
});
