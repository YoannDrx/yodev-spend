import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { credentialBinding, decryptCredentials, encryptCredentials } from "./credential-crypto";

describe("connector credential encryption", () => {
  const key = randomBytes(32).toString("base64");
  const binding = credentialBinding("workspace-a", "vercel");

  it("round-trips credentials without exposing plaintext", () => {
    const encrypted = encryptCredentials({ token: "secret-token", teamId: "team_123" }, binding, key);
    expect(encrypted.ciphertext).not.toContain("secret-token");
    expect(decryptCredentials(encrypted, binding, key)).toEqual({ token: "secret-token", teamId: "team_123" });
  });

  it("cannot decrypt credentials under a different tenant binding", () => {
    const encrypted = encryptCredentials({ token: "secret-token" }, binding, key);
    expect(() => decryptCredentials(encrypted, credentialBinding("workspace-b", "vercel"), key)).toThrow();
  });

  it("rejects an invalid encryption key", () => {
    expect(() => encryptCredentials({ token: "secret" }, binding, Buffer.from("short").toString("base64"))).toThrow("32-byte");
  });
});
