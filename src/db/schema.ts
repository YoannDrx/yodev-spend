import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  githubId: text("github_id").unique(),
  ...timestamps,
});

export const authOrganizations = pgTable("auth_organizations", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id").references(() => authOrganizations.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [index("auth_sessions_user_idx").on(table.userId), index("auth_sessions_expiry_idx").on(table.expiresAt)]);

export const authAccounts = pgTable("auth_accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: varchar("provider_id", { length: 64 }).notNull(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
}, (table) => [uniqueIndex("auth_accounts_provider_account_idx").on(table.providerId, table.accountId), index("auth_accounts_user_idx").on(table.userId)]);

export const authVerifications = pgTable("auth_verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, (table) => [index("auth_verifications_identifier_idx").on(table.identifier)]);

export const authMembers = pgTable("auth_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => authOrganizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).default("member").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("auth_members_org_user_idx").on(table.organizationId, table.userId), index("auth_members_user_idx").on(table.userId)]);

export const authInvitations = pgTable("auth_invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => authOrganizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  role: varchar("role", { length: 32 }).default("member").notNull(),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  inviterId: text("inviter_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("auth_invitations_org_idx").on(table.organizationId), index("auth_invitations_email_idx").on(table.email, table.status)]);

export const authRateLimits = pgTable("auth_rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").default(0).notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const clientStatusEnum = pgEnum("client_status", ["active", "archived"]);
export const projectStatusEnum = pgEnum("project_status", ["active", "maintenance", "archived"]);
export const repositorySourceEnum = pgEnum("repository_source", ["github"]);
export const githubInstallationStatusEnum = pgEnum("github_installation_status", ["active", "suspended", "deleted"]);
export const providerCategoryEnum = pgEnum("provider_category", ["hosting", "cloud", "database", "email", "observability", "analytics", "ai", "payments", "authentication", "storage", "dns", "maps", "messaging", "ci", "cms", "developer_tool", "other"]);
export const scanTypeEnum = pgEnum("scan_type", ["quick", "deep"]);
export const scanTriggerEnum = pgEnum("scan_trigger", ["manual", "scheduled", "initial"]);
export const scanStatusEnum = pgEnum("scan_status", ["pending", "running", "success", "partial", "failed", "skipped"]);
export const evidenceTypeEnum = pgEnum("evidence_type", ["package", "env_variable", "import", "config_file", "domain", "workflow", "iac", "manual"]);
export const integrationLifecycleEnum = pgEnum("integration_lifecycle", ["candidate", "active", "stale", "removed"]);
export const integrationReviewEnum = pgEnum("integration_review", ["pending", "confirmed", "ignored"]);
export const billingOwnerEnum = pgEnum("billing_owner", ["workspace", "client", "shared"]);
export const billingAccountStatusEnum = pgEnum("billing_account_status", ["active", "cancelled", "archived"]);
export const billingModelEnum = pgEnum("billing_model", ["free", "fixed_monthly", "fixed_yearly", "usage", "fixed_plus_usage", "manual"]);
export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year", "none"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "cancelled", "archived"]);
export const costKindEnum = pgEnum("cost_kind", ["subscription", "usage", "credit", "tax", "manual"]);
export const alertTypeEnum = pgEnum("alert_type", ["NEW_PROVIDER_DETECTED", "PROVIDER_STALE", "PROVIDER_REMOVED", "POSSIBLE_MIGRATION", "PAID_PROVIDER_WITHOUT_PROJECT", "PROJECT_PROVIDER_WITHOUT_BILLING", "RENEWAL_SOON", "SCAN_FAILED"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);
export const alertStatusEnum = pgEnum("alert_status", ["open", "resolved", "dismissed"]);

export const workspaceProfiles = pgTable("workspace_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().references(() => authOrganizations.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 140 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  baseCurrency: varchar("base_currency", { length: 3 }).default("EUR").notNull(),
  locale: varchar("locale", { length: 8 }).default("fr").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Europe/Paris").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("workspaces_org_idx").on(table.organizationId), uniqueIndex("workspaces_slug_idx").on(table.slug)]);

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 140 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  description: text("description"),
  status: clientStatusEnum("status").default("active").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("clients_workspace_slug_idx").on(table.workspaceId, table.slug), index("clients_workspace_status_idx").on(table.workspaceId, table.status)]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 140 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  description: text("description"),
  status: projectStatusEnum("status").default("active").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("projects_workspace_slug_idx").on(table.workspaceId, table.slug), index("projects_client_idx").on(table.workspaceId, table.clientId), index("projects_status_idx").on(table.workspaceId, table.status)]);

