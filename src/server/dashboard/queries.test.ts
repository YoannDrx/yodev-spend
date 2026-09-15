import { afterEach, describe, expect, it, vi } from "vitest";
const transaction = vi.hoisted(() => vi.fn());
vi.mock("@/server/auth/workspace-transaction", () => ({withAuthorizedWorkspace: transaction}));
vi.mock("@/lib/env", () => ({env: {AUTH_TEST_MODE: "false", DEMO_DATA_ENABLED: "false"}}));
import { getDashboardData, getPortfolioData, getProjectDetail, getClientDetail, getServiceDetail } from "./queries";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("real dashboard data never falls back to fixtures", () => {
  it("requires a real transaction when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    transaction.mockRejectedValue(new Error("DATABASE_UNAVAILABLE"));
    const id = "00000000-0000-4000-8000-000000000001";
    for (const query of [() => getDashboardData(id), () => getPortfolioData(id), () => getProjectDetail(id,id), () => getClientDetail(id,id), () => getServiceDetail(id,"vercel")]) await expect(query()).rejects.toThrow("DATABASE_UNAVAILABLE");
  });
  it("returns not-found for malformed tenant IDs without querying PostgreSQL", async () => {
    expect(await getClientDetail("workspace", "unknown")).toBeNull();
    expect(await getProjectDetail("workspace", "unknown")).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });
});
