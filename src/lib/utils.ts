import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatMinorUnits } from "./money";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatMoney(amountMinor: bigint | number | string, currency = "EUR", locale = "fr") {
  return formatMinorUnits(amountMinor, currency, locale);
}

export function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
