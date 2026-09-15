import { describe, expect, it } from "vitest";
import { validateRuntimeDatabaseConfiguration as validate } from "./configuration";

describe("production database configuration", () => {
  const safe = {NODE_ENV: "production", DATABASE_APP_URL: "postgresql://spend_app@localhost/spend", DATABASE_SERVICE_URL: "postgresql://spend_service@localhost/spend"};
  it("requires separate least-privilege runtime identities without migration credentials", () => expect(() => validate(safe)).not.toThrow());
  it("rejects an omitted runtime URL", () => expect(() => validate({...safe, DATABASE_APP_URL: undefined})).toThrow("DATABASE_APP_URL"));
  it("rejects an owner or a service role posing as the tenant role", () => expect(() => validate({...safe, DATABASE_APP_URL: safe.DATABASE_SERVICE_URL})).toThrow("spend_app"));
  it("rejects malformed URLs without echoing credential values", () => {
    expect(() => validate({...safe, DATABASE_APP_URL: "secret-value"})).toThrow("valid PostgreSQL URL");
  });
  it("allows local single-role development", () => expect(() => validate({NODE_ENV: "development"})).not.toThrow());
});
