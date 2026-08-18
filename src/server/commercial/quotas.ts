import "server-only";

import { and, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { authInvitations, authMembers, projects, providerConnections, workspaceProfiles, workspaceQuotaStates, commercialPlans } from "@/db/schema";
import { requireServiceDb, type SpendExecutor } from "@/db";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { getWorkspaceEntitlements } from "./plans";

export type QuotaResource = "member" | "project" | "connection";

export type WorkspaceQuotaSnapshot = {
  members: number;
  projects: number;
  connections: number;
};

export async function countWorkspaceQuotaUsage(workspaceId: string, db: SpendExecutor): Promise<WorkspaceQuotaSnapshot> {
  const [workspace] = await db.select({ organizationId: workspaceProfiles.organizationId }).from(workspaceProfiles)
    .where(eq(workspaceProfiles.id, workspaceId)).limit(1);
  if (!workspace) throw new Error("Workspace not found.");

  const [memberRows] = await db.select({ value: count() }).from(authMembers).where(eq(authMembers.organizationId, workspace.organizationId));
  const [invitationRows] = await db.select({ value: count() }).from(authInvitations).where(and(eq(authInvitations.organizationId, workspace.organizationId), eq(authInvitations.status, "pending")));
  const [projectRows] = await db.select({ value: count() }).from(projects).where(and(eq(projects.workspaceId, workspaceId), ne(projects.status, "archived")));
  const [connectionRows] = await db.select({ value: count() }).from(providerConnections).where(and(
      eq(providerConnections.workspaceId, workspaceId),
      inArray(providerConnections.status, ["pending", "active", "invalid", "rate_limited", "error"]),
      isNull(providerConnections.archivedAt),
    ));

  return {
    members: Number(memberRows.value) + Number(invitationRows.value),
    projects: Number(projectRows.value),
    connections: Number(connectionRows.value),
  };
}

function limitFor(resource: QuotaResource, entitlements: Awaited<ReturnType<typeof getWorkspaceEntitlements>>) {
  if (resource === "member") return entitlements.memberLimit;
  if (resource === "project") return entitlements.projectLimit;
  return entitlements.connectionLimit;
}

export async function assertWorkspaceCanCreate(workspaceId: string, resource: QuotaResource, db?: SpendExecutor) {
  const evaluate = async (executor: SpendExecutor) => {
    await executor.execute(sql`select pg_advisory_xact_lock(hashtext(${`spend-quota:${workspaceId}:${resource}`}))`);
    const entitlements = await getWorkspaceEntitlements(workspaceId, executor);
    const [row] = resource === "member"
      ? await executor.select({ value: count() }).from(authMembers)
        .innerJoin(workspaceProfiles, eq(workspaceProfiles.organizationId, authMembers.organizationId))
        .where(eq(workspaceProfiles.id, workspaceId))
      : resource === "project"
        ? await executor.select({ value: count() }).from(projects).where(and(eq(projects.workspaceId, workspaceId), ne(projects.status, "archived")))
        : await executor.select({ value: count() }).from(providerConnections).where(and(
          eq(providerConnections.workspaceId, workspaceId),
          inArray(providerConnections.status, ["pending", "active", "invalid", "rate_limited", "error"]),
          isNull(providerConnections.archivedAt),
        ));
    let current = Number(row.value);
    if (resource === "member") {
      const [workspace] = await executor.select({ organizationId: workspaceProfiles.organizationId }).from(workspaceProfiles)
        .where(eq(workspaceProfiles.id, workspaceId)).limit(1);
      if (!workspace) throw new Error("Workspace not found.");
      const [pending] = await executor.select({ value: count() }).from(authInvitations).where(and(
        eq(authInvitations.organizationId, workspace.organizationId),
        eq(authInvitations.status, "pending"),
      ));
      current += Number(pending.value);
    }
    const limit = limitFor(resource, entitlements);
    if (current >= limit) {
      throw new Error(`The ${resource} limit for the ${entitlements.code} plan has been reached.`);
    }
    return { entitlements, current, limit };
  };
  if (resource === "member") return requireServiceDb().transaction(evaluate);
  return db ? evaluate(db) : withAuthorizedWorkspace(workspaceId, evaluate);
}

export async function evaluateWorkspaceQuotas(workspaceId: string, db: SpendExecutor) {
  const entitlements = await getWorkspaceEntitlements(workspaceId, db);
  const usage = await countWorkspaceQuotaUsage(workspaceId, db);
  if (entitlements.code === "private") return { status: "within_limit" as const, usage, entitlements };
  if (entitlements.code === "inactive") return { status: "restricted" as const, usage, entitlements };

  const plan = await db.select().from(commercialPlans).where(and(
    eq(commercialPlans.code, entitlements.code),
    eq(commercialPlans.version, entitlements.version),
  )).limit(1).then((rows) => rows[0]);
  if (!plan) throw new Error("Commercial plan not found while evaluating quotas.");

  const exceeded = usage.members > entitlements.memberLimit
    || usage.projects > entitlements.projectLimit
    || usage.connections > entitlements.connectionLimit;
  const [previous] = await db.select().from(workspaceQuotaStates).where(eq(workspaceQuotaStates.workspaceId, workspaceId)).limit(1);
  const now = new Date();
  const graceEndsAt = exceeded
    ? previous?.graceEndsAt ?? new Date(now.getTime() + 7 * 86_400_000)
    : null;
  const status = !exceeded ? "within_limit" as const : graceEndsAt && graceEndsAt > now ? "grace" as const : "restricted" as const;

  await db.insert(workspaceQuotaStates).values({
    workspaceId,
    commercialPlanId: plan.id,
    status,
    memberCount: usage.members,
    projectCount: usage.projects,
    connectionCount: usage.connections,
    exceededAt: exceeded ? previous?.exceededAt ?? now : null,
    graceEndsAt,
    evaluatedAt: now,
  }).onConflictDoUpdate({
    target: workspaceQuotaStates.workspaceId,
    set: {
      commercialPlanId: plan.id,
      status,
      memberCount: usage.members,
      projectCount: usage.projects,
      connectionCount: usage.connections,
      exceededAt: exceeded ? previous?.exceededAt ?? now : null,
      graceEndsAt,
      evaluatedAt: now,
      updatedAt: now,
    },
  });

  return { status, usage, entitlements, graceEndsAt };
}
