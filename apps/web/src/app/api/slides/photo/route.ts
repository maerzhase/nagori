import { ACTIVE_SLIDE_LIMIT, randomId } from "@memory-screen/core";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getEnv, getStore } from "@/lib/cloudflare";

export const runtime = "nodejs";
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role === "viewer")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const contentType = request.headers.get("content-type")?.split(";")[0] ?? "";
  const size = Number(
    request.headers.get("x-file-size") ??
      request.headers.get("content-length") ??
      0,
  );
  if (!ALLOWED_TYPES.has(contentType))
    return NextResponse.json({ error: "unsupported_image" }, { status: 415 });
  if (!request.body || size <= 0 || size > MAX_BYTES)
    return NextResponse.json({ error: "invalid_size" }, { status: 413 });
  if (
    (await getStore().countActiveSlides(user.householdId)) >= ACTIVE_SLIDE_LIMIT
  ) {
    return NextResponse.json({ error: "active_limit" }, { status: 409 });
  }
  const key = `${user.householdId}/${new Date().toISOString().slice(0, 10)}/${randomId("photo")}.jpg`;
  await getEnv().PHOTOS.put(key, request.body, {
    httpMetadata: { contentType },
  });
  try {
    const store = getStore();
    const settings = await store.getSettings(user.householdId);
    const id = await store.createPhotoSlide({
      householdId: user.householdId,
      userId: user.id,
      r2Key: key,
      contentType,
      sizeBytes: size,
      caption: decodeURIComponent(request.headers.get("x-caption") ?? ""),
      displayFrom: request.headers.get("x-display-from") || undefined,
      displayUntil: request.headers.has("x-display-until")
        ? request.headers.get("x-display-until")
        : undefined,
      defaultVisibilityDays: settings.defaultVisibilityDays,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    await getEnv().PHOTOS.delete(key);
    throw error;
  }
}
