"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

function isoAt(value: string, end = false) {
  if (!value) return "";
  return new Date(
    `${value}${end ? "T23:59:59.999" : "T00:00:00.000"}`,
  ).toISOString();
}

async function browserSafeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 2200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image conversion is unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not prepare image")),
      "image/jpeg",
      0.88,
    ),
  );
}

export function UploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  return (
    <form
      ref={formRef}
      className="composer-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setState("working");
        setError("");
        try {
          const data = new FormData(event.currentTarget);
          const file = data.get("photo");
          if (!(file instanceof File) || file.size === 0)
            throw new Error("Choose a photo first.");
          const body = await browserSafeImage(file);
          const from = isoAt(String(data.get("displayFrom") || ""));
          const forever = data.get("forever") === "yes";
          const until = forever
            ? ""
            : isoAt(String(data.get("displayUntil") || ""), true);
          const headers: Record<string, string> = {
            "content-type": "image/jpeg",
            "x-file-size": String(body.size),
            "x-caption": encodeURIComponent(
              String(data.get("caption") || "").slice(0, 180),
            ),
          };
          if (from) headers["x-display-from"] = from;
          if (forever || until) headers["x-display-until"] = until;
          const response = await fetch("/api/slides/photo", {
            method: "POST",
            headers,
            body,
          });
          if (!response.ok)
            throw new Error(
              response.status === 409
                ? "The frame already has 200 active slides."
                : "The upload did not complete.",
            );
          formRef.current?.reset();
          setState("done");
          router.refresh();
        } catch (reason) {
          setState("error");
          setError(
            reason instanceof Error ? reason.message : "Something went wrong.",
          );
        }
      }}
    >
      <label className="drop-field">
        <span className="drop-icon">＋</span>
        <strong>Choose a photo</strong>
        <span>HEIC, JPEG or PNG · prepared for the frame automatically</span>
        <input name="photo" type="file" accept="image/*" required />
      </label>
      <label>
        Little note <span>optional</span>
        <input
          name="caption"
          maxLength={180}
          placeholder="Sunday lunch at the old house"
        />
      </label>
      <ScheduleFields />
      <button
        className="primary-button"
        disabled={state === "working"}
        type="submit"
      >
        {state === "working" ? "Preparing photo…" : "Share with the frame"}
      </button>
      <p className={`form-status ${state}`} aria-live="polite">
        {state === "done"
          ? "Shared — it will appear on the frame shortly."
          : error}
      </p>
    </form>
  );
}

export function ScheduleFields() {
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return (
    <fieldset className="schedule-fields">
      <legend>When should it show?</legend>
      <div className="date-grid">
        <label>
          From
          <input name="displayFrom" type="date" defaultValue={today} />
        </label>
        <label>
          Until
          <input name="displayUntil" type="date" defaultValue={later} />
        </label>
      </div>
      <label className="check">
        <input name="forever" type="checkbox" value="yes" /> Keep in the
        rotation forever
      </label>
    </fieldset>
  );
}
