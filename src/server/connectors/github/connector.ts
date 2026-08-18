import { createHash } from "node:crypto";
import { z } from "zod";
import { parseJsonPreservingDecimals } from "../decimal-json";
import { ConnectorHttpError, type ConnectorAccount, type ConnectorCredentials, type ConnectorSyncContext, type ConnectorSyncResult, type NormalizedConnectorCost, type NormalizedExternalResource, type SpendConnector } from "../types";

const credentialsSchema = z.object({ token: z.string().min(20), organization: z.string().min(1).max(100) });
const organizationSchema = z.object({ login: z.string(), name: z.string().nullable().optional() });
const repositorySchema = z.object({ full_name: z.string(), name: z.string(), archived: z.boolean(), visibility: z.string().optional() }).passthrough();
const usageSchema = z.object({
  usageItems: z.array(z.object({
    product: z.string(),
    sku: z.string(),
    unitType: z.string(),
    netAmount: z.string(),
    repository: z.union([z.string(), z.object({ name: z.string() })]).nullable().optional(),
  }).passthrough()),
});
type Fetch = typeof fetch;

function stableId(parts: string[]) {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}

function monthPeriods(from: Date, to: Date) {
  const result: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor < to) {
    const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    result.push({ start: cursor, end: end < to ? end : to });
    cursor = end;
  }
  return result;
}

export class GitHubBillingConnector implements SpendConnector {
  readonly providerSlug = "github";
  readonly manifest = { providerSlug: "github", capabilities: ["accounts", "resources", "costs"], authMode: "api_key", minimumSyncIntervalMinutes: 360 } as const;
  readonly capabilities = { accounts: true, resources: true, subscriptions: false, plans: false, usage: false, accruedCosts: true, invoices: false } as const;

  constructor(private readonly fetchImpl: Fetch = fetch) {}

  async validate(credentials: ConnectorCredentials): Promise<ConnectorAccount> {
    const input = credentialsSchema.parse(credentials);
    const organization = organizationSchema.parse(JSON.parse(await this.requestText(`/orgs/${encodeURIComponent(input.organization)}`, input)));
    return { externalId: organization.login, name: organization.name ?? organization.login, currency: "USD" };
  }

  async syncResources(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedExternalResource>> {
    const credentials = credentialsSchema.parse(context.credentials);
    const items: NormalizedExternalResource[] = [];
    for (let page = 1; ; page += 1) {
      const repositories = z.array(repositorySchema).parse(JSON.parse(await this.requestText(`/orgs/${encodeURIComponent(credentials.organization)}/repos?per_page=100&page=${page}&type=all`, credentials)));
      items.push(...repositories.map((repository) => ({
        externalId: repository.full_name,
        type: "repository",
        name: repository.full_name,
        status: repository.archived ? "inactive" as const : "active" as const,
        metadata: { visibility: repository.visibility ?? null },
      })));
      if (repositories.length < 100) break;
    }
    return { items, hasMore: false, completeness: "complete", warnings: [] };
  }

  async syncAccruedCosts(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedConnectorCost>> {
    const credentials = credentialsSchema.parse(context.credentials);
    const items: NormalizedConnectorCost[] = [];
    for (const period of monthPeriods(context.from, context.to)) {
      const params = new URLSearchParams({ year: String(period.start.getUTCFullYear()), month: String(period.start.getUTCMonth() + 1) });
      const usage = usageSchema.parse(parseJsonPreservingDecimals(await this.requestText(`/organizations/${encodeURIComponent(credentials.organization)}/settings/billing/usage/summary?${params}`, credentials), ["netAmount"]));
      for (const item of usage.usageItems) {
        const repository = typeof item.repository === "string" ? item.repository : item.repository?.name;
        items.push({
          externalId: stableId([period.start.toISOString(), item.product, item.sku, repository ?? "organization"]),
          resourceExternalId: repository,
          amount: item.netAmount,
          currency: "USD",
          periodStart: period.start,
          periodEnd: period.end,
          kind: item.netAmount.startsWith("-") ? "credit" : "usage",
          status: "accrued",
          basis: "provider_charge",
          description: `${item.product} · ${item.sku}`,
          metadata: { product: item.product, sku: item.sku, unitType: item.unitType, repository: repository ?? null, apiStatus: "public_preview" },
        });
      }
    }
    return { items, hasMore: false, completeness: "complete", warnings: [{ code: "GITHUB_BILLING_PREVIEW", messageKey: "connections.githubPreview" }] };
  }

  private async requestText(path: string, credentials: z.infer<typeof credentialsSchema>) {
    const response = await this.fetchImpl(`https://api.github.com${path}`, {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${credentials.token}`, "x-github-api-version": "2026-03-10" },
      signal: AbortSignal.timeout(25_000),
    });
    if (response.ok) return response.text();
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const retryAfter = Number.isFinite(reset) ? new Date(reset * 1_000) : undefined;
    const code = response.status === 401 || response.status === 403 ? (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0" ? "GITHUB_RATE_LIMITED" : "GITHUB_CREDENTIALS_INVALID") : response.status === 429 ? "GITHUB_RATE_LIMITED" : response.status >= 500 ? "GITHUB_TEMPORARILY_UNAVAILABLE" : "GITHUB_REQUEST_FAILED";
    throw new ConnectorHttpError(response.status, code, `GitHub API request failed with status ${response.status}.`, retryAfter);
  }
}
