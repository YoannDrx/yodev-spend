import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function createPool(connectionString: string) {
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 20_000 });
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
