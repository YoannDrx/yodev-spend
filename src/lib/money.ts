/** ISO currency precision as shipped with the runtime's ICU currency data. */
export function currencyFractionDigits(currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits!;
}

export function parseMoneyInput(input: string, currency: string) {
  const match = /^([+-]?)(\d+)(?:[.,](\d+))?$/.exec(input.trim());
  if (!match || input.length > 40) throw new Error("INVALID_MONEY_INPUT");
  const scale = currencyFractionDigits(currency);
  const fraction = match[3] ?? "";
  if (fraction.length > scale) throw new Error("MONEY_PRECISION_EXCEEDED");
  const minor = BigInt(match[2]) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale,"0") || "0");
  const signed = match[1] === "-" ? -minor : minor;
  if (signed < -9223372036854775808n || signed > 9223372036854775807n) throw new Error("MONEY_OUT_OF_RANGE");
  return signed;
}

/** Keep integer money exact, including values beyond Number.MAX_SAFE_INTEGER. */
export function formatMinorUnits(amount: bigint | number | string, currency = "EUR", locale = "fr") {
  if (typeof amount === "number" && !Number.isSafeInteger(amount)) throw new Error("Money must use safe integer minor units.");
  const minor = BigInt(amount);
  const digits = currencyFractionDigits(currency);
  const divisor = 10n ** BigInt(digits);
  const absolute = minor < 0n ? -minor : minor;
  const whole = absolute / divisor;
  const formatter = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency });
  // Use a negative template even for amounts between -1 and 0, preserving the sign.
  const template = minor < 0n ? -(whole || 1n) : whole;
  return formatter.formatToParts(template).map((part) => {
    if (part.type === "fraction") return (absolute % divisor).toString().padStart(digits, "0");
    if (part.type === "integer" && minor < 0n && whole === 0n) return "0";
    return part.value;
  }).join("");
}
