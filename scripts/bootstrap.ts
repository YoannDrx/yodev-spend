import "dotenv/config";
import { requireDb } from "../src/db";
import { providers } from "../src/db/schema";
import { providerCatalog } from "../src/server/providers/catalog";

async function main(){await requireDb().insert(providers).values(providerCatalog).onConflictDoNothing();console.log(`Spend provider catalog ready (${providerCatalog.length} providers).`);}
main().then(()=>process.exit(0)).catch((error)=>{console.error(error instanceof Error?error.message:"Bootstrap failed");process.exit(1)});
