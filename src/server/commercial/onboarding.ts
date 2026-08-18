import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  authMembers,
  authOrganizations,
  authUsers,
  betaInvitations,
  commercialTermsAcceptances,
  dataDeletionJobs,
  workspaceBillingProfiles,
  workspaceProfiles,
  workspaceSubscriptions,
} from "@/db/schema";
import { requireServiceDb } from "@/db";
import { env } from "@/lib/env";
import { slugify } from "@/lib/utils";
import { recordAuditEvent } from "@/server/audit";
import type { CommercialPlanCode } from "./plans";
import { hashBetaInvitationToken } from "./beta-invitation-security";

export const commercialDocumentVersions = {
  terms: "2026-08-13",
  privacy: "2026-08-13",
  dpa: "2026-08-13",
} as const;

export type CommercialOnboardingInput = {
  userId: string;
  verifiedEmail: string;
  workspaceName: string;
  legalName: string;
  billingEmail: string;
  countryCode: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  vatId?: string;
  baseCurrency: string;
  locale: "fr" | "en";
  requestedPlanCode: CommercialPlanCode;
  betaInvitationId?: string;
};

const BETA_RESERVATION_MS = 24 * 60 * 60 * 1_000;

export async function reserveBetaInvitation(input: { token: string; userId: string }) {
  const tokenHash = hashBetaInvitationToken(input.token);
  return requireServiceDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`spend-beta:${tokenHash}`}))`);
    const now = new Date();
    const [user] = await tx.select({ email: authUsers.email, emailVerified: authUsers.emailVerified }).from(authUsers)
      .where(eq(authUsers.id, input.userId)).limit(1);
    if (!user?.emailVerified) throw new Error("BETA_INVITATION_REQUIRES_VERIFIED_EMAIL");
    const [invitation] = await tx.select().from(betaInvitations).where(and(
      eq(betaInvitations.tokenHash, tokenHash),
      eq(betaInvitations.email, user.email.toLowerCase()),
      gt(betaInvitations.expiresAt, now),
      or(
        eq(betaInvitations.status, "pending"),
        and(eq(betaInvitations.status, "reserved"), eq(betaInvitations.reservedByUserId, input.userId)),
      ),
    )).limit(1).for("update");
    if (!invitation) throw new Error("BETA_INVITATION_INVALID");
    const existingReservationIsFresh = Boolean(invitation.reservationExpiresAt && invitation.reservationExpiresAt > now);
    const reservationExpiresAt = existingReservationIsFresh ? invitation.reservationExpiresAt! : new Date(now.getTime() + BETA_RESERVATION_MS);
    await tx.update(betaInvitations).set({
      status: "reserved",
      reservedByUserId: input.userId,
      reservedAt: existingReservationIsFresh ? invitation.reservedAt ?? now : now,
      reservationExpiresAt,
      checkoutSessionId: existingReservationIsFresh ? invitation.checkoutSessionId : null,
      updatedAt: now,
    }).where(eq(betaInvitations.id, invitation.id));
    return { id: invitation.id, planCode: invitation.planCode, reservationExpiresAt };
  });
}

export async function getReservedBetaInvitationForUser(userId: string) {
  const [invitation] = await requireServiceDb().select({
    id: betaInvitations.id,
    planCode: betaInvitations.planCode,
    workspaceId: betaInvitations.workspaceId,
    reservationExpiresAt: betaInvitations.reservationExpiresAt,
  }).from(betaInvitations).where(and(
    eq(betaInvitations.reservedByUserId, userId),
    eq(betaInvitations.status, "reserved"),
    gt(betaInvitations.expiresAt, new Date()),
    gt(betaInvitations.reservationExpiresAt, new Date()),
  )).limit(1);
  return invitation ?? null;
}

export async function expireAbandonedCommercialOnboarding(now = new Date()) {
  const db = requireServiceDb();
  const candidates = await db.select({ id: betaInvitations.id }).from(betaInvitations).where(and(
    eq(betaInvitations.status, "reserved"),
    isNotNull(betaInvitations.reservationExpiresAt),
    lte(betaInvitations.reservationExpiresAt, now),
  ));
  let released = 0;
  let scheduledForDeletion = 0;

  for (const candidate of candidates) {
    const outcome = await db.transaction(async (tx) => {
      const [invitation] = await tx.select().from(betaInvitations)
        .where(and(eq(betaInvitations.id, candidate.id), eq(betaInvitations.status, "reserved")))
        .limit(1).for("update");
      if (!invitation?.reservationExpiresAt || invitation.reservationExpiresAt > now) return "unchanged" as const;
      const reset = {
        reservedByUserId: null,
        reservedAt: null,
        reservationExpiresAt: null,
        checkoutSessionId: null,
        updatedAt: now,
      };
      if (!invitation.workspaceId) {
        await tx.update(betaInvitations).set({
          ...reset,
          status: invitation.expiresAt > now ? "pending" : "expired",
        }).where(eq(betaInvitations.id, invitation.id));
        return "released" as const;
      }

      const [workspace] = await tx.select({ commercialStatus: workspaceProfiles.commercialStatus })
        .from(workspaceProfiles).where(eq(workspaceProfiles.id, invitation.workspaceId)).limit(1).for("update");
      if (!workspace || workspace.commercialStatus !== "pending_checkout") return "unchanged" as const;
      const [subscription] = await tx.select({ id: workspaceSubscriptions.id }).from(workspaceSubscriptions)
        .where(eq(workspaceSubscriptions.workspaceId, invitation.workspaceId)).limit(1);
      if (subscription) return "unchanged" as const;

      await tx.update(workspaceProfiles).set({ commercialStatus: "deletion_scheduled", updatedAt: now })
        .where(eq(workspaceProfiles.id, invitation.workspaceId));
      await tx.insert(dataDeletionJobs).values({
        workspaceId: invitation.workspaceId,
        status: "scheduled",
        exportAvailableUntil: now,
        purgeScheduledAt: now,
      }).onConflictDoNothing();
      await tx.update(betaInvitations).set({
        ...reset,
        status: invitation.expiresAt > now ? "revoked" : "expired",
        revokedAt: invitation.expiresAt > now ? now : null,
      }).where(eq(betaInvitations.id, invitation.id));
      await recordAuditEvent({
        workspaceId: invitation.workspaceId,
        actorType: "system",
        action: "commercial.pending_checkout_abandoned",
        targetType: "workspace",
        targetId: invitation.workspaceId,
        metadata: { invitationId: invitation.id },
      }, tx);
      return "scheduled" as const;
    });
    if (outcome === "released") released += 1;
    if (outcome === "scheduled") scheduledForDeletion += 1;
  }
  return { inspected: candidates.length, released, scheduledForDeletion };
}

export async function getCommercialWorkspaceForUser(userId: string) {
  const [row] = await requireServiceDb().select({
    workspace: workspaceProfiles,
    organizationId: authMembers.organizationId,
    role: authMembers.role,
  }).from(authMembers)
    .innerJoin(workspaceProfiles, eq(workspaceProfiles.organizationId, authMembers.organizationId))
    .where(eq(authMembers.userId, userId)).limit(1);
  return row ?? null;
}

export async function provisionPendingCommercialWorkspace(input: CommercialOnboardingInput) {
  const db = requireServiceDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`spend-commercial-onboarding:${input.userId}`}))`);
    const [existing] = await tx.select({
      workspaceId: workspaceProfiles.id,
      commercialStatus: workspaceProfiles.commercialStatus,
    }).from(authMembers)
      .innerJoin(workspaceProfiles, eq(workspaceProfiles.organizationId, authMembers.organizationId))
      .where(eq(authMembers.userId, input.userId)).limit(1);
    if (existing && existing.commercialStatus !== "pending_checkout") {
      throw new Error("This account already belongs to an active workspace.");
    }

    const normalizedEmail = input.verifiedEmail.toLowerCase();
    const invitationConditions = [
      eq(betaInvitations.email, normalizedEmail),
      eq(betaInvitations.reservedByUserId, input.userId),
      eq(betaInvitations.status, "reserved"),
      gt(betaInvitations.expiresAt, new Date()),
      gt(betaInvitations.reservationExpiresAt, new Date()),
    ];
    if (input.betaInvitationId) invitationConditions.push(eq(betaInvitations.id, input.betaInvitationId));
    const [invitation] = await tx.select().from(betaInvitations).where(and(...invitationConditions)).limit(1).for("update");
    if (!invitation && env.COMMERCIAL_SIGNUP_ENABLED !== "true") {
      throw new Error("A valid Spend beta invitation is required.");
    }
    const planCode = invitation?.planCode ?? input.requestedPlanCode;
    const now = new Date();
    let workspaceId = existing?.workspaceId;

    if (!workspaceId) {
      const organizationId = randomUUID();
      const slug = `${slugify(input.workspaceName)}-${randomUUID().slice(0, 8)}`;
      await tx.insert(authOrganizations).values({ id: organizationId, name: input.workspaceName, slug });
      await tx.insert(authMembers).values({ id: randomUUID(), organizationId, userId: input.userId, role: "owner" });
      const [workspace] = await tx.insert(workspaceProfiles).values({
        organizationId,
        name: input.workspaceName,
        slug,
        baseCurrency: input.baseCurrency,
        locale: input.locale,
        commercialStatus: "pending_checkout",
      }).returning({ id: workspaceProfiles.id });
      workspaceId = workspace.id;
    } else {
      await tx.update(workspaceProfiles).set({
        name: input.workspaceName,
        baseCurrency: input.baseCurrency,
        locale: input.locale,
        updatedAt: now,
      }).where(eq(workspaceProfiles.id, workspaceId));
    }

    await tx.insert(workspaceBillingProfiles).values({
      workspaceId,
      legalName: input.legalName,
      billingEmail: input.billingEmail.toLowerCase(),
      countryCode: input.countryCode.toUpperCase(),
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      postalCode: input.postalCode,
      city: input.city,
      vatId: input.vatId?.toUpperCase(),
      businessConfirmedAt: now,
    }).onConflictDoUpdate({
      target: workspaceBillingProfiles.workspaceId,
      set: {
        legalName: input.legalName,
        billingEmail: input.billingEmail.toLowerCase(),
        countryCode: input.countryCode.toUpperCase(),
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        postalCode: input.postalCode,
        city: input.city,
        vatId: input.vatId?.toUpperCase(),
        businessConfirmedAt: now,
        updatedAt: now,
      },
    });

    for (const [document, version] of Object.entries(commercialDocumentVersions) as Array<[keyof typeof commercialDocumentVersions, string]>) {
      await tx.insert(commercialTermsAcceptances).values({ workspaceId, userId: input.userId, document, version })
        .onConflictDoNothing();
    }
    if (invitation) await tx.update(betaInvitations).set({ workspaceId, updatedAt: now }).where(eq(betaInvitations.id, invitation.id));
    await recordAuditEvent({
      workspaceId,
      actorType: "user",
      actorUserId: input.userId,
      action: "commercial.workspace_pending_checkout_created",
      targetType: "workspace",
      targetId: workspaceId,
      metadata: { planCode, betaInvitation: Boolean(invitation), countryCode: input.countryCode.toUpperCase() },
    }, tx);
    return { workspaceId, planCode, betaInvitationId: invitation?.id };
  });
}
