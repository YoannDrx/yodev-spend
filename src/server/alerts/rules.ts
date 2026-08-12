export type WasteCandidate = { subscriptionId: string; recurringMinor: bigint; billingAccountId: string; activeProjectCount: number; allProviderIntegrationsStale: boolean; scanDataFresh: boolean; suppressed: boolean };

export function potentialWaste(candidates: WasteCandidate[]) {
  const included = new Map<string, WasteCandidate>();
  for (const item of candidates) if (!item.suppressed && item.scanDataFresh && (item.activeProjectCount === 0 || item.allProviderIntegrationsStale)) included.set(item.subscriptionId, item);
  return { subscriptionIds: [...included.keys()], amountMinor: [...included.values()].reduce((sum,item) => sum+item.recurringMinor,0n) };
}

export function alertDedupeKey(type: string, parts: Array<string | number | null | undefined>) {
  return [type, ...parts.filter((part) => part !== null && part !== undefined)].join(":");
}
