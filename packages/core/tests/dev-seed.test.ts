import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isStrongEnoughPassword, verifyPassword } from "../src/security";

/**
 * The dev fixture stores a precomputed PBKDF2 hash, because a salted hash is
 * deterministic and SQL cannot derive one. That makes the seed's login depend on
 * KDF parameters recorded nowhere: change the iteration count and every hash in
 * the file silently stops matching. These assertions turn that into a failing
 * test instead of an afternoon spent wondering why dev login broke.
 */
const seed = readFileSync(
  fileURLToPath(new URL("../seeds/dev.sql", import.meta.url)),
  "utf8",
);

function seedValue(name: string): string {
  const match = new RegExp(`-- ${name}: (\\S+)`).exec(seed);
  if (!match) throw new Error(`${name} is not declared in seeds/dev.sql`);
  return match[1];
}

describe("dev seed credentials", () => {
  const password = seedValue("SEED_PASSWORD");
  const salt = seedValue("SEED_SALT");
  const hash = seedValue("SEED_HASH");

  it("signs in with the documented password", async () => {
    await expect(verifyPassword(password, salt, hash)).resolves.toBe(true);
  });

  it("rejects a wrong password against the same salt", async () => {
    await expect(verifyPassword(`${password}x`, salt, hash)).resolves.toBe(
      false,
    );
  });

  it("meets the app's own minimum, so setup would accept it too", () => {
    // Keeps the fixture credential honest: if the minimum ever rises above the
    // seed password's length, this fails rather than leaving a dev account that
    // the real signup flow would reject.
    expect(isStrongEnoughPassword(password)).toBe(true);
  });

  it("stores the hash and salt the SQL inserts", () => {
    // Guards a copy-paste slip between the header comment and the INSERT.
    expect(seed).toContain(`'${hash}'`);
    expect(seed).toContain(`'${salt}'`);
  });
});
