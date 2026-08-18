import { describe, expect, it, vi } from "vitest";
import { GitHubBillingConnector } from "./connector";

describe("GitHub billing connector", () => {
  it("maps repository usage and marks the preview response as accrued", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"usageItems":[{"product":"Actions","sku":"actions_linux","unitType":"minutes","netAmount":8.125000000000000001,"repository":"yodev/spend"}]}'));
    const connector = new GitHubBillingConnector(fetchMock);
    const result = await connector.syncAccruedCosts!({ workspaceId: "workspace", connectionId: "connection", credentials: { token: "github_token_that_is_long_enough", organization: "yodev" }, from: new Date("2026-08-01T00:00:00Z"), to: new Date("2026-09-01T00:00:00Z") });
    expect(result.items[0]).toMatchObject({ amount: "8.125000000000000001", resourceExternalId: "yodev/spend", status: "accrued", basis: "provider_charge" });
    expect(result.warnings).toHaveLength(1);
  });
});
