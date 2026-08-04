"use client";

import { useRef, useState } from "react";
import type { JSX, MouseEvent, ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import { Dialog } from "./dialog";

export interface ConfirmButtonProps
  extends Omit<ButtonProps, "onClick" | "type" | "children" | "title"> {
  /** Trigger content — an icon, or a word. */
  children: ReactNode;
  /** Accessible name, needed when the trigger is icon-only. */
  label: string;
  heading: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
}

/**
 * A submit button that asks first. It renders its own trigger and, on confirm,
 * submits the form it sits in — so the surrounding server action stays a plain
 * `<form action={…}>` and behaves as it did without the confirmation step.
 */
export function ConfirmButton({
  children,
  label,
  heading,
  description,
  confirmLabel,
  cancelLabel = "Keep it",
  ...props
}: ConfirmButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);
  // Captured from the click rather than a ref, because Button renders through
  // Base UI and does not forward one.
  const form = useRef<HTMLFormElement | null>(null);
  return (
    <>
      <Button
        {...props}
        aria-label={label}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          form.current = event.currentTarget.form;
          setOpen(true);
        }}
        type="button"
      >
        {children}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={heading}
        description={description}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              form.current?.requestSubmit();
              setOpen(false);
            }}
            type="button"
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
