import { describe, expect, it } from "vitest";
import { defaultSchedule, isVisible, scheduleStatus } from "../src/schedule";

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
});
