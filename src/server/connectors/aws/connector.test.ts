import { describe, expect, it, vi } from "vitest";
import { AwsCostExplorerConnector } from "./connector";

const credentials = { accountId: "123456789012", roleArn: "arn:aws:iam::123456789012:role/SpendReadOnly", allocationTagKey: "Project", costMetric: "NetUnblendedCost" };

describe("AWS Cost Explorer connector", () => {
  it("paginates exact decimal costs and maps confirmed tag resources", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ ResultsByTime: [{ TimePeriod: { Start: "2026-08-01", End: "2026-08-02" }, Estimated: false, Groups: [{ Keys: ["Amazon EC2", "Project$parigo"], Metrics: { NetUnblendedCost: { Amount: "12.345678901", Unit: "USD" } } }] }], NextPageToken: "next" })
      .mockResolvedValueOnce({ ResultsByTime: [], NextPageToken: undefined });
    const connector = new AwsCostExplorerConnector(() => ({ send }) as never);
    const result = await connector.syncAccruedCosts!({ workspaceId: "workspace", connectionId: "connection", credentials, from: new Date("2026-08-01T00:00:00Z"), to: new Date("2026-08-03T00:00:00Z") });
    expect(result.items[0]).toMatchObject({ amount: "12.345678901", resourceExternalId: "tag:Project:parigo", status: "accrued", description: "Amazon EC2" });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
