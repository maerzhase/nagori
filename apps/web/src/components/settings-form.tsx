"use client";

import type { ViewerSettings } from "@nagori/core";
import {
  Button,
  Checkbox,
  Field,
  Input,
  SegmentedControl,
  Select,
} from "@nagori/ui";
import { useState } from "react";
import { FOCAL_OPTIONS } from "./slide-card";
import { useFormStatus } from "react-dom";
import { updateSettingsAction } from "@/app/actions";

export function SettingsForm({
  settings,
  saved,
}: {
  settings: ViewerSettings;
  saved: boolean;
}) {
  return (
    <form action={updateSettingsAction} className="settings-form">
      <Field label="Seconds per slide">
        <Input
          name="displaySeconds"
          type="number"
          min="5"
          max="60"
          defaultValue={settings.displaySeconds}
        />
      </Field>
      <PhotoFraming settings={settings} />
      <Field label="Default lifetime">
        <Select
          name="defaultVisibilityDays"
          defaultValue={String(settings.defaultVisibilityDays)}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "60", label: "60 days" },
            { value: "90", label: "90 days" },
          ]}
        />
      </Field>
      <Checkbox name="showCaptions" defaultChecked={settings.showCaptions}>
        Show captions
      </Checkbox>
      <SaveButton saved={saved} />
    </form>
  );
}

/**
 * Household defaults. Any slide can override these from the library, so the
 * copy says "by default".
 */
function PhotoFraming({ settings }: { settings: ViewerSettings }) {
  const [fit, setFit] = useState(settings.fitMode);
  return (
    <div className="settings-framing">
      <SegmentedControl
        name="fitMode"
        legend="Photos, by default"
        options={[
          { value: "contain", label: "Whole photo" },
          { value: "cover", label: "Fill the screen" },
        ]}
        value={fit}
        onValueChange={(next) => setFit(next as typeof fit)}
      />
      {fit === "cover" ? (
        <Field label="Keep this part in view">
          <Select
            name="focalPoint"
            defaultValue={settings.focalPoint}
            options={FOCAL_OPTIONS}
          />
        </Field>
      ) : null}
    </div>
  );
}

function SaveButton({ saved }: { saved: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="form-footer">
      <Button disabled={pending} type="submit">
        {pending ? "Saving…" : "Save settings"}
      </Button>
      <span aria-live="polite">{!pending && saved ? "Saved" : null}</span>
    </div>
  );
}
