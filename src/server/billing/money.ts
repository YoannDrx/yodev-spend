export type Money = { amountMinor: bigint; currency: string };
export type SubscriptionInput = Money & { billingModel: "free" | "fixed_monthly" | "fixed_yearly" | "usage" | "fixed_plus_usage" | "manual"; billingInterval: "month" | "year" | "none"; status: "active" | "cancelled" | "archived" };
export type CostInput = Money & { kind: "subscription" | "usage" | "credit" | "tax" | "manual"; periodStart: Date; periodEnd: Date; subscriptionId?: string | null };

export function normalizeMonthly(subscription: SubscriptionInput): Money {
  if (subscription.status !== "active" || subscription.billingModel === "free" || subscription.billingInterval === "none") return { amountMinor: 0n, currency: subscription.currency };
  return { amountMinor: subscription.billingInterval === "year" ? subscription.amountMinor / 12n : subscription.amountMinor, currency: subscription.currency };
}

/** Aggregates annual commitments as twelfths and rounds only once at the display boundary. */
export function sumMonthlyCommitments(subscriptions: SubscriptionInput[], currency: string) {
  const twelfths = subscriptions
    .filter((subscription) => subscription.currency === currency && subscription.status === "active" && subscription.billingModel !== "free" && subscription.billingInterval !== "none")
    .reduce((sum, subscription) => sum + (subscription.billingInterval === "year" ? subscription.amountMinor : subscription.amountMinor * 12n), 0n);
  return { amountMinor: twelfths / 12n, currency, exactNumerator: twelfths, exactDenominator: 12n };
}

export function equalAllocationBps(count: number) {
  if (!Number.isSafeInteger(count) || count <= 0 || count > 10_000) throw new Error("Allocation count must be between 1 and 10,000.");
  const base = Math.floor(10_000 / count);
  const remainder = 10_000 - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function allocateMoney(amountMinor: bigint, allocationsBps: number[]) {
  if (allocationsBps.some((bps) => !Number.isInteger(bps) || bps < 0) || allocationsBps.reduce((sum,bps) => sum+bps,0) > 10_000) throw new Error("Allocations must be integer basis points totaling at most 10,000.");
  const sign = amountMinor < 0n ? -1n : 1n;
  const absoluteAmount = amountMinor * sign;
  const weighted = allocationsBps.map((bps, index) => {
    const numerator = absoluteAmount * BigInt(bps);
    return { index, amount: numerator / 10_000n, remainder: numerator % 10_000n };
  });
  let left = absoluteAmount - weighted.reduce((sum, item) => sum + item.amount, 0n);
  const allocatedBps = allocationsBps.reduce((sum, bps) => sum + bps, 0);
  if (allocatedBps === 10_000) {
    const order = [...weighted].sort((leftItem, rightItem) => rightItem.remainder === leftItem.remainder ? leftItem.index - rightItem.index : rightItem.remainder > leftItem.remainder ? 1 : -1);
    for (let index = 0; left > 0n; index = (index + 1) % order.length) {
      order[index].amount += 1n;
      left -= 1n;
    }
  }
  return weighted.map((item) => item.amount * sign);
}

export function dashboardMetrics({ subscriptions, costs, baseCurrency, now, wasteSubscriptionIds = [] }: { subscriptions: Array<SubscriptionInput & { id: string }>; costs: CostInput[]; baseCurrency: string; now: Date; wasteSubscriptionIds?: string[] }) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1));
  const eligibleSubscriptions = subscriptions.filter((item) => item.currency === baseCurrency);
  const monthlyCommitment = sumMonthlyCommitments(eligibleSubscriptions, baseCurrency).amountMinor;
  const monthCosts = costs.filter((item) => item.currency === baseCurrency && item.periodStart < monthEnd && item.periodEnd >= monthStart);
  const monthToDate = monthCosts.reduce((sum,item) => sum + item.amountMinor, 0n);
  const variableKnown = monthCosts.filter((item) => item.kind !== "subscription" || !item.subscriptionId).reduce((sum,item) => sum + item.amountMinor, 0n);
  const wasteSet = new Set(wasteSubscriptionIds);
  const potentialWaste = sumMonthlyCommitments(eligibleSubscriptions.filter((item) => wasteSet.has(item.id)), baseCurrency).amountMinor;
  return { monthToDate, monthlyCommitment, forecast: monthlyCommitment + variableKnown, annualized: monthlyCommitment * 12n, potentialWaste };
}

export interface BillingSyncContext { workspaceId: string; billingAccountId: string; from: Date; to: Date }
export type NormalizedCost = CostInput & { externalId: string; description?: string };
export interface BillingAdapter { readonly providerSlug: string; sync(context: BillingSyncContext): Promise<NormalizedCost[]> }
