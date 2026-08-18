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
export const costKindEnum = pgEnum("cost_kind", ["subscription", "usage", "credit", "tax", "fee", "refund", "adjustment", "manual"]);
export const costAmountStatusEnum = pgEnum("cost_amount_status", ["commitment", "accrued", "estimated", "final"]);
export const costAmountBasisEnum = pgEnum("cost_amount_basis", ["invoice", "provider_charge", "usage_calculation", "contract", "manual"]);
export const providerConnectionStatusEnum = pgEnum("provider_connection_status", ["pending", "active", "invalid", "rate_limited", "error", "archived"]);
export const providerAuthTypeEnum = pgEnum("provider_auth_type", ["oauth2", "api_key", "admin_key", "service_account", "access_token", "email", "manual"]);
export const externalResourceStatusEnum = pgEnum("external_resource_status", ["active", "inactive", "deleted", "unknown"]);
export const allocationMethodEnum = pgEnum("allocation_method", ["direct", "equal", "usage_proportional", "cost_proportional", "manual", "workspace_unallocated"]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "running", "success", "partial", "failed", "rate_limited", "skipped"]);
export const syncCapabilityEnum = pgEnum("sync_capability", ["accounts", "resources", "subscriptions", "plans", "usage", "accrued_costs", "invoices"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["estimated", "issued", "paid", "void", "refunded"]);
export const optimizationStatusEnum = pgEnum("optimization_status", ["open", "accepted", "ignored", "snoozed", "resolved"]);
export const optimizationConfidenceEnum = pgEnum("optimization_confidence", ["low", "medium", "high"]);
export const commercialPlanCodeEnum = pgEnum("commercial_plan_code", ["solo", "studio"]);
export const commercialBillingIntervalEnum = pgEnum("commercial_billing_interval", ["month", "year"]);
export const commercialSubscriptionStatusEnum = pgEnum("commercial_subscription_status", ["incomplete", "trialing", "active", "past_due", "unpaid", "cancelled"]);
export const workspaceCommercialStatusEnum = pgEnum("workspace_commercial_status", ["private", "pending_checkout", "trialing", "active", "past_due", "cancelled", "deletion_scheduled"]);
export const commercialWebhookStatusEnum = pgEnum("commercial_webhook_status", ["pending", "processing", "processed", "failed", "ignored"]);
export const betaInvitationStatusEnum = pgEnum("beta_invitation_status", ["pending", "reserved", "consumed", "expired", "revoked"]);
export const workspaceQuotaStatusEnum = pgEnum("workspace_quota_status", ["within_limit", "grace", "restricted"]);
export const termsDocumentEnum = pgEnum("terms_document", ["terms", "privacy", "dpa"]);
export const deletionJobStatusEnum = pgEnum("deletion_job_status", ["scheduled", "export_window", "purging", "completed", "failed", "cancelled"]);
export const auditActorTypeEnum = pgEnum("audit_actor_type", ["user", "system", "support"]);
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
  commercialStatus: workspaceCommercialStatusEnum("commercial_status").default("private").notNull(),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("workspaces_org_idx").on(table.organizationId), uniqueIndex("workspaces_slug_idx").on(table.slug)]);

export type CommercialPlanFeatures = {
  clientAllocations: boolean;
  collaboration: boolean;
  csvExports: boolean;
  pdfReports: boolean;
};

export const commercialPlans = pgTable("commercial_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: commercialPlanCodeEnum("code").notNull(),
  version: integer("version").notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  monthlyPriceMinor: bigint("monthly_price_minor", { mode: "bigint" }).notNull(),
  annualPriceMinor: bigint("annual_price_minor", { mode: "bigint" }).notNull(),
  memberLimit: integer("member_limit").notNull(),
  projectLimit: integer("project_limit").notNull(),
  connectionLimit: integer("connection_limit").notNull(),
  historyMonths: integer("history_months").notNull(),
  features: jsonb("features").$type<CommercialPlanFeatures>().notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("commercial_plans_code_version_idx").on(table.code, table.version),
  uniqueIndex("commercial_plans_active_code_idx").on(table.code).where(sql`${table.active} = true`),
  check("commercial_plans_price_check", sql`${table.monthlyPriceMinor} >= 0 and ${table.annualPriceMinor} >= 0`),
  check("commercial_plans_limits_check", sql`${table.memberLimit} > 0 and ${table.projectLimit} > 0 and ${table.connectionLimit} > 0 and ${table.historyMonths} > 0`),
]);

