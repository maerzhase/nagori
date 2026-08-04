"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "../lib/cn";

/** Matches the app's own narrow breakpoint. */
const MOBILE = "(max-width: 720px)";

/**
 * True on narrow screens. Starts false so the server render and the first
 * client render agree; a dialog is closed at that point either way, so the
 * post-mount correction is never visible.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOBILE);
    // A zero-width viewport — a collapsed pane or a detached frame — satisfies
    // `max-width` too, and a sheet is the wrong answer there.
    const sync = () => setIsMobile(query.matches && window.innerWidth > 0);
    sync();
    query.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      query.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
  return isMobile;
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

const panelClass =
  "grid gap-4 bg-card text-foreground shadow-[0_24px_60px_rgba(41,37,31,0.22)]";
const titleClass = "m-0 font-serif text-2xl leading-tight";
const descriptionClass = "m-0 text-sm text-muted-foreground";

/**
 * One dialog that presents as a sheet on a phone and a centred panel on a
 * desktop — a reach-friendly bottom sheet is the native-feeling shape on touch,
 * and Vaul brings the drag-to-dismiss behaviour that implies.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps): JSX.Element {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/45" />
          <Drawer.Content
            /* The transition is load-bearing, not decoration: Vaul unmounts the
               sheet when its slide-out transition ends, so without one the
               closed drawer stays on screen. */
            className={cn(
              panelClass,
              "fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
              "transition-transform duration-300 ease-out motion-reduce:transition-none",
              className,
            )}
          >
            <div
              aria-hidden="true"
              className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border"
            />
            <Drawer.Title className={titleClass}>{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className={descriptionClass}>
                {description}
              </Drawer.Description>
            ) : null}
            {children}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            panelClass,
            // The duration matters beyond looks: an arbitrary `transition-[…]`
            // sets only the property list, and a 0s transition fires no
            // transitionend — so Base UI never unmounted the closed popup and
            // it stayed on screen.
            "fixed top-1/2 left-1/2 z-50 max-h-[88vh] w-[min(34rem,calc(100vw-3rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border p-6 transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0",
            className,
          )}
        >
          <BaseDialog.Title className={titleClass}>{title}</BaseDialog.Title>
          {description ? (
            <BaseDialog.Description className={descriptionClass}>
              {description}
            </BaseDialog.Description>
          ) : null}
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
