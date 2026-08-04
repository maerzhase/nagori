"use client";

import { Field, Input, SegmentedControl } from "@nagori/ui";
import { useState } from "react";

function dayValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export interface ScheduleFieldsProps {
  /** Existing window, when editing a slide that already has one. */
  displayFrom?: string | null;
  displayUntil?: string | null;
  /** True for a slide that is already set to stay in the rotation. */
  forever?: boolean;
}

/**
 * Shared by the composer and the library's schedule editor, so an existing
 * window is always shown as it stands: a slide already kept forever opens on
 * "Keep forever", not on an empty end date.
 */
export function ScheduleFields({
  displayFrom,
  displayUntil,
  forever,
}: ScheduleFieldsProps) {
  const [mode, setMode] = useState<"until" | "forever">(
    forever ? "forever" : "until",
  );
  const today = new Date().toISOString().slice(0, 10);
  const defaultUntil = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  return (
    <fieldset className="schedule-fields">
      <legend>How long should it stay?</legend>
      <div className="schedule-rows">
        <Field label="First shown">
          <Input
            name="displayFrom"
            type="date"
            defaultValue={dayValue(displayFrom) || today}
            required
          />
        </Field>
        <SegmentedControl
          name="scheduleMode"
          legend="Then"
          options={[
            { value: "until", label: "Until a date" },
            { value: "forever", label: "Keep forever" },
          ]}
          value={mode}
          onValueChange={(next) => setMode(next as "until" | "forever")}
        />
        {mode === "until" ? (
          <Field label="Last shown">
            <Input
              name="displayUntil"
              type="date"
              defaultValue={dayValue(displayUntil) || defaultUntil}
              required
            />
          </Field>
        ) : (
          // The actions read `forever`, so the choice still reaches the server
          // when the date input is not rendered.
          <input name="forever" type="hidden" value="yes" />
        )}
      </div>
    </fieldset>
  );
}
