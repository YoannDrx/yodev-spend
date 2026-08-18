import { describe, expect, it } from "vitest";
import { normalizeVercelCommitment, normalizeVercelFocusCharge, parseJsonLines } from "./focus";

describe("Vercel FOCUS normalization", () => {
  it("normalizes a charge while preserving source precision", () => {
    const line = JSON.stringify({
      BilledCost: 0.123456,
      BillingCurrency: "USD",
      ChargeCategory: "Usage",
      ChargePeriodStart: "2026-08-01T00:00:00.000Z",
      ChargePeriodEnd: "2026-08-02T00:00:00.000Z",
      ConsumedQuantity: 1234.5,
      ConsumedUnit: "GB",
      EffectiveCost: 0.120001,
      PricingCategory: "Dynamic",
      PricingCurrency: "USD",
      PricingQuantity: 1234.5,
      PricingUnit: "GB",
      ServiceName: "Fast Data Transfer",
      ServiceProviderName: "Vercel",
      Tags: { ProjectId: "prj_123", ProjectName: "Spend" },
    });
    const cost = normalizeVercelFocusCharge(line);
    expect(cost.amount).toBe("0.120001");
    expect(cost.resourceExternalId).toBe("prj_123");
    expect(cost.metadata).toMatchObject({ billedCost: "0.123456", consumedQuantity: "1234.5" });
    expect(cost.externalId).toHaveLength(64);
  });

  it("normalizes Pro commitments", () => {
    const commitment = normalizeVercelCommitment(JSON.stringify({
      BillingCurrency: "USD",
      ContractCommitmentCategory: "Spend",
      ContractCommitmentCost: 20,
      ContractCommitmentDescription: "Vercel Pro monthly commitment",
      ContractCommitmentId: "commit_1",
      ContractCommitmentPeriodStart: "2026-08-01T00:00:00.000Z",
      ContractCommitmentPeriodEnd: "2026-09-01T00:00:00.000Z",
      ContractCommitmentType: "Pro",
      ContractCommitmentUnit: "USD",
      ContractId: "contract_1",
    }));
    expect(commitment).toMatchObject({ externalId: "commit_1", amount: "20", unit: "USD" });
  });

  it("parses streamed JSONL with empty trailing lines", () => {
    const body = '{"value":1}\n{"value":2}\n';
    expect(parseJsonLines(body, (line) => JSON.parse(line) as { value: number })).toEqual([{ value: 1 }, { value: 2 }]);
  });
});
