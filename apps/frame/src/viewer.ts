import { startAutomaticUpdates } from "./automatic-updates";
import { loadPhoto } from "./photo-load";
import { createSlideshow } from "./slideshow";

interface Slide {
  id: string;
  kind: "photo" | "message";
  caption: string | null;
  message: string | null;
  theme: string;
  mediaUrl: string | null;
  /** null means "use the household setting". */
  fitMode: "contain" | "cover" | null;
  focalPoint: string | null;
}

interface Manifest {
  revision: number;
  settings: {
    displaySeconds: number;
    fitMode: "contain" | "cover";
    focalPoint: string;
    showCaptions: boolean;
  };
  slides: Slide[];
}

const pairing = document.getElementById("pairing") as HTMLElement;
const empty = document.getElementById("empty") as HTMLElement;
const slideElement = document.getElementById("slide") as HTMLElement;
const caption = document.getElementById("caption") as HTMLElement;
const message = document.getElementById("message") as HTMLElement;
const connection = document.getElementById("connection") as HTMLElement;
const images = [
  document.getElementById("photo-a") as HTMLImageElement,
  document.getElementById("photo-b") as HTMLImageElement,
];
let manifest: Manifest | null = null;
let activeImage = 0;
let refreshVersion = 0;

function showOnly(element: HTMLElement) {
  pairing.hidden = element !== pairing;
  empty.hidden = element !== empty;
  slideElement.hidden = element !== slideElement;
}

const slideshow = createSlideshow(
  {
    now: () => performance.now(),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (id) => window.clearTimeout(id),
  },
  {
    unavailable() {
      showOnly(empty);
    },
    prepare(index, ready, fail) {
      const value = manifest;
      const item = value?.slides[index];
      if (!value || !item) {
        fail();
        return () => {};
      }
      const commitCaption = () => {
        showOnly(slideElement);
        caption.hidden = !value.settings.showCaptions || !item.caption;
        caption.textContent = item.caption || "";
      };
      if (item.kind === "message") {
        ready(() => {
          images[0].className = "photo";
          images[1].className = "photo";
          message.hidden = false;
          message.textContent = item.message || "";
          message.dataset.theme = item.theme;
          commitCaption();
        });
        return () => {};
      }
      const nextImageIndex = 1 - activeImage;
      const nextImage = images[nextImageIndex];
      nextImage.style.objectFit = item.fitMode || value.settings.fitMode;
      nextImage.style.objectPosition =
        item.focalPoint || value.settings.focalPoint || "center";
      return loadPhoto(
        nextImage,
        item.mediaUrl || "",
        () =>
          ready(() => {
            images[activeImage].className = "photo";
            nextImage.className = "photo active";
            activeImage = nextImageIndex;
            message.hidden = true;
            commitCaption();
          }),
        fail,
      );
    },
  },
);
slideshow.setPaused(document.hidden);

function renderCurrent() {
  slideshow.replace(
    manifest?.slides.length || 0,
    manifest?.settings.displaySeconds || 12,
  );
}

function saveManifest(value: Manifest) {
  try {
    localStorage.setItem("nagori-manifest", JSON.stringify(value));
  } catch (_error) {
    /* storage may be disabled */
  }
}

function loadSavedManifest(): Manifest | null {
  try {
    return JSON.parse(localStorage.getItem("nagori-manifest") || "null");
  } catch (_error) {
    return null;
  }
}

function warmPhotos(value: Manifest) {
  const photos = value.slides
    .filter((item) => item.kind === "photo" && item.mediaUrl)
    .slice(0, 2);
  for (const photo of photos) {
    void fetch(photo.mediaUrl as string, { credentials: "same-origin" }).catch(
      () => undefined,
    );
  }
}

