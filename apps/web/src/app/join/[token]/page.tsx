import { Button, Field, Input } from "@nagori/ui";
import { acceptInvitationAction } from "../../actions";
import { getStore } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invitation = await getStore().getInvitation(token);
  return (
    <main className="join-shell">
      <div className="join-card">
        <img
          className="logo"
          src="/logo.png"
          alt=""
          width={38}
          height={38}
          aria-hidden="true"
        />
        {invitation ? (
          <>
            <p className="eyebrow">Family invitation</p>
            <h1>Join {invitation.householdName}</h1>
            <p>
              You’ve been invited as{" "}
              {invitation.role === "editor"
                ? "a contributor who can share photos and notes"
                : "a family viewer"}
              .
            </p>
            {error && (
              <div className="alert">
                {error === "password"
                  ? "Use a password with at least 12 characters."
                  : "This invitation is no longer available."}
              </div>
            )}
            <form action={acceptInvitationAction} className="auth-form">
              <input type="hidden" name="token" value={token} />
              <Field label="Email address">
                <Input value={invitation.email} disabled />
              </Field>
              <Field label="Your name">
                <Input name="name" autoComplete="name" required />
              </Field>
              <Field label="Choose a password" hint="at least 12 characters">
                <Input
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
              </Field>
              <Button type="submit">Join family</Button>
            </form>
          </>
        ) : (
          <>
            <p className="eyebrow">Invitation unavailable</p>
            <h1>This link has expired.</h1>
            <p>Ask your family owner to create a fresh invitation.</p>
            <Button nativeButton={false} render={<a href="/" />}>
              Back to sign in
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
