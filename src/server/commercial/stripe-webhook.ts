import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import {
  commercialWebhookEvents,
  betaInvitations,
  workspaceProfiles,
  workspaceSubscriptions,
} from "@/db/schema";
import { requireServiceDb } from "@/db";
import { recordAuditEvent } from "@/server/audit";
import { evaluateWorkspaceQuotas } from "./quotas";
import { findCommercialSelectionForPrice, getStripe } from "./stripe";
import { getActiveCommercialPlan } from "./plans";
import { mapStripeSubscriptionStatus, paymentGraceForStatus, shouldApplyStripeEvent } from "./stripe-status";

export { mapStripeSubscriptionStatus } from "./stripe-status";

const metadataSchema = z.object({
  workspaceId: z.uuid(),
  planCode: z.enum(["solo", "studio"]),
  billingInterval: z.enum(["month", "year"]),
  betaInvitationId: z.uuid().optional(),
});

function workspaceStatusForSubscription(status: ReturnType<typeof mapStripeSubscriptionStatus>) {
  if (status === "incomplete") return "pending_checkout" as const;
  if (status === "unpaid") return "past_due" as const;
  return status;
}

function toDate(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp * 1_000) : null;
}

function objectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function synchronizeSubscription(subscription: Stripe.Subscription, eventCreatedAt: number) {
  const metadata = metadataSchema.parse(subscription.metadata);
  const firstItem = subscription.items.data[0];
  if (!firstItem) throw new Error("STRIPE_SUBSCRIPTION_WITHOUT_ITEM");
  const priceId = firstItem.price.id;
  const priceSelection = findCommercialSelectionForPrice(priceId);
  if (!priceSelection || priceSelection.code !== metadata.planCode || priceSelection.interval !== metadata.billingInterval) {
    throw new Error("STRIPE_PRICE_METADATA_MISMATCH");
  }
  const customerId = objectId(subscription.customer);
  if (!customerId) throw new Error("STRIPE_SUBSCRIPTION_WITHOUT_CUSTOMER");
  const db = requireServiceDb();
  const plan = await getActiveCommercialPlan(metadata.planCode, db);
  const localStatus = mapStripeSubscriptionStatus(subscription.status);
  const now = new Date();

  await db.transaction(async (tx) => {
    const [existing] = await tx.select({
      lastStripeEventCreatedAt: workspaceSubscriptions.lastStripeEventCreatedAt,
      paymentGraceEndsAt: workspaceSubscriptions.paymentGraceEndsAt,
    }).from(workspaceSubscriptions).where(eq(workspaceSubscriptions.stripeSubscriptionId, subscription.id)).limit(1);
    if (!shouldApplyStripeEvent(existing?.lastStripeEventCreatedAt, eventCreatedAt)) return;
    const paymentGraceEndsAt = paymentGraceForStatus(localStatus, existing?.paymentGraceEndsAt, now);
    await tx.insert(workspaceSubscriptions).values({
      workspaceId: metadata.workspaceId,
      commercialPlanId: plan.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: localStatus,
      billingInterval: metadata.billingInterval,
      trialEndsAt: toDate(subscription.trial_end),
      currentPeriodStartsAt: toDate(firstItem.current_period_start),
      currentPeriodEndsAt: toDate(firstItem.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelledAt: toDate(subscription.canceled_at),
      endedAt: toDate(subscription.ended_at),
      paymentGraceEndsAt,
      lastStripeEventCreatedAt: eventCreatedAt,
    }).onConflictDoUpdate({
      target: workspaceSubscriptions.stripeSubscriptionId,
      set: {
        commercialPlanId: plan.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        status: localStatus,
        billingInterval: metadata.billingInterval,
        trialEndsAt: toDate(subscription.trial_end),
        currentPeriodStartsAt: toDate(firstItem.current_period_start),
        currentPeriodEndsAt: toDate(firstItem.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        cancelledAt: toDate(subscription.canceled_at),
        endedAt: toDate(subscription.ended_at),
        paymentGraceEndsAt,
        lastStripeEventCreatedAt: eventCreatedAt,
        updatedAt: now,
      },
    });
    await tx.update(workspaceProfiles).set({
      commercialStatus: workspaceStatusForSubscription(localStatus),
      onboardingCompletedAt: ["trialing", "active"].includes(localStatus) ? now : undefined,
      updatedAt: now,
    }).where(eq(workspaceProfiles.id, metadata.workspaceId));
    if (metadata.betaInvitationId && ["trialing", "active"].includes(localStatus)) {
      const [invitation] = await tx.select({ status: betaInvitations.status, workspaceId: betaInvitations.workspaceId })
        .from(betaInvitations).where(eq(betaInvitations.id, metadata.betaInvitationId)).limit(1).for("update");
      if (!invitation || invitation.workspaceId !== metadata.workspaceId || !["reserved", "consumed"].includes(invitation.status)) {
        throw new Error("BETA_INVITATION_BINDING_MISMATCH");
      }
      if (invitation.status === "reserved") {
        await tx.update(betaInvitations).set({
          status: "consumed",
          consumedByUserId: sql`${betaInvitations.reservedByUserId}`,
          consumedAt: now,
          updatedAt: now,
        }).where(eq(betaInvitations.id, metadata.betaInvitationId));
      }
    }
    await recordAuditEvent({
      workspaceId: metadata.workspaceId,
      actorType: "system",
      action: "commercial.subscription_synchronized",
      targetType: "workspace_subscription",
      targetId: subscription.id,
      metadata: { status: localStatus, planCode: metadata.planCode, billingInterval: metadata.billingInterval },
    }, tx);
  });
  await evaluateWorkspaceQuotas(metadata.workspaceId, db);
  return metadata.workspaceId;
}

async function subscriptionFromInvoice(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = objectId(subscription ?? null);
  return subscriptionId ? getStripe().subscriptions.retrieve(subscriptionId) : null;
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = objectId(session.subscription);
      if (!subscriptionId) return null;
      return synchronizeSubscription(await getStripe().subscriptions.retrieve(subscriptionId), event.created);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return synchronizeSubscription(event.data.object, event.created);
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subscription = await subscriptionFromInvoice(event.data.object);
      return subscription ? synchronizeSubscription(subscription, event.created) : null;
    }
    case "customer.updated":
      return null;
    default:
      return null;
  }
}

