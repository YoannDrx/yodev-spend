import { createHash } from "node:crypto";
import { z } from "zod";
import { parseJsonPreservingDecimals } from "../decimal-json";
import { ConnectorHttpError, type ConnectorAccount, type ConnectorCredentials, type ConnectorSyncContext, type ConnectorSyncResult, type NormalizedConnectorCost, type NormalizedExternalResource, type SpendConnector } from "../types";

const credentialsSchema = z.object({
  adminKey: z.string().min(20),
  organizationId: z.string().min(3).max(240),
});
const projectSchema = z.object({ id: z.string(), name: z.string(), status: z.string().optional() }).passthrough();
const projectsPageSchema = z.object({ data: z.array(projectSchema), has_more: z.boolean(), last_id: z.string().nullable().optional() });
const costsPageSchema = z.object({
  data: z.array(z.object({
    start_time: z.number().int(),
    end_time: z.number().int(),
    results: z.array(z.object({
      amount: z.object({ value: z.string(), currency: z.string() }),
      line_item: z.string().nullable().optional(),
      project_id: z.string().nullable().optional(),
    })),
  })),
  has_more: z.boolean(),
  next_page: z.string().nullable().optional(),
});

type Fetch = typeof fetch;

function stableId(parts: Array<string | null | undefined>) {
  return createHash("sha256").update(parts.map((part) => part ?? "").join("\u001f")).digest("hex");
}

export class OpenAIConnector implements SpendConnector {
  readonly providerSlug = "openai";
  readonly manifest = { providerSlug: "openai", capabilities: ["accounts", "resources", "costs"], authMode: "api_key", minimumSyncIntervalMinutes: 360 } as const;
  readonly capabilities = { accounts: true, resources: true, subscriptions: false, plans: false, usage: false, accruedCosts: true, invoices: false } as const;

  constructor(private readonly fetchImpl: Fetch = fetch) {}

  async validate(credentials: ConnectorCredentials): Promise<ConnectorAccount> {
    const input = credentialsSchema.parse(credentials);
    await this.requestText("/v1/organization/projects?limit=1", input);
    return { externalId: input.organizationId, name: `OpenAI ${input.organizationId}`, currency: "USD" };
  }

  async syncResources(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedExternalResource>> {
    const credentials = credentialsSchema.parse(context.credentials);
    const items: NormalizedExternalResource[] = [];
    let after: string | undefined;
    do {
      const params = new URLSearchParams({ limit: "100" });
      if (after) params.set("after", after);
      const page = projectsPageSchema.parse(JSON.parse(await this.requestText(`/v1/organization/projects?${params}`, credentials)));
      items.push(...page.data.map((project) => ({
        externalId: project.id,
        type: "project",
        name: project.name,
        status: project.status === "archived" ? "inactive" as const : "active" as const,
      })));
      after = page.has_more ? page.last_id ?? undefined : undefined;
      if (page.has_more && !after) throw new ConnectorHttpError(502, "OPENAI_PARTIAL_RESPONSE", "OpenAI returned an incomplete project page.");
    } while (after);
    return { items, hasMore: false, completeness: "complete", warnings: [] };
  }

  async syncAccruedCosts(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedConnectorCost>> {
    const credentials = credentialsSchema.parse(context.credentials);
    const items: NormalizedConnectorCost[] = [];
    let page: string | undefined;
    do {
      const params = new URLSearchParams({
        start_time: String(Math.floor(context.from.getTime() / 1_000)),
        end_time: String(Math.floor(context.to.getTime() / 1_000)),
        bucket_width: "1d",
        limit: "180",
      });
      params.append("group_by", "project_id");
      params.append("group_by", "line_item");
      if (page) params.set("page", page);
      const parsed = costsPageSchema.parse(parseJsonPreservingDecimals(await this.requestText(`/v1/organization/costs?${params}`, credentials), ["value"]));
      for (const bucket of parsed.data) {
        for (const result of bucket.results) {
          const start = new Date(bucket.start_time * 1_000);
          const end = new Date(bucket.end_time * 1_000);
          items.push({
            externalId: stableId([String(bucket.start_time), String(bucket.end_time), result.project_id, result.line_item, result.amount.currency]),
            resourceExternalId: result.project_id ?? undefined,
            amount: result.amount.value,
            currency: result.amount.currency.toUpperCase(),
            periodStart: start,
            periodEnd: end,
            kind: result.amount.value.startsWith("-") ? "credit" : "usage",
            status: "accrued",
            basis: "provider_charge",
            description: result.line_item ?? "OpenAI usage",
            metadata: { lineItem: result.line_item ?? null, projectId: result.project_id ?? null },
          });
        }
      }
      page = parsed.has_more ? parsed.next_page ?? undefined : undefined;
      if (parsed.has_more && !page) throw new ConnectorHttpError(502, "OPENAI_PARTIAL_RESPONSE", "OpenAI returned an incomplete costs page.");
    } while (page);
    return { items, hasMore: false, completeness: "complete", warnings: [] };
  }

  private async requestText(path: string, credentials: z.infer<typeof credentialsSchema>) {
    const response = await this.fetchImpl(`https://api.openai.com${path}`, {
      headers: { accept: "application/json", authorization: `Bearer ${credentials.adminKey}`, "openai-organization": credentials.organizationId },
      signal: AbortSignal.timeout(25_000),
    });
    if (response.ok) return response.text();
    const retrySeconds = Number(response.headers.get("retry-after"));
    const retryAfter = Number.isFinite(retrySeconds) ? new Date(Date.now() + retrySeconds * 1_000) : undefined;
    const code = response.status === 401 || response.status === 403 ? "OPENAI_CREDENTIALS_INVALID" : response.status === 429 ? "OPENAI_RATE_LIMITED" : response.status >= 500 ? "OPENAI_TEMPORARILY_UNAVAILABLE" : "OPENAI_REQUEST_FAILED";
    throw new ConnectorHttpError(response.status, code, `OpenAI API request failed with status ${response.status}.`, retryAfter);
  }
}
