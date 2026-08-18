import type { CommercialPlanFeatures } from "@/db/schema";

export type CommercialPlanCatalogEntry = {
  code: "solo" | "studio";
  version: number;
  currency: "EUR";
  monthlyPriceMinor: bigint;
  annualPriceMinor: bigint;
  memberLimit: number;
  projectLimit: number;
  connectionLimit: number;
  historyMonths: number;
  features: CommercialPlanFeatures;
  effectiveFrom: Date;
};

export const commercialPlanCatalog: CommercialPlanCatalogEntry[] = [
  {
    code: "solo",
    version: 1,
    currency: "EUR",
    monthlyPriceMinor: 1_900n,
    annualPriceMinor: 18_240n,
    memberLimit: 1,
    projectLimit: 10,
    connectionLimit: 5,
    historyMonths: 12,
    features: { clientAllocations: false, collaboration: false, csvExports: false, pdfReports: false },
    effectiveFrom: new Date("2026-08-13T00:00:00.000Z"),
  },
  {
    code: "studio",
    version: 1,
    currency: "EUR",
    monthlyPriceMinor: 4_900n,
    annualPriceMinor: 47_040n,
    memberLimit: 10,
    projectLimit: 50,
    connectionLimit: 20,
    historyMonths: 24,
    features: { clientAllocations: true, collaboration: true, csvExports: true, pdfReports: true },
    effectiveFrom: new Date("2026-08-13T00:00:00.000Z"),
  },
];
