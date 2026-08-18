import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { authMembers, githubInstallations, githubInstallStates, workspaceProfiles } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { env, requireGitHubAppUserAuthEnv } from "@/lib/env";
import { decryptCredentials, encryptCredentials } from "@/server/connectors/credentials";
import { getGitHubAppInstallation } from "./adapter";
import {
  assertGitHubInstallationCapabilities,
  buildGitHubAppInstallUrl,
  buildGitHubAppUserAuthorizationUrl,
  createPkceChallenge,
  GitHubInstallFlowError,
  hashGitHubInstallState,
  verifyGitHubUserCanAccessInstallation,
} from "./install-security";

export { GitHubInstallFlowError } from "./install-security";

const INSTALL_STATE_TTL_MS = 10 * 60 * 1_000;
const githubTokenResponseSchema = z.object({ access_token: z.string().min(1), token_type: z.string().min(1) });

function installStateBinding(id: string) {
  return `spend:github-install-state:${id}`;
}

async function getAuthorizedAttempt(state: string, userId: string) {
  const [attempt] = await requireServiceDb().select({
    id: githubInstallStates.id,
    workspaceId: githubInstallStates.workspaceId,
    locale: githubInstallStates.locale,
    candidateInstallationId: githubInstallStates.candidateInstallationId,
    pkceVerifierCiphertext: githubInstallStates.pkceVerifierCiphertext,
    pkceVerifierIv: githubInstallStates.pkceVerifierIv,
    pkceVerifierTag: githubInstallStates.pkceVerifierTag,
    encryptionKeyVersion: githubInstallStates.encryptionKeyVersion,
    role: authMembers.role,
  }).from(githubInstallStates)
    .innerJoin(workspaceProfiles, eq(workspaceProfiles.id, githubInstallStates.workspaceId))
    .innerJoin(authMembers, and(
      eq(authMembers.organizationId, workspaceProfiles.organizationId),
      eq(authMembers.userId, userId),
    ))
    .where(and(
      eq(githubInstallStates.stateHash, hashGitHubInstallState(state)),
      eq(githubInstallStates.initiatedByUserId, userId),
      gt(githubInstallStates.expiresAt, new Date()),
      isNull(githubInstallStates.consumedAt),
    )).limit(1);
  if (!attempt) throw new GitHubInstallFlowError("invalid_or_expired_state");
  if (!attempt.role.split(",").some((role) => role === "owner" || role === "admin")) {
    throw new GitHubInstallFlowError("insufficient_workspace_role");
  }
  return attempt;
}

export async function createGitHubInstallAttempt(input: {
  workspaceId: string;
  userId: string;
  locale: "fr" | "en";
}) {
  const configuration = requireGitHubAppUserAuthEnv();
  const id = randomUUID();
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const encrypted = encryptCredentials({ codeVerifier }, installStateBinding(id), configuration.CONNECTOR_ENCRYPTION_KEY);
  await requireServiceDb().insert(githubInstallStates).values({
    id,
    workspaceId: input.workspaceId,
    initiatedByUserId: input.userId,
    locale: input.locale,
    stateHash: hashGitHubInstallState(state),
    pkceVerifierCiphertext: encrypted.ciphertext,
    pkceVerifierIv: encrypted.iv,
    pkceVerifierTag: encrypted.tag,
    encryptionKeyVersion: encrypted.keyVersion,
    expiresAt: new Date(Date.now() + INSTALL_STATE_TTL_MS),
  });
  return buildGitHubAppInstallUrl(configuration.GITHUB_APP_SLUG, state);
}

