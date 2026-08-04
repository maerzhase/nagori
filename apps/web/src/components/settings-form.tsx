"use client";

import type { ViewerSettings } from "@nagori/core";
import { Button, Checkbox, Field, Input, Select } from "@nagori/ui";
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
      <fieldset aria-labelledby="captions-title" className="settings-captions">
        <p className="field-group-title" id="captions-title">
          Captions
        </p>
        <Checkbox name="showCaptions" defaultChecked={settings.showCaptions}>
          Show the note written with each photo
        </Checkbox>
      </fieldset>
      <SaveButton saved={saved} />
    </form>
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
