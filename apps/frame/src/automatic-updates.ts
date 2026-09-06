const UPDATE_CHECK_INTERVAL_MS = 60_000;

interface Registration {
  update?: () => Promise<unknown>;
}

interface ServiceWorkers {
  controller: { postMessage?(message: unknown): void } | null;
  register(scriptUrl: string): Promise<Registration>;
  addEventListener(type: "controllerchange", listener: () => void): void;
  removeEventListener(type: "controllerchange", listener: () => void): void;
}

interface Page {
  hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

interface Browser {
  location: { reload(): void };
  addEventListener(type: "online", listener: () => void): void;
  removeEventListener(type: "online", listener: () => void): void;
  setInterval(callback: () => void, delay: number): number;
  clearInterval(id: number): void;
}

/**
 * Keeps a permanently open Home Screen viewer on the latest deployed bundle.
 * A newly activated worker takes control first, then the page reloads once so
 * HTML, JavaScript, and CSS all move to the same release.
 */
export function startAutomaticUpdates(
  serviceWorkers: ServiceWorkers,
  page: Page,
  browser: Browser,
): () => void {
  let registration: Registration | null = null;
  let checking = false;
  let stopped = false;
  let reloading = false;
  let hasController = Boolean(serviceWorkers.controller);
  let interval = 0;

  const announceCapability = () => {
    serviceWorkers.controller?.postMessage?.({
      type: "NAGORI_AUTOMATIC_UPDATES",
    });
  };

  const check = async () => {
    if (checking || stopped || !registration?.update) return;
    checking = true;
    try {
      await registration.update();
    } catch (_error) {
      // A lost connection is expected. The interval and online event retry.
    } finally {
      checking = false;
    }
  };

  const onControllerChange = () => {
    // clients.claim() also fires after the very first installation. The page
    // already contains the current release then, so it does not need a reload.
    if (!hasController) {
      hasController = true;
      return;
    }
    if (reloading || !serviceWorkers.controller) return;
    announceCapability();
    reloading = true;
    browser.location.reload();
  };
  const onVisible = () => {
    if (!page.hidden) void check();
  };
  const onOnline = () => void check();

  serviceWorkers.addEventListener("controllerchange", onControllerChange);
  page.addEventListener("visibilitychange", onVisible);
  browser.addEventListener("online", onOnline);

  void serviceWorkers
    .register("/sw.js")
    .then((value) => {
      if (stopped) return;
      registration = value;
      announceCapability();
      void check();
      interval = browser.setInterval(
        () => void check(),
        UPDATE_CHECK_INTERVAL_MS,
      );
    })
    .catch(() => undefined);

  return () => {
    stopped = true;
    if (interval) browser.clearInterval(interval);
    serviceWorkers.removeEventListener("controllerchange", onControllerChange);
    page.removeEventListener("visibilitychange", onVisible);
    browser.removeEventListener("online", onOnline);
  };
}
