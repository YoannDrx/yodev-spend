import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { and, eq, gt } from "drizzle-orm";
import { requireServiceDb } from "@/db";
import * as authSchema from "@/db/schema";
import { allowedGitHubIds, env } from "@/lib/env";
import { getWorkspaceEntitlements } from "@/server/commercial/plans";
import { Resend } from "resend";

let singleton: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  if (!env.BETTER_AUTH_SECRET || !env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    throw new Error("Better Auth and GitHub OAuth configuration is incomplete.");
  }
  const socialProviders = {
    github: {
      clientId: env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
      mapProfileToUser: (profile: { id: string | number }) => ({ githubId: String(profile.id) }),
    },
    ...(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET ? {
      google: {
        clientId: env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      },
    } : {}),
  };

  return betterAuth({
    appName: "Spend by YoDev",
    baseURL: env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(requireServiceDb(), { provider: "pg", schema: authSchema, usePlural: false }),
    user: {
      modelName: "authUsers",
      // OAuth profile fields must be accepted as input for Better Auth to persist
      // values returned by mapProfileToUser. Public credential sign-up is disabled.
      additionalFields: { githubId: { type: "string", required: false, input: true } },
    },
    session: { modelName: "authSessions", expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    account: {
      modelName: "authAccounts",
      encryptOAuthTokens: true,
      accountLinking: { enabled: true, disableImplicitLinking: true, allowDifferentEmails: false },
    },
    verification: { modelName: "authVerifications", storeIdentifier: "hashed" },
    socialProviders,
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const githubId = String((user as typeof user & { githubId?: string }).githubId ?? "");
            if (allowedGitHubIds.has(githubId) || env.COMMERCIAL_SIGNUP_ENABLED === "true") return;
            const [invitation] = await requireServiceDb().select({ id: authSchema.betaInvitations.id })
              .from(authSchema.betaInvitations)
              .where(and(
                eq(authSchema.betaInvitations.email, user.email.toLowerCase()),
                eq(authSchema.betaInvitations.status, "pending"),
                gt(authSchema.betaInvitations.expiresAt, new Date()),
              )).limit(1);
            if (!invitation) throw new APIError("FORBIDDEN", { message: "A valid Spend beta invitation is required." });
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
        invitationExpiresIn: 48 * 60 * 60,
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: async ({ id, email, organization: invitedOrganization }) => {
          if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new Error("INVITATION_EMAIL_NOT_CONFIGURED");
          const [workspace] = await requireServiceDb().select({ locale: authSchema.workspaceProfiles.locale }).from(authSchema.workspaceProfiles).where(eq(authSchema.workspaceProfiles.organizationId, invitedOrganization.id)).limit(1);
          const locale = workspace?.locale === "en" ? "en" : "fr";
          const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/${locale}/invite/${encodeURIComponent(id)}`;
          const safeOrganization = invitedOrganization.name.replace(/[<>&"']/g, "");
          const content = locale === "fr" ? {
            subject: `Invitation à rejoindre ${safeOrganization} sur Spend`,
            html: `<p>Vous êtes invité à rejoindre <strong>${safeOrganization}</strong> sur Spend by YoDev.</p><p><a href="${inviteUrl}">Accepter l’invitation</a></p><p>Cette invitation expire dans 48 heures.</p>`,
          } : {
            subject: `Invitation to join ${safeOrganization} on Spend`,
            html: `<p>You are invited to join <strong>${safeOrganization}</strong> on Spend by YoDev.</p><p><a href="${inviteUrl}">Accept the invitation</a></p><p>This invitation expires in 48 hours.</p>`,
          };
          const result = await new Resend(env.RESEND_API_KEY).emails.send({
            from: env.RESEND_FROM_EMAIL,
            to: email,
            ...content,
          });
          if (result.error) throw new Error("INVITATION_EMAIL_DELIVERY_FAILED");
        },
        membershipLimit: async (_user, organizationRow) => {
          const [workspace] = await requireServiceDb().select({ id: authSchema.workspaceProfiles.id })
            .from(authSchema.workspaceProfiles)
            .where(eq(authSchema.workspaceProfiles.organizationId, organizationRow.id)).limit(1);
          if (!workspace) return 1;
          return (await getWorkspaceEntitlements(workspace.id, requireServiceDb())).memberLimit;
        },
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
