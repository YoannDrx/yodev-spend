import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function createPool(connectionString: string) {
  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "verify-full");
  return new Pool({ connectionString: url.toString(), max: 10, idleTimeoutMillis: 20_000 });
}

type DatabaseSlot = {
  connectionString?: string;
  pool: Pool | null;
  database: ReturnType<typeof drizzle<typeof schema>> | null;
};

function createSlot(connectionString?: string): DatabaseSlot {
  const pool = connectionString ? createPool(connectionString) : null;
  return { connectionString, pool, database: pool ? drizzle({ client: pool, schema }) : null };
}

const applicationSlot = createSlot(process.env.DATABASE_APP_URL ?? process.env.DATABASE_URL);
const serviceSlot = createSlot(process.env.DATABASE_SERVICE_URL ?? process.env.DATABASE_URL);

function requireSlot(slot: DatabaseSlot, variableName: string) {
  if (!slot.database && slot.connectionString) {
    slot.pool = createPool(slot.connectionString);
    slot.database = drizzle({ client: slot.pool, schema });
  }
  if (!slot.database) throw new Error(`${variableName} is required for this operation.`);
  return slot.database;
}

/** Tenant application connection. Production credentials must not own the schema or bypass RLS. */
export function requireDb() {
  return requireSlot(applicationSlot, "DATABASE_APP_URL or DATABASE_URL");
}

/** Trusted boundary for Better Auth, signed webhooks, cron and workspace bootstrap. */
export function requireServiceDb() {
  return requireSlot(serviceSlot, "DATABASE_SERVICE_URL or DATABASE_URL");
}

export type SpendDatabase = ReturnType<typeof requireDb>;
export type SpendTransaction = Parameters<Parameters<SpendDatabase["transaction"]>[0]>[0];
export type SpendExecutor = SpendDatabase | SpendTransaction;
