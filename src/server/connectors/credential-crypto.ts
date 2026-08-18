import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

export type EncryptedCredential = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
};

const credentialPayload = z.record(z.string(), z.string().max(20_000));

function readKey(encodedKey = process.env.CONNECTOR_ENCRYPTION_KEY) {
  if (!encodedKey) throw new Error("CONNECTOR_ENCRYPTION_KEY is required to store provider credentials.");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("CONNECTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptCredentials(
  credentials: Record<string, string>,
  binding: string,
  encodedKey?: string,
): EncryptedCredential {
  const payload = credentialPayload.parse(credentials);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readKey(encodedKey), iv);
  cipher.setAAD(Buffer.from(binding));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    keyVersion: 1,
  };
}

export function decryptCredentials(
  encrypted: EncryptedCredential,
  binding: string,
  encodedKey?: string,
) {
  if (encrypted.keyVersion !== 1) throw new Error("Unsupported connector credential key version.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    readKey(encodedKey),
    Buffer.from(encrypted.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return credentialPayload.parse(JSON.parse(plaintext));
}

export function credentialBinding(workspaceId: string, providerSlug: string) {
  return `spend:${workspaceId}:${providerSlug}`;
}
