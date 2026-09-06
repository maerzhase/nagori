"use client";

import type { FitMode, FocalPoint } from "@nagori/core";
import { SegmentedControl, SlidePreview } from "@nagori/ui";
import { useId, useRef, useState } from "react";

export function PhotoFraming({
  imageUrl,
  fit,
  focalPoint,
  onFitChange,
  onFocalChange,
  caption,
  showCaption = true,
}: {
  caption?: string | null;
  showCaption?: boolean;
  imageUrl: string | null;
  fit: FitMode;
  focalPoint: FocalPoint;
  onFitChange: (value: FitMode) => void;
  onFocalChange: (value: FocalPoint) => void;
}) {
  const keywords: Record<string, [number, number]> = {
    center: [50, 50],
    top: [50, 0],
    bottom: [50, 100],
    left: [0, 50],
    right: [100, 50],
  };
  const [x, y] =
    keywords[focalPoint] ?? focalPoint.split(" ").map(Number.parseFloat);
  const change = (nextX: number, nextY: number) =>
    onFocalChange(
      `${Math.round(Math.max(0, Math.min(100, nextX)))}% ${Math.round(Math.max(0, Math.min(100, nextY)))}%`,
    );
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointer: number;
    left: number;
    top: number;
    x: number;
    y: number;
    overflowX: number;
    overflowY: number;
  } | null>(null);
  const preview = (
    <SlidePreview
      imageUrl={imageUrl}
      fit={fit}
      focalPoint={fit === "cover" ? focalPoint : "center"}
      caption={caption}
      showCaption={showCaption}
    />
  );
  return (
    <div className="photo-framing">
      <input type="hidden" name="focalPoint" value={focalPoint} />
      {imageUrl &&
        (fit === "cover" ? (
          <button
            type="button"
            className={`photo-crop${dragging ? " is-dragging" : ""}`}
            data-vaul-no-drag
            aria-label="Reposition photo"
            aria-describedby={hintId}
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return;
              const img = event.currentTarget.querySelector("img");
              if (!img?.naturalWidth) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const scale = Math.max(
                bounds.width / img.naturalWidth,
                bounds.height / img.naturalHeight,
              );
              drag.current = {
                pointer: event.pointerId,
                left: event.clientX,
                top: event.clientY,
                x,
                y,
                overflowX: img.naturalWidth * scale - bounds.width,
                overflowY: img.naturalHeight * scale - bounds.height,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (!start || start.pointer !== event.pointerId) return;
              // object-position distributes the cropped overflow. Moving the photo
              // right reduces that percentage; the uncropped axis stays fixed.
              change(
                start.overflowX > 1
                  ? start.x -
                      ((event.clientX - start.left) / start.overflowX) * 100
                  : start.x,
                start.overflowY > 1
                  ? start.y -
                      ((event.clientY - start.top) / start.overflowY) * 100
                  : start.y,
              );
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              drag.current = null;
              setDragging(false);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragging(false);
            }}
            onLostPointerCapture={() => {
              drag.current = null;
              setDragging(false);
            }}
            onKeyDown={(event) => {
              if (!event.key.startsWith("Arrow")) return;
              event.preventDefault();
              const step = event.shiftKey ? 10 : 1;
              change(
                x +
                  (event.key === "ArrowLeft"
                    ? step
                    : event.key === "ArrowRight"
                      ? -step
                      : 0),
                y +
                  (event.key === "ArrowUp"
                    ? step
                    : event.key === "ArrowDown"
                      ? -step
                      : 0),
              );
            }}
          >
            {preview}
            <span className="photo-crop-grid" aria-hidden="true" />
            <span className="photo-crop-badge" aria-hidden="true">
              ↔ Drag to reframe
            </span>
          </button>
        ) : (
          <div className="photo-crop-static">{preview}</div>
        ))}
      <SegmentedControl
        name="fitMode"
        legend="Framing"
        options={[
          { value: "contain", label: "Whole photo" },
          { value: "cover", label: "Fill the screen" },
        ]}
        value={fit}
        onValueChange={(value) => onFitChange(value as FitMode)}
      />
      <div className="photo-framing-footer">
        <p id={hintId}>
          {fit === "cover"
            ? "Drag to adjust. Arrow keys fine-tune."
            : "Your entire photo, without cropping."}
        </p>
        {fit === "cover" && (
          <button
            type="button"
            className="photo-crop-reset"
            disabled={x === 50 && y === 50}
            onClick={() => onFocalChange("center")}
          >
            Center
          </button>
        )}
      </div>
    </div>
  );
}