/** Resolves false when this frame has no usable device session. */
async function refresh(): Promise<boolean> {
  const version = ++refreshVersion;
  try {
    const headers: Record<string, string> = {};
    if (manifest) headers["if-none-match"] = `W/"${manifest.revision}"`;
    let response = await fetch("/api/manifest", {
      credentials: "same-origin",
      cache: "no-store",
      headers,
    });
    if (response.status === 304 && !manifest) {
      // We sent no validator, so this 304 is old WebKit answering from its
      // own HTTP cache (iOS 12 ignores no-store and leaks the 304 to JS).
      // With nothing saved to show, force a full response from a URL that
      // cannot have a cache entry.
      response = await fetch(`/api/manifest?fresh=${Date.now()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
    }
    if (version !== refreshVersion) return false;
    if (response.status === 401) {
      // Drop any pending advance, or the previous slideshow would paint itself
      // back over the pairing screen a few seconds later.
      slideshow.stop();
      showOnly(pairing);
      return false;
    }
    if (response.status === 304) {
      connection.hidden = true;
      // The saved manifest is current. That is not the same as it being on
      // screen: after a fresh pair the pairing screen is still up.
      if (manifest && !pairing.hidden) renderCurrent();
      return true;
    }
    if (!response.ok) throw new Error("manifest unavailable");
    const next = (await response.json()) as Manifest;
    if (version !== refreshVersion) return false;
    connection.hidden = true;
    const changed = !manifest || next.revision !== manifest.revision;
    if (changed) {
      manifest = next;
      saveManifest(next);
      warmPhotos(next);
    }
    // An unchanged revision still has to be rendered if the frame just paired.
    if (changed || !pairing.hidden) renderCurrent();
    return true;
  } catch (_error) {
    if (version !== refreshVersion) return false;
    connection.hidden = false;
    if (!manifest) {
      manifest = loadSavedManifest();
      if (manifest) renderCurrent();
    }
    return false;
  }
}

/**
 * The frame has no reachable devtools, so on a pairing failure the screen
 * itself must say what happened: whether a session survived (manifest status)
 * and whether this browser can store cookies at all.
 */
async function sessionProbe(): Promise<string> {
  let manifestStatus = "unreachable";
  try {
    const response = await fetch("/api/manifest", {
      credentials: "same-origin",
      cache: "no-store",
    });
    manifestStatus = String(response.status);
  } catch (_error) {
    /* keep "unreachable" */
  }
  let cookieTest = "blocked";
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API does not exist on iOS 12.
    document.cookie = "nagori_probe=1; Path=/; SameSite=Lax";
    if (document.cookie.indexOf("nagori_probe=1") !== -1) cookieTest = "ok";
  } catch (_error) {
    /* keep "blocked" */
  }
  return `manifest ${manifestStatus}, cookie test ${cookieTest}`;
}

async function pair(body: { code?: string; token?: string }) {
  const error = document.getElementById("pair-error") as HTMLElement;
  error.textContent = "";
  try {
    const response = await fetch("/api/pair", {
      method: "POST",
      // Older WebKit defaults fetch to "omit", which would discard the
      // session cookie this response exists to set.
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      error.textContent =
        response.status === 429
          ? "Too many attempts. Please wait a few minutes."
          : "That code or link is invalid or has expired.";
      return false;
    }
  } catch (_error) {
    error.textContent = "No connection. Please try again.";
    return false;
  }
  // The code is spent by now. If the session cookie did not survive the
  // response, say so instead of silently redrawing the same pairing screen.
  if (!(await refresh())) {
    error.textContent = `Connected, but this frame could not keep its session (${await sessionProbe()}). Allow cookies for this site, then ask for a new code.`;
    return false;
  }
  return true;
}

document
  .getElementById("pair-form")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await pair({
      code: (document.getElementById("code") as HTMLInputElement).value,
    });
  });

/**
 * A connect link carries its token in the fragment, so the secret never reaches
 * the server in a request line or a Referer header. Strip it once used, or a
 * reload would retry a token that is already spent.
 */
function linkToken(): string {
  const match = /(?:^|[#&])t=([^&]+)/.exec(window.location.hash);
  return match ? decodeURIComponent(match[1]) : "";
}

const pendingToken = linkToken();
if (pendingToken) {
  const connectButton = document.getElementById("pair-link") as HTMLElement;
  const codeFields = document.getElementById("pair-code-fields") as HTMLElement;
  if (connectButton && codeFields) {
    codeFields.hidden = true;
    // Hiding alone would leave a required control blocking validation.
    (document.getElementById("code") as HTMLInputElement).disabled = true;
    const hint = document.querySelector(".pairing .hint");
    if (hint) hint.textContent = "Tap the button to connect this frame.";
    connectButton.hidden = false;
    connectButton.addEventListener("click", async () => {
      if (await pair({ token: pendingToken })) {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
      }
    });
  }
}

manifest = loadSavedManifest();
if (manifest) {
  warmPhotos(manifest);
  renderCurrent();
}
if ("serviceWorker" in navigator) {
  startAutomaticUpdates(navigator.serviceWorker, document, window);
}
void refresh();
window.setInterval(refresh, 60_000);
function resumeViewer() {
  slideshow.setPaused(document.hidden);
  if (!document.hidden) void refresh();
}
document.addEventListener("visibilitychange", resumeViewer);
window.addEventListener("pagehide", () => slideshow.setPaused(true));
window.addEventListener("pageshow", resumeViewer);
