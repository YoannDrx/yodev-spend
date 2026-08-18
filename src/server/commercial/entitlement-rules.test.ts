import { describe, expect, it } from "vitest";
import { subscriptionGrantsPaidEntitlements } from "./entitlement-rules";

describe("commercial entitlement rules", () => {
  const now = new Date("2026-08-16T00:00:00.000Z");
  it.each(["trialing", "active"] as const)("grants paid entitlements to %s subscriptions", (status) => {
    expect(subscriptionGrantsPaidEntitlements(status, null, now)).toBe(true);
  });
  it("grants past-due access only inside the explicit grace window", () => {
    expect(subscriptionGrantsPaidEntitlements("past_due", new Date("2026-08-17T00:00:00.000Z"), now)).toBe(true);
    expect(subscriptionGrantsPaidEntitlements("past_due", now, now)).toBe(false);
    expect(subscriptionGrantsPaidEntitlements("past_due", null, now)).toBe(false);
  });
  it.each(["incomplete", "unpaid", "cancelled"] as const)("fails closed for %s subscriptions", (status) => {
    expect(subscriptionGrantsPaidEntitlements(status, new Date("2026-09-01T00:00:00.000Z"), now)).toBe(false);
  });
});
