import { describe, expect, it } from "vitest";
import { comparePlans, estimatePlanCost, type ComparablePlan } from "./plan-comparison";

const pro: ComparablePlan = { id: "pro", name: "Pro", amountMinor: 2_000n, currency: "USD", features: ["team"], entitlements: [{ metricKey: "requests", includedQuantity: 1_000n, overageAmountMinor: 100n, overagePerQuantity: 1_000n }] };

describe("plan comparison", () => {
  it("calculates base and overage without floating point", () => {
    expect(estimatePlanCost(pro, [{ metricKey: "requests", quantity: 1_001n }])).toBe(2_100n);
  });

  it("never recommends a plan that drops a required feature", () => {
    const hobby = { ...pro, id: "hobby", name: "Hobby", amountMinor: 0n, features: [] };
    const [comparison] = comparePlans({ currentPlan: pro, candidates: [hobby], usage: [], requiredFeatures: ["team"], observationDays: 30, complete: true });
    expect(comparison).toMatchObject({ eligible: false, blockingFeatures: ["team"], confidence: "high" });
  });

  it("downgrades confidence when the observation window is incomplete", () => {
    const lean = { ...pro, id: "lean", name: "Lean", amountMinor: 1_000n };
    const [comparison] = comparePlans({ currentPlan: pro, candidates: [lean], usage: [], requiredFeatures: [], observationDays: 30, complete: false });
    expect(comparison).toMatchObject({ eligible: true, savings: 1_000n, confidence: "low" });
  });
});
