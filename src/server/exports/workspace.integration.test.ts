import { describe, expect, it } from "vitest";
import { exportWorkspace } from "./workspace";

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite("workspace business export", () => {
  const context = {workspaceId: "00000000-0000-4000-8000-000000000001", userId: "seed-owner", organizationId: "seed-yodev", role: "owner"};
  it("exports exact money and omits authentication and credential fields", async () => {
    const value = await exportWorkspace(context);
    const parsed = JSON.parse(value);
    expect(parsed.workspace[0].id).toBe(context.workspaceId);
    expect(parsed.costs.length).toBeGreaterThan(0);
    expect(typeof parsed.costs[0].amountMinor).toBe("string");
    expect(value).not.toMatch(/credentialCiphertext|credentialIv|credentialTag|accessToken|refreshToken|authAccounts|password/);
    expect(parsed.clients.some((client: {name: string}) => client.name === "Isolation client")).toBe(false);
  });
  it("denies non-owners before reading business data", async () => {
    await expect(exportWorkspace({...context,role:"member"})).rejects.toThrow("Workspace role denied");
  });
});