export const workspaceBillingProfiles = pgTable("workspace_billing_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  legalName: varchar("legal_name", { length: 240 }).notNull(),
  billingEmail: varchar("billing_email", { length: 320 }).notNull(),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  addressLine1: varchar("address_line_1", { length: 240 }).notNull(),
  addressLine2: varchar("address_line_2", { length: 240 }),
  postalCode: varchar("postal_code", { length: 32 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  vatId: varchar("vat_id", { length: 40 }),
  businessConfirmedAt: timestamp("business_confirmed_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("workspace_billing_profiles_workspace_idx").on(table.workspaceId),
  index("workspace_billing_profiles_country_idx").on(table.countryCode),
]);

export const workspaceSubscriptions = pgTable("workspace_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  commercialPlanId: uuid("commercial_plan_id").notNull().references(() => commercialPlans.id, { onDelete: "restrict" }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 120 }).notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 }).notNull(),
  stripePriceId: varchar("stripe_price_id", { length: 120 }).notNull(),
  status: commercialSubscriptionStatusEnum("status").notNull(),
  billingInterval: commercialBillingIntervalEnum("billing_interval").notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStartsAt: timestamp("current_period_starts_at", { withTimezone: true }),
  currentPeriodEndsAt: timestamp("current_period_ends_at", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  paymentGraceEndsAt: timestamp("payment_grace_ends_at", { withTimezone: true }),
  lastStripeEventCreatedAt: integer("last_stripe_event_created_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("workspace_subscriptions_stripe_idx").on(table.stripeSubscriptionId),
  index("workspace_subscriptions_workspace_idx").on(table.workspaceId, table.status),
  index("workspace_subscriptions_customer_idx").on(table.stripeCustomerId),
]);

export const commercialWebhookEvents = pgTable("commercial_webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  stripeEventId: varchar("stripe_event_id", { length: 120 }).notNull(),
  eventType: varchar("event_type", { length: 120 }).notNull(),
  stripeEventCreatedAt: integer("stripe_event_created_at").notNull(),
  status: commercialWebhookStatusEnum("status").default("pending").notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  errorCode: varchar("error_code", { length: 100 }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("commercial_webhook_events_stripe_idx").on(table.stripeEventId),
  index("commercial_webhook_events_workspace_idx").on(table.workspaceId, table.createdAt),
]);

export const betaInvitations = pgTable("beta_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  planCode: commercialPlanCodeEnum("plan_code").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  status: betaInvitationStatusEnum("status").default("pending").notNull(),
  invitedByUserId: text("invited_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  reservedByUserId: text("reserved_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  consumedByUserId: text("consumed_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  workspaceId: uuid("workspace_id").references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  reservedAt: timestamp("reserved_at", { withTimezone: true }),
  reservationExpiresAt: timestamp("reservation_expires_at", { withTimezone: true }),
  checkoutSessionId: varchar("checkout_session_id", { length: 160 }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("beta_invitations_token_idx").on(table.tokenHash),
  uniqueIndex("beta_invitations_checkout_session_idx").on(table.checkoutSessionId).where(sql`${table.checkoutSessionId} is not null`),
  index("beta_invitations_email_status_idx").on(table.email, table.status),
  index("beta_invitations_workspace_idx").on(table.workspaceId),
]);

export const workspaceQuotaStates = pgTable("workspace_quota_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  commercialPlanId: uuid("commercial_plan_id").notNull().references(() => commercialPlans.id, { onDelete: "restrict" }),
  status: workspaceQuotaStatusEnum("status").default("within_limit").notNull(),
  memberCount: integer("member_count").default(0).notNull(),
  projectCount: integer("project_count").default(0).notNull(),
  connectionCount: integer("connection_count").default(0).notNull(),
  exceededAt: timestamp("exceeded_at", { withTimezone: true }),
  graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("workspace_quota_states_workspace_idx").on(table.workspaceId),
  index("workspace_quota_states_status_idx").on(table.status, table.graceEndsAt),
  check("workspace_quota_counts_check", sql`${table.memberCount} >= 0 and ${table.projectCount} >= 0 and ${table.connectionCount} >= 0`),
]);

export const commercialTermsAcceptances = pgTable("commercial_terms_acceptances", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "restrict" }),
  document: termsDocumentEnum("document").notNull(),
  version: varchar("version", { length: 40 }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("commercial_terms_acceptances_unique_idx").on(table.workspaceId, table.userId, table.document, table.version),
  index("commercial_terms_acceptances_workspace_idx").on(table.workspaceId, table.acceptedAt),
]);

export const dataDeletionJobs = pgTable("data_deletion_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  requestedByUserId: text("requested_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  status: deletionJobStatusEnum("status").default("scheduled").notNull(),
  credentialsRevokedAt: timestamp("credentials_revoked_at", { withTimezone: true }),
  exportAvailableUntil: timestamp("export_available_until", { withTimezone: true }).notNull(),
  purgeScheduledAt: timestamp("purge_scheduled_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorCode: varchar("error_code", { length: 100 }),
  ...timestamps,
}, (table) => [
  uniqueIndex("data_deletion_jobs_active_idx").on(table.workspaceId).where(sql`${table.status} in ('scheduled', 'export_window', 'purging')`),
  index("data_deletion_jobs_schedule_idx").on(table.status, table.purgeScheduledAt),
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  actorType: auditActorTypeEnum("actor_type").notNull(),
  actorUserId: text("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  targetType: varchar("target_type", { length: 80 }),
  targetId: varchar("target_id", { length: 180 }),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_events_workspace_idx").on(table.workspaceId, table.createdAt), index("audit_events_action_idx").on(table.workspaceId, table.action)]);

export const fxRates = pgTable("fx_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  baseCurrency: varchar("base_currency", { length: 3 }).notNull(),
  quoteCurrency: varchar("quote_currency", { length: 3 }).notNull(),
  rateScaled: bigint("rate_scaled", { mode: "bigint" }).notNull(),
  rateScale: integer("rate_scale").default(8).notNull(),
  rateAt: timestamp("rate_at", { withTimezone: true }).notNull(),
  source: varchar("source", { length: 40 }).default("ecb").notNull(),
  sourceUrl: text("source_url").notNull(),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("fx_rates_identity_idx").on(table.baseCurrency, table.quoteCurrency, table.rateAt, table.source),
  index("fx_rates_lookup_idx").on(table.baseCurrency, table.quoteCurrency, table.rateAt),
  check("fx_rates_scale_check", sql`${table.rateScale} between 0 and 18`),
  check("fx_rates_positive_check", sql`${table.rateScaled} > 0`),
]);

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
  repositorySelection: varchar("repository_selection", { length: 16 }),
  permissions: jsonb("permissions").$type<Record<string, string>>(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedByUserId: text("verified_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  status: githubInstallationStatusEnum("status").default("active").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("github_installations_installation_idx").on(table.installationId), index("github_installations_workspace_idx").on(table.workspaceId, table.status)]);

export const githubInstallStates = pgTable("github_install_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "cascade" }),
  initiatedByUserId: text("initiated_by_user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 2 }).default("fr").notNull(),
  stateHash: varchar("state_hash", { length: 64 }).notNull(),
  candidateInstallationId: bigint("candidate_installation_id", { mode: "number" }),
  pkceVerifierCiphertext: text("pkce_verifier_ciphertext").notNull(),
  pkceVerifierIv: varchar("pkce_verifier_iv", { length: 32 }).notNull(),
  pkceVerifierTag: varchar("pkce_verifier_tag", { length: 32 }).notNull(),
  encryptionKeyVersion: integer("encryption_key_version").default(1).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("github_install_states_state_hash_idx").on(table.stateHash),
  index("github_install_states_workspace_idx").on(table.workspaceId, table.expiresAt),
  index("github_install_states_expiry_idx").on(table.expiresAt, table.consumedAt),
]);

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

export type ConnectorCapabilities = {
  accounts: boolean;
  resources: boolean;
  subscriptions: boolean;
  plans: boolean;
  usage: boolean;
  accruedCosts: boolean;
  invoices: boolean;
};

export const providerConnections = pgTable("provider_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  authType: providerAuthTypeEnum("auth_type").notNull(),
  status: providerConnectionStatusEnum("status").default("pending").notNull(),
  externalAccountId: varchar("external_account_id", { length: 240 }),
  externalAccountName: varchar("external_account_name", { length: 240 }),
  capabilities: jsonb("capabilities").$type<ConnectorCapabilities>().notNull(),
  credentialCiphertext: text("credential_ciphertext"),
  credentialIv: varchar("credential_iv", { length: 64 }),
  credentialTag: varchar("credential_tag", { length: 64 }),
  credentialKeyVersion: integer("credential_key_version").default(1).notNull(),
  credentialExpiresAt: timestamp("credential_expires_at", { withTimezone: true }),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
  lastErrorCode: varchar("last_error_code", { length: 100 }),
  createdByUserId: text("created_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("provider_connections_workspace_idx").on(table.workspaceId, table.status),
  index("provider_connections_provider_idx").on(table.workspaceId, table.providerId),
  uniqueIndex("provider_connections_external_account_idx").on(table.workspaceId, table.providerId, table.externalAccountId).where(sql`${table.externalAccountId} is not null and ${table.archivedAt} is null`),
  check("provider_connections_credentials_check", sql`(${table.credentialCiphertext} is null and ${table.credentialIv} is null and ${table.credentialTag} is null) or (${table.credentialCiphertext} is not null and ${table.credentialIv} is not null and ${table.credentialTag} is not null)`),
]);

export const externalResources = pgTable("external_resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  connectionId: uuid("connection_id").notNull().references(() => providerConnections.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  externalId: varchar("external_id", { length: 240 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }).notNull(),
  name: varchar("name", { length: 240 }).notNull(),
  region: varchar("region", { length: 80 }),
  status: externalResourceStatusEnum("status").default("unknown").notNull(),
  parentExternalId: varchar("parent_external_id", { length: 240 }),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("external_resources_connection_external_idx").on(table.workspaceId, table.connectionId, table.externalId),
  index("external_resources_provider_idx").on(table.workspaceId, table.providerId, table.status),
]);

export const externalResourceProjects = pgTable("external_resource_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  externalResourceId: uuid("external_resource_id").notNull().references(() => externalResources.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  allocationBps: integer("allocation_bps").default(10000).notNull(),
  allocationMethod: allocationMethodEnum("allocation_method").default("direct").notNull(),
  confirmedByUser: boolean("confirmed_by_user").default(false).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("external_resource_projects_active_idx").on(table.workspaceId, table.externalResourceId, table.projectId).where(sql`${table.effectiveTo} is null`),
  index("external_resource_projects_project_idx").on(table.workspaceId, table.projectId),
  check("external_resource_allocation_check", sql`${table.allocationBps} between 0 and 10000`),
]);

export const connectorSyncRuns = pgTable("connector_sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  connectionId: uuid("connection_id").notNull().references(() => providerConnections.id, { onDelete: "restrict" }),
  capability: syncCapabilityEnum("capability").notNull(),
  status: syncStatusEnum("status").default("pending").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 240 }).notNull(),
  requestedFrom: timestamp("requested_from", { withTimezone: true }),
  requestedTo: timestamp("requested_to", { withTimezone: true }),
  coveredFrom: timestamp("covered_from", { withTimezone: true }),
  coveredTo: timestamp("covered_to", { withTimezone: true }),
  cursorBefore: text("cursor_before"),
  cursorAfter: text("cursor_after"),
  recordsRead: integer("records_read").default(0).notNull(),
  recordsWritten: integer("records_written").default(0).notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  errorCode: varchar("error_code", { length: 100 }),
  errorMessage: text("error_message"),
  ...timestamps,
}, (table) => [
  uniqueIndex("connector_sync_runs_idempotency_idx").on(table.workspaceId, table.idempotencyKey),
  uniqueIndex("connector_sync_runs_active_idx").on(table.connectionId, table.capability).where(sql`${table.status} in ('pending', 'running')`),
  index("connector_sync_runs_connection_idx").on(table.workspaceId, table.connectionId, table.createdAt),
  check("connector_sync_period_check", sql`${table.requestedFrom} is null or ${table.requestedTo} is null or ${table.requestedTo} >= ${table.requestedFrom}`),
]);

export const providerPlanVersions = pgTable("provider_plan_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  connectionId: uuid("connection_id").references(() => providerConnections.id, { onDelete: "set null" }),
  externalId: varchar("external_id", { length: 240 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  billingInterval: billingIntervalEnum("billing_interval").default("none").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  source: varchar("source", { length: 80 }).notNull(),
  sourceUrl: text("source_url"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("provider_plan_versions_global_identity_idx").on(table.providerId, table.externalId, table.effectiveFrom).where(sql`${table.workspaceId} is null`),
  uniqueIndex("provider_plan_versions_workspace_identity_idx").on(table.workspaceId, table.providerId, table.externalId, table.effectiveFrom).where(sql`${table.workspaceId} is not null`),
  index("provider_plan_versions_workspace_idx").on(table.workspaceId, table.providerId),
  index("provider_plan_versions_provider_idx").on(table.providerId, table.effectiveTo),
  check("provider_plan_versions_connection_scope_check", sql`(${table.connectionId} is null) or (${table.workspaceId} is not null)`),
]);

export const providerPlanEntitlements = pgTable("provider_plan_entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  planVersionId: uuid("plan_version_id").notNull().references(() => providerPlanVersions.id, { onDelete: "cascade" }),
  metricKey: varchar("metric_key", { length: 120 }).notNull(),
  includedQuantityScaled: bigint("included_quantity_scaled", { mode: "bigint" }),
  quantityScale: integer("quantity_scale").default(0).notNull(),
  unit: varchar("unit", { length: 80 }).notNull(),
  limitType: varchar("limit_type", { length: 32 }).default("soft").notNull(),
  overageAmountScaled: bigint("overage_amount_scaled", { mode: "bigint" }),
  overageAmountScale: integer("overage_amount_scale").default(2).notNull(),
  overageCurrency: varchar("overage_currency", { length: 3 }),
  overagePerQuantityScaled: bigint("overage_per_quantity_scaled", { mode: "bigint" }),
  overagePerQuantityScale: integer("overage_per_quantity_scale").default(0).notNull(),
  scope: varchar("scope", { length: 32 }).default("account").notNull(),
  requiredFeature: varchar("required_feature", { length: 160 }),
  ...timestamps,
}, (table) => [
  uniqueIndex("provider_plan_entitlements_metric_idx").on(table.planVersionId, table.metricKey),
  check("provider_plan_entitlements_quantity_scale_check", sql`${table.quantityScale} between 0 and 18`),
  check("provider_plan_entitlements_amount_scale_check", sql`${table.overageAmountScale} between 0 and 18`),
]);

export const usageMetrics = pgTable("usage_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  key: varchar("key", { length: 120 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  unit: varchar("unit", { length: 80 }).notNull(),
  aggregatingMethod: varchar("aggregating_method", { length: 32 }).default("sum").notNull(),
  billable: boolean("billable").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("usage_metrics_provider_key_idx").on(table.providerId, table.key)]);

export const usageSamples = pgTable("usage_samples", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  connectionId: uuid("connection_id").notNull().references(() => providerConnections.id, { onDelete: "restrict" }),
  externalResourceId: uuid("external_resource_id").references(() => externalResources.id, { onDelete: "set null" }),
  metricId: uuid("metric_id").notNull().references(() => usageMetrics.id, { onDelete: "restrict" }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  quantityScaled: bigint("quantity_scaled", { mode: "bigint" }).notNull(),
  quantityScale: integer("quantity_scale").default(0).notNull(),
  source: varchar("source", { length: 80 }).notNull(),
  externalId: varchar("external_id", { length: 240 }).notNull(),
  quality: varchar("quality", { length: 32 }).default("provider_reported").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("usage_samples_source_external_idx").on(table.workspaceId, table.connectionId, table.externalId),
  index("usage_samples_period_idx").on(table.workspaceId, table.periodStart, table.periodEnd),
  index("usage_samples_resource_metric_idx").on(table.workspaceId, table.externalResourceId, table.metricId),
  check("usage_samples_period_check", sql`${table.periodEnd} >= ${table.periodStart}`),
  check("usage_samples_scale_check", sql`${table.quantityScale} between 0 and 18`),
]);

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
  connectionId: uuid("connection_id").references(() => providerConnections.id, { onDelete: "set null" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  ownerType: billingOwnerEnum("owner_type").default("workspace").notNull(),
  status: billingAccountStatusEnum("status").default("active").notNull(),
  defaultCurrency: varchar("default_currency", { length: 3 }).default("EUR").notNull(),
  source: varchar("source", { length: 64 }).default("manual").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("billing_accounts_workspace_idx").on(table.workspaceId, table.status),
  index("billing_accounts_provider_idx").on(table.workspaceId, table.providerId),
  index("billing_accounts_connection_idx").on(table.workspaceId, table.connectionId),
  check("billing_accounts_client_owner_check", sql`(${table.ownerType} = 'client' and ${table.clientId} is not null) or (${table.ownerType} <> 'client' and ${table.clientId} is null)`),
]);

export const billingAccountProjects = pgTable("billing_account_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  allocationBps: integer("allocation_bps").default(10000).notNull(),
  allocationMethod: allocationMethodEnum("allocation_method").default("equal").notNull(),
  confirmedByUser: boolean("confirmed_by_user").default(false).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("billing_account_projects_active_idx").on(table.workspaceId, table.billingAccountId, table.projectId).where(sql`${table.effectiveTo} is null`),
  index("billing_project_idx").on(table.workspaceId, table.projectId),
  index("billing_account_projects_period_idx").on(table.workspaceId, table.billingAccountId, table.effectiveFrom, table.effectiveTo),
  check("billing_allocation_bps_check", sql`${table.allocationBps} between 0 and 10000`),
  check("billing_allocation_period_check", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "restrict" }),
  planVersionId: uuid("plan_version_id").references(() => providerPlanVersions.id, { onDelete: "set null" }),
  name: varchar("name", { length: 180 }).notNull(),
  billingModel: billingModelEnum("billing_model").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  billingInterval: billingIntervalEnum("billing_interval").default("none").notNull(),
  renewalDate: timestamp("renewal_date", { withTimezone: true }),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  source: varchar("source", { length: 64 }).default("manual").notNull(),
  externalId: varchar("external_id", { length: 240 }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("subscriptions_workspace_status_idx").on(table.workspaceId, table.status), index("subscriptions_account_idx").on(table.workspaceId, table.billingAccountId), uniqueIndex("subscriptions_source_external_idx").on(table.workspaceId, table.source, table.externalId).where(sql`${table.externalId} is not null`)]);

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "restrict" }),
  connectionId: uuid("connection_id").references(() => providerConnections.id, { onDelete: "set null" }),
  externalResourceId: uuid("external_resource_id").references(() => externalResources.id, { onDelete: "set null" }),
  externalId: varchar("external_id", { length: 240 }).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 180 }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  subtotalMinor: bigint("subtotal_minor", { mode: "bigint" }),
  taxMinor: bigint("tax_minor", { mode: "bigint" }),
  totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
  status: invoiceStatusEnum("status").default("issued").notNull(),
  source: varchar("source", { length: 80 }).notNull(),
  documentHash: varchar("document_hash", { length: 128 }),
  sourceUrl: text("source_url"),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("invoices_source_external_idx").on(table.workspaceId, table.source, table.externalId),
  uniqueIndex("invoices_document_hash_idx").on(table.workspaceId, table.documentHash).where(sql`${table.documentHash} is not null`),
  index("invoices_account_period_idx").on(table.workspaceId, table.billingAccountId, table.periodStart, table.periodEnd),
  check("invoices_period_check", sql`${table.periodEnd} >= ${table.periodStart}`),
]);

