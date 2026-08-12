import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function createPool(connectionString: string) {
  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "verify-full");
  return new Pool({ connectionString: url.toString(), max: 10, idleTimeoutMillis: 20_000 });
}

let pool = process.env.DATABASE_URL ? createPool(process.env.DATABASE_URL) : null;
let database = pool ? drizzle({ client: pool, schema }) : null;

export function requireDb() {
  if (!database && process.env.DATABASE_URL) {
    pool = createPool(process.env.DATABASE_URL);
    database = drizzle({ client: pool, schema });
  }
  if (!database) throw new Error("DATABASE_URL is required for this operation.");
  return database;
}

export type SpendDatabase = ReturnType<typeof requireDb>;
