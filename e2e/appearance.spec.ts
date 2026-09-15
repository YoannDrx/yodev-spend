import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const route of ['/fr','/fr/dashboard']) test(`brand, themes and responsive layout: ${route}`,async({page},testInfo)=>{
  await page.goto(route);
  await expect(page.locator('html')).toHaveClass(/dark/);
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const theme of ['dark','light']){
      if(!(await page.locator('html').getAttribute('class'))?.includes(theme))await page.getByRole('button',{name:'Changer le thème',exact:true}).click();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
      expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
      await page.screenshot({path:testInfo.outputPath(`spend-${route.endsWith('dashboard')?'app':'public'}-${width}-${theme}.png`)});
    }
  }
  await page.reload();await expect(page.locator('html')).toHaveClass(/light/);
});
test('brand images are served outside translated application routes',async({request})=>{
  for(const path of ['/icon','/apple-icon','/opengraph-image']){
    const response=await request.get(path);expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('image/png');
  }
});