function safeErrorCode(error: unknown) {
  if (error instanceof z.ZodError) return "INVALID_STRIPE_METADATA";
  if (error instanceof Error && /^[A-Z0-9_]{3,100}$/.test(error.message)) return error.message;
  return "STRIPE_WEBHOOK_PROCESSING_FAILED";
}

export async function processStripeWebhook(rawBody: string, signature: string) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_NOT_CONFIGURED");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new StripeWebhookSignatureError();
  }
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const db = requireServiceDb();

  await db.insert(commercialWebhookEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    stripeEventCreatedAt: event.created,
    payloadHash,
  }).onConflictDoNothing({ target: commercialWebhookEvents.stripeEventId });

  const [claimed] = await db.update(commercialWebhookEvents).set({
    status: "processing",
    attempts: sql`${commercialWebhookEvents.attempts} + 1`,
    errorCode: null,
    updatedAt: new Date(),
  }).where(and(
    eq(commercialWebhookEvents.stripeEventId, event.id),
    inArray(commercialWebhookEvents.status, ["pending", "failed"]),
  )).returning({ id: commercialWebhookEvents.id });
  if (!claimed) return { duplicate: true, eventId: event.id };

  try {
    const workspaceId = await handleStripeEvent(event);
    await db.update(commercialWebhookEvents).set({
      workspaceId,
      status: workspaceId || ["customer.updated"].includes(event.type) ? "processed" : "ignored",
      processedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(commercialWebhookEvents.id, claimed.id));
    return { duplicate: false, eventId: event.id };
  } catch (error) {
    await db.update(commercialWebhookEvents).set({
      status: "failed",
      errorCode: safeErrorCode(error),
      updatedAt: new Date(),
    }).where(eq(commercialWebhookEvents.id, claimed.id));
    throw error;
  }
}

export class StripeWebhookSignatureError extends Error {
  constructor() {
    super("STRIPE_WEBHOOK_SIGNATURE_INVALID");
    this.name = "StripeWebhookSignatureError";
  }
}
