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
        <span className="logo">M</span>
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
              <label>
                Email address
                <input value={invitation.email} disabled />
              </label>
              <label>
                Your name
                <input name="name" autoComplete="name" required />
              </label>
              <label>
                Choose a password
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Join family
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="eyebrow">Invitation unavailable</p>
            <h1>This link has expired.</h1>
            <p>Ask your family owner to create a fresh invitation.</p>
            <a className="primary-button" href="/">
              Back to sign in
            </a>
          </>
        )}
      </div>
    </main>
  );
}
