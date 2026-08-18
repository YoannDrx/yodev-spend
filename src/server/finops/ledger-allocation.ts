import { allocateDatedCost, type AllocationRule } from "./allocation";

export type AllocatableLedgerCost = {
  id: string;
  billingAccountId: string;
  externalResourceId: string | null;
  projectId: string | null;
  amountMinor: bigint;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
};

export type ScopedAllocationRule = AllocationRule & {
  billingAccountId?: string;
  externalResourceId?: string;
};

export type LedgerAllocation = {
  costId: string;
  projectId: string | null;
  amountMinor: bigint;
  currency: string;
  allocationMethod: AllocationRule["allocationMethod"] | "unallocated";
};

export function allocateLedgerCosts(
  costs: AllocatableLedgerCost[],
  resourceRules: ScopedAllocationRule[],
  billingRules: ScopedAllocationRule[],
): LedgerAllocation[] {
  const resources = new Map<string, AllocationRule[]>();
  const accounts = new Map<string, AllocationRule[]>();
  for (const rule of resourceRules) {
    if (!rule.externalResourceId) continue;
    const current = resources.get(rule.externalResourceId) ?? [];
    current.push(rule);
    resources.set(rule.externalResourceId, current);
  }
  for (const rule of billingRules) {
    if (!rule.billingAccountId) continue;
    const current = accounts.get(rule.billingAccountId) ?? [];
    current.push(rule);
    accounts.set(rule.billingAccountId, current);
  }

  return costs.flatMap((cost): LedgerAllocation[] => {
    if (cost.projectId) {
      return [{ costId: cost.id, projectId: cost.projectId, amountMinor: cost.amountMinor, currency: cost.currency, allocationMethod: "direct" }];
    }
    const rules = cost.externalResourceId
      ? resources.get(cost.externalResourceId) ?? []
      : accounts.get(cost.billingAccountId) ?? [];
    return allocateDatedCost(cost.amountMinor, cost.periodStart, cost.periodEnd, rules).map((share) => ({
      costId: cost.id,
      projectId: share.projectId,
      amountMinor: share.amountMinor,
      currency: cost.currency,
      allocationMethod: share.allocationMethod,
    }));
  });
}

export function allocationTotals(allocations: LedgerAllocation[]) {
  const projects = new Map<string, Map<string, bigint>>();
  const unallocated = new Map<string, bigint>();
  for (const allocation of allocations) {
    if (!allocation.projectId) {
      unallocated.set(allocation.currency, (unallocated.get(allocation.currency) ?? 0n) + allocation.amountMinor);
      continue;
    }
    const currencies = projects.get(allocation.projectId) ?? new Map<string, bigint>();
    currencies.set(allocation.currency, (currencies.get(allocation.currency) ?? 0n) + allocation.amountMinor);
    projects.set(allocation.projectId, currencies);
  }
  return { projects, unallocated };
}
