export type PlanEntitlementInput = {
  metricKey: string;
  includedQuantity: bigint;
  overageAmountMinor: bigint;
  overagePerQuantity: bigint;
};

export type ComparablePlan = {
  id: string;
  name: string;
  amountMinor: bigint;
  currency: string;
  features: string[];
  entitlements: PlanEntitlementInput[];
};

export type ObservedMetric = { metricKey: string; quantity: bigint };

function ceilDivide(value: bigint, divisor: bigint) {
  if (divisor <= 0n) throw new Error("Overage quantity divisor must be positive.");
  return value === 0n ? 0n : (value + divisor - 1n) / divisor;
}

export function estimatePlanCost(plan: ComparablePlan, usage: ObservedMetric[]) {
  const usageByMetric = new Map(usage.map((metric) => [metric.metricKey, metric.quantity]));
  return plan.entitlements.reduce((total, entitlement) => {
    const observed = usageByMetric.get(entitlement.metricKey) ?? 0n;
    const overage = observed > entitlement.includedQuantity ? observed - entitlement.includedQuantity : 0n;
    return total + ceilDivide(overage, entitlement.overagePerQuantity) * entitlement.overageAmountMinor;
  }, plan.amountMinor);
}

export function comparePlans(input: {
  currentPlan: ComparablePlan;
  candidates: ComparablePlan[];
  usage: ObservedMetric[];
  requiredFeatures: string[];
  observationDays: number;
  complete: boolean;
}) {
  const currentCost = estimatePlanCost(input.currentPlan, input.usage);
  return input.candidates.map((candidate) => {
    const blockingFeatures = input.requiredFeatures.filter((feature) => !candidate.features.includes(feature));
    const comparableCurrency = candidate.currency === input.currentPlan.currency;
    const estimatedCost = comparableCurrency ? estimatePlanCost(candidate, input.usage) : null;
    const savings = estimatedCost === null ? null : currentCost - estimatedCost;
    const confidence = input.complete && input.observationDays >= 28
      ? "high" as const
      : input.complete && input.observationDays >= 14
        ? "medium" as const
        : "low" as const;
    return {
      planId: candidate.id,
      planName: candidate.name,
      estimatedCost,
      savings,
      confidence,
      blockingFeatures,
      eligible: comparableCurrency && blockingFeatures.length === 0 && savings !== null && savings > 0n,
    };
  }).sort((a, b) => {
    const aSavings = a.savings ?? -1n;
    const bSavings = b.savings ?? -1n;
    return bSavings > aSavings ? 1 : bSavings < aSavings ? -1 : 0;
  });
}
