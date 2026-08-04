"use client";

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import type { ComponentPropsWithoutRef, JSX, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface CheckboxProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseCheckbox.Root>, "render"> {
  children: ReactNode;
}

/**
 * The whole row is the control — Base UI renders a `role="checkbox"` button and
 * takes its accessible name from the text inside, so there is no separate label
 * to associate. A hidden input carries `name`/`value` to the enclosing form.
 */
export function Checkbox({
  children,
  className,
  ...props
}: CheckboxProps): JSX.Element {
  return (
    <BaseCheckbox.Root
      {...props}
      className={cn(
        "group flex cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left text-xs font-medium text-foreground focus-visible:outline-none",
        className,
      )}
    >
      <span className="flex size-[18px] flex-none items-center justify-center rounded border border-input bg-card text-on-strong transition-colors group-data-checked:border-transparent group-data-checked:bg-coral-strong group-focus-visible:ring-3 group-focus-visible:ring-ring/25">
        <BaseCheckbox.Indicator className="flex">
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </BaseCheckbox.Indicator>
      </span>
      {children}
    </BaseCheckbox.Root>
  );
}
