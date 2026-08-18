import { describe, expect, it, vi } from "vitest";
import { OpenAIConnector } from "./connector";

const credentials = { adminKey: "sk-admin-this-is-long-enough-for-tests", organizationId: "org_yodev" };
const context = { workspaceId: "workspace", connectionId: "connection", credentials, from: new Date("2026-08-01T00:00:00Z"), to: new Date("2026-08-03T00:00:00Z") };

describe("OpenAI connector", () => {
  it("paginates costs and keeps amount precision as text", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"data":[{"start_time":1785542400,"end_time":1785628800,"results":[{"amount":{"value":0.123456789012345678,"currency":"usd"},"line_item":"responses","project_id":"proj_1"}]}],"has_more":true,"next_page":"next"}'))
      .mockResolvedValueOnce(new Response('{"data":[],"has_more":false,"next_page":null}'));
    const result = await new OpenAIConnector(fetchMock).syncAccruedCosts!(context);
    expect(result.items[0]).toMatchObject({ amount: "0.123456789012345678", currency: "USD", resourceExternalId: "proj_1", status: "accrued" });
    expect(String(fetchMock.mock.calls[1][0])).toContain("page=next");
  });
});
