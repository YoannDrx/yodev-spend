import { z } from "zod";

const optionalSecret = z.string().min(1).optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: optionalSecret,
  DATABASE_URL_UNPOOLED: optionalSecret,
  BETTER_AUTH_SECRET: optionalSecret,
  GITHUB_OAUTH_CLIENT_ID: optionalSecret,
  GITHUB_OAUTH_CLIENT_SECRET: optionalSecret,
  AUTH_ALLOWED_GITHUB_IDS: z.string().default(""),
  GITHUB_APP_ID: optionalSecret,
  GITHUB_APP_SLUG: optionalSecret,
  GITHUB_APP_PRIVATE_KEY: optionalSecret,
  GITHUB_APP_WEBHOOK_SECRET: optionalSecret,
  CRON_SECRET: optionalSecret,
  CRON_ENABLED: z.enum(["true", "false"]).default("false"),
  AUTH_TEST_MODE: z.enum(["true", "false"]).default("false"),
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
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_WEBHOOK_SECRET",
    "CRON_SECRET",
  ] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
}
