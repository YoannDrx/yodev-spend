export type AllocationRule = {
  projectId: string;
  allocationBps: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  allocationMethod: "direct" | "equal" | "usage_proportional" | "cost_proportional" | "manual" | "workspace_unallocated";
};

export type AllocationShare = {
  projectId: string | null;
  amountMinor: bigint;
  allocationMethod: AllocationRule["allocationMethod"] | "unallocated";
};

type WeightedShare = {
  projectId: string | null;
  weight: bigint;
  allocationMethod: AllocationShare["allocationMethod"];
};

const TOTAL_BPS = 10_000;

function assertRules(rules: AllocationRule[]) {
  for (const rule of rules) {
    if (!Number.isInteger(rule.allocationBps) || rule.allocationBps < 0 || rule.allocationBps > TOTAL_BPS) {
      throw new Error("Allocation basis points must be integers between 0 and 10,000.");
    }
    if (rule.effectiveTo && rule.effectiveTo <= rule.effectiveFrom) {
      throw new Error("Allocation rules must have a positive effective period.");
    }
  }
}

function largestRemainder(amountMinor: bigint, shares: WeightedShare[]) {
  const sign = amountMinor < 0n ? -1n : 1n;
  const absoluteAmount = amountMinor * sign;
  const totalWeight = shares.reduce((sum, share) => sum + share.weight, 0n);
  if (totalWeight === 0n) return [];

  const allocated = shares.map((share) => {
    const numerator = absoluteAmount * share.weight;
    return {
      ...share,
      amountMinor: numerator / totalWeight,
      remainder: numerator % totalWeight,
    };
  });
  let centsLeft = absoluteAmount - allocated.reduce((sum, share) => sum + share.amountMinor, 0n);
  const order = [...allocated].sort((left, right) => {
    if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
    return (left.projectId ?? "\uffff").localeCompare(right.projectId ?? "\uffff");
  });
  for (let index = 0; centsLeft > 0n; index = (index + 1) % order.length) {
    order[index].amountMinor += 1n;
    centsLeft -= 1n;
  }
  return allocated.map((share) => ({
    projectId: share.projectId,
    allocationMethod: share.allocationMethod,
    amountMinor: share.amountMinor * sign,
  }));
}

/**
 * Allocates one ledger entry over dated rules while preserving the source sum.
 * The cost period is treated as [start, end); zero-length manual entries are
 * evaluated at their timestamp. Uncovered basis points remain unallocated.
 */
export function allocateDatedCost(
  amountMinor: bigint,
  periodStart: Date,
  periodEnd: Date,
  rules: AllocationRule[],
): AllocationShare[] {
  assertRules(rules);
  const startMs = periodStart.getTime();
  const endMs = Math.max(periodEnd.getTime(), startMs + 1);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) throw new Error("Cost periods must contain valid dates.");

  const boundaries = new Set<number>([startMs, endMs]);
  for (const rule of rules) {
    const from = rule.effectiveFrom.getTime();
    const to = rule.effectiveTo?.getTime() ?? endMs;
    if (from > startMs && from < endMs) boundaries.add(from);
    if (to > startMs && to < endMs) boundaries.add(to);
  }
  const ordered = [...boundaries].sort((left, right) => left - right);
  const weighted = new Map<string, WeightedShare>();

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const segmentStart = ordered[index];
    const segmentEnd = ordered[index + 1];
    const duration = BigInt(segmentEnd - segmentStart);
    const active = rules.filter((rule) => rule.effectiveFrom.getTime() < segmentEnd
      && (rule.effectiveTo === null || rule.effectiveTo.getTime() > segmentStart));
    const byProject = new Map<string, { bps: number; method: AllocationRule["allocationMethod"] }>();
    for (const rule of active) {
      const current = byProject.get(rule.projectId);
      byProject.set(rule.projectId, {
        bps: (current?.bps ?? 0) + rule.allocationBps,
        method: current?.method ?? rule.allocationMethod,
      });
    }
    const totalBps = [...byProject.values()].reduce((sum, item) => sum + item.bps, 0);
    if (totalBps > TOTAL_BPS) throw new Error("Active allocation rules exceed 10,000 basis points.");
    for (const [projectId, item] of byProject) {
      const key = `project:${projectId}`;
      const current = weighted.get(key);
      weighted.set(key, {
        projectId,
        allocationMethod: current?.allocationMethod ?? item.method,
        weight: (current?.weight ?? 0n) + duration * BigInt(item.bps),
      });
    }
    const unallocatedBps = TOTAL_BPS - totalBps;
    if (unallocatedBps > 0) {
      const current = weighted.get("unallocated");
      weighted.set("unallocated", {
        projectId: null,
        allocationMethod: "unallocated",
        weight: (current?.weight ?? 0n) + duration * BigInt(unallocatedBps),
      });
    }
  }

  return largestRemainder(amountMinor, [...weighted.values()].filter((share) => share.weight > 0n));
}