export async function prepareGitHubInstallationAuthorization(input: {
  state: string;
  userId: string;
  installationId: number;
}) {
  if (!Number.isSafeInteger(input.installationId) || input.installationId <= 0) {
    throw new GitHubInstallFlowError("invalid_installation");
  }
  const [attempt, installation] = await Promise.all([
    getAuthorizedAttempt(input.state, input.userId),
    getGitHubAppInstallation(input.installationId),
  ]);
  assertGitHubInstallationCapabilities(installation);
  const [updated] = await requireServiceDb().update(githubInstallStates).set({
    candidateInstallationId: input.installationId,
    updatedAt: new Date(),
  }).where(and(
    eq(githubInstallStates.id, attempt.id),
    isNull(githubInstallStates.consumedAt),
    gt(githubInstallStates.expiresAt, new Date()),
    or(
      isNull(githubInstallStates.candidateInstallationId),
      eq(githubInstallStates.candidateInstallationId, input.installationId),
    ),
  )).returning({ id: githubInstallStates.id });
  if (!updated) throw new GitHubInstallFlowError("installation_state_conflict");

  const configuration = requireGitHubAppUserAuthEnv();
  const credentials = decryptCredentials({
    ciphertext: attempt.pkceVerifierCiphertext,
    iv: attempt.pkceVerifierIv,
    tag: attempt.pkceVerifierTag,
    keyVersion: attempt.encryptionKeyVersion,
  }, installStateBinding(attempt.id), configuration.CONNECTOR_ENCRYPTION_KEY);
  return buildGitHubAppUserAuthorizationUrl({
    clientId: configuration.GITHUB_APP_CLIENT_ID,
    redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/github/install/callback`,
    state: input.state,
    codeChallenge: createPkceChallenge(credentials.codeVerifier),
  });
}

async function exchangeGitHubAppUserCode(code: string, codeVerifier: string) {
  const configuration = requireGitHubAppUserAuthEnv();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: configuration.GITHUB_APP_CLIENT_ID,
      client_secret: configuration.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/github/install/callback`,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new GitHubInstallFlowError("github_token_exchange_failed");
  const parsed = githubTokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new GitHubInstallFlowError("github_token_exchange_failed");
  return parsed.data.access_token;
}

export async function completeGitHubInstallation(input: { state: string; userId: string; code: string }) {
  const attempt = await getAuthorizedAttempt(input.state, input.userId);
  if (!attempt.candidateInstallationId) throw new GitHubInstallFlowError("installation_not_selected");
  const configuration = requireGitHubAppUserAuthEnv();
  const credentials = decryptCredentials({
    ciphertext: attempt.pkceVerifierCiphertext,
    iv: attempt.pkceVerifierIv,
    tag: attempt.pkceVerifierTag,
    keyVersion: attempt.encryptionKeyVersion,
  }, installStateBinding(attempt.id), configuration.CONNECTOR_ENCRYPTION_KEY);
  const accessToken = await exchangeGitHubAppUserCode(input.code, credentials.codeVerifier);
  const [installation] = await Promise.all([
    getGitHubAppInstallation(attempt.candidateInstallationId),
    verifyGitHubUserCanAccessInstallation(accessToken, attempt.candidateInstallationId),
  ]);
  assertGitHubInstallationCapabilities(installation);

  await requireServiceDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${installation.installationId})`);
    const [lockedAttempt] = await tx.select({ id: githubInstallStates.id })
      .from(githubInstallStates)
      .where(and(
        eq(githubInstallStates.id, attempt.id),
        isNull(githubInstallStates.consumedAt),
        gt(githubInstallStates.expiresAt, new Date()),
      )).for("update").limit(1);
    if (!lockedAttempt) throw new GitHubInstallFlowError("invalid_or_expired_state");
    const [existing] = await tx.select({ workspaceId: githubInstallations.workspaceId })
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, installation.installationId))
      .limit(1);
    if (existing && existing.workspaceId !== attempt.workspaceId) {
      throw new GitHubInstallFlowError("installation_already_linked");
    }
    await tx.insert(githubInstallations).values({
      workspaceId: attempt.workspaceId,
      installationId: installation.installationId,
      accountLogin: installation.accountLogin,
      accountType: installation.accountType,
      repositorySelection: installation.repositorySelection,
      permissions: installation.permissions,
      verifiedAt: new Date(),
      verifiedByUserId: input.userId,
      status: "active",
      lastSyncedAt: new Date(),
    }).onConflictDoUpdate({
      target: githubInstallations.installationId,
      set: {
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        repositorySelection: installation.repositorySelection,
        permissions: installation.permissions,
        verifiedAt: new Date(),
        verifiedByUserId: input.userId,
        status: "active",
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await tx.update(githubInstallStates).set({ consumedAt: new Date(), updatedAt: new Date() })
      .where(eq(githubInstallStates.id, attempt.id));
  });
  return { locale: attempt.locale === "en" ? "en" as const : "fr" as const };
}
