import { z } from "zod";

const optionalSecret = z.string().min(1).optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: optionalSecret,
  DATABASE_URL_UNPOOLED: optionalSecret,
  DATABASE_APP_URL: optionalSecret,
  DATABASE_SERVICE_URL: optionalSecret,
  DATABASE_MIGRATION_URL: optionalSecret,
  BETTER_AUTH_SECRET: optionalSecret,
  GITHUB_OAUTH_CLIENT_ID: optionalSecret,
  GITHUB_OAUTH_CLIENT_SECRET: optionalSecret,
  GOOGLE_OAUTH_CLIENT_ID: optionalSecret,
  GOOGLE_OAUTH_CLIENT_SECRET: optionalSecret,
  GMAIL_OAUTH_CLIENT_ID: optionalSecret,
  GMAIL_OAUTH_CLIENT_SECRET: optionalSecret,
  AUTH_ALLOWED_GITHUB_IDS: z.string().default(""),
  GITHUB_APP_ID: optionalSecret,
  GITHUB_APP_SLUG: optionalSecret,
  GITHUB_APP_CLIENT_ID: optionalSecret,
  GITHUB_APP_CLIENT_SECRET: optionalSecret,
  GITHUB_APP_PRIVATE_KEY: optionalSecret,
  GITHUB_APP_WEBHOOK_SECRET: optionalSecret,
  CONNECTOR_ENCRYPTION_KEY: optionalSecret,
  STRIPE_RESTRICTED_KEY: optionalSecret,
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  STRIPE_SOLO_MONTHLY_PRICE_ID: optionalSecret,
  STRIPE_SOLO_ANNUAL_PRICE_ID: optionalSecret,
  STRIPE_STUDIO_MONTHLY_PRICE_ID: optionalSecret,
  STRIPE_STUDIO_ANNUAL_PRICE_ID: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_FROM_EMAIL: z.string().min(3).max(320).optional(),
  CRON_SECRET: optionalSecret,
  CRON_ENABLED: z.enum(["true", "false"]).default("false"),
  STRIPE_BILLING_ENABLED: z.enum(["true", "false"]).default("false"),
  COMMERCIAL_SIGNUP_ENABLED: z.enum(["true", "false"]).default("false"),
  GMAIL_CONNECTOR_ENABLED: z.enum(["true", "false"]).default("false"),
  WORKFLOW_ENABLED: z.enum(["true", "false"]).default("false"),
  AUTH_TEST_MODE: z.enum(["true", "false"]).default("false"),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && value.AUTH_TEST_MODE === "true") {
    context.addIssue({
      code: "custom",
      path: ["AUTH_TEST_MODE"],
      message: "AUTH_TEST_MODE must never be enabled in production.",
    });
  }
  if (
    value.NODE_ENV === "production"
    && value.DATABASE_APP_URL
    && value.DATABASE_SERVICE_URL
    && value.DATABASE_APP_URL === value.DATABASE_SERVICE_URL
  ) {
    context.addIssue({
      code: "custom",
      path: ["DATABASE_SERVICE_URL"],
      message: "DATABASE_APP_URL and DATABASE_SERVICE_URL must use distinct production roles.",
    });
  }
  if (value.NODE_ENV === "production") {
    const configuredDatabaseUrls = [value.DATABASE_APP_URL, value.DATABASE_SERVICE_URL, value.DATABASE_MIGRATION_URL].filter((url): url is string => Boolean(url));
    if (new Set(configuredDatabaseUrls).size !== configuredDatabaseUrls.length) {
      context.addIssue({ code: "custom", path: ["DATABASE_MIGRATION_URL"], message: "Production database boundaries must use distinct URLs." });
    }
    const githubAppConfigured = Boolean(value.GITHUB_APP_ID || value.GITHUB_APP_SLUG || value.GITHUB_APP_PRIVATE_KEY);
    if (githubAppConfigured) {
      for (const key of ["GITHUB_APP_ID", "GITHUB_APP_SLUG", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_WEBHOOK_SECRET", "CONNECTOR_ENCRYPTION_KEY"] as const) {
        if (!value[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required for the production GitHub App flow.` });
      }
    }
  }
  const commercialEnabled = value.STRIPE_BILLING_ENABLED === "true"
    || value.COMMERCIAL_SIGNUP_ENABLED === "true"
    || value.GMAIL_CONNECTOR_ENABLED === "true";
  if (value.NODE_ENV === "production" && commercialEnabled) {
    for (const key of ["DATABASE_APP_URL", "DATABASE_SERVICE_URL", "DATABASE_MIGRATION_URL"] as const) {
      if (!value[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required when commercial features are enabled.` });
    }
  }
});

export const env = schema.parse(process.env);

export const allowedGitHubIds = new Set(
  env.AUTH_ALLOWED_GITHUB_IDS.split(",").map((value) => value.trim()).filter(Boolean),
);

export function requireProductionEnv() {
  const required = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "GITHUB_OAUTH_CLIENT_ID",
    "GITHUB_OAUTH_CLIENT_SECRET",
    "GITHUB_APP_ID",
    "GITHUB_APP_SLUG",
    "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_WEBHOOK_SECRET",
    "CONNECTOR_ENCRYPTION_KEY",
    "CRON_SECRET",
  ] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
}

export function requireCommercialDatabaseEnv() {
  const keys = ["DATABASE_APP_URL", "DATABASE_SERVICE_URL", "DATABASE_MIGRATION_URL"] as const;
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing commercial database environment variables: ${missing.join(", ")}`);
  const urls = keys.map((key) => new URL(env[key]!));
  if (new Set(urls.map((url) => url.username)).size !== keys.length) {
    throw new Error("Commercial database roles must use distinct credentials.");
  }
  const expectedRoles = ["spend_app", "spend_service", "spend_migration"];
  for (const [index, url] of urls.entries()) {
    if (decodeURIComponent(url.username) !== expectedRoles[index]) {
      throw new Error(`${keys[index]} must authenticate as ${expectedRoles[index]}.`);
    }
  }
  return Object.fromEntries(keys.map((key) => [key, env[key]!])) as Record<(typeof keys)[number], string>;
}

export function requireStripeEnv() {
  const keys = [
    "STRIPE_RESTRICTED_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_SOLO_MONTHLY_PRICE_ID",
    "STRIPE_SOLO_ANNUAL_PRICE_ID",
    "STRIPE_STUDIO_MONTHLY_PRICE_ID",
    "STRIPE_STUDIO_ANNUAL_PRICE_ID",
  ] as const;
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing Stripe environment variables: ${missing.join(", ")}`);
  return Object.fromEntries(keys.map((key) => [key, env[key]!])) as Record<(typeof keys)[number], string>;
}

export function requireGmailEnv() {
  const keys = ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET"] as const;
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing Gmail environment variables: ${missing.join(", ")}`);
  return Object.fromEntries(keys.map((key) => [key, env[key]!])) as Record<(typeof keys)[number], string>;
}

export function requireGitHubAppUserAuthEnv() {
  const keys = ["GITHUB_APP_SLUG", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "CONNECTOR_ENCRYPTION_KEY"] as const;
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing GitHub App installation variables: ${missing.join(", ")}`);
  return Object.fromEntries(keys.map((key) => [key, env[key]!])) as Record<(typeof keys)[number], string>;
}
