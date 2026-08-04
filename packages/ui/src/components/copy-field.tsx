"use client";

import { useState } from "react";
import type { JSX } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

export interface CopyFieldProps {
  /** The link or code to copy. Shown in full so it can also be read aloud. */
  value: string;
  label?: string;
  className?: string;
}

export function CopyField({
  value,
  label = "Copy",
  className,
}: CopyFieldProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2",
        className,
      )}
    >
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-1 font-mono text-xs text-foreground">
        {value}
      </code>
      <Button
        size="sm"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard access can be denied; the value stays selectable.
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : label}
      </Button>
    </div>
  );
}
