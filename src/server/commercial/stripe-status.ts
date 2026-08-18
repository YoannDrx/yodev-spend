import type Stripe from "stripe";

export type LocalCommercialSubscriptionStatus = "incomplete" | "trialing" | "active" | "past_due" | "unpaid" | "cancelled";

export const paymentGraceMilliseconds = 7 * 86_400_000;

export function shouldApplyStripeEvent(lastAppliedEventCreatedAt: number | null | undefined, eventCreatedAt: number) {
  return lastAppliedEventCreatedAt == null || eventCreatedAt >= lastAppliedEventCreatedAt;
}

export function paymentGraceForStatus(
  status: LocalCommercialSubscriptionStatus,
  existingGraceEndsAt: Date | null | undefined,
  now: Date,
) {
  if (status !== "past_due") return null;
  return existingGraceEndsAt ?? new Date(now.getTime() + paymentGraceMilliseconds);
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): LocalCommercialSubscriptionStatus {
  if (status === "incomplete_expired" || status === "canceled") return "cancelled";
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  if (status === "incomplete") return "incomplete";
  // Stripe's generated type deliberately permits future statuses. Unknown or
  // paused states must never grant access before the integration is reviewed.
  return "unpaid";
}
