import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authMembers, authOrganizations, authUsers, workspaceProfiles } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { allowedGitHubIds, env } from "@/lib/env";
import { getAuth } from "@/lib/auth";
import { getWorkspaceEntitlements } from "@/server/commercial/plans";
import { assertWorkspaceAccess, assertWorkspaceRole } from "./authorization";
import { withAuthorizedWorkspace } from "./workspace-transaction";

export type WorkspaceContext = { userId: string; workspaceId: string; organizationId: string; role: string };

export async function findWorkspaceMembership(userId: string, organizationId?: string | null) {
  const conditions = [eq(authMembers.userId, userId)];
  if (organizationId) conditions.push(eq(authMembers.organizationId, organizationId));
  const [existing] = await requireServiceDb().select({ workspaceId: workspaceProfiles.id, organizationId: authMembers.organizationId, role: authMembers.role })
    .from(authMembers)
    .innerJoin(workspaceProfiles, eq(workspaceProfiles.organizationId, authMembers.organizationId))
    .where(and(...conditions)).limit(1);
  return existing ?? null;
}

export async function ensureWorkspaceForUser(userId: string) {
  const db = requireServiceDb();
  return db.transaction(async (tx) => {
    // A first page load can issue concurrent RSC requests. Serialize bootstrap
    // per user so only one request creates the organization and workspace.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`spend-workspace:${userId}`}))`);
    const existing = await tx.select({ workspaceId: workspaceProfiles.id, organizationId: authMembers.organizationId, role: authMembers.role })
      .from(authMembers)
      .innerJoin(workspaceProfiles, eq(workspaceProfiles.organizationId, authMembers.organizationId))
      .where(eq(authMembers.userId, userId)).limit(1);
    if (existing[0]) return existing[0];

    const [user] = await tx.select({ githubId: authUsers.githubId }).from(authUsers).where(eq(authUsers.id, userId)).limit(1);
    if (!user?.githubId || !allowedGitHubIds.has(user.githubId)) {
      throw new Error("This user must complete commercial onboarding before accessing a workspace.");
    }

    const organizationId = randomUUID();
    await tx.insert(authOrganizations).values({ id: organizationId, name: "YoDev", slug: `yodev-${userId.slice(0, 8)}` });
    await tx.insert(authMembers).values({ id: randomUUID(), organizationId, userId, role: "owner" });
    const [workspace] = await tx.insert(workspaceProfiles).values({ organizationId, name: "YoDev", slug: `yodev-${userId.slice(0, 8)}`, baseCurrency: "EUR", locale: "fr" }).returning({ id: workspaceProfiles.id });
    return { workspaceId: workspace.id, organizationId, role: "owner" };
  });
}

export async function requireSession(locale = "fr") {
  if (env.AUTH_TEST_MODE === "true") return { user: { id: "test-owner", email: "owner@example.invalid", emailVerified: true }, session: { activeOrganizationId: "test-yodev" } };
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${locale}/sign-in`);
  return session;
}

export async function requireWorkspaceContext(locale = "fr"): Promise<WorkspaceContext> {
  if (env.AUTH_TEST_MODE === "true") {
    return { userId: "test-owner", workspaceId: "00000000-0000-4000-8000-000000000001", organizationId: "test-yodev", role: "owner" };
  }
  const session = await requireSession(locale);
  let workspace = await findWorkspaceMembership(session.user.id, session.session.activeOrganizationId);
  if (!workspace) {
    try {
      workspace = await ensureWorkspaceForUser(session.user.id);
    } catch {
      redirect(`/${locale}/onboarding`);
    }
  }
  return { userId: session.user.id, ...workspace };
}

export async function requireWorkspaceMutationContext(locale = "fr") {
  const context = await requireWorkspaceContext(locale);
  const workspace = await withAuthorizedWorkspace(context.workspaceId, async (db) => {
    const [row] = await db.select({ commercialStatus: workspaceProfiles.commercialStatus })
      .from(workspaceProfiles).where(eq(workspaceProfiles.id, context.workspaceId)).limit(1);
    const entitlements = row?.commercialStatus === "past_due"
      ? await getWorkspaceEntitlements(context.workspaceId, db)
      : null;
    return { row, entitlements };
  });
  const hasAccess = workspace.row && (
    ["private", "trialing", "active"].includes(workspace.row.commercialStatus)
    || (workspace.row.commercialStatus === "past_due" && workspace.entitlements?.code !== "inactive")
  );
  if (!hasAccess) {
    throw new Error("This workspace is read-only until its commercial subscription is active.");
  }
  return context;
}

export async function requireWorkspaceMembership(workspaceId: string, locale = "fr") {
  const context = await requireWorkspaceContext(locale);
  assertWorkspaceAccess(context.workspaceId, workspaceId);
  return context;
}

export async function requireWorkspaceRole(workspaceId: string, roles: string[], locale = "fr") {
  const context = await requireWorkspaceMembership(workspaceId, locale);
  assertWorkspaceRole(context.role, roles);
  return context;
}

export async function findWorkspaceForOrganization(organizationId: string) {
  const [workspace] = await requireServiceDb().select().from(workspaceProfiles).where(eq(workspaceProfiles.organizationId, organizationId)).limit(1);
  return workspace ?? null;
}

export async function isWorkspaceMember(userId: string, workspaceId: string) {
  const [member] = await requireServiceDb().select({ id: authMembers.id }).from(authMembers)
    .innerJoin(workspaceProfiles, eq(workspaceProfiles.organizationId, authMembers.organizationId))
    .where(and(eq(authMembers.userId, userId), eq(workspaceProfiles.id, workspaceId))).limit(1);
  return Boolean(member);
}
