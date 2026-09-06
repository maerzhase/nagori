"use client";

import type {
  FitMode,
  FocalPoint,
  SlideRow,
  ViewerSettings,
} from "@nagori/core";
import {
  Button,
  buttonVariants,
  ConfirmButton,
  Dialog,
  Field,
  Input,
  SegmentedControl,
  SlidePreview,
  Textarea,
} from "@nagori/ui";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { archiveSlideAction, updateSlideDisplayAction } from "@/app/actions";
import { PhotoFraming } from "./photo-framing";

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

      {open && (
        <MemoryEditor
          slide={slide}
          settings={settings}
          imageUrl={imageUrl}
          onClose={() => setOpen(false)}
        />
      )}
    </article>
  );
}

function MemoryEditor({
  slide,
  settings,
  imageUrl,
  onClose,
}: {
  slide: SlideRow;
  settings: ViewerSettings;
  imageUrl: string | null;
  onClose: () => void;
}) {
  const [initial] = useState(() => ({
    fit: slide.fitMode ?? settings.fitMode,
    focal: slide.focalPoint ?? settings.focalPoint,
    text:
      slide.kind === "photo" ? (slide.caption ?? "") : (slide.message ?? ""),
    from: slide.displayFrom.slice(0, 10),
    until: slide.displayUntil?.slice(0, 10) ?? "",
    mode: slide.displayUntil === null ? "forever" : "until",
  }));
  const [fit, setFit] = useState<FitMode>(initial.fit);
  const [focalPoint, setFocalPoint] = useState<FocalPoint>(initial.focal);
  const [text, setText] = useState(initial.text);
  const [from, setFrom] = useState(initial.from);
  const [until, setUntil] = useState(initial.until);
  const [mode, setMode] = useState(initial.mode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const canonical = (point: FocalPoint) =>
    ({
      center: "50% 50%",
      top: "50% 0%",
      bottom: "50% 100%",
      left: "0% 50%",
      right: "100% 50%",
    })[point as "center"] ?? point;
  const scheduleChanged =
    from !== initial.from ||
    mode !== initial.mode ||
    (mode === "until" && until !== initial.until);
  const dirty =
    text !== initial.text ||
    fit !== initial.fit ||
    canonical(focalPoint) !== canonical(initial.focal) ||
    scheduleChanged;
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const scrollBody = useRef<HTMLDivElement>(null);
  const scrollPosition = useRef(0);
  useEffect(() => {
    if (discard) keepEditingRef.current?.focus();
    else if (returnFocus.current) {
      if (scrollBody.current)
        scrollBody.current.scrollTop = scrollPosition.current;
      returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [discard]);
  const close = () => {
    if (saving) return;
    if (discard) {
      setDiscard(false);
      return;
    }
    if (dirty) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      scrollPosition.current = scrollBody.current?.scrollTop ?? 0;
      setDiscard(true);
    } else onClose();
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
      className={`memory-editor-dialog${discard ? " memory-editor-confirming" : ""}`}
      title={
        discard ? (
          "Discard unsaved changes?"
        ) : (
          <span className="memory-editor-heading">
            <span>Edit memory</span>
            <span
              className="memory-editor-state"
              data-dirty={dirty}
              role="status"
            >
              {saving ? "Saving…" : dirty ? "Unsaved changes" : null}
            </span>
            <Button
              type="button"
              variant="subtle"
              size="icon"
              aria-label="Close editor"
              onClick={close}
              disabled={saving}
            >
              <CloseIcon />
            </Button>
          </span>
        )
      }
    >
      <form
        hidden={discard}
        className="memory-editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving || !dirty) return;
          const data = new FormData(event.currentTarget);
          setSaving(true);
          setError("");
          try {
            const result = await updateSlideDisplayAction(data);
            if (result.error) {
              setError(result.error);
              setSaving(false);
              return;
            }
            onClose();
          } catch {
            setError(
              "Couldn’t save. Your changes are still here—please try again.",
            );
            setSaving(false);
          }
        }}
      >
        <input type="hidden" name="slideId" value={slide.id} />
        <input
          type="hidden"
          name="scheduleChanged"
          value={scheduleChanged ? "yes" : "no"}
        />
        <div ref={scrollBody} className="memory-editor-body" data-vaul-no-drag>
          <fieldset disabled={saving} className="memory-editor-fields">
            {imageUrl ? (
              <PhotoFraming
                imageUrl={imageUrl}
                fit={fit}
                focalPoint={focalPoint}
                onFitChange={setFit}
                onFocalChange={setFocalPoint}
                caption={text}
                showCaption={settings.showCaptions}
              />
            ) : (
              <SlidePreview
                className="rounded-lg"
                theme={slide.theme}
                message={text}
              />
            )}
            <Field
              label={imageUrl ? "Little note" : "Message"}
              hint={imageUrl ? "optional" : undefined}
            >
              <Textarea
                name="text"
                rows={2}
                value={text}
                onChange={(event) => setText(event.currentTarget.value)}
                maxLength={imageUrl ? 180 : 280}
                required={!imageUrl}
                className="memory-editor-note"
              />
            </Field>
            <section className="memory-editor-schedule" aria-label="Schedule">
              <h3>Schedule</h3>
              <div className="memory-editor-dates">
                <Field label="First shown">
                  <Input
                    name="displayFrom"
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.currentTarget.value)}
                    required
                  />
                </Field>
                <SegmentedControl
                  name="scheduleMode"
                  legend="Keep on the frame"
                  options={[
                    { value: "forever", label: "Forever" },
                    { value: "until", label: "Until a date" },
                  ]}
                  value={mode}
                  onValueChange={setMode}
                />
                {mode === "until" && (
                  <Field label="Last shown">
                    <Input
                      name="displayUntil"
                      type="date"
                      min={from}
                      value={until}
                      onChange={(event) => setUntil(event.currentTarget.value)}
                      required
                    />
                  </Field>
                )}
              </div>
            </section>
          </fieldset>
        </div>
        <div className="memory-editor-footer">
          {error && (
            <p className="memory-editor-error" role="alert">
              {error}
            </p>
          )}
          <div className="memory-editor-buttons">
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={close}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </form>
      {discard && (
        <div className="memory-editor-confirmation">
          <p>
            Your changes haven’t been saved. Keep editing to finish, or discard
            them to close this memory.
          </p>
          <div className="memory-editor-buttons">
            <Button type="button" variant="outline" onClick={onClose}>
              Discard changes
            </Button>
            <button
              ref={keepEditingRef}
              className={buttonVariants()}
              type="button"
              onClick={() => setDiscard(false)}
            >
              Keep editing
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
