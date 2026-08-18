import { createHash } from "node:crypto";
import type { VerifiedGitHubInstallation } from "./adapter";

export class GitHubInstallFlowError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "GitHubInstallFlowError";
  }
}

export function hashGitHubInstallState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function assertGitHubInstallationCapabilities(installation: VerifiedGitHubInstallation) {
  if (installation.suspended) throw new GitHubInstallFlowError("installation_suspended");
  if (!Number.isSafeInteger(installation.installationId) || installation.installationId <= 0) {
    throw new GitHubInstallFlowError("invalid_installation");
  }
  if (!installation.accountLogin || installation.permissions.contents !== "read") {
    throw new GitHubInstallFlowError("missing_contents_permission");
  }
}

export function buildGitHubAppInstallUrl(slug: string, state: string) {
  const url = new URL(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
  url.searchParams.set("state", state);
  return url;
}

export function buildGitHubAppUserAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function verifyGitHubUserCanAccessInstallation(
  accessToken: string,
  installationId: number,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`https://api.github.com/user/installations/${installationId}/repositories?per_page=1`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "x-github-api-version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new GitHubInstallFlowError("installation_not_accessible_to_user");
}
