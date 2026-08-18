import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";
import { authInvitations, authMembers, authUsers } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { recordAuditEvent } from "@/server/audit";

export async function listOrganizationIdentityState(organizationId: string) {
  return requireServiceDb().transaction(async (db) => ({
    members: await db.select({
      id: authMembers.id,
      userId: authMembers.userId,
      name: authUsers.name,
      email: authUsers.email,
      role: authMembers.role,
    }).from(authMembers)
      .innerJoin(authUsers, eq(authUsers.id, authMembers.userId))
      .where(eq(authMembers.organizationId, organizationId)),
    invitations: await db.select({
      id: authInvitations.id,
      email: authInvitations.email,
      role: authInvitations.role,
      status: authInvitations.status,
      expiresAt: authInvitations.expiresAt,
    }).from(authInvitations).where(and(
      eq(authInvitations.organizationId, organizationId),
      eq(authInvitations.status, "pending"),
    )),
  }));
}

export async function manageOrganizationMember(input: {
  workspaceId: string;
  organizationId: string;
  actorUserId: string;
  memberId: string;
  decision: "admin" | "member" | "remove";
}) {
  return requireServiceDb().transaction(async (db) => {
    await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`spend-members:${input.organizationId}`}))`);
    const [actor] = await db.select({ role: authMembers.role }).from(authMembers).where(and(
      eq(authMembers.organizationId, input.organizationId),
      eq(authMembers.userId, input.actorUserId),
    )).limit(1);
    if (!actor?.role.split(",").includes("owner")) throw new Error("Only the owner can manage existing members.");

    if (input.decision === "remove") {
      const [removed] = await db.delete(authMembers).where(and(
        eq(authMembers.id, input.memberId),
        eq(authMembers.organizationId, input.organizationId),
        ne(authMembers.userId, input.actorUserId),
        ne(authMembers.role, "owner"),
      )).returning({ id: authMembers.id });
      if (!removed) throw new Error("Member cannot be removed.");
    } else {
      const [updated] = await db.update(authMembers).set({ role: input.decision }).where(and(
        eq(authMembers.id, input.memberId),
        eq(authMembers.organizationId, input.organizationId),
        ne(authMembers.userId, input.actorUserId),
        ne(authMembers.role, "owner"),
      )).returning({ id: authMembers.id });
      if (!updated) throw new Error("Member role cannot be changed.");
    }

    await recordAuditEvent({
      workspaceId: input.workspaceId,
      actorType: "user",
      actorUserId: input.actorUserId,
      action: input.decision === "remove" ? "member.revoked" : "member.role_changed",
      targetType: "organization_member",
      targetId: input.memberId,
      metadata: { role: input.decision },
    }, db);
  });
}
