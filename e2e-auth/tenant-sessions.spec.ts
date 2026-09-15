import { createHmac, randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { authTestSecret } from "../playwright.auth.config";

// Real Better Auth session validation, with local synthetic users. OAuth consent
// remains a separate external acceptance gate; AUTH_TEST_MODE is disabled here.
test("two signed sessions cannot read each other's workspace, and revocation takes effect",async({browser,baseURL})=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!["127.0.0.1","localhost"].includes(new URL(url).hostname))throw new Error("A disposable local TEST_DATABASE_URL is required.");
  const db=new Client({connectionString:url});await db.connect();
  const contexts=[];
  try {
    const tenants=[];
    for(const name of ["Alpha","Beta"]) {
      const user=randomUUID(),org=randomUUID(),workspace=randomUUID(),client=randomUUID(),session=randomUUID(),token=randomUUID();
      await db.query("insert into auth_users(id,name,email,email_verified) values($1,$2,$3,true)",[user,name,`${user}@example.invalid`]);
      await db.query("insert into auth_organizations(id,name,slug) values($1,$2,$3)",[org,name,org]);
      await db.query("insert into workspace_profiles(id,organization_id,name,slug,commercial_status) values($1,$2,$3,$4,'private')",[workspace,org,name,workspace]);
      await db.query("insert into auth_members(id,organization_id,user_id,role) values($1,$2,$3,'owner')",[randomUUID(),org,user]);
      await db.query("insert into clients(id,workspace_id,name,slug) values($1,$2,$3,$4)",[client,workspace,`${name} confidential`,client]);
      await db.query("insert into auth_sessions(id,token,user_id,active_organization_id,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')",[session,token,user,org]);
      const context=await browser.newContext({baseURL});contexts.push(context);
      const signature=createHmac("sha256",authTestSecret).update(token).digest("base64");
      await context.addCookies([{name:"yodev_spend.session_token",value:encodeURIComponent(`${token}.${signature}`),url:baseURL!,httpOnly:true,sameSite:"Lax"}]);
      tenants.push({context,workspace,client,session,name});
    }
    for(const [index,tenant] of tenants.entries()) {
      const page=await tenant.context.newPage();
      await page.goto("/fr/clients");
      await expect(page.getByRole("link",{name:`${tenant.name} confidential`,exact:true})).toBeVisible();
      await expect(page.getByText(`${tenants[1-index].name} confidential`,{exact:true})).toHaveCount(0);
      const exported=await tenant.context.request.get(`${baseURL}/api/workspace/export`);
      expect(exported.status()).toBe(200);expect((await exported.json()).workspace[0].id).toBe(tenant.workspace);
      await page.goto(`/fr/clients/${tenants[1-index].client}`);
      await expect(page.getByText(`${tenants[1-index].name} confidential`,{exact:true})).toHaveCount(0);
    }
    const ownerPage=await tenants[0].context.newPage();
    await ownerPage.goto("/fr/settings/privacy");
    await ownerPage.getByText("Programmer une suppression",{exact:true}).click();
    await ownerPage.getByLabel("Nom de l’espace",{exact:true}).fill("Alpha");
    await ownerPage.getByRole("button",{name:"Confirmer la suppression dans 30 jours"}).click();
    await expect(ownerPage.getByRole("button",{name:"Annuler la suppression"})).toBeVisible();
    await ownerPage.getByRole("button",{name:"Annuler la suppression"}).click();
    await expect(ownerPage.getByText("Programmer une suppression",{exact:true})).toBeVisible();
    const first=tenants[0];await db.query("delete from auth_sessions where id=$1",[first.session]);
    const page=await first.context.newPage();await page.goto("/fr/dashboard");await expect(page).toHaveURL(/\/fr\/sign-in/);
  } finally {await Promise.all(contexts.map(context=>context.close()));await db.end();}
});
