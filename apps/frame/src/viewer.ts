import { startAutomaticUpdates } from "./automatic-updates";
import { loadPhoto } from "./photo-load";
import {
  commitSlideDwell,
  createSlideshowController,
  guardedCallback,
  guardedDeferred,
  revisionChanged,
} from "./slideshow";

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
const progress = document.getElementById("gallery-progress") as HTMLElement;
const counter = document.getElementById("gallery-counter") as HTMLElement;
const fill = document.getElementById("gallery-fill") as HTMLElement;
const toggle = document.getElementById("gallery-toggle") as HTMLButtonElement;
const images = [
  document.getElementById("photo-a") as HTMLImageElement,
  document.getElementById("photo-b") as HTMLImageElement,
];
let manifest: Manifest | null = null;
let current = 0;
let activeImage = 0;
let loadTimer = 0;
let retryTimer = 0;
let skipTimer = 0;
let failedInPass = 0;
let manuallyPaused = false;
let refreshVersion = 0;
let cancelPhotoLoad = () => {};

const playback = createSlideshowController(
  {
    now: () => Date.now(),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (id) => window.clearTimeout(id),
  },
  () => {
    if (!manifest?.slides.length) return;
    current = (current + 1) % manifest.slides.length;
    renderCurrent();
  },
  (state) => {
    fill.style.transition = "none";
    const start = state.duration ? 1 - state.remaining / state.duration : 0;
    fill.style.transform = `scaleX(${Math.max(0, Math.min(1, start))})`;
    if (!state.paused && state.remaining > 0) {
      void fill.offsetWidth;
      fill.style.transition = `transform ${state.remaining}ms linear`;
      fill.style.transform = "scaleX(1)";
    }
  },
);

function showOnly(element: HTMLElement) {
  pairing.hidden = element !== pairing;
  empty.hidden = element !== empty;
  slideElement.hidden = element !== slideElement;
  if (element !== slideElement) progress.hidden = true;
}

function clearLoad() {
  window.clearTimeout(loadTimer);
  loadTimer = 0;
  cancelPhotoLoad();
  cancelPhotoLoad = () => {};
  for (const image of images) {
    image.onload = null;
    image.onerror = null;
  }
}

function cancelRendering() {
  clearLoad();
  window.clearTimeout(retryTimer);
  window.clearTimeout(skipTimer);
  retryTimer = 0;
  skipTimer = 0;
  playback.cancel();
}

function preferredSize(element: HTMLElement) {
  if (element === caption)
    return window.innerWidth < 600 ? 24 : window.innerWidth < 1000 ? 32 : 36;
  return window.innerWidth < 600 ? 36 : window.innerWidth < 1000 ? 48 : 56;
}

function fitText(element: HTMLElement) {
  const minimum =
    element === caption
      ? window.innerWidth < 600
        ? 20
        : 24
      : window.innerWidth < 600
        ? 18
        : 24;
  let size = preferredSize(element);
  element.style.fontSize = `${size}px`;
  for (
    let attempts = 0;
    attempts < 20 &&
    size > minimum &&
    (element.scrollHeight > element.clientHeight ||
      element.scrollWidth > element.clientWidth);
    attempts += 1
  ) {
    size = Math.max(minimum, size - 2);
    element.style.fontSize = `${size}px`;
  }
}

function commit(item: Slide) {
  if (!manifest) return;
  showOnly(slideElement);
  caption.hidden =
    !manifest.settings.showCaptions || !item.caption || item.kind === "message";
  caption.textContent = item.caption || "";
  counter.textContent = `${current + 1} / ${manifest.slides.length}`;
  progress.hidden = manifest.slides.length <= 1;
  failedInPass = 0;
  if (!caption.hidden) fitText(caption);
  if (!message.hidden) fitText(message);
  commitSlideDwell(
    playback,
    manifest.slides.length,
    manifest.settings.displaySeconds * 1000,
  );
}

function renderCurrent() {
  if (!manifest || manifest.slides.length === 0) {
    cancelRendering();
    showOnly(empty);
    return;
  }
  const item = manifest.slides[current % manifest.slides.length];
  const generation = playback.invalidate();
  clearLoad();
  if (item.kind === "message") {
    images[0].className = "photo";
    images[1].className = "photo";
    message.hidden = false;
    message.textContent = item.message || "";
    message.dataset.theme = item.theme;
    commit(item);
  } else {
    const nextImage = images[1 - activeImage];
    // A slide's own choice wins; the household setting is the fallback.
    nextImage.style.objectFit = item.fitMode || manifest.settings.fitMode;
    nextImage.style.objectPosition =
      item.focalPoint || manifest.settings.focalPoint || "center";
    const loaded = guardedCallback(generation, playback.isCurrent, () => {
      window.clearTimeout(loadTimer);
      message.hidden = true;
      images[activeImage].className = "photo";
      nextImage.className = "photo active";
      activeImage = 1 - activeImage;
      commit(item);
    });
    const failed = () => {
      if (!playback.isCurrent(generation) || !manifest) return;
      clearLoad();
      failedInPass += 1;
      if (failedInPass >= manifest.slides.length) {
        playback.cancel();
        showOnly(empty);
        connection.hidden = false;
        const retryGeneration = playback.invalidate();
        retryTimer = guardedDeferred(
          {
            setTimeout: (callback, delay) => window.setTimeout(callback, delay),
            clearTimeout: (id) => window.clearTimeout(id),
          },
          retryGeneration,
          (value) => playback.isCurrent(value),
          () => {
            failedInPass = 0;
            renderCurrent();
          },
          60_000,
        );
        return;
      }
      current = (current + 1) % manifest.slides.length;
      const skipGeneration = playback.invalidate();
      skipTimer = guardedDeferred(
        {
          setTimeout: (callback, delay) => window.setTimeout(callback, delay),
          clearTimeout: (id) => window.clearTimeout(id),
        },
        skipGeneration,
        (value) => playback.isCurrent(value),
        renderCurrent,
        0,
      );
    };
    loadTimer = window.setTimeout(failed, 10_000);
    cancelPhotoLoad = loadPhoto(nextImage, item.mediaUrl || "", loaded, failed);
  }
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
      cancelRendering();
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
    const changed = revisionChanged(manifest?.revision ?? null, next.revision);
    if (changed) {
      cancelRendering();
      manifest = next;
      current = 0;
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
  playback.resume("manual");
  manuallyPaused = false;
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
toggle.addEventListener("click", () => {
  manuallyPaused = !manuallyPaused;
  if (!manuallyPaused) {
    playback.resume("manual");
    toggle.textContent = "Ⅱ";
    toggle.setAttribute("aria-label", "Pause slideshow");
  } else {
    playback.pause("manual");
    toggle.textContent = "▶";
    toggle.setAttribute("aria-label", "Resume slideshow");
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    playback.pause("hidden");
  } else {
    playback.resume("hidden");
    void refresh();
  }
});
window.addEventListener("resize", () => {
  if (!caption.hidden) fitText(caption);
  if (!message.hidden) fitText(message);
});
if (document.fonts?.ready) {
  void document.fonts.ready.then(() => {
    if (!caption.hidden) fitText(caption);
    if (!message.hidden) fitText(message);
  });
}