export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  externalResourceId: uuid("external_resource_id").references(() => externalResources.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  externalId: varchar("external_id", { length: 240 }).notNull(),
  description: text("description").notNull(),
  productCode: varchar("product_code", { length: 180 }),
  quantityScaled: bigint("quantity_scaled", { mode: "bigint" }),
  quantityScale: integer("quantity_scale").default(0).notNull(),
  unit: varchar("unit", { length: 80 }),
  unitAmountScaled: bigint("unit_amount_scaled", { mode: "bigint" }),
  unitAmountScale: integer("unit_amount_scale").default(2).notNull(),
  grossMinor: bigint("gross_minor", { mode: "bigint" }),
  discountMinor: bigint("discount_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  netMinor: bigint("net_minor", { mode: "bigint" }).notNull(),
  taxMinor: bigint("tax_minor", { mode: "bigint" }),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("invoice_lines_external_idx").on(table.invoiceId, table.externalId),
  index("invoice_lines_resource_idx").on(table.workspaceId, table.externalResourceId),
  check("invoice_lines_quantity_scale_check", sql`${table.quantityScale} between 0 and 18`),
  check("invoice_lines_amount_scale_check", sql`${table.unitAmountScale} between 0 and 18`),
]);

export const costEntries = pgTable("cost_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "restrict" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  connectionId: uuid("connection_id").references(() => providerConnections.id, { onDelete: "set null" }),
  externalResourceId: uuid("external_resource_id").references(() => externalResources.id, { onDelete: "set null" }),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  invoiceLineId: uuid("invoice_line_id").references(() => invoiceLines.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  exactAmountScaled: bigint("exact_amount_scaled", { mode: "bigint" }),
  exactAmountScale: integer("exact_amount_scale").default(2).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  kind: costKindEnum("kind").notNull(),
  amountStatus: costAmountStatusEnum("amount_status").default("final").notNull(),
  amountBasis: costAmountBasisEnum("amount_basis").default("manual").notNull(),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  supersededByInvoiceId: uuid("superseded_by_invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  source: varchar("source", { length: 64 }).default("manual").notNull(),
  externalId: varchar("external_id", { length: 180 }),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  ...timestamps,
}, (table) => [index("cost_entries_workspace_period_idx").on(table.workspaceId, table.periodStart, table.periodEnd), index("cost_entries_resource_idx").on(table.workspaceId, table.externalResourceId), index("cost_entries_project_idx").on(table.workspaceId, table.projectId), index("cost_entries_invoice_idx").on(table.workspaceId, table.invoiceId), uniqueIndex("cost_entries_source_external_idx").on(table.workspaceId, table.source, table.externalId).where(sql`${table.externalId} is not null`), check("cost_entry_period_check", sql`${table.periodEnd} >= ${table.periodStart}`), check("cost_entry_exact_scale_check", sql`${table.exactAmountScale} between 0 and 18`)]);

export const optimizationFindings = pgTable("optimization_findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaceProfiles.id, { onDelete: "restrict" }),
  connectionId: uuid("connection_id").references(() => providerConnections.id, { onDelete: "set null" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  billingAccountId: uuid("billing_account_id").references(() => billingAccounts.id, { onDelete: "set null" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  externalResourceId: uuid("external_resource_id").references(() => externalResources.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  type: varchar("type", { length: 100 }).notNull(),
  status: optimizationStatusEnum("status").default("open").notNull(),
  confidence: optimizationConfidenceEnum("confidence").default("low").notNull(),
  dedupeKey: varchar("dedupe_key", { length: 240 }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description").notNull(),
  currency: varchar("currency", { length: 3 }),
  savingsMinMinor: bigint("savings_min_minor", { mode: "bigint" }),
  savingsMaxMinor: bigint("savings_max_minor", { mode: "bigint" }),
  observationFrom: timestamp("observation_from", { withTimezone: true }).notNull(),
  observationTo: timestamp("observation_to", { withTimezone: true }).notNull(),
  evidence: jsonb("evidence").$type<Array<{ label: string; value: string }>>().default([]).notNull(),
  blockingFeatures: jsonb("blocking_features").$type<string[]>().default([]).notNull(),
  ruleVersion: varchar("rule_version", { length: 40 }).notNull(),
  firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).defaultNow().notNull(),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }).defaultNow().notNull(),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("optimization_findings_active_idx").on(table.workspaceId, table.dedupeKey).where(sql`${table.status} in ('open', 'accepted', 'ignored', 'snoozed')`),
  index("optimization_findings_workspace_idx").on(table.workspaceId, table.status, table.confidence),
  index("optimization_findings_connection_idx").on(table.workspaceId, table.connectionId, table.status),
  check("optimization_findings_period_check", sql`${table.observationTo} >= ${table.observationFrom}`),
  check("optimization_findings_savings_check", sql`${table.savingsMinMinor} is null or ${table.savingsMaxMinor} is null or ${table.savingsMaxMinor} >= ${table.savingsMinMinor}`),
]);

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
