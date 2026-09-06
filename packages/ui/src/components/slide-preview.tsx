import type { JSX } from "react";
import { cn } from "../lib/cn";

export interface SlidePreviewProps {
  /** Photo to show as the background. Takes precedence over `theme`. */
  imageUrl?: string | null;
  /** One of the message backgrounds the frame knows: paper, sunset, garden. */
  theme?: string;
  /** Large centred text, as a message slide renders it on the frame. */
  message?: string | null;
  /** Small text along the bottom edge, as the frame renders a caption. */
  caption?: string | null;
  /** Matches the household's photo-fit setting. */
  fit?: "contain" | "cover";
  /** Which part stays in view when the photo is cropped. */
  focalPoint?: string;
  /** Stand-in text while the slide has no content yet. */
  placeholder?: string;
  showCaption?: boolean;
  className?: string;
}

/**
 * A scaled stand-in for what the iPad will show. Deliberately mirrors the
 * frame's own layout in apps/frame/src/viewer.css — the frame itself cannot use
 * this component, since that bundle stays React-free for old WebKit.
 */
export function SlidePreview({
  imageUrl,
  theme = "paper",
  message,
  caption,
  fit = "contain",
  focalPoint = "center",
  placeholder = "Your note will appear here.",
  showCaption = true,
  className,
}: SlidePreviewProps): JSX.Element {
  const hasPhoto = Boolean(imageUrl);
  return (
    <div
      data-theme={hasPhoto ? undefined : theme}
      className={cn(
        "relative isolate grid aspect-4/3 w-full place-items-center overflow-hidden bg-paper text-ink",
        !hasPhoto &&
          "data-[theme=sunset]:bg-coral data-[theme=sunset]:text-on-strong",
        !hasPhoto &&
          "data-[theme=garden]:bg-garden data-[theme=garden]:text-on-strong",
        hasPhoto && "bg-ink",
        className,
      )}
    >
      {hasPhoto ? (
        <img
          src={imageUrl as string}
          alt=""
          style={{ objectPosition: fit === "cover" ? focalPoint : "center" }}
          className={cn(
            "absolute inset-0 size-full",
            fit === "cover" ? "object-cover" : "object-contain",
          )}
        />
      ) : (
        <p className="m-0 max-w-[85%] px-4 text-center font-serif text-2xl leading-tight break-words">
          {message || placeholder}
        </p>
      )}
      {showCaption && caption ? (
        <p
          className={cn(
            "absolute inset-x-0 bottom-0 m-0 px-4 py-3 text-center text-xs",
            hasPhoto
              ? "bg-gradient-to-t from-black/70 via-black/60 to-transparent pt-10 text-on-strong"
              : "text-current opacity-80",
          )}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}
