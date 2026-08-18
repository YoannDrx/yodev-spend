import "dotenv/config";
import { requireServiceDb } from "../src/db";
import { commercialPlans, providers } from "../src/db/schema";
import { commercialPlanCatalog } from "../src/server/commercial/catalog";
import { providerCatalog } from "../src/server/providers/catalog";

async function main(){
  const db=requireServiceDb();
  for(const provider of providerCatalog){
    await db.insert(providers).values(provider).onConflictDoUpdate({target:providers.slug,set:{name:provider.name,category:provider.category,websiteUrl:provider.websiteUrl,discoverySupported:provider.discoverySupported,billingSupported:provider.billingSupported,updatedAt:new Date()}});
  }
  for (const plan of commercialPlanCatalog) {
    await db.insert(commercialPlans).values(plan).onConflictDoUpdate({
      target: [commercialPlans.code, commercialPlans.version],
      set: { ...plan, active: true, updatedAt: new Date() },
    });
  }
  console.log(`Spend catalogs ready (${providerCatalog.length} providers, ${commercialPlanCatalog.length} commercial plans).`);
}
main().then(()=>process.exit(0)).catch((error)=>{console.error(error instanceof Error?error.message:"Bootstrap failed");process.exit(1)});
