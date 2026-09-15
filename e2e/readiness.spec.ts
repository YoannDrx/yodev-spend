import { randomUUID } from "node:crypto";
import { Client } from "pg";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("creates, searches, archives and restores a client and project in PostgreSQL", async ({page}) => {
  const suffix = randomUUID().slice(0,8);
  const client = `Studio audit ${suffix}`;
  const project = `Projet audit ${suffix}`;
  await page.goto("/fr/clients");
  await page.getByLabel("Nom", {exact:true}).fill(client);
  await page.getByLabel("Description", {exact:true}).fill("Parcours de recette");
  await page.getByRole("button",{name:"Nouveau client",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Modification enregistrée");
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Projets",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Projets",exact:true})).toBeVisible();
  await page.getByLabel("Nom",{exact:true}).fill(project);
  await page.getByLabel("Client",{exact:true}).selectOption({label:client});
  await page.getByRole("button",{name:"Nouveau projet",exact:true}).click();
  await expect(page.getByRole("link",{name:project,exact:true})).toBeVisible();
  await page.getByRole("searchbox").fill(suffix);
  await page.getByRole("button",{name:"Filtrer",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`q=${suffix}`));
  await page.getByRole("link",{name:project,exact:true}).click();
  await page.getByRole("button",{name:"Archiver",exact:true}).click();
  await expect(page.locator(".page-header").getByText("Archivé",{exact:true})).toBeVisible();
  await page.goto(`/fr/projects?status=archived&q=${suffix}`);
  await page.getByRole("link",{name:project,exact:true}).click();
  await page.getByText("Modifier le projet",{exact:true}).click();
  await page.getByRole("combobox",{name:"Statut",exact:true}).selectOption("active");
  await page.getByRole("button",{name:"Enregistrer",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Modification enregistrée");
  await page.goto(`/fr/projects?q=${suffix}`);
  await expect(page.getByRole("link",{name:project,exact:true})).toBeVisible();
});

test("preserves user input on a failed mutation and offers an accessible error", async ({page}) => {
  await page.goto("/fr/projects");
  await page.getByLabel("Nom",{exact:true}).fill("Keep this project name");
  // A forged relationship must be rejected server-side without discarding the form.
  await page.getByLabel("Client",{exact:true}).evaluate((select: HTMLSelectElement) => {
    select.add(new Option("Unknown client","00000000-0000-4000-8000-999999999999",true,true));
  });
  await page.getByRole("button",{name:"Nouveau projet",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Impossible d’enregistrer"})).toBeVisible();
  await expect(page.getByLabel("Nom",{exact:true})).toHaveValue("Keep this project name");
});

test("exports exact financial data as an uncached download", async ({request}) => {
  const response = await request.get("/api/workspace/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const data = await response.json();
  expect(data.workspace[0].id).toBe("00000000-0000-4000-8000-000000000001");
  expect(typeof data.costs[0].amountMinor).toBe("string");
  expect(JSON.stringify(data)).not.toMatch(/credentialCiphertext|credentialIv|refreshToken|accessToken/);
});

test("mobile navigation retains labels, active location and keyboard access", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/fr/dashboard");
  await page.getByLabel("Navigation complète",{exact:true}).click();
  const nav = page.getByRole("navigation",{name:"Navigation principale"});
  await expect(nav.getByRole("link",{name:"Vue d’ensemble"})).toHaveAttribute("aria-current","page");
  await expect(nav.getByRole("link",{name:"Projets",exact:true}).locator("span")).toBeVisible();
  await nav.getByRole("link",{name:"Projets",exact:true}).click();
  await page.getByLabel("Navigation complète",{exact:true}).click();
  await expect(nav.getByRole("link",{name:"Projets",exact:true})).toHaveAttribute("aria-current","page");
  await expect(page.getByRole("heading",{name:"Projets",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Changer le thème"}).click();
  await page.reload();
  await expect(page.getByRole("heading",{name:"Projets",exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

for (const locale of ["fr","en"]) {
  for (const route of ["clients", "spend", "settings/connections"]) {
    test(`critical accessibility rules pass on ${locale}/${route}`, async ({page}) => {
      await page.goto(`/${locale}/${route}`);
      await expect(page.getByRole("heading",{level:1})).toBeVisible();
      if (route === "spend") await page.locator("main details").first().locator("summary").click();
      const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
      expect(results.violations.map(({id,impact,nodes})=>({id,impact,targets:nodes.map(node=>node.target)}))).toEqual([]);
    });
  }
}

test("unknown project IDs display a localized recovery page", async ({page}) => {
  await page.goto("/fr/projects/not-a-real-id");
  await expect(page.getByRole("heading",{name:"Cette page n’existe pas."})).toBeVisible();
  await page.getByRole("link",{name:"Revenir au tableau de bord"}).click();
  await expect(page.getByRole("heading",{name:"Vue d’ensemble"})).toBeVisible();
});

test("records decimal costs and a final invoice without accepting conflicting re-entry", async ({page,request}) => {
  const account = `Billing audit ${randomUUID().slice(0,8)}`;
  await page.goto("/fr/spend");
  const create = page.locator("details").filter({has:page.getByRole("heading",{name:"Nouveau compte",exact:true})});
  await create.locator("summary").click();
  await create.getByLabel("Nom",{exact:true}).fill(account);
  await create.getByLabel("Montant dans la devise choisie").fill("19,99");
  await create.getByRole("button",{name:"Nouveau compte",exact:true}).click();
  await expect(create.getByRole("status")).toContainText("Modification enregistrée");
  await expect(page.getByRole("row").filter({hasText:account})).toContainText("19,99");
  const cost = page.locator("details").filter({has:page.getByRole("heading",{name:"Nouvelle écriture",exact:true})});
  await cost.locator("summary").click();
  await cost.getByLabel("Compte",{exact:true}).selectOption({label:account});
  await cost.getByLabel("Montant dans la devise choisie").fill("12.34");
  await cost.getByLabel("Début de période").fill("2026-04-01");
  await cost.getByLabel("Fin de période (exclue)").fill("2026-05-01");
  await cost.getByRole("button",{name:"Nouvelle écriture",exact:true}).click();
  await expect(cost.getByRole("status")).toContainText("Modification enregistrée");
  const invoice = page.locator("details").filter({has:page.getByRole("heading",{name:"Réconcilier une facture",exact:true})});
  await invoice.locator("summary").click();
  await invoice.getByLabel("Compte",{exact:true}).selectOption({label:account});
  await invoice.getByLabel("Numéro de facture").fill("INV-E2E");
  await invoice.getByLabel("Montant dans la devise choisie").fill("25,00");
  await invoice.getByRole("button",{name:"Enregistrer comme montant final"}).click();
  await expect(invoice.getByRole("status")).toContainText("Modification enregistrée");
  await invoice.getByLabel("Montant dans la devise choisie").fill("26,00");
  await invoice.getByRole("button",{name:"Enregistrer comme montant final"}).click();
  await expect(invoice.getByRole("alert")).toContainText("Impossible d’enregistrer");
  const data=await (await request.get("/api/workspace/export")).json();
  const id=data.billingAccounts.find((item:{name:string})=>item.name===account).id;
  expect(data.costs.filter((item:{billingAccountId:string})=>item.billingAccountId===id).map((item:{amountMinor:string})=>item.amountMinor).sort()).toEqual(["1234","2500"]);
});

test("privacy and legal pages remain accessible on mobile",async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  for(const path of ["/fr/settings/privacy","/fr/privacy","/en/terms"]){
    await page.goto(path);
    await expect(page.getByRole("heading",{level:1})).toBeVisible();
    const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(audit.violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(path==="/fr/settings/privacy")await page.screenshot({path:testInfo.outputPath("privacy-mobile.png"),fullPage:true});
  }
});

test("corrects a manual amount on mobile and preserves the original in the ledger",async({page})=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!["127.0.0.1","localhost"].includes(new URL(url).hostname))throw new Error("A disposable local database is required.");
  const db=new Client({connectionString:url});await db.connect();
  const workspace="00000000-0000-4000-8000-000000000001",account=randomUUID(),name=`Correction ${randomUUID().slice(0,8)}`;
  try {
    await db.query("insert into billing_accounts(id,workspace_id,provider_id,name) select $1,$2,id,$3 from providers where slug='vercel'",[account,workspace,name]);
    await db.query("insert into cost_entries(workspace_id,billing_account_id,amount_minor,currency,period_start,period_end,kind,amount_status,amount_basis,source) values($1,$2,1000,'EUR',date_trunc('month',now()),date_trunc('month',now())+interval '1 month','manual','final','manual','manual')",[workspace,account]);
    await page.setViewportSize({width:390,height:844});await page.goto("/fr/spend");
    const ledger=page.locator(".ledger-section");
    const original=ledger.getByRole("row").filter({hasText:name});
    await original.getByText("Corriger",{exact:true}).click();
    await original.getByLabel("Nouveau montant en EUR",{exact:true}).fill("8,75");
    await original.getByLabel("Motif de correction",{exact:true}).fill("Justificatif corrigé pendant la recette");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await original.getByRole("button",{name:"Enregistrer la correction"}).click();
    await expect(ledger.locator(".ledger-superseded").filter({hasText:name})).toHaveCount(1);
    await expect(ledger.getByRole("row").filter({hasText:name})).toHaveCount(2);
    const result=await db.query("select amount_minor::text from cost_entries where billing_account_id=$1 and superseded_at is null",[account]);
    expect(result.rows).toEqual([{amount_minor:"875"}]);
  } finally {await db.end();}
});
