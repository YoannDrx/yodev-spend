import { describe, expect, it, vi } from "vitest";
import { VercelConnector } from "./connector";

const credentials = { token: "vercel_test_token_that_is_long_enough", teamId: "team_123" };

describe("Vercel connector", () => {
  it("validates the selected team without exposing the token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "team_123", name: "YoDev", slug: "yodev" }), { status: 200 }));
    const connector = new VercelConnector(fetchMock);
    await expect(connector.validate(credentials)).resolves.toEqual({ externalId: "team_123", name: "YoDev", currency: "USD" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.vercel.com/v2/teams/team_123", expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${credentials.token}` }) }));
  });

  it("paginates resources using the continuation token", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "prj_1", name: "Spend" }], pagination: { next: "cursor_2" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "prj_2", name: "Mail" }], pagination: {} }), { status: 200 }));
    const result = await new VercelConnector(fetchMock).syncResources!({
      workspaceId: "workspace",
      connectionId: "connection",
      credentials,
      from: new Date("2026-08-01T00:00:00Z"),
      to: new Date("2026-08-02T00:00:00Z"),
    });
    expect(result.items.map((resource) => resource.externalId)).toEqual(["prj_1", "prj_2"]);
    expect(result.completeness).toBe("complete");
    expect(String(fetchMock.mock.calls[1][0])).toContain("from=cursor_2");
  });

  it("classifies rate limits without persisting response bodies", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("sensitive provider error", { status: 429, headers: { "x-ratelimit-reset": "1800000000" } }));
    const connector = new VercelConnector(fetchMock);
    await expect(connector.validate(credentials)).rejects.toMatchObject({ code: "VERCEL_RATE_LIMITED", status: 429 });
  });
});
