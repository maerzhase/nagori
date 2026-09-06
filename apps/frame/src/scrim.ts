/**
 * The caption scrim is only as dark as the photo behind it demands. A fixed
 * gradient either buries a dusk photo's bottom for nothing or is too light for
 * a white sky, so the viewer measures the brightness of the photo region under
 * the caption and scales the scrim's opacity from there.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** object-position keywords or percentages -> fractions along each axis. */
export function parsePosition(position: string): { x: number; y: number } {
  let x = 0.5;
  let y = 0.5;
  const axis = { left: 0, right: 1, center: 0.5 } as Record<string, number>;
  const parts = position.trim().split(/\s+/);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === "top") y = 0;
    else if (part === "bottom") y = 1;
    else if (part in axis) x = axis[part];
    else if (/^-?[\d.]+%$/.test(part)) {
      const value = parseFloat(part) / 100;
      if (index === 0) x = value;
      else y = value;
    }
  }
  return { x, y };
}

/** Where the photo's pixels land in the viewport under object-fit. */
export function renderedRect(
  fit: string,
  position: string,
  viewport: Size,
  natural: Size,
): Rect {
  const scaleX = viewport.width / natural.width;
  const scaleY = viewport.height / natural.height;
  const scale =
    fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const width = natural.width * scale;
  const height = natural.height * scale;
  const anchor = parsePosition(position);
  return {
    // `|| 0` folds the -0 a zero anchor produces into plain 0.
    x: (viewport.width - width) * anchor.x || 0,
    y: (viewport.height - height) * anchor.y || 0,
    width,
    height,
  };
}

/**
 * The part of the source image visible inside a horizontal viewport band, in
 * image pixels. Null when the band shows only the letterbox background.
 */
export function sampleRect(
  rendered: Rect,
  bandTop: number,
  viewport: Size,
  natural: Size,
): Rect | null {
  const scale = rendered.width / natural.width;
  const left = Math.max(0, rendered.x);
  const right = Math.min(viewport.width, rendered.x + rendered.width);
  const top = Math.max(bandTop, rendered.y);
  const bottom = Math.min(viewport.height, rendered.y + rendered.height);
  if (right - left < 1 || bottom - top < 1) return null;
  return {
    x: (left - rendered.x) / scale,
    y: (top - rendered.y) / scale,
    width: (right - left) / scale,
    height: (bottom - top) / scale,
  };
}

/**
 * Mean brightness (0..1) of a region, or null where the platform cannot read
 * pixels back (no canvas, tainted image, old WebKit quirks).
 */
export function measureLuminance(
  image: HTMLImageElement,
  source: Rect,
): number | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 8;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      16,
      8,
    );
    const pixels = context.getImageData(0, 0, 16, 8).data;
    let total = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      total +=
        0.2126 * pixels[index] +
        0.7152 * pixels[index + 1] +
        0.0722 * pixels[index + 2];
    }
    return total / (pixels.length / 4) / 255;
  } catch (_error) {
    return null;
  }
}

/**
 * Scrim opacity for a given background brightness. The gradient itself is
 * authored at full strength for a white photo; a dark photo needs only enough
 * to lift the text off mid-tone detail.
 */
export function scrimOpacity(luminance: number): number {
  const eased = Math.max(0, Math.min(1, (luminance - 0.15) / 0.6));
  return 0.4 + 0.6 * eased;
}

/**
 * How much of the scrim a caption of this many lines needs. One line reads on
 * the halo alone with just a haze behind it; three lines need the full band.
 */
export function captionFactor(lines: number): number {
  return Math.min(1, 0.3 + 0.35 * (Math.max(1, lines) - 1));
}

/** Rendered lines of text, or null where layout cannot be measured. */
function captionLines(caption: HTMLElement): number | null {
  try {
    const style = getComputedStyle(caption);
    const lineHeight = parseFloat(style.lineHeight);
    const textHeight =
      caption.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom);
    if (!(lineHeight > 0) || !(textHeight > 0)) return null;
    return Math.max(1, Math.round(textHeight / lineHeight));
  } catch (_error) {
    return null;
  }
}

const BAND_FRACTION = 0.3;
const BAND_MINIMUM = 230;

/**
 * Measure the photo behind the caption and the caption itself, then set the
 * scrim strength. Call after the caption text is in place and sized.
 */
export function applyScrim(caption: HTMLElement, image: HTMLImageElement) {
  let opacity = 1;
  try {
    const lines = captionLines(caption);
    if (lines !== null) opacity = captionFactor(lines);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const natural = { width: image.naturalWidth, height: image.naturalHeight };
    if (viewport.width > 0 && natural.width > 0) {
      const rendered = renderedRect(
        image.style.objectFit || "contain",
        image.style.objectPosition || "center",
        viewport,
        natural,
      );
      // ponytail: the band is the caption's usual footprint, not its measured
      // height; measure caption.offsetHeight here if long captions misjudge.
      const bandTop =
        viewport.height -
        Math.max(BAND_MINIMUM, viewport.height * BAND_FRACTION);
      const source = sampleRect(rendered, bandTop, viewport, natural);
      // Letterbox background is near-black, so the lightest scrim will do.
      const luminance = source ? measureLuminance(image, source) : 0;
      if (luminance !== null) opacity *= scrimOpacity(luminance);
    }
  } catch (_error) {
    /* fall back to the full-strength scrim */
  }
  if (typeof caption.style.setProperty === "function") {
    caption.style.setProperty("--scrim", String(opacity));
  }
}
