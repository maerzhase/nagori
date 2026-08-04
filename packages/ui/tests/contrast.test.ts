import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The palette is the source of truth; this test is the gate. A colour that
 * cannot be read on the surface it is used against must not ship, which is how
 * light-blue-on-cream error text reached the dashboard in the first place.
 */
const palette = parsePalette(
  readFileSync(
    fileURLToPath(new URL("../src/styles/memory.css", import.meta.url)),
    "utf8",
  ),
);

/** WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text and UI boundaries. */
const BODY = 4.5;
const LARGE = 3;

const pairs: Array<[foreground: string, background: string, minimum: number]> =
  [
    // Light surfaces.
    ["ink", "paper", BODY],
    ["ink", "card", BODY],
    ["ink", "cream", BODY],
    ["ink", "sidebar", BODY],
    ["muted", "paper", BODY],
    ["muted", "card", BODY],
    ["muted", "cream", BODY],
    ["muted", "sidebar", BODY],
    ["accent-ink", "paper", BODY],
    ["accent-ink", "card", BODY],
    // Dark surface.
    ["ink-on-night", "night", BODY],
    ["muted-on-night", "night", BODY],
    ["accent-on-night", "night", BODY],
    // Semantic pairs — each foreground only against its own surface.
    ["danger", "danger-surface", BODY],
    ["danger", "paper", BODY],
    ["success", "success-surface", BODY],
    ["success", "card", BODY],
    ["warning", "warning-surface", BODY],
    ["warning", "paper", BODY],
    // Filled interactive surfaces, carrying a small bold label.
    ["ink-on-night", "coral-strong", BODY],
    ["ink-on-night", "coral-strong-hover", BODY],
    ["ink-on-night", "garden", BODY],
    // Decorative only: large display type and icon glyphs, never body text.
    ["coral", "paper", LARGE],
    ["ink-on-night", "coral", LARGE],
    ["garden", "paper", BODY],
    // Boundaries. A control's edge is information (WCAG 1.4.11); a divider
    // between filled areas is not, so `line` only has to be visible.
    ["control-border", "card", LARGE],
    ["control-border", "paper", LARGE],
    ["line", "paper", 1.2],
  ];

describe("memory palette contrast", () => {
  it.each(
    pairs,
  )("--memory-%s on --memory-%s meets %s:1", (foreground, background, minimum) => {
    const ratio = contrast(token(foreground), token(background));
    expect(
      ratio,
      `--memory-${foreground} on --memory-${background} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
    ).toBeGreaterThanOrEqual(minimum);
  });

  it("covers every colour token in the palette", () => {
    const used = new Set<string>();
    for (const [foreground, background] of pairs)
      used.add(foreground).add(background);
    const uncovered = [...palette.keys()].filter((name) => !used.has(name));
    expect(
      uncovered,
      `these tokens have no declared contrast pair: ${uncovered.join(", ")}`,
    ).toEqual([]);
  });
});

function token(name: string): string {
  const value = palette.get(name);
  if (!value) throw new Error(`--memory-${name} is not declared in memory.css`);
  return value;
}

function parsePalette(css: string): Map<string, string> {
  const entries = css.matchAll(/--memory-([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi);
  return new Map([...entries].map(([, name, value]) => [name, value]));
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = (hex.replace("#", "").match(/../g) as string[])
    .map((pair) => Number.parseInt(pair, 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
