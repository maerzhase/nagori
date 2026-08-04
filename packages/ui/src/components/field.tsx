"use client";

import { Field as BaseField } from "@base-ui/react/field";
import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentPropsWithoutRef, JSX, ReactNode } from "react";
import { cn } from "../lib/cn";

const labelClass =
  "grid gap-1.5 text-xs font-semibold text-foreground [&>span]:font-normal [&>span]:text-muted-foreground";

/** Border is `--input`, not `--border`: a control's edge has to clear 3:1. */
const controlClass =
  "w-full rounded-md border border-input bg-card px-3 py-3 text-sm text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60";

export interface FieldProps extends ComponentPropsWithoutRef<"div"> {
  /** Visible label. Base UI wires it to the control's id for us. */
  label: ReactNode;
  /** Shown under the label, before the control — for a hint or "optional". */
  hint?: ReactNode;
  /** Shown when the control fails validation. */
  error?: ReactNode;
  children: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  ...props
}: FieldProps): JSX.Element {
  return (
    <BaseField.Root {...props} className={cn("grid gap-1.5", className)}>
      <BaseField.Label className={labelClass}>
        {label}
        {hint ? <span>{hint}</span> : null}
      </BaseField.Label>
      {children}
      {error ? (
        <BaseField.Error className="text-xs text-danger">
          {error}
        </BaseField.Error>
      ) : null}
    </BaseField.Root>
  );
}

export type InputProps = ComponentPropsWithoutRef<typeof BaseInput>;

export function Input({ className, ...props }: InputProps): JSX.Element {
  return <BaseInput {...props} className={cn(controlClass, className)} />;
}

export type TextareaProps = ComponentPropsWithoutRef<"textarea">;

export function Textarea({ className, ...props }: TextareaProps): JSX.Element {
  // Props go on the rendered element, not on Control: Control is typed for
  // `input`, and Base UI merges its own id/aria wiring into whatever we render.
  return (
    <BaseField.Control
      render={<textarea {...props} />}
      className={cn(
        controlClass,
        "min-h-24 resize-y leading-relaxed",
        className,
      )}
    />
  );
}

export { controlClass, labelClass };
