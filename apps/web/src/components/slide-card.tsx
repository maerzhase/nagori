"use client";

import type { SlideRow } from "@nagori/core";
import type { FitMode, FocalPoint, ViewerSettings } from "@nagori/core";
import {
  Button,
  ConfirmButton,
  Dialog,
  Field,
  SegmentedControl,
  Select,
  SlidePreview,
} from "@nagori/ui";
import type { CSSProperties } from "react";
import { useState } from "react";
import {
  archiveSlideAction,
  rescheduleSlideAction,
  updateSlideDisplayAction,
} from "@/app/actions";
import { ScheduleFields } from "./schedule-fields";

function formatDate(value: string | null) {
  if (!value) return "Kept forever";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * The card is the picture. Everything else — schedule, framing, archiving —
 * lives behind it, because a grid of thumbnails is what the library is for and
 * inline editors on every tile buried that.
 */
export function SlideCard({
  slide,
  settings,
  index,
  total,
  ref,
  style,
  dragHandle,
  dragging,
}: {
  slide: SlideRow;
  settings: ViewerSettings;
  /** Position in the rotation, 1-based, as the frame plays it. */
  index: number;
  total: number;
  ref?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  /** Drag attributes and listeners, when the list is reorderable. */
  dragHandle?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const imageUrl =
    slide.kind === "photo"
      ? `/api/media/${encodeURIComponent(slide.id)}`
      : null;
  const label = slide.caption || slide.message?.slice(0, 60) || "Family memory";

  return (
    <article
      className={`memory-card${dragging ? " dragging" : ""}`}
      ref={ref}
      style={style}
    >
      <button
        aria-label={`Edit “${label}”`}
        className="memory-open"
        onClick={() => setOpen(true)}
        type="button"
      >
        <SlidePreview
          imageUrl={imageUrl}
          theme={slide.theme}
          message={slide.message}
          caption={slide.caption}
          fit={slide.fitMode ?? settings.fitMode}
          focalPoint={slide.focalPoint ?? settings.focalPoint}
          showCaption={settings.showCaptions}
        />
      </button>
      <div className="memory-meta">
        <div>
          <h3>{label}</h3>
          <p>
            {index} of {total} · {formatDate(slide.displayUntil)}
          </p>
        </div>
        <div className="memory-actions">
          {dragHandle ? (
            <Button
              {...dragHandle}
              aria-label={`Reorder “${label}”`}
              className="memory-grip"
              size="icon"
              type="button"
              variant="subtle"
            >
              <GripIcon />
            </Button>
          ) : null}
          <form action={archiveSlideAction}>
            <input type="hidden" name="slideId" value={slide.id} />
            <ConfirmButton
              label={`Archive ${label}`}
              heading="Archive this memory?"
              description="It leaves the frame straight away. Photos are removed from storage, so this cannot be undone."
              confirmLabel="Archive it"
              size="icon"
              variant="outline"
            >
              <CloseIcon />
            </ConfirmButton>
          </form>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description={
          slide.displayUntil
            ? `Showing until ${formatDate(slide.displayUntil)}`
            : "Kept in the rotation forever"
        }
      >
        <SlidePreview
          className="max-w-56 rounded-lg"
          imageUrl={imageUrl}
          theme={slide.theme}
          message={slide.message}
          caption={slide.caption}
          fit={slide.fitMode ?? settings.fitMode}
          focalPoint={slide.focalPoint ?? settings.focalPoint}
          showCaption={settings.showCaptions}
        />

        {slide.kind === "photo" ? (
          <form action={updateSlideDisplayAction} className="dialog-form">
            <input type="hidden" name="slideId" value={slide.id} />
            <DisplayFields slide={slide} settings={settings} />
            <Button size="sm" type="submit">
              Save framing
            </Button>
          </form>
        ) : null}

        <form action={rescheduleSlideAction} className="dialog-form">
          <input type="hidden" name="slideId" value={slide.id} />
          <ScheduleFields
            displayFrom={slide.displayFrom}
            displayUntil={slide.displayUntil}
            forever={slide.displayUntil === null}
          />
          <Button size="sm" type="submit">
            Save schedule
          </Button>
        </form>
      </Dialog>
    </article>
  );
}

/** Per-slide framing, defaulting to whatever the household setting says. */
function DisplayFields({
  slide,
  settings,
}: {
  slide: SlideRow;
  settings: ViewerSettings;
}) {
  const [fit, setFit] = useState<FitMode>(slide.fitMode ?? settings.fitMode);
  return (
    <>
      <SegmentedControl
        name="fitMode"
        legend="How it fills the frame"
        options={[
          { value: "contain", label: "Whole photo" },
          { value: "cover", label: "Fill the screen" },
        ]}
        value={fit}
        onValueChange={(next) => setFit(next as FitMode)}
      />
      {/* Only a crop hides part of the photo, so the choice of which part to
          keep is meaningless when the whole photo is shown. */}
      {fit === "cover" ? (
        <Field label="Keep this part in view">
          <Select
            name="focalPoint"
            defaultValue={slide.focalPoint ?? settings.focalPoint}
            options={FOCAL_OPTIONS}
          />
        </Field>
      ) : null}
    </>
  );
}

export const FOCAL_OPTIONS: { value: FocalPoint; label: string }[] = [
  { value: "center", label: "The middle" },
  { value: "top", label: "The top" },
  { value: "bottom", label: "The bottom" },
  { value: "left", label: "The left" },
  { value: "right", label: "The right" },
];
