import { convertMinorWithRate, findRateAtOrBefore, type AuditedFxRate } from "./fx";

export type ReportingCost = {
  id: string;
  amountMinor: bigint;
  currency: string;
  periodStart: Date;
  fxDate?: Date | null;
};

export function convertCostsForReporting<T extends ReportingCost>(costs: T[], rates: AuditedFxRate[], targetCurrency: string) {
  const converted: T[] = [];
  const missing: T[] = [];
  const appliedRates = new Map<string, AuditedFxRate>();
  for (const cost of costs) {
    if (cost.currency === targetCurrency) {
      converted.push(cost);
      continue;
    }
    const rate = findRateAtOrBefore(rates, cost.currency, targetCurrency, cost.fxDate ?? cost.periodStart);
    if (!rate) {
      missing.push(cost);
      continue;
    }
    converted.push({ ...cost, amountMinor: convertMinorWithRate(cost.amountMinor, cost.currency, targetCurrency, rate), currency: targetCurrency });
    appliedRates.set(`${rate.quoteCurrency}:${rate.rateAt.toISOString()}:${rate.source}`, rate);
  }
  return { converted, missing, appliedRates: [...appliedRates.values()] };
}
