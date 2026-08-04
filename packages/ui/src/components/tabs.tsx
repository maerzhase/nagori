"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentPropsWithoutRef, JSX, ReactNode } from "react";
import { cn } from "../lib/cn";

export type TabsProps = ComponentPropsWithoutRef<typeof BaseTabs.Root>;

export function Tabs({ className, ...props }: TabsProps): JSX.Element {
  return <BaseTabs.Root {...props} className={className} />;
}

export interface TabsListProps
  extends ComponentPropsWithoutRef<typeof BaseTabs.List> {
  children: ReactNode;
}

/**
 * The indicator is positioned from the CSS variables Base UI writes onto it
 * (`--active-tab-top/left/width/height`), so moving between tabs is a transform
 * transition rather than a class swap.
 *
 * It is a plain filled surface. The selected tab is already carried by weight
 * and text colour, so the fill only has to say "this row", and an accent rule
 * pinned to one edge was decoration doing a job the type already did.
 */
export function TabsList({
  children,
  className,
  ...props
}: TabsListProps): JSX.Element {
  return (
    <BaseTabs.List {...props} className={cn("relative grid gap-px", className)}>
      <BaseTabs.Indicator
        renderBeforeHydration
        className="pointer-events-none absolute top-0 left-0 z-0 h-[var(--active-tab-height)] w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] translate-y-[var(--active-tab-top)] rounded-md bg-card transition-[translate,width,height] duration-200 ease-out motion-reduce:transition-none"
      />
      {children}
    </BaseTabs.List>
  );
}

export type TabProps = ComponentPropsWithoutRef<typeof BaseTabs.Tab>;

export function Tab({ className, ...props }: TabProps): JSX.Element {
  return (
    <BaseTabs.Tab
      {...props}
      className={cn(
        "relative z-1 flex cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-selected:font-semibold data-selected:text-foreground [&>svg]:size-[18px]",
        className,
      )}
    />
  );
}

export type TabPanelProps = ComponentPropsWithoutRef<typeof BaseTabs.Panel>;

export function TabPanel({ className, ...props }: TabPanelProps): JSX.Element {
  return (
    <BaseTabs.Panel
      {...props}
      className={cn("focus-visible:outline-none", className)}
    />
  );
}
