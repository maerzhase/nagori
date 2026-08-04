import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../components/button";
import { Checkbox } from "../components/checkbox";
import { CopyField } from "../components/copy-field";
import { Field, Input, Textarea } from "../components/field";
import { Select } from "../components/select";

const meta: Meta = {
  title: "Primitives/Form",
  parameters: {
    layout: "padded",
  },
};

export default meta;

export const Fields: StoryObj = {
  render: () => (
    <form className="grid w-80 gap-4">
      <Field label="Email address">
        <Input name="email" type="email" placeholder="family@example.com" />
      </Field>
      <Field label="Little note" hint="optional">
        <Input name="caption" placeholder="Sunday lunch at the old house" />
      </Field>
      <Field label="Message">
        <Textarea name="message" placeholder="Thinking of you both today…" />
      </Field>
      <Field label="Background">
        <Select
          name="theme"
          defaultValue="paper"
          options={[
            { value: "paper", label: "Warm paper" },
            { value: "sunset", label: "Sunset coral" },
            { value: "garden", label: "Garden green" },
          ]}
        />
      </Field>
      <Checkbox name="forever" value="yes">
        Keep in the rotation forever
      </Checkbox>
      <Button type="submit">Share with the frame</Button>
    </form>
  ),
};

export const Copyable: StoryObj = {
  render: () => (
    <div className="w-96">
      <CopyField
        value="https://nagori.example/join/invite_9f3c2a7b41d8"
        label="Copy link"
      />
    </div>
  ),
};
