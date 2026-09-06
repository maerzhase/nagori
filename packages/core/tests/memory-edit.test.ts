import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { NagoriStore } from "../src/store";
import type { D1Statement, Database } from "../src/types";

const databases: DatabaseSync[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});
function fixture() {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  const migrations = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(migrations).sort())
    db.exec(readFileSync(new URL(file, migrations), "utf8"));
  db.exec(readFileSync(new URL("../seeds/dev.sql", import.meta.url), "utf8"));
  const adapter = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        async first<T>() {
          return (db.prepare(sql).get(...values) as T | undefined) ?? null;
        },
        async all<T>() {
          return {
            success: true,
            results: db.prepare(sql).all(...values) as T[],
          };
        },
        bind(...args: unknown[]) {
          values = args as SQLInputValue[];
          return this;
        },
        async run() {
          const result = db.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      } as D1Statement;
    },
    async batch(statements: D1Statement[]) {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  } as Database;
  return { db, store: new NagoriStore(adapter) };
}

it("persists coordinates and edited captions without changing legacy focal points", async () => {
  const { db, store } = fixture();
  const id = await store.createPhotoSlide({
    householdId: "home_dev",
    userId: "usr_dev_owner",
    r2Key: "focus-test",
    contentType: "image/jpeg",
    sizeBytes: 100,
    caption: "Before",
    fitMode: "cover",
    focalPoint: "25% 70%",
  });
  expect(
    db.prepare("SELECT focal_position FROM slides WHERE id = ?").get(id)
      ?.focal_position,
  ).toBe("25% 70%");
  await store.updateSlideDisplay({
    householdId: "home_dev",
    userId: "usr_dev_owner",
    slideId: id,
    fitMode: "cover",
    focalPoint: "80% 10%",
    text: "After",
  });
  expect(
    db
      .prepare("SELECT caption, focal_position FROM slides WHERE id = ?")
      .get(id),
  ).toMatchObject({ caption: "After", focal_position: "80% 10%" });
  expect(
    await store.updateSlideDisplay({
      householdId: "another-home",
      userId: "usr_dev_owner",
      slideId: id,
      fitMode: "contain",
      focalPoint: "center",
      text: "Wrong household",
    }),
  ).toBe(false);
});

it("edits a message slide", async () => {
  const { db, store } = fixture();
  const slide = db
    .prepare("SELECT id FROM slides WHERE kind = 'message' LIMIT 1")
    .get();
  await store.updateSlideDisplay({
    householdId: "home_dev",
    userId: "usr_dev_owner",
    slideId: String(slide?.id),
    fitMode: null,
    focalPoint: null,
    text: "A new message",
  });
  expect(
    db.prepare("SELECT message FROM slides WHERE id = ?").get(String(slide?.id))
      ?.message,
  ).toBe("A new message");
});

it("saves the schedule and content together, and rejects invalid windows without partial changes", async () => {
  const { db, store } = fixture();
  const slide = db
    .prepare("SELECT id FROM slides WHERE kind = 'message' LIMIT 1")
    .get();
  const input = {
    householdId: "home_dev",
    userId: "usr_dev_owner",
    slideId: String(slide?.id),
    fitMode: null,
    focalPoint: null,
    text: "Together",
    schedule: { displayFrom: "2026-09-01T12:00:00.000Z", displayUntil: null },
  };
  await store.updateSlideDisplay(input);
  expect(
    db
      .prepare(
        "SELECT message, display_from, display_until FROM slides WHERE id = ?",
      )
      .get(input.slideId),
  ).toMatchObject({
    message: "Together",
    display_from: input.schedule.displayFrom,
    display_until: null,
  });
  await expect(
    store.updateSlideDisplay({
      ...input,
      text: "Should not save",
      schedule: {
        displayFrom: "2026-09-10T00:00:00.000Z",
        displayUntil: "2026-09-01T00:00:00.000Z",
      },
    }),
  ).rejects.toThrow("INVALID_SCHEDULE");
  expect(
    db.prepare("SELECT message FROM slides WHERE id = ?").get(input.slideId)
      ?.message,
  ).toBe("Together");
  await store.updateSlideDisplay({
    ...input,
    schedule: undefined,
    text: "Text only",
  });
  expect(
    db
      .prepare("SELECT display_from FROM slides WHERE id = ?")
      .get(input.slideId)?.display_from,
  ).toBe(input.schedule.displayFrom);
});
