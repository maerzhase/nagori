"use server";

import {
  clampDisplaySeconds,
  defaultSchedule,
  hashPassword,
  isStrongEnoughPassword,
  normalizeEmail,
} from "@memory-screen/core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, SESSION_COOKIE, setSessionCookie } from "@/lib/auth";
import { getEnv, getStore } from "@/lib/cloudflare";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeDate(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function setupAction(formData: FormData) {
  const store = getStore();
  if (await store.hasUsers()) redirect("/?view=login");
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  const env = getEnv();
  if (
    env.ENVIRONMENT === "production" &&
    (!env.INITIAL_OWNER_EMAIL ||
      normalizeEmail(env.INITIAL_OWNER_EMAIL) !== email)
  ) {
    redirect("/?error=owner_email");
  }
  if (!email.includes("@") || !isStrongEnoughPassword(password))
    redirect("/?error=setup_validation");
  const credentials = await hashPassword(password);
  const { userId } = await store.createOwner({
    email,
    name: text(formData, "name") || "Family admin",
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    householdName: text(formData, "householdName") || "Our family",
    timezone: text(formData, "timezone") || "UTC",
  });
  await setSessionCookie(await store.createSession(userId));
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const store = getStore();
  const email = normalizeEmail(text(formData, "email"));
  if (await store.isLoginLocked(email)) {
    redirect("/?view=login&error=rate_limited");
  }
  const user = await store.findPasswordUser(email);
  if (!user) {
    await store.recordFailedLogin(email);
    redirect("/?view=login&error=login");
  }
  const { verifyPassword } = await import("@memory-screen/core");
  if (
    !(await verifyPassword(
      text(formData, "password"),
      user.passwordSalt,
      user.passwordHash,
    ))
  ) {
    await store.recordFailedLogin(email);
    redirect("/?view=login&error=login");
  }
  await store.clearFailedLogins(email);
  await setSessionCookie(await store.createSession(user.id));
  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await getStore().deleteSession(token);
  cookieStore.delete(SESSION_COOKIE);
  redirect("/?view=login");
}

export async function createMessageAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "viewer") redirect("/?error=permission");
  const message = text(formData, "message");
  if (!message || message.length > 280) redirect("/?error=message");
  const store = getStore();
  const settings = await store.getSettings(user.householdId);
  await store.createMessageSlide({
    householdId: user.householdId,
    userId: user.id,
    message,
    theme: text(formData, "theme") || "paper",
    displayFrom: safeDate(text(formData, "displayFrom")) ?? undefined,
    displayUntil:
      text(formData, "forever") === "yes"
        ? null
        : (safeDate(text(formData, "displayUntil"), true) ?? undefined),
    defaultVisibilityDays: settings.defaultVisibilityDays,
  });
  revalidatePath("/");
  redirect("/?created=message");
}

export async function rescheduleSlideAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "viewer") redirect("/?error=permission");
  const displayFrom = safeDate(text(formData, "displayFrom"));
  const displayUntil =
    text(formData, "forever") === "yes"
      ? null
      : safeDate(text(formData, "displayUntil"), true);
  if (!displayFrom || (!displayUntil && text(formData, "forever") !== "yes")) {
    redirect("/?error=schedule");
  }
  try {
    await getStore().rescheduleSlide({
      householdId: user.householdId,
      userId: user.id,
      slideId: text(formData, "slideId"),
      displayFrom,
      displayUntil,
    });
  } catch {
    redirect("/?error=schedule");
  }
  revalidatePath("/");
  redirect("/?saved=schedule#library");
}

export async function renewSlideAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "viewer") redirect("/?error=permission");
  const store = getStore();
  const settings = await store.getSettings(user.householdId);
  const schedule = defaultSchedule(new Date(), settings.defaultVisibilityDays);
  await store.rescheduleSlide({
    householdId: user.householdId,
    userId: user.id,
    slideId: text(formData, "slideId"),
    displayFrom: schedule.displayFrom,
    displayUntil: schedule.displayUntil,
  });
  revalidatePath("/");
  redirect("/?saved=renewed#library");
}

export async function archiveSlideAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "viewer") redirect("/?error=permission");
  const r2Key = await getStore().archiveSlide(
    user.householdId,
    user.id,
    text(formData, "slideId"),
  );
  if (r2Key) await getEnv().PHOTOS.delete(r2Key);
  revalidatePath("/");
}

export async function createPairingCodeAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "viewer") redirect("/?error=permission");
  const code = await getStore().createPairingCode(
    user.householdId,
    text(formData, "name"),
  );
  redirect(`/?pairing=${encodeURIComponent(code)}`);
}

export async function revokeDeviceAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/?error=permission");
  await getStore().revokeDevice({
    householdId: user.householdId,
    userId: user.id,
    deviceId: text(formData, "deviceId"),
  });
  revalidatePath("/");
  redirect("/?saved=device_revoked#frame");
}

export async function updateSettingsAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/?error=permission");
  const seconds = clampDisplaySeconds(Number(text(formData, "displaySeconds")));
  const visibilityDays = Number(text(formData, "defaultVisibilityDays"));
  const defaultVisibilityDays = [7, 30, 60, 90].includes(visibilityDays)
    ? visibilityDays
    : 30;
  await getEnv()
    .DB.prepare(
      "UPDATE viewer_settings SET display_seconds = ?, fit_mode = ?, show_captions = ?, default_visibility_days = ? WHERE household_id = ?",
    )
    .bind(
      seconds,
      text(formData, "fitMode") === "cover" ? "cover" : "contain",
      formData.get("showCaptions") ? 1 : 0,
      defaultVisibilityDays,
      user.householdId,
    )
    .run();
  await getEnv()
    .DB.prepare(
      "UPDATE households SET playlist_revision = playlist_revision + 1 WHERE id = ?",
    )
    .bind(user.householdId)
    .run();
  revalidatePath("/");
  redirect("/?saved=settings");
}

export async function createInvitationAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/?error=permission");
  const email = normalizeEmail(text(formData, "email"));
  if (!email.includes("@")) redirect("/?error=invite");
  const requestedRole = text(formData, "role");
  const role = requestedRole === "viewer" ? "viewer" : "editor";
  const token = await getStore().createInvitation({
    householdId: user.householdId,
    userId: user.id,
    email,
    role,
  });
  redirect(`/?invite=${encodeURIComponent(token)}`);
}

export async function acceptInvitationAction(formData: FormData) {
  const token = text(formData, "token");
  const password = text(formData, "password");
  if (!isStrongEnoughPassword(password))
    redirect(`/join/${encodeURIComponent(token)}?error=password`);
  const credentials = await hashPassword(password);
  const result = await getStore().acceptInvitation({
    token,
    name: text(formData, "name"),
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
  });
  if (!result) redirect(`/join/${encodeURIComponent(token)}?error=expired`);
  if (result.existing) redirect("/?view=login&error=existing");
  await setSessionCookie(await getStore().createSession(result.userId));
  redirect("/");
}
