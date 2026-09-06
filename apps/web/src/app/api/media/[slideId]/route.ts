import { currentUser } from "@/lib/auth";
import { getEnv, getStore } from "@/lib/cloudflare";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slideId: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { slideId } = await context.params;
  const media = await getStore().mediaForDevice(user.householdId, slideId);
  if (!media) return new Response("Not found", { status: 404 });
  const object = await getEnv().PHOTOS.get(media.r2Key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "content-type": media.mediaType,
    "cache-control": "private, max-age=3600",
  });
  return new Response(object.body, { headers });
}
