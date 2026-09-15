import "server-only";

import { and, eq, gt, inArray } from "drizzle-orm";
import { authInvitations, betaInvitations, workspaceProfiles } from "@/db/schema";
import { requireServiceDb } from "@/db";

/** Admission creates an identity only; organization membership still requires acceptance. */
export async function hasRegistrationInvitation(email: string) {
  const db = requireServiceDb();
  const normalized = email.trim().toLowerCase();
  const now = new Date();
  const [beta] = await db.select({id:betaInvitations.id}).from(betaInvitations).where(and(eq(betaInvitations.email,normalized),eq(betaInvitations.status,"pending"),gt(betaInvitations.expiresAt,now))).limit(1);
  if (beta) return true;
  const [member] = await db.select({id:authInvitations.id}).from(authInvitations).innerJoin(workspaceProfiles,eq(workspaceProfiles.organizationId,authInvitations.organizationId)).where(and(eq(authInvitations.email,normalized),eq(authInvitations.status,"pending"),gt(authInvitations.expiresAt,now),inArray(workspaceProfiles.commercialStatus,["private","trialing","active"]))).limit(1);
  return Boolean(member);
}
