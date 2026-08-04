"use client";

import type { JSX, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SegmentedOption {
  value: string;
  label: ReactNode;
}

export interface SegmentedControlProps {
  /** Submitted with the surrounding form. */
  name: string;
  legend: ReactNode;
  options: readonly SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

/**
 * Native radios in a fieldset, styled as one control. Radios rather than a
 * toggle group because these are mutually exclusive choices that a form has to
 * submit, and because arrow-key navigation then comes from the platform.
 */
export function SegmentedControl({
  name,
  legend,
  options,
  value,
  defaultValue,
  onValueChange,
  className,
}: SegmentedControlProps): JSX.Element {
  return (
    <fieldset className={cn("m-0 grid gap-1.5 border-0 p-0", className)}>
      <legend className="mb-0 p-0 text-xs font-semibold text-foreground">
        {legend}
      </legend>
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex-1 cursor-pointer text-center"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === undefined ? undefined : value === option.value}
              defaultChecked={
                value === undefined ? defaultValue === option.value : undefined
              }
              onChange={() => onValueChange?.(option.value)}
              className="peer sr-only"
            />
            <span className="block rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-[0_1px_2px_rgba(41,37,31,0.10)] peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
