import { describe, expect, it, vi } from "vitest";
import {
  assertGitHubInstallationCapabilities,
  buildGitHubAppInstallUrl,
  buildGitHubAppUserAuthorizationUrl,
  createPkceChallenge,
  GitHubInstallFlowError,
  hashGitHubInstallState,
  verifyGitHubUserCanAccessInstallation,
} from "./install-security";

describe("GitHub App installation trust", () => {
  it("hashes state and builds a state-bound installation URL", () => {
    const state = "state-that-never-enters-the-database";
    expect(hashGitHubInstallState(state)).toMatch(/^[a-f0-9]{64}$/);
    const url = buildGitHubAppInstallUrl("spend-yodev", state);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/apps/spend-yodev/installations/new");
    expect(url.searchParams.get("state")).toBe(state);
  });

  it("uses S256 PKCE and the exact callback URL for user authorization", () => {
    const verifier = "a".repeat(64);
    const challenge = createPkceChallenge(verifier);
    const url = buildGitHubAppUserAuthorizationUrl({
      clientId: "Iv1.test",
      redirectUri: "https://spend.example/api/github/install/callback",
      state: "opaque-state",
      codeChallenge: challenge,
    });
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(challenge);
    expect(url.searchParams.get("state")).toBe("opaque-state");
    expect(url.searchParams.get("redirect_uri")).toBe("https://spend.example/api/github/install/callback");
  });

  it("accepts only active read-only Contents installations", () => {
    expect(() => assertGitHubInstallationCapabilities({
      installationId: 42,
      accountLogin: "yodev",
      accountType: "Organization",
      repositorySelection: "selected",
      permissions: { contents: "read", metadata: "read" },
      suspended: false,
    })).not.toThrow();
    const rejected: Array<{ permissions: Record<string, string>; suspended: boolean }> = [
      { permissions: { metadata: "read" }, suspended: false },
      { permissions: { contents: "write" }, suspended: false },
      { permissions: { contents: "read" }, suspended: true },
    ];
    for (const installation of rejected) {
      expect(() => assertGitHubInstallationCapabilities({
        installationId: 42,
        accountLogin: "yodev",
        accountType: "Organization",
        repositorySelection: "selected",
        ...installation,
      })).toThrow(GitHubInstallFlowError);
    }
  });

  it("checks installation access with an ephemeral GitHub user token", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ total_count: 1, repositories: [] }), { status: 200 }));
    await verifyGitHubUserCanAccessInstallation("ghu_ephemeral", 42, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.github.com/user/installations/42/repositories?per_page=1",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer ghu_ephemeral" }) }),
    );
  });

  it("rejects a spoofed installation that the user token cannot access", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("Not Found", { status: 404 }));
    await expect(verifyGitHubUserCanAccessInstallation("ghu_ephemeral", 999, fetcher))
      .rejects.toMatchObject({ code: "installation_not_accessible_to_user" });
  });
});
