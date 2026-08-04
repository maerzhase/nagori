"use client";

import type { PendingInvitationRow } from "@nagori/core";
import {
  Button,
  ConfirmButton,
  CopyField,
  Field,
  Input,
  Select,
} from "@nagori/ui";
import { useActionState } from "react";
import type { InviteResult } from "@/app/action-results";
import {
  createInvitationAction,
  revokeInvitationAction,
  rotateInvitationAction,
} from "@/app/actions";

function InviteSecret({ result }: { result: InviteResult }) {
  if (result.error)
    return (
      <div className="alert">
        {result.error === "invite"
          ? "That email address doesn’t look right."
          : result.error === "not_found"
            ? "That invitation was already accepted or withdrawn."
            : "You don’t have permission to do that."}
      </div>
    );
  if (!result.link) return null;
  return (
    <div className="secret-reveal">
      <p>
        <strong>Send this link to {result.email}.</strong> It is private, works
        once, and lasts seven days.
      </p>
      <CopyField value={result.link} label="Copy link" />
    </div>
  );
}

export function InviteForm() {
  const [result, action, pending] = useActionState(
    createInvitationAction,
    null,
  );
  return (
    <div className="invite-form">
      <h3>Invite someone</h3>
      <p>We’ll make a private link for you to send.</p>
      <form action={action} className="grid gap-4">
        <Field label="Email">
          <Input
            name="email"
            type="email"
            placeholder="family@example.com"
            required
          />
        </Field>
        <Field label="Access">
          <Select
            name="role"
            defaultValue="editor"
            options={[
              { value: "editor", label: "Can share memories" },
              { value: "viewer", label: "Can only view" },
            ]}
          />
        </Field>
        <Button disabled={pending} type="submit" variant="outline">
          {pending ? "Creating…" : "Create invite link"}
        </Button>
      </form>
      {result ? <InviteSecret result={result} /> : null}
    </div>
  );
}

export function PendingInvites({
  invitations,
}: {
  invitations: PendingInvitationRow[];
}) {
  if (invitations.length === 0) return null;
  return (
    <div className="pending-invites">
      <h3>Pending invites</h3>
      {invitations.map((invitation) => (
        <PendingInviteRow key={invitation.id} invitation={invitation} />
      ))}
    </div>
  );
}

function PendingInviteRow({
  invitation,
}: {
  invitation: PendingInvitationRow;
}) {
  const [result, action, pending] = useActionState(
    rotateInvitationAction,
    null,
  );
  const expired = new Date(invitation.expiresAt) <= new Date();
  return (
    <div className="pending-invite">
      <div>
        <strong>{invitation.email}</strong>
        <span>
          {invitation.role === "editor"
            ? "Can share memories"
            : "Can only view"}
          {" · "}
          {expired
            ? "link expired"
            : `link works until ${new Intl.DateTimeFormat("en", {
                day: "numeric",
                month: "short",
              }).format(new Date(invitation.expiresAt))}`}
        </span>
      </div>
      <div className="device-actions">
        {/* The original link is unrecoverable — only its hash is stored — so
            re-sending an invite means replacing the token. */}
        <form action={action}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <Button disabled={pending} size="sm" type="submit" variant="outline">
            {pending ? "Creating…" : "New link"}
          </Button>
        </form>
        <form action={revokeInvitationAction}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <ConfirmButton
            label={`Cancel the invitation for ${invitation.email}`}
            heading="Cancel this invitation?"
            description={`The link stops working, so ${invitation.email} can no longer use it to join. You can always invite them again.`}
            confirmLabel="Cancel it"
            cancelLabel="Keep it"
            size="sm"
            variant="subtle"
          >
            Cancel invite
          </ConfirmButton>
        </form>
      </div>
      {result ? <InviteSecret result={result} /> : null}
    </div>
  );
}
