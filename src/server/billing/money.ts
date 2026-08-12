export type Money = { amountMinor: bigint; currency: string };
export type SubscriptionInput = Money & { billingModel: "free" | "fixed_monthly" | "fixed_yearly" | "usage" | "fixed_plus_usage" | "manual"; billingInterval: "month" | "year" | "none"; status: "active" | "cancelled" | "archived" };
export type CostInput = Money & { kind: "subscription" | "usage" | "credit" | "tax" | "manual"; periodStart: Date; periodEnd: Date; subscriptionId?: string | null };

export function normalizeMonthly(subscription: SubscriptionInput): Money {
  if (subscription.status !== "active" || subscription.billingModel === "free" || subscription.billingInterval === "none") return { amountMinor: 0n, currency: subscription.currency };
  return { amountMinor: subscription.billingInterval === "year" ? subscription.amountMinor / 12n : subscription.amountMinor, currency: subscription.currency };
}

export function allocateMoney(amountMinor: bigint, allocationsBps: number[]) {
  if (allocationsBps.some((bps) => !Number.isInteger(bps) || bps < 0) || allocationsBps.reduce((sum,bps) => sum+bps,0) > 10_000) throw new Error("Allocations must be integer basis points totaling at most 10,000.");
  return allocationsBps.map((bps) => amountMinor * BigInt(bps) / 10_000n);
}

export function dashboardMetrics({ subscriptions, costs, baseCurrency, now, wasteSubscriptionIds = [] }: { subscriptions: Array<SubscriptionInput & { id: string }>; costs: CostInput[]; baseCurrency: string; now: Date; wasteSubscriptionIds?: string[] }) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1));
  const eligibleSubscriptions = subscriptions.filter((item) => item.currency === baseCurrency);
  const monthlyCommitment = eligibleSubscriptions.reduce((sum,item) => sum + normalizeMonthly(item).amountMinor, 0n);
  const monthCosts = costs.filter((item) => item.currency === baseCurrency && item.periodStart < monthEnd && item.periodEnd >= monthStart);
  const monthToDate = monthCosts.reduce((sum,item) => sum + item.amountMinor, 0n);
  const variableKnown = monthCosts.filter((item) => item.kind !== "subscription" || !item.subscriptionId).reduce((sum,item) => sum + item.amountMinor, 0n);
  const wasteSet = new Set(wasteSubscriptionIds);
  const potentialWaste = eligibleSubscriptions.filter((item) => wasteSet.has(item.id)).reduce((sum,item) => sum + normalizeMonthly(item).amountMinor, 0n);
  return { monthToDate, monthlyCommitment, forecast: monthlyCommitment + variableKnown, annualized: monthlyCommitment * 12n, potentialWaste };
}

export interface BillingSyncContext { workspaceId: string; billingAccountId: string; from: Date; to: Date }
export type NormalizedCost = CostInput & { externalId: string; description?: string };
export interface BillingAdapter { readonly providerSlug: string; sync(context: BillingSyncContext): Promise<NormalizedCost[]> }
