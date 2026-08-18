import { describe, expect, it } from "vitest";
import { mapStripeSubscriptionStatus, paymentGraceForStatus, shouldApplyStripeEvent } from "./stripe-status";

describe("Stripe commercial subscription status mapping", () => {
  it.each([
    ["incomplete", "incomplete"],
    ["incomplete_expired", "cancelled"],
    ["trialing", "trialing"],
    ["active", "active"],
    ["past_due", "past_due"],
    ["canceled", "cancelled"],
    ["unpaid", "unpaid"],
    ["paused", "unpaid"],
  ] as const)("maps %s to %s", (stripeStatus, localStatus) => {
    expect(mapStripeSubscriptionStatus(stripeStatus)).toBe(localStatus);
  });

  it("rejects an event older than the subscription state already applied", () => {
    expect(shouldApplyStripeEvent(200, 199)).toBe(false);
    expect(shouldApplyStripeEvent(200, 200)).toBe(true);
    expect(shouldApplyStripeEvent(null, 1)).toBe(true);
  });

  it("grants one explicit seven-day grace window only for past-due subscriptions", () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    const grace = paymentGraceForStatus("past_due", null, now);
    expect(grace?.toISOString()).toBe("2026-08-23T00:00:00.000Z");
    expect(paymentGraceForStatus("active", grace, now)).toBeNull();
    expect(paymentGraceForStatus("unpaid", grace, now)).toBeNull();
  });

  it("does not extend an existing grace window on repeated failures", () => {
    const existing = new Date("2026-08-20T12:00:00.000Z");
    expect(paymentGraceForStatus("past_due", existing, new Date("2026-08-19T00:00:00.000Z"))).toBe(existing);
  });
});
