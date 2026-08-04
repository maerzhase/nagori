interface Slide {
  id: string;
  kind: "photo" | "message";
  caption: string | null;
  message: string | null;
  theme: string;
  mediaUrl: string | null;
}

interface Manifest {
  revision: number;
  settings: {
    displaySeconds: number;
    fitMode: "contain" | "cover";
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
let current = 0;
let activeImage = 0;
let timer = 0;

function showOnly(element: HTMLElement) {
  pairing.hidden = element !== pairing;
  empty.hidden = element !== empty;
  slideElement.hidden = element !== slideElement;
}

function renderCurrent() {
  if (!manifest || manifest.slides.length === 0) {
    showOnly(empty);
    return;
  }
  showOnly(slideElement);
  const item = manifest.slides[current % manifest.slides.length];
  caption.hidden = !manifest.settings.showCaptions || !item.caption;
  caption.textContent = item.caption || "";
  if (item.kind === "message") {
    images[0].className = "photo";
    images[1].className = "photo";
    message.hidden = false;
    message.textContent = item.message || "";
    message.dataset.theme = item.theme;
  } else {
    message.hidden = true;
    const nextImage = images[1 - activeImage];
    nextImage.style.objectFit = manifest.settings.fitMode;
    nextImage.src = item.mediaUrl || "";
    nextImage.onload = () => {
      images[activeImage].className = "photo";
      nextImage.className = "photo active";
      activeImage = 1 - activeImage;
    };
  }
  window.clearTimeout(timer);
  const displaySeconds = manifest.settings.displaySeconds;
  timer = window.setTimeout(() => {
    const currentManifest = manifest;
    if (!currentManifest || currentManifest.slides.length === 0) return;
    current = (current + 1) % currentManifest.slides.length;
    renderCurrent();
  }, displaySeconds * 1000);
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

async function refresh() {
  try {
    const headers: Record<string, string> = {};
    if (manifest) headers["if-none-match"] = `W/"${manifest.revision}"`;
    const response = await fetch("/api/manifest", {
      credentials: "same-origin",
      cache: "no-store",
      headers,
    });
    if (response.status === 401) {
      showOnly(pairing);
      return;
    }
    if (response.status === 304) {
      connection.hidden = true;
      return;
    }
    if (!response.ok) throw new Error("manifest unavailable");
    const next = (await response.json()) as Manifest;
    connection.hidden = true;
    if (!manifest || next.revision !== manifest.revision) {
      manifest = next;
      current = 0;
      saveManifest(next);
      warmPhotos(next);
      renderCurrent();
    }
  } catch (_error) {
    connection.hidden = false;
    if (!manifest) {
      manifest = loadSavedManifest();
      if (manifest) renderCurrent();
    }
  }
}

async function pair(body: { code?: string; token?: string }) {
  const error = document.getElementById("pair-error") as HTMLElement;
  error.textContent = "";
  try {
    const response = await fetch("/api/pair", {
      method: "POST",
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
  await refresh();
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
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}
void refresh();
window.setInterval(refresh, 60_000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refresh();
});
