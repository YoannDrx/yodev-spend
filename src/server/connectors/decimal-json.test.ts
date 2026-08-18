import { describe, expect, it } from "vitest";
import { parseJsonPreservingDecimals } from "./decimal-json";

describe("parseJsonPreservingDecimals", () => {
  it("preserves selected decimal tokens while leaving other numbers typed", () => {
    expect(parseJsonPreservingDecimals('{"value":0.123456789012345678,"count":2,"nested":{"netAmount":-1.2e-7}}', ["value", "netAmount"])).toEqual({
      value: "0.123456789012345678",
      count: 2,
      nested: { netAmount: "-1.2e-7" },
    });
  });
});
