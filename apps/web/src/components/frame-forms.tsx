"use client";

import type { DeviceRow } from "@nagori/core";
import { Button, CopyField, Field, Input } from "@nagori/ui";
import { useActionState } from "react";
import type { PairingResult } from "@/app/action-results";
import {
  createPairingCodeAction,
  revokeDeviceAction,
  rotatePairingCodeAction,
} from "@/app/actions";

function formatDay(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

/** Shown once, right after the secrets are minted. They cannot be re-read. */
function Secrets({ result }: { result: PairingResult }) {
  if (result.error)
    return (
      <div className="alert">
        {result.error === "name"
          ? "Give the frame a name first."
          : result.error === "not_found"
            ? "That frame is already connected."
            : "You don’t have permission to do that."}
      </div>
    );
  if (!result.link) return null;
  return (
    <div className="secret-reveal">
      <p>
        <strong>Send this link</strong> to whoever sets up{" "}
        {result.name || "the frame"}. They open it on the iPad and tap Connect.
        It works until used, or until {formatDay(result.linkExpiresAt ?? null)}.
      </p>
      <CopyField value={result.link} label="Copy link" />
      <p className="secret-alt">
        Setting it up yourself? Type <b>{result.code}</b> on the frame instead —
        that code only lasts 15 minutes.
      </p>
    </div>
  );
}

export function CreateFrameForm() {
  const [result, action, pending] = useActionState(
    createPairingCodeAction,
    null,
  );
  return (
    <>
      <form action={action} className="inline-form">
        <Field label="Name this frame">
          <Input name="name" placeholder="Grandparents’ iPad" required />
        </Field>
        <Button disabled={pending} type="submit" variant="outline">
          {pending ? "Creating…" : "Create connect link"}
        </Button>
      </form>
      {result ? <Secrets result={result} /> : null}
    </>
  );
}

export function DeviceRows({
  devices,
  isOwner,
}: {
  devices: DeviceRow[];
  isOwner: boolean;
}) {
  return (
    <div className="device-list">
      {devices.map((device) => (
        <DeviceRowItem key={device.id} device={device} isOwner={isOwner} />
      ))}
    </div>
  );
}

function DeviceRowItem({
  device,
  isOwner,
}: {
  device: DeviceRow;
  isOwner: boolean;
}) {
  const [result, action, pending] = useActionState(
    rotatePairingCodeAction,
    null,
  );
  const waiting = device.paired === 0;
  const linkLive =
    device.linkExpiresAt !== null &&
    new Date(device.linkExpiresAt) > new Date();
  return (
    <div className="device-row">
      <div>
        <strong>{device.name}</strong>
        <span>
          {device.paired
            ? device.lastSeenAt
              ? `Seen ${formatDay(device.lastSeenAt)}`
              : "Connected · waiting for first check-in"
            : linkLive
              ? `Waiting to connect · link works until ${formatDay(device.linkExpiresAt)}`
              : "Waiting to connect · link expired"}
        </span>
      </div>
      <div className="device-actions">
        {waiting && isOwner ? (
          <form action={action}>
            <input type="hidden" name="deviceId" value={device.id} />
            <input type="hidden" name="name" value={device.name} />
            <Button disabled={pending} size="sm" type="submit" variant="text">
              {pending ? "Creating…" : "New link"}
            </Button>
          </form>
        ) : null}
        {isOwner ? (
          <form action={revokeDeviceAction}>
            <input type="hidden" name="deviceId" value={device.id} />
            <Button size="sm" type="submit" variant="text">
              {waiting ? "Cancel" : "Revoke"}
            </Button>
          </form>
        ) : null}
      </div>
      {result ? <Secrets result={result} /> : null}
    </div>
  );
}
