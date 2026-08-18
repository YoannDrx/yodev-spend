/** Quotes selected JSON number fields before parsing so ledger decimals never
 * pass through an IEEE-754 number. This is intentionally field-scoped. */
export function parseJsonPreservingDecimals(source: string, fields: string[]) {
  const escaped = fields.map((field) => field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!escaped) return JSON.parse(source) as unknown;
  const pattern = new RegExp(`("(?:${escaped})"\\s*:\\s*)(-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)`, "g");
  return JSON.parse(source.replace(pattern, "$1\"$2\"")) as unknown;
}
