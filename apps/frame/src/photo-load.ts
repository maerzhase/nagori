/** Load into an inactive buffer, including images already decoded in cache. */
export function loadPhoto(
  image: HTMLImageElement,
  source: string,
  commit: () => void,
  fail: () => void = () => {},
): () => void {
  let pending = true;
  const cancel = () => {
    pending = false;
    image.onload = null;
    image.onerror = null;
  };
  const loaded = () => {
    if (!pending) return;
    cancel();
    commit();
  };
  // Install listeners before src: a cached image can be ready immediately.
  image.onload = loaded;
  image.onerror = () => {
    if (!pending) return;
    cancel();
    fail();
  };
  if (!source) {
    cancel();
    fail();
    return cancel;
  }
  image.src = source;
  // Reusing the same URL need not produce another load event in WebKit.
  if (image.complete && image.naturalWidth > 0) loaded();
  return cancel;
}
