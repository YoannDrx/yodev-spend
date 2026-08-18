import type { ConnectorCapabilities } from "@/db/schema";

export type ConnectorCapability = keyof ConnectorCapabilities;
export type ConnectorCredentials = Record<string, string>;

export type ManifestCapability = "accounts" | "resources" | "subscriptions" | "plans" | "usage" | "costs" | "invoices";

export type ConnectorManifest = {
  providerSlug: string;
  capabilities: readonly ManifestCapability[];
  authMode: "oauth" | "api_key" | "github_app" | "manual";
  minimumSyncIntervalMinutes: number;
};

export type ConnectorSyncResult<T> = {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  completeness: "complete" | "partial";
  warnings: Array<{ code: string; messageKey: string }>;
};

export type ConnectorAccount = {
  externalId: string;
  name: string;
  currency: string;
};

export type NormalizedExternalResource = {
  externalId: string;
  type: string;
  name: string;
  status: "active" | "inactive" | "deleted" | "unknown";
  region?: string;
  parentExternalId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type NormalizedConnectorCost = {
  externalId: string;
  resourceExternalId?: string;
  amount: string;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  kind: "subscription" | "usage" | "credit" | "tax" | "fee" | "refund" | "adjustment" | "manual";
  status: "commitment" | "accrued" | "estimated" | "final";
  basis: "invoice" | "provider_charge" | "usage_calculation" | "contract" | "manual";
  description?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type NormalizedCommitment = {
  externalId: string;
  name: string;
  amount?: string;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  quantity?: string;
  unit?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type NormalizedUsageSample = {
  externalId: string;
  resourceExternalId?: string;
  metricKey: string;
  quantity: string;
  unit: string;
  periodStart: Date;
  periodEnd: Date;
  completeness: "complete" | "partial";
  metadata?: Record<string, string | number | boolean | null>;
};

export type NormalizedInvoice = {
  externalId: string;
  invoiceNumber?: string;
  issuedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  total: string;
  currency: string;
  status: "draft" | "issued" | "paid" | "void";
  sourceUrl?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ConnectorSyncContext = {
  workspaceId: string;
  connectionId: string;
  credentials: ConnectorCredentials;
  from: Date;
  to: Date;
  cursor?: string;
};

export interface SpendConnector {
  readonly providerSlug: string;
  readonly manifest: ConnectorManifest;
  readonly capabilities: ConnectorCapabilities;
  validate(credentials: ConnectorCredentials): Promise<ConnectorAccount>;
  syncResources?(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedExternalResource>>;
  syncUsage?(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedUsageSample>>;
  syncAccruedCosts?(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedConnectorCost>>;
  syncCommitments?(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedCommitment>>;
  syncInvoices?(context: ConnectorSyncContext): Promise<ConnectorSyncResult<NormalizedInvoice>>;
}

export class ConnectorHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: Date,
  ) {
    super(message);
    this.name = "ConnectorHttpError";
  }
}
