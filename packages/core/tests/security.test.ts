import { describe, expect, it } from "vitest";
import {
  hashPassword,
  isStrongEnoughPassword,
  MINIMUM_PASSWORD_LENGTH,
  verifyPassword,
} from "../src/security";

describe("password rules", () => {
  it("accepts a password at the minimum length", () => {
    expect(isStrongEnoughPassword("a".repeat(MINIMUM_PASSWORD_LENGTH))).toBe(
      true,
    );
  });

  it("rejects one character short of it", () => {
    expect(
      isStrongEnoughPassword("a".repeat(MINIMUM_PASSWORD_LENGTH - 1)),
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(isStrongEnoughPassword("")).toBe(false);
  });

  it("has no upper bound, so a passphrase is allowed", () => {
    expect(
      isStrongEnoughPassword("a correct horse battery staple, at length"),
    ).toBe(true);
  });
});

describe("password hashing", () => {
  it("verifies a password against its own hash", async () => {
    const { salt, hash } = await hashPassword("a good enough password");
    await expect(
      verifyPassword("a good enough password", salt, hash),
    ).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const { salt, hash } = await hashPassword("a good enough password");
    await expect(verifyPassword("something else", salt, hash)).resolves.toBe(
      false,
    );
  });

  it("salts each hash, so equal passwords do not collide", async () => {
    const first = await hashPassword("the same password");
    const second = await hashPassword("the same password");
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});
