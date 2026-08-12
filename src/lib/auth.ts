import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { requireDb } from "@/db";
import * as authSchema from "@/db/schema";
import { allowedGitHubIds, env } from "@/lib/env";

let singleton: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  if (!env.BETTER_AUTH_SECRET || !env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    throw new Error("Better Auth and GitHub OAuth configuration is incomplete.");
  }
  return betterAuth({
    appName: "Spend by YoDev",
    baseURL: env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(requireDb(), { provider: "pg", schema: authSchema, usePlural: false }),
    user: {
      modelName: "authUsers",
      additionalFields: { githubId: { type: "string", required: false, input: false } },
    },
    session: { modelName: "authSessions", expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    account: { modelName: "authAccounts", encryptOAuthTokens: true },
    verification: { modelName: "authVerifications", storeIdentifier: "hashed" },
    socialProviders: {
      github: {
        clientId: env.GITHUB_OAUTH_CLIENT_ID,
        clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
        mapProfileToUser: (profile) => ({ githubId: String(profile.id) }),
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const githubId = String((user as typeof user & { githubId?: string }).githubId ?? "");
            if (!allowedGitHubIds.has(githubId)) {
              throw new APIError("FORBIDDEN", { message: "This GitHub account is not allowed to access Spend." });
            }
          },
        },
      },
    },
    rateLimit: { enabled: true, storage: "database", modelName: "authRateLimits", window: 60, max: 100 },
    trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
    advanced: {
      cookiePrefix: "yodev_spend",
      useSecureCookies: env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: env.NEXT_PUBLIC_APP_URL.startsWith("https://"), path: "/" },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: false,
        disableOrganizationDeletion: true,
        creatorRole: "owner",
        membershipLimit: 3,
        schema: {
          organization: { modelName: "authOrganizations" },
          member: { modelName: "authMembers" },
          invitation: { modelName: "authInvitations" },
          session: { fields: { activeOrganizationId: "activeOrganizationId" } },
        },
      }),
      nextCookies(),
    ],
  });
}

export function getAuth() {
  singleton ??= createAuth();
  return singleton;
}
