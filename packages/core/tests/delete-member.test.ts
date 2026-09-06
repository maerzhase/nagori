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
const input = {
  householdId: "home_dev",
  actorUserId: "usr_dev_owner",
  memberId: "usr_dev_editor",
};

it("deletes credentials and sessions while keeping shared memories and media", async () => {
  const { db, store } = fixture();
  db.exec(`UPDATE slides SET created_by = 'usr_dev_editor';
    INSERT INTO media_assets VALUES ('media', 'home_dev', 'usr_dev_editor', 'photo-key', 'image/jpeg', 100, '2026', NULL);
    INSERT INTO slides (id, household_id, kind, media_asset_id, display_from, created_by, created_at, updated_at)
      VALUES ('photo', 'home_dev', 'photo', 'media', '2026', 'usr_dev_editor', '2026', '2026');
    UPDATE media_assets SET uploader_user_id = 'usr_dev_editor';
    INSERT INTO sessions VALUES ('session', 'usr_dev_editor', 'hash', '2099', '2026');
    INSERT INTO audit_events VALUES ('audit', 'home_dev', 'usr_dev_editor', 'upload', NULL, '2026');
    UPDATE invitations SET email = 'editor@nagori.test';`);
  const count = db.prepare("SELECT count(*) AS n FROM slides").get();
  expect(await store.deleteMemberAccount(input)).toBe(true);
  expect(
    db.prepare("SELECT * FROM users WHERE id = 'usr_dev_editor'").get(),
  ).toBeUndefined();
  expect(db.prepare("SELECT * FROM sessions").all()).toEqual([]);
  expect(
    db
      .prepare("SELECT * FROM memberships WHERE user_id = 'usr_dev_editor'")
      .all(),
  ).toEqual([]);
  expect(db.prepare("SELECT count(*) AS n FROM slides").get()).toEqual(count);
  expect(
    db
      .prepare("SELECT * FROM slides WHERE created_by <> 'usr_dev_owner'")
      .all(),
  ).toEqual([]);
  expect(
    db
      .prepare(
        "SELECT * FROM media_assets WHERE uploader_user_id <> 'usr_dev_owner'",
      )
      .all(),
  ).toEqual([]);
  expect(
    db.prepare("SELECT r2_key FROM media_assets WHERE id = 'media'").get()
      ?.r2_key,
  ).toBe("photo-key");
  expect(
    db
      .prepare("SELECT actor_user_id FROM audit_events WHERE id = 'audit'")
      .get()?.actor_user_id,
  ).toBeNull();
  expect(
    db
      .prepare("SELECT * FROM invitations WHERE email = 'editor@nagori.test'")
      .all(),
  ).toEqual([]);
  expect(await store.deleteMemberAccount(input)).toBe(false);
});

it.each([
  { actorUserId: "usr_dev_editor" },
  { memberId: "usr_dev_owner" },
  { householdId: "other" },
  { memberId: "missing" },
])("rejects unauthorized or invalid deletion: %j", async (override) => {
  const { db, store } = fixture();
  expect(await store.deleteMemberAccount({ ...input, ...override })).toBe(
    false,
  );
  expect(db.prepare("SELECT count(*) AS n FROM users").get()?.n).toBe(2);
});

it("does not delete an account with membership in another household", async () => {
  const { db, store } = fixture();
  db.exec(`INSERT INTO households (id, name, created_at) VALUES ('other', 'Other', '2026');
    INSERT INTO memberships VALUES ('other', 'usr_dev_editor', 'viewer', '2026');`);
  expect(await store.deleteMemberAccount(input)).toBe(false);
});
