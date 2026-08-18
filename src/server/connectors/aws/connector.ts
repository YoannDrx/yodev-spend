import { createHash } from "node:crypto";
import { CostExplorerClient, GetCostAndUsageCommand, type GetCostAndUsageResponse } from "@aws-sdk/client-cost-explorer";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { z } from "zod";
import { ConnectorHttpError, type ConnectorAccount, type ConnectorCredentials, type ConnectorSyncContext, type ConnectorSyncResult, type NormalizedConnectorCost, type NormalizedExternalResource, type SpendConnector } from "../types";

const credentialsSchema = z.object({
  accountId: z.string().regex(/^\d{12}$/),
  accountName: z.string().min(1).max(180).optional(),
  roleArn: z.string().startsWith("arn:aws:iam::").max(240),
  externalId: z.string().min(2).max(1_224).optional(),
  allocationTagKey: z.string().min(1).max(128).optional(),
  costMetric: z.enum(["NetUnblendedCost", "AmortizedCost", "NetAmortizedCost"]).default("NetUnblendedCost"),
});

type AwsCredentials = z.infer<typeof credentialsSchema>;
type CostExplorerSender = Pick<CostExplorerClient, "send">;
type ClientFactory = (credentials: AwsCredentials) => CostExplorerSender;

function createClient(credentials: AwsCredentials) {
  return new CostExplorerClient({
    region: "us-east-1",
    credentials: fromTemporaryCredentials({
      params: {
        RoleArn: credentials.roleArn,
        RoleSessionName: "yodev-spend-cost-explorer",
        ExternalId: credentials.externalId,
      },
    }),
  });
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function stableId(parts: string[]) {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}

function tagValue(raw: string | undefined) {
  if (!raw) return null;
  const separator = raw.indexOf("$");
  const value = separator >= 0 ? raw.slice(separator + 1) : raw;
  return value || null;
}

function awsError(error: unknown): ConnectorHttpError {
  const candidate = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const status = candidate.$metadata?.httpStatusCode ?? 500;
  const code = candidate.name === "ThrottlingException" || status === 429
    ? "AWS_RATE_LIMITED"
    : status === 401 || status === 403 || candidate.name === "AccessDeniedException"
      ? "AWS_CREDENTIALS_INVALID"
      : status >= 500
        ? "AWS_TEMPORARILY_UNAVAILABLE"
        : "AWS_REQUEST_FAILED";
  return new ConnectorHttpError(status, code, `AWS Cost Explorer request failed with status ${status}.`);
}

export class AwsCostExplorerConnector implements SpendConnector {
  readonly providerSlug = "aws";
  readonly manifest = { providerSlug: "aws", capabilities: ["accounts", "resources", "costs"], authMode: "manual", minimumSyncIntervalMinutes: 720 } as const;
  readonly capabilities = { accounts: true, resources: true, subscriptions: false, plans: false, usage: false, accruedCosts: true, invoices: false } as const;

  constructor(private readonly clientFactory: ClientFactory = createClient) {}

  async validate(credentials: ConnectorCredentials): Promise<ConnectorAccount> {
    const input = credentialsSchema.parse(credentials);
    const to = new Date();
    to.setUTCHours(0, 0, 0, 0);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 1);
    await this.query(input, from, to);
    return { externalId: input.accountId, name: input.accountName ?? `AWS ${input.accountId}`, currency: "USD" };
  }

  async syncResources(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedExternalResource>> {
    const credentials = credentialsSchema.parse(context.credentials);
    if (!credentials.allocationTagKey) return {
      items: [],
      hasMore: false,
      completeness: "complete",
      warnings: [{ code: "AWS_ALLOCATION_TAG_MISSING", messageKey: "connections.awsAllocationTagMissing" }],
    };
    const pages = await this.query(credentials, context.from, context.to);
    const values = new Set<string>();
    for (const page of pages) for (const result of page.ResultsByTime ?? []) for (const group of result.Groups ?? []) {
      const value = tagValue(group.Keys?.[1]);
      if (value) values.add(value);
    }
    return {
      items: [...values].sort().map((value) => ({
        externalId: `tag:${credentials.allocationTagKey}:${value}`,
        type: "cost_allocation_tag",
        name: `${credentials.allocationTagKey}=${value}`,
        status: "active",
        metadata: { tagKey: credentials.allocationTagKey!, tagValue: value },
      })),
      hasMore: false,
      completeness: "complete",
      warnings: [],
    };
  }

  async syncAccruedCosts(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedConnectorCost>> {
    const credentials = credentialsSchema.parse(context.credentials);
    const pages = await this.query(credentials, context.from, context.to);
    const items: NormalizedConnectorCost[] = [];
    for (const page of pages) for (const period of page.ResultsByTime ?? []) for (const group of period.Groups ?? []) {
      const metric = group.Metrics?.[credentials.costMetric];
      if (!period.TimePeriod?.Start || !period.TimePeriod.End || !metric?.Amount || !metric.Unit) continue;
      const service = group.Keys?.[0] ?? "AWS";
      const value = tagValue(group.Keys?.[1]);
      items.push({
        externalId: stableId([credentials.accountId, period.TimePeriod.Start, period.TimePeriod.End, service, value ?? "unallocated", credentials.costMetric]),
        resourceExternalId: credentials.allocationTagKey && value ? `tag:${credentials.allocationTagKey}:${value}` : undefined,
        amount: metric.Amount,
        currency: metric.Unit.toUpperCase(),
        periodStart: new Date(`${period.TimePeriod.Start}T00:00:00.000Z`),
        periodEnd: new Date(`${period.TimePeriod.End}T00:00:00.000Z`),
        kind: metric.Amount.startsWith("-") ? "credit" : "usage",
        status: period.Estimated ? "estimated" : "accrued",
        basis: "provider_charge",
        description: service,
        metadata: { accountId: credentials.accountId, service, costMetric: credentials.costMetric, allocationTagKey: credentials.allocationTagKey ?? null, allocationTagValue: value },
      });
    }
    return { items, hasMore: false, completeness: "complete", warnings: [] };
  }

  private async query(credentials: AwsCredentials, from: Date, to: Date) {
    const client = this.clientFactory(credentials);
    const pages: GetCostAndUsageResponse[] = [];
    let nextPageToken: string | undefined;
    try {
      do {
        const response = await client.send(new GetCostAndUsageCommand({
          TimePeriod: { Start: dateOnly(from), End: dateOnly(to) },
          Granularity: "DAILY",
          Metrics: [credentials.costMetric],
          GroupBy: [
            { Type: "DIMENSION", Key: "SERVICE" },
            ...(credentials.allocationTagKey ? [{ Type: "TAG" as const, Key: credentials.allocationTagKey }] : []),
          ],
          NextPageToken: nextPageToken,
        }));
        pages.push(response);
        nextPageToken = response.NextPageToken;
      } while (nextPageToken);
      return pages;
    } catch (error) {
      throw awsError(error);
    }
  }
}
