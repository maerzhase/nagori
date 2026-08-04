"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, JSX, ReactNode } from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border font-semibold transition-[background-color,transform,color] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        // `coral-strong`, not `coral`: the plain accent carries a small bold
        // label at only 3.48:1. See packages/ui/tests/contrast.test.ts.
        primary:
          "border-transparent bg-coral-strong text-on-strong hover:bg-coral-strong-hover hover:not-disabled:-translate-y-px",
        secondary:
          "border-foreground bg-foreground text-on-strong hover:opacity-90",
        outline: "border-input bg-card text-foreground hover:bg-muted",
        // Quiet, but still a shape you can aim at: transparent until hovered,
        // where `outline` is too heavy to repeat in a row of table actions.
        subtle:
          "border-transparent bg-transparent text-muted-foreground hover:border-input hover:bg-card hover:text-foreground",
      },
      size: {
        default: "min-h-11 px-4 py-2.5 text-sm",
        sm: "min-h-9 px-3 py-1.5 text-xs",
        lg: "min-h-12 px-6 py-3 text-base",
        icon: "size-9 p-0 text-sm [&>svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type BaseButtonProps = ComponentPropsWithoutRef<typeof BaseButton>;

export interface ButtonProps
  extends Omit<BaseButtonProps, "className">,
    VariantProps<typeof buttonVariants> {
  children: ReactNode;
  className?: string;
}

export function Button({
  children,
  className,
  size,
  variant,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <BaseButton
      {...props}
      className={cn(buttonVariants({ size, variant }), className)}
    >
      {children}
    </BaseButton>
  );
}

export { buttonVariants };
