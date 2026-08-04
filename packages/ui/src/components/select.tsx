"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import type { JSX, ReactNode } from "react";
import { cn } from "../lib/cn";
import { controlClass } from "./field";

export interface SelectOption {
  value: string;
  label: ReactNode;
}

export interface SelectProps {
  /** Submitted with the surrounding form, via the hidden input Base UI renders. */
  name: string;
  options: readonly SelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  placeholder,
  disabled,
  className,
}: SelectProps): JSX.Element {
  return (
    <BaseSelect.Root
      name={name}
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      items={options as { value: string; label: ReactNode }[]}
    >
      <BaseSelect.Trigger
        className={cn(
          controlClass,
          "flex cursor-pointer items-center justify-between gap-2 text-left",
          className,
        )}
      >
        <BaseSelect.Value placeholder={placeholder} />
        <BaseSelect.Icon className="text-muted-foreground">
          <ChevronDown />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false}>
          <BaseSelect.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-card p-1 text-sm text-foreground shadow-lg">
            {options.map((option) => (
              <BaseSelect.Item
                key={option.value}
                value={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 data-highlighted:bg-muted data-selected:font-semibold"
              >
                <BaseSelect.ItemIndicator className="text-ring">
                  ✓
                </BaseSelect.ItemIndicator>
                <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
