import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authMembers, authOrganizations, workspaceProfiles } from "@/db/schema";
import { requireDb } from "@/db";
import { env } from "@/lib/env";
import { getAuth } from "@/lib/auth";
import { assertWorkspaceAccess, assertWorkspaceRole } from "./authorization";

export type WorkspaceContext = { userId: string; workspaceId: string; organizationId: string; role: string };

export async function ensureWorkspaceForUser(userId: string) {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const existing = await tx.select({ workspaceId: workspaceProfiles.id, organizationId: authMembers.organizationId, role: authMembers.role })
      .from(authMembers)
      .innerJoin(workspaceProfiles, eq(workspaceProfiles.organizationId, authMembers.organizationId))
      .where(eq(authMembers.userId, userId)).limit(1);
    if (existing[0]) return existing[0];

    const organizationId = randomUUID();
    await tx.insert(authOrganizations).values({ id: organizationId, name: "YoDev", slug: `yodev-${userId.slice(0, 8)}` });
    await tx.insert(authMembers).values({ id: randomUUID(), organizationId, userId, role: "owner" });
    const [workspace] = await tx.insert(workspaceProfiles).values({ organizationId, name: "YoDev", slug: `yodev-${userId.slice(0, 8)}`, baseCurrency: "EUR", locale: "fr" }).returning({ id: workspaceProfiles.id });
    return { workspaceId: workspace.id, organizationId, role: "owner" };
  });
}

export async function requireWorkspaceContext(locale = "fr"): Promise<WorkspaceContext> {
  if (env.AUTH_TEST_MODE === "true") {
    return { userId: "test-owner", workspaceId: "00000000-0000-4000-8000-000000000001", organizationId: "test-yodev", role: "owner" };
  }
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${locale}/sign-in`);
  const workspace = await ensureWorkspaceForUser(session.user.id);
  return { userId: session.user.id, ...workspace };
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
  const [workspace] = await requireDb().select().from(workspaceProfiles).where(eq(workspaceProfiles.organizationId, organizationId)).limit(1);
  return workspace ?? null;
}

export async function isWorkspaceMember(userId: string, workspaceId: string) {
  const [member] = await requireDb().select({ id: authMembers.id }).from(authMembers)
    .innerJoin(workspaceProfiles, eq(workspaceProfiles.organizationId, authMembers.organizationId))
    .where(and(eq(authMembers.userId, userId), eq(workspaceProfiles.id, workspaceId))).limit(1);
  return Boolean(member);
}
