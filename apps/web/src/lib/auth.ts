import type { SessionUser } from "@nagori/core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStore } from "./cloudflare";

export const SESSION_COOKIE = "memory_session";

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getStore().getSession(token) : null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/?view=login");
  return user;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
