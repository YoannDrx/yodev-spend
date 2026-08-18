import { z } from "zod";
import type {
  ConnectorAccount,
  ConnectorCredentials,
  ConnectorSyncContext,
  ConnectorSyncResult,
  NormalizedCommitment,
  NormalizedConnectorCost,
  NormalizedExternalResource,
  SpendConnector,
} from "../types";
import { ConnectorHttpError } from "../types";
import { normalizeVercelCommitment, normalizeVercelFocusCharge, parseJsonLines } from "./focus";

const credentialsSchema = z.object({
  token: z.string().min(20),
  teamId: z.string().min(3),
});

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  framework: z.string().nullable().optional(),
  nodeVersion: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
}).passthrough();

const projectsSchema = z.union([
  z.array(projectSchema),
  z.object({
    projects: z.array(projectSchema),
    pagination: z.object({ next: z.union([z.string(), z.number()]).nullable().optional() }).optional(),
  }),
]);

type Fetch = typeof fetch;

export class VercelConnector implements SpendConnector {
  readonly providerSlug = "vercel";
  // The production OAuth integration remains feature-gated. This manifest
  // truthfully describes the currently shipped manual access-token path.
  readonly manifest = {
    providerSlug: "vercel",
    capabilities: ["accounts", "resources", "subscriptions", "costs"],
    authMode: "manual",
    minimumSyncIntervalMinutes: 360,
  } as const;
  readonly capabilities = {
    accounts: true,
    resources: true,
    subscriptions: true,
    plans: false,
    usage: false,
    accruedCosts: true,
    invoices: false,
  } as const;

  constructor(private readonly fetchImpl: Fetch = fetch) {}

  async validate(credentials: ConnectorCredentials): Promise<ConnectorAccount> {
    const input = credentialsSchema.parse(credentials);
    const team = teamSchema.parse(await this.requestJson(`/v2/teams/${encodeURIComponent(input.teamId)}`, input));
    return { externalId: team.id, name: team.name, currency: "USD" };
  }

  async syncResources(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedExternalResource>> {
    const credentials = credentialsSchema.parse(context.credentials);
    const resources: NormalizedExternalResource[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ teamId: credentials.teamId, limit: "100" });
      if (cursor) params.set("from", cursor);
      const result = projectsSchema.parse(await this.requestJson(`/v10/projects?${params}`, credentials));
      const projects = Array.isArray(result) ? result : result.projects;
      resources.push(...projects.map((project) => ({
        externalId: project.id,
        type: "project",
        name: project.name,
        status: "active" as const,
        metadata: {
          framework: project.framework ?? null,
          nodeVersion: project.nodeVersion ?? null,
          createdAt: project.createdAt ?? null,
          updatedAt: project.updatedAt ?? null,
        },
      })));
      cursor = Array.isArray(result) || !result.pagination?.next ? undefined : String(result.pagination.next);
    } while (cursor);

    return { items: resources, hasMore: false, completeness: "complete", warnings: [] };
  }

  async syncAccruedCosts(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedConnectorCost>> {
    const credentials = credentialsSchema.parse(context.credentials);
    const params = new URLSearchParams({
      teamId: credentials.teamId,
      from: context.from.toISOString(),
      to: context.to.toISOString(),
    });
    const body = await this.requestText(`/v1/billing/charges?${params}`, credentials, "application/jsonl");
    return { items: parseJsonLines(body, normalizeVercelFocusCharge), hasMore: false, completeness: "complete", warnings: [] };
  }

  async syncCommitments(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedCommitment>> {
    const credentials = credentialsSchema.parse(context.credentials);
    const params = new URLSearchParams({ teamId: credentials.teamId });
    const body = await this.requestText(`/v1/billing/contract-commitments?${params}`, credentials, "application/jsonl");
    return { items: parseJsonLines(body, normalizeVercelCommitment), hasMore: false, completeness: "complete", warnings: [] };
  }

  private async requestJson(path: string, credentials: z.infer<typeof credentialsSchema>) {
    const response = await this.request(path, credentials, "application/json");
    return response.json() as Promise<unknown>;
  }

  private async requestText(path: string, credentials: z.infer<typeof credentialsSchema>, accept: string) {
    const response = await this.request(path, credentials, accept);
    return response.text();
  }

  private async request(path: string, credentials: z.infer<typeof credentialsSchema>, accept: string) {
    const response = await this.fetchImpl(`https://api.vercel.com${path}`, {
      headers: {
        accept,
        authorization: `Bearer ${credentials.token}`,
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (response.ok) return response;

    const resetHeader = response.headers.get("x-ratelimit-reset");
    const retryAfter = resetHeader && Number.isFinite(Number(resetHeader))
      ? new Date(Number(resetHeader) * 1_000)
      : undefined;
    const code = response.status === 401 || response.status === 403
      ? "VERCEL_CREDENTIALS_INVALID"
      : response.status === 429
        ? "VERCEL_RATE_LIMITED"
        : response.status >= 500
          ? "VERCEL_TEMPORARILY_UNAVAILABLE"
          : "VERCEL_REQUEST_FAILED";
    throw new ConnectorHttpError(response.status, code, `Vercel API request failed with status ${response.status}.`, retryAfter);
  }
}