export const githubInstallations = pgTable("github_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  installationId: bigint("installation_id", { mode: "number" }).notNull(),
  accountLogin: varchar("account_login", { length: 140 }).notNull(),
  accountType: varchar("account_type", { length: 32 }).notNull(),
  status: githubInstallationStatusEnum("status").default("active").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("github_installations_workspace_installation_idx").on(table.workspaceId, table.installationId), index("github_installations_workspace_idx").on(table.workspaceId, table.status)]);

export const repositories = pgTable("repositories", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  githubInstallationId: uuid("github_installation_id").references(() => githubInstallations.id, { onDelete: "set null" }),
  source: repositorySourceEnum("source").default("github").notNull(),
  externalId: bigint("external_id", { mode: "number" }).notNull(),
  owner: varchar("owner", { length: 140 }).notNull(),
  name: varchar("name", { length: 140 }).notNull(),
  fullName: varchar("full_name", { length: 300 }).notNull(),
  defaultBranch: varchar("default_branch", { length: 140 }).default("main").notNull(),
  isPrivate: boolean("is_private").default(true).notNull(),
  htmlUrl: text("html_url").notNull(),
  lastKnownCommitSha: varchar("last_known_commit_sha", { length: 64 }),
  lastScannedCommitSha: varchar("last_scanned_commit_sha", { length: 64 }),
  lastSuccessfulScanAt: timestamp("last_successful_scan_at", { withTimezone: true }),
  lastScanAttemptAt: timestamp("last_scan_attempt_at", { withTimezone: true }),
  scanEnabled: boolean("scan_enabled").default(true).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("repositories_workspace_external_idx").on(table.workspaceId, table.source, table.externalId), index("repositories_project_idx").on(table.workspaceId, table.projectId), index("repositories_scan_idx").on(table.workspaceId, table.scanEnabled, table.lastSuccessfulScanAt)]);

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  category: providerCategoryEnum("category").notNull(),
  websiteUrl: text("website_url"),
  discoverySupported: boolean("discovery_supported").default(true).notNull(),
  billingSupported: boolean("billing_supported").default(false).notNull(),
  ...timestamps,
});

export const scanRuns = pgTable("scan_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "restrict" }),
  type: scanTypeEnum("type").notNull(),
  trigger: scanTriggerEnum("trigger").notNull(),
  status: scanStatusEnum("status").default("pending").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 180 }),
  commitSha: varchar("commit_sha", { length: 64 }),
  fingerprintVersion: varchar("fingerprint_version", { length: 32 }).default("1").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorCode: varchar("error_code", { length: 80 }),
  errorMessage: text("error_message"),
  filesInspected: integer("files_inspected").default(0).notNull(),
  bytesInspected: integer("bytes_inspected").default(0).notNull(),
  evidenceCount: integer("evidence_count").default(0).notNull(),
  warnings: jsonb("warnings").$type<string[]>().default([]).notNull(),
  ...timestamps,
}, (table) => [index("scan_runs_workspace_repository_idx").on(table.workspaceId, table.repositoryId, table.createdAt), uniqueIndex("scan_runs_idempotency_idx").on(table.workspaceId, table.idempotencyKey).where(sql`${table.idempotencyKey} is not null`), uniqueIndex("scan_runs_active_repository_idx").on(table.repositoryId).where(sql`${table.status} in ('pending', 'running')`)]);

export const detectionEvidence = pgTable("detection_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  scanRunId: uuid("scan_run_id").notNull().references(() => scanRuns.id, { onDelete: "restrict" }),
  repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  type: evidenceTypeEnum("type").notNull(),
  key: text("key").notNull(),
  filePath: text("file_path"),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  weight: integer("weight").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("evidence_repository_provider_idx").on(table.workspaceId, table.repositoryId, table.providerId), index("evidence_scan_idx").on(table.scanRunId)]);

