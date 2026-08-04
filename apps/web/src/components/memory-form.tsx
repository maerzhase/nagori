"use client";

import {
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  SlidePreview,
  Textarea,
} from "@nagori/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createMessageAction } from "@/app/actions";

const THEMES = [
  { value: "paper", label: "Warm paper" },
  { value: "sunset", label: "Sunset coral" },
  { value: "garden", label: "Garden green" },
] as const;

function isoAt(value: string, end = false) {
  if (!value) return "";
  return new Date(
    `${value}${end ? "T23:59:59.999" : "T00:00:00.000"}`,
  ).toISOString();
}

async function browserSafeImage(file: File): Promise<Blob> {
  const source = await loadImage(file);
  const max = 2200;
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image conversion is unavailable");
  context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  source.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not prepare image")),
      "image/jpeg",
      0.88,
    ),
  );
}

async function loadImage(file: File): Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Safari can decode some camera formats through an <img> but not ImageBitmap.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not read this image"));
      element.src = url;
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function upload(
  body: Blob,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/slides/photo");
    Object.entries(headers).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300)
        resolve(request.status);
      else
        reject(
          Object.assign(new Error("Upload failed"), { status: request.status }),
        );
    };
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(body);
  });
}

async function uploadWithRetry(
  body: Blob,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
  onRetry: () => void,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await upload(body, headers, onProgress);
    } catch (error) {
      const status = Number((error as { status?: number }).status ?? 0);
      if (attempt === 2 || (status >= 400 && status < 500 && status !== 429))
        throw error;
      onRetry();
      await new Promise((resolve) =>
        window.setTimeout(resolve, 800 * (attempt + 1)),
      );
    }
  }
}

/**
 * One form for both kinds of slide. A memory is text plus a background, and the
 * background is either a photo or one of the frame's themes. Which one decides
 * the transport: photos stream to /api/slides/photo so upload progress and
 * retries stay on the client, themes go through the message server action.
 */
export function MemoryForm({ showCaptions }: { showCaptions: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [background, setBackground] = useState<"photo" | "theme">("photo");
  const [theme, setTheme] = useState<string>("paper");
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  const isPhoto = background === "photo";

  return (
    <div className="composer-grid">
      <form
        ref={formRef}
        className="composer-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setState("working");
          setError("");
          if (!isPhoto) {
            // A themed note has nothing to stream, so it goes straight through
            // the server action — but it reports success the same way.
            try {
              await createMessageAction(data);
              formRef.current?.reset();
              setText("");
              setState("done");
              router.refresh();
            } catch (reason) {
              setState("error");
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Something went wrong.",
              );
            }
            return;
          }
          setProgress("Preparing photo…");
          try {
            const file = data.get("photo");
            if (!(file instanceof File) || file.size === 0)
              throw new Error("Choose a photo first.");
            const body = await browserSafeImage(file);
            setProgress("Uploading…");
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
            const status = await uploadWithRetry(
              body,
              headers,
              (percent) => setProgress(`Uploading… ${percent}%`),
              () => setProgress("Connection interrupted — retrying…"),
            );
            if (status === 409)
              throw new Error("The frame already has 200 active slides.");
            formRef.current?.reset();
            setText("");
            setPhotoUrl(null);
            setState("done");
            setProgress("");
            router.refresh();
          } catch (reason) {
            setState("error");
            const status = Number(
              (reason as { status?: number } | undefined)?.status ?? 0,
            );
            setError(
              status === 409
                ? "The frame already has 200 active slides."
                : reason instanceof Error
                  ? reason.message
                  : "Something went wrong.",
            );
          }
        }}
      >
        <fieldset className="segmented">
          <legend>Background</legend>
          <label>
            <input
              type="radio"
              name="background"
              value="photo"
              checked={isPhoto}
              onChange={() => setBackground("photo")}
            />
            <span>A photo</span>
          </label>
          <label>
            <input
              type="radio"
              name="background"
              value="theme"
              checked={!isPhoto}
              onChange={() => setBackground("theme")}
            />
            <span>A colour</span>
          </label>
        </fieldset>

        {isPhoto ? (
          <label className="drop-field">
            <span className="drop-icon">＋</span>
            <strong>
              {photoUrl ? "Choose another photo" : "Choose a photo"}
            </strong>
            <span>
              HEIC, JPEG or PNG · prepared for the frame automatically
            </span>
            <input
              name="photo"
              type="file"
              accept="image/*"
              required
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                setPhotoUrl((previous) => {
                  if (previous) URL.revokeObjectURL(previous);
                  return file ? URL.createObjectURL(file) : null;
                });
              }}
            />
          </label>
        ) : (
          <Field label="Colour">
            <Select
              name="theme"
              defaultValue={theme}
              onValueChange={setTheme}
              options={THEMES}
            />
          </Field>
        )}

        {isPhoto ? (
          <Field label="Little note" hint="optional">
            <Input
              name="caption"
              maxLength={180}
              placeholder="Sunday lunch at the old house"
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
            />
          </Field>
        ) : (
          <Field label="Message">
            <Textarea
              name="message"
              maxLength={280}
              placeholder="Thinking of you both today…"
              required
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
            />
          </Field>
        )}

        <ScheduleFields />
        <Button disabled={state === "working"} type="submit">
          {state === "working" ? "Sharing…" : "Share with the frame"}
        </Button>
        <p className={`form-status ${state}`} aria-live="polite">
          {state === "done"
            ? "Shared — it will appear on the frame shortly."
            : error || progress}
        </p>
      </form>
      <div className="composer-preview">
        <p className="eyebrow">On the frame</p>
        <SlidePreview
          imageUrl={isPhoto ? photoUrl : null}
          theme={theme}
          message={isPhoto ? null : text}
          caption={isPhoto ? text : null}
          placeholder={
            isPhoto
              ? "Your photo will appear here."
              : "Your note will appear here."
          }
          showCaption={showCaptions}
        />
        <p className="preview-note">
          {isPhoto && !photoUrl
            ? "Choose a photo to see it here."
            : showCaptions
              ? "This is roughly what the iPad will show."
              : "Captions are hidden in your playback settings."}
        </p>
      </div>
    </div>
  );
}

export function ScheduleFields() {
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return (
    <fieldset className="schedule-fields">
      <legend>When should it show?</legend>
      <div className="date-grid">
        <Field label="From">
          <Input name="displayFrom" type="date" defaultValue={today} />
        </Field>
        <Field label="Until">
          <Input name="displayUntil" type="date" defaultValue={later} />
        </Field>
      </div>
      <Checkbox name="forever" value="yes">
        Keep in the rotation forever
      </Checkbox>
    </fieldset>
  );
}
