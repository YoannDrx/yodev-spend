export type ScaledDecimal = {
  value: bigint;
  scale: number;
};

const currencyFractionDigits: Record<string, number> = {
  BHD: 3,
  CLP: 0,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  KWD: 3,
  USD: 2,
};

function assertScale(scale: number) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new Error("A decimal scale must be an integer between 0 and 18.");
  }
}

export function parseScaledDecimal(input: string): ScaledDecimal {
  const value = input.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) throw new Error(`Invalid decimal value: ${input}`);

  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent)) throw new Error(`Invalid decimal exponent: ${input}`);
  const scale = fraction.length - exponent;
  if (scale < 0) {
    const expandedScale = -scale;
    if (expandedScale > 18) throw new Error("A decimal scale must be an integer between 0 and 18.");
    const sign = match[1] === "-" ? -1n : 1n;
    return { value: sign * BigInt(`${match[2]}${fraction}`) * 10n ** BigInt(expandedScale), scale: 0 };
  }
  assertScale(scale);
  const sign = match[1] === "-" ? -1n : 1n;
  return {
    value: sign * BigInt(`${match[2]}${fraction}`),
    scale,
  };
}

export function rescaleDecimal(decimal: ScaledDecimal, targetScale: number): ScaledDecimal {
  assertScale(decimal.scale);
  assertScale(targetScale);
  if (decimal.scale === targetScale) return decimal;

  if (decimal.scale < targetScale) {
    return { value: decimal.value * 10n ** BigInt(targetScale - decimal.scale), scale: targetScale };
  }

  const divisor = 10n ** BigInt(decimal.scale - targetScale);
  const quotient = decimal.value / divisor;
  const remainder = decimal.value % divisor;
  const rounded = remainder === 0n || (remainder < 0n ? -remainder : remainder) * 2n < divisor
    ? quotient
    : quotient + (decimal.value < 0n ? -1n : 1n);
  return { value: rounded, scale: targetScale };
}

export function currencyScale(currency: string) {
  return currencyFractionDigits[currency.toUpperCase()] ?? 2;
}

export function decimalToMinorUnits(input: string, currency: string) {
  const exact = parseScaledDecimal(input);
  const minor = rescaleDecimal(exact, currencyScale(currency));
  return {
    amountMinor: minor.value,
    exactAmountScaled: exact.value,
    exactAmountScale: exact.scale,
  };
}

export function formatScaledDecimal(decimal: ScaledDecimal) {
  assertScale(decimal.scale);
  const negative = decimal.value < 0n;
  const digits = (negative ? -decimal.value : decimal.value).toString().padStart(decimal.scale + 1, "0");
  if (decimal.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const split = digits.length - decimal.scale;
  return `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`;
}
