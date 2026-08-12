import { expect,test } from "@playwright/test";

test("renders the localized product shell and core inventory",async({page})=>{await page.goto("/fr/dashboard");await expect(page.getByRole("heading",{name:"Vue d’ensemble"})).toBeVisible();await expect(page.getByText("Gaspillage potentiel")).toBeVisible();await page.getByRole("link",{name:"Projets"}).click();await expect(page.getByRole("heading",{name:"Projets"})).toBeVisible();await page.goto("/en/services");await expect(page.getByRole("heading",{name:"Services"})).toBeVisible();await expect(page.getByText("Vercel")).toBeVisible();});
