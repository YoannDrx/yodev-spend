import { describe, expect, it } from "vitest";
import { hashBetaInvitationToken } from "./beta-invitation-security";

describe("commercial beta invitation tokens", () => {
  it("stores a deterministic SHA-256 digest instead of the bearer token", () => {
    const token = "beta_6EVQUDwFuNAcClXjhtxY9vVxYfrM9d4Q";
    const hash = hashBetaInvitationToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashBetaInvitationToken(token)).toBe(hash);
    expect(hashBetaInvitationToken(`${token}x`)).not.toBe(hash);
  });
});
