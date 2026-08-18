import { currencyScale } from "./decimal";

export type AuditedFxRate = {
  baseCurrency: string;
  quoteCurrency: string;
  rateScaled: bigint;
  rateScale: number;
  rateAt: Date;
  source: string;
  sourceUrl: string;
};

function divideRounded(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new Error("FX rate denominator must be positive.");
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator * sign;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  return (quotient + (remainder * 2n >= denominator ? 1n : 0n)) * sign;
}

export function convertMinorWithRate(amountMinor: bigint, sourceCurrency: string, targetCurrency: string, rate: AuditedFxRate) {
  const source = sourceCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();
  if (source === target) return amountMinor;
  if (rate.baseCurrency !== target || rate.quoteCurrency !== source) throw new Error("The FX rate does not match the requested conversion pair.");
  const numerator = amountMinor * 10n ** BigInt(currencyScale(target) + rate.rateScale);
  const denominator = 10n ** BigInt(currencyScale(source)) * rate.rateScaled;
  return divideRounded(numerator, denominator);
}

export function findRateAtOrBefore(rates: AuditedFxRate[], sourceCurrency: string, targetCurrency: string, at: Date) {
  const source = sourceCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();
  if (source === target) return null;
  return rates
    .filter((rate) => rate.baseCurrency === target && rate.quoteCurrency === source && rate.rateAt <= at)
    .sort((left, right) => right.rateAt.getTime() - left.rateAt.getTime())[0] ?? null;
}
