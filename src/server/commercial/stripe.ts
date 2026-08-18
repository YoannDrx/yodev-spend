import "server-only";

import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import Stripe from "stripe";
import { betaInvitations, commercialPlans, workspaceBillingProfiles, workspaceSubscriptions } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { env, requireStripeEnv } from "@/lib/env";
import type { CommercialPlanCode } from "./plans";

export type CommercialBillingInterval = "month" | "year";

let stripeClient: Stripe | undefined;

export function getStripe() {
  if (env.STRIPE_BILLING_ENABLED !== "true") throw new Error("Stripe Billing is not enabled.");
  const stripeEnv = requireStripeEnv();
  stripeClient ??= new Stripe(stripeEnv.STRIPE_RESTRICTED_KEY, {
    apiVersion: "2026-07-29.dahlia",
    appInfo: { name: "Spend by YoDev", version: "0.1.0" },
  });
  return stripeClient;
}

export function getCommercialPriceId(code: CommercialPlanCode, interval: CommercialBillingInterval) {
  const stripeEnv = requireStripeEnv();
  const key = `${code}:${interval}` as const;
  const prices = {
    "solo:month": stripeEnv.STRIPE_SOLO_MONTHLY_PRICE_ID,
    "solo:year": stripeEnv.STRIPE_SOLO_ANNUAL_PRICE_ID,
    "studio:month": stripeEnv.STRIPE_STUDIO_MONTHLY_PRICE_ID,
    "studio:year": stripeEnv.STRIPE_STUDIO_ANNUAL_PRICE_ID,
  } satisfies Record<`${CommercialPlanCode}:${CommercialBillingInterval}`, string>;
  return prices[key];
}

export function findCommercialSelectionForPrice(priceId: string) {
  const selections: Array<{ code: CommercialPlanCode; interval: CommercialBillingInterval }> = [
    { code: "solo", interval: "month" },
    { code: "solo", interval: "year" },
    { code: "studio", interval: "month" },
    { code: "studio", interval: "year" },
  ];
  return selections.find((selection) => getCommercialPriceId(selection.code, selection.interval) === priceId) ?? null;
}

function integrationIdentifier() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return `spend_${Array.from(randomBytes(8), (value) => alphabet[value % alphabet.length]).join("")}`;
}

export async function createCommercialCheckout(input: {
  workspaceId: string;
  planCode: CommercialPlanCode;
  billingInterval: CommercialBillingInterval;
  locale: "fr" | "en";
  betaInvitationId?: string;
}) {
  const db = requireServiceDb();
  const [[profile], [existingSubscription]] = await Promise.all([
    db.select().from(workspaceBillingProfiles).where(eq(workspaceBillingProfiles.workspaceId, input.workspaceId)).limit(1),
    db.select().from(workspaceSubscriptions).where(eq(workspaceSubscriptions.workspaceId, input.workspaceId))
      .orderBy(desc(workspaceSubscriptions.updatedAt)).limit(1),
  ]);
  if (!profile) throw new Error("A billing profile is required before Checkout.");
  if (existingSubscription && ["trialing", "active", "past_due", "unpaid"].includes(existingSubscription.status)) {
    throw new Error("This workspace already has a Stripe subscription.");
  }

  const stripe = getStripe();
  const priceId = getCommercialPriceId(input.planCode, input.billingInterval);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: profile.billingEmail,
    client_reference_id: input.workspaceId,
    locale: input.locale,
    tax_id_collection: { enabled: true },
    billing_address_collection: "required",
    success_url: `${env.NEXT_PUBLIC_APP_URL}/${input.locale}/onboarding?checkout=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/${input.locale}/onboarding?checkout=cancelled`,
    metadata: {
      workspaceId: input.workspaceId,
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      ...(input.betaInvitationId ? { betaInvitationId: input.betaInvitationId } : {}),
    },
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        workspaceId: input.workspaceId,
        planCode: input.planCode,
        billingInterval: input.billingInterval,
        ...(input.betaInvitationId ? { betaInvitationId: input.betaInvitationId } : {}),
      },
    },
    integration_identifier: integrationIdentifier(),
  }, { idempotencyKey: `checkout:${input.workspaceId}:${input.betaInvitationId ?? "public"}:${input.planCode}:${input.billingInterval}` });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  if (input.betaInvitationId) {
    const [bound] = await db.update(betaInvitations).set({ checkoutSessionId: session.id, updatedAt: new Date() }).where(and(
      eq(betaInvitations.id, input.betaInvitationId),
      eq(betaInvitations.workspaceId, input.workspaceId),
      eq(betaInvitations.status, "reserved"),
    )).returning({ id: betaInvitations.id });
    if (!bound) {
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw new Error("BETA_INVITATION_CHECKOUT_BINDING_FAILED");
    }
  }
  return { url: session.url, sessionId: session.id };
}

export async function createCommercialPortal(input: { workspaceId: string; locale: "fr" | "en" }) {
  const [subscription] = await requireServiceDb().select().from(workspaceSubscriptions)
    .where(and(eq(workspaceSubscriptions.workspaceId, input.workspaceId)))
    .orderBy(desc(workspaceSubscriptions.updatedAt)).limit(1);
  if (!subscription) throw new Error("No Stripe subscription is associated with this workspace.");
  const session = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/${input.locale}/settings/billing`,
  });
  return session.url;
}

export async function getWorkspaceCommercialSubscription(workspaceId: string) {
  const [row] = await requireServiceDb().select({ subscription: workspaceSubscriptions, plan: commercialPlans })
    .from(workspaceSubscriptions)
    .innerJoin(commercialPlans, eq(commercialPlans.id, workspaceSubscriptions.commercialPlanId))
    .where(eq(workspaceSubscriptions.workspaceId, workspaceId))
    .orderBy(desc(workspaceSubscriptions.updatedAt)).limit(1);
  return row ?? null;
}
