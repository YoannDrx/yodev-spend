import type { LocalCommercialSubscriptionStatus } from "./stripe-status";

export function subscriptionGrantsPaidEntitlements(
  status: LocalCommercialSubscriptionStatus,
  paymentGraceEndsAt: Date | null,
  now: Date,
) {
  if (status === "trialing" || status === "active") return true;
  return status === "past_due" && Boolean(paymentGraceEndsAt && paymentGraceEndsAt > now);
}
