import { createHash } from "node:crypto";
import { z } from "zod";
import type { NormalizedCommitment, NormalizedConnectorCost } from "../types";

const focusChargeSchema = z.object({
  BillingCurrency: z.string().length(3),
  ChargeCategory: z.enum(["Adjustment", "Credit", "Purchase", "Tax", "Usage"]),
  ChargePeriodStart: z.iso.datetime(),
  ChargePeriodEnd: z.iso.datetime(),
  ConsumedUnit: z.string().nullable().optional(),
  RegionId: z.string().optional(),
  RegionName: z.string().optional(),
  ServiceName: z.string(),
  ServiceCategory: z.string().optional(),
  ServiceProviderName: z.string(),
  Tags: z.record(z.string(), z.string()).default({}),
  PricingCategory: z.string().optional(),
  PricingCurrency: z.string().optional(),
  PricingUnit: z.string().optional(),
}).passthrough();

const commitmentSchema = z.object({
  BillingCurrency: z.string().length(3),
  ContractCommitmentCategory: z.enum(["Spend", "Usage"]),
  ContractCommitmentDescription: z.string().optional(),
  ContractCommitmentId: z.string(),
  ContractCommitmentPeriodStart: z.iso.datetime(),
  ContractCommitmentPeriodEnd: z.iso.datetime(),
  ContractCommitmentType: z.string(),
  ContractCommitmentUnit: z.string(),
  ContractId: z.string(),
}).passthrough();

function exactNumber(line: string, field: string): string;
function exactNumber(line: string, field: string, nullable: true): string | undefined;
function exactNumber(line: string, field: string, nullable = false) {
  const match = new RegExp(`"${field}"\\s*:\\s*(-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?|null)`).exec(line);
  if (!match || match[1] === "null") {
    if (nullable) return undefined;
    throw new Error(`Missing numeric FOCUS field: ${field}`);
  }
  return match[1];
}

function stableId(parts: Array<string | undefined>) {
  return createHash("sha256").update(parts.map((part) => part ?? "").join("\u001f")).digest("hex");
}

function chargeKind(category: z.infer<typeof focusChargeSchema>["ChargeCategory"]): NormalizedConnectorCost["kind"] {
  if (category === "Usage") return "usage";
  if (category === "Credit") return "credit";
  if (category === "Tax") return "tax";
  if (category === "Adjustment") return "adjustment";
  return "subscription";
}

export function normalizeVercelFocusCharge(line: string): NormalizedConnectorCost {
  const charge = focusChargeSchema.parse(JSON.parse(line));
  const billedCost = exactNumber(line, "BilledCost");
  const effectiveCost = exactNumber(line, "EffectiveCost");
  const consumedQuantity = exactNumber(line, "ConsumedQuantity", true);
  const pricingQuantity = exactNumber(line, "PricingQuantity", true);
  const projectId = charge.Tags.ProjectId ?? charge.Tags.projectId;

  return {
    externalId: stableId([
      charge.ChargePeriodStart,
      charge.ChargePeriodEnd,
      charge.ChargeCategory,
      charge.ServiceName,
      projectId,
      charge.RegionId,
      billedCost,
      effectiveCost,
      consumedQuantity,
    ]),
    resourceExternalId: projectId,
    amount: effectiveCost,
    currency: charge.BillingCurrency.toUpperCase(),
    periodStart: new Date(charge.ChargePeriodStart),
    periodEnd: new Date(charge.ChargePeriodEnd),
    kind: chargeKind(charge.ChargeCategory),
    status: "accrued",
    basis: "provider_charge",
    description: charge.ServiceName,
    metadata: {
      billedCost,
      consumedQuantity: consumedQuantity ?? null,
      consumedUnit: charge.ConsumedUnit ?? null,
      pricingCategory: charge.PricingCategory ?? null,
      pricingCurrency: charge.PricingCurrency ?? null,
      pricingQuantity: pricingQuantity ?? null,
      pricingUnit: charge.PricingUnit ?? null,
      projectName: charge.Tags.ProjectName ?? charge.Tags.projectName ?? null,
      regionId: charge.RegionId ?? null,
      regionName: charge.RegionName ?? null,
      serviceCategory: charge.ServiceCategory ?? null,
    },
  };
}

export function normalizeVercelCommitment(line: string): NormalizedCommitment {
  const commitment = commitmentSchema.parse(JSON.parse(line));
  const amount = exactNumber(line, "ContractCommitmentCost", true);
  const quantity = exactNumber(line, "ContractCommitmentQuantity", true);
  return {
    externalId: commitment.ContractCommitmentId,
    name: commitment.ContractCommitmentDescription ?? commitment.ContractCommitmentType,
    amount,
    currency: commitment.BillingCurrency.toUpperCase(),
    periodStart: new Date(commitment.ContractCommitmentPeriodStart),
    periodEnd: new Date(commitment.ContractCommitmentPeriodEnd),
    quantity,
    unit: commitment.ContractCommitmentUnit,
    metadata: {
      category: commitment.ContractCommitmentCategory,
      contractId: commitment.ContractId,
      type: commitment.ContractCommitmentType,
    },
  };
}

export function parseJsonLines<T>(body: string, normalize: (line: string) => T) {
  return body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(normalize);
}