export const repositoryProviderObservations = pgTable("repository_provider_observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  confidence: integer("confidence").default(0).notNull(),
  present: boolean("present").default(false).notNull(),
  consecutiveAbsences: integer("consecutive_absences").default(0).notNull(),
  firstAbsentAt: timestamp("first_absent_at", { withTimezone: true }),
  lastDetectedAt: timestamp("last_detected_at", { withTimezone: true }),
  lastSuccessfulScanRunId: uuid("last_successful_scan_run_id").references(() => scanRuns.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [uniqueIndex("repository_provider_observation_idx").on(table.workspaceId, table.repositoryId, table.providerId), index("observations_provider_idx").on(table.workspaceId, table.providerId, table.present), check("observation_confidence_check", sql`${table.confidence} between 0 and 100`), check("observation_absences_check", sql`${table.consecutiveAbsences} >= 0`)]);

export const projectIntegrations = pgTable("project_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  lifecycleStatus: integrationLifecycleEnum("lifecycle_status").default("candidate").notNull(),
  reviewStatus: integrationReviewEnum("review_status").default("pending").notNull(),
  confidence: integer("confidence").default(0).notNull(),
  evidenceSignature: varchar("evidence_signature", { length: 64 }),
  firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).defaultNow().notNull(),
  lastDetectedAt: timestamp("last_detected_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  ignoredAt: timestamp("ignored_at", { withTimezone: true }),
  staleAt: timestamp("stale_at", { withTimezone: true }),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("project_integrations_unique_idx").on(table.workspaceId, table.projectId, table.providerId), index("project_integrations_status_idx").on(table.workspaceId, table.lifecycleStatus, table.reviewStatus), index("project_integrations_provider_idx").on(table.workspaceId, table.providerId), check("integration_confidence_check", sql`${table.confidence} between 0 and 100`)]);

export const integrationEvents = pgTable("integration_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  integrationId: uuid("integration_id").notNull().references(() => projectIntegrations.id, { onDelete: "restrict" }),
  actorUserId: text("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("integration_events_integration_idx").on(table.workspaceId, table.integrationId, table.createdAt)]);

export const billingAccounts = pgTable("billing_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  ownerType: billingOwnerEnum("owner_type").default("workspace").notNull(),
  status: billingAccountStatusEnum("status").default("active").notNull(),
  defaultCurrency: varchar("default_currency", { length: 3 }).default("EUR").notNull(),
  source: varchar("source", { length: 64 }).default("manual").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("billing_accounts_workspace_idx").on(table.workspaceId, table.status), index("billing_accounts_provider_idx").on(table.workspaceId, table.providerId)]);

export const billingAccountProjects = pgTable("billing_account_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  allocationBps: integer("allocation_bps").default(10000).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("billing_account_project_unique_idx").on(table.workspaceId, table.billingAccountId, table.projectId), index("billing_project_idx").on(table.workspaceId, table.projectId), check("billing_allocation_bps_check", sql`${table.allocationBps} between 0 and 10000`)]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  billingModel: billingModelEnum("billing_model").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  billingInterval: billingIntervalEnum("billing_interval").default("none").notNull(),
  renewalDate: timestamp("renewal_date", { withTimezone: true }),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("subscriptions_workspace_status_idx").on(table.workspaceId, table.status), index("subscriptions_account_idx").on(table.workspaceId, table.billingAccountId)]);

export const costEntries = pgTable("cost_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "restrict" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  kind: costKindEnum("kind").notNull(),
  source: varchar("source", { length: 64 }).default("manual").notNull(),
  externalId: varchar("external_id", { length: 180 }),
  description: text("description"),
  ...timestamps,
}, (table) => [index("cost_entries_workspace_period_idx").on(table.workspaceId, table.periodStart, table.periodEnd), uniqueIndex("cost_entries_source_external_idx").on(table.workspaceId, table.source, table.externalId).where(sql`${table.externalId} is not null`), check("cost_entry_period_check", sql`${table.periodEnd} >= ${table.periodStart}`)]);

export const alerts = pgTable("alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  type: alertTypeEnum("type").notNull(),
  severity: alertSeverityEnum("severity").default("warning").notNull(),
  status: alertStatusEnum("status").default("open").notNull(),
  dedupeKey: varchar("dedupe_key", { length: 220 }).notNull(),
  providerId: uuid("provider_id").references(() => providers.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").references(() => billingAccounts.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("alerts_open_dedupe_idx").on(table.workspaceId, table.dedupeKey).where(sql`${table.status} = 'open'`), index("alerts_workspace_status_idx").on(table.workspaceId, table.status, table.severity)]);
