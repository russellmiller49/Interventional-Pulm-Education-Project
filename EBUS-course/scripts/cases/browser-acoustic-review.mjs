import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base=process.env.EBUS_REVIEW_URL??'http://127.0.0.1:3131';
const output=path.resolve(process.env.EBUS_REVIEW_OUTPUT??'artifacts/ebus-browser-review');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1100},recordVideo:{dir:output,size:{width:1280,height:880}}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  await page.goto(`${base}/simulator?publicTraining=1`);
  const pane=page.getByLabel('Continuous EBUS ultrasound',{exact:true});
  await pane.waitFor({timeout:60000});
  const image=pane.getByLabel('Grayscale ultrasound image');
  await page.waitForFunction(()=>document.querySelector('[data-acoustic-version="simplified-v2"] canvas')?.width===384);
  const manifest=JSON.parse(await readFile('EBUS-course/apps/web/public/simulator/case-001/case_manifest.simplified.web.json','utf8'));
  for(const preset of manifest.presets){
    await page.getByRole('combobox').selectOption(preset.preset_key);
    await pane.scrollIntoViewIfNeeded();await page.waitForTimeout(750);
    const name=preset.preset_key.replace(/[^a-zA-Z0-9]+/g,'_');
    await page.locator('.simulator-workspace').screenshot({path:path.join(output,`${name}.png`)});
  }
  await page.getByRole('combobox').selectOption('station_4r_node_a::default');await page.waitForTimeout(250);
  const pixels=()=>image.evaluate(c=>c.toDataURL());
  const stationary=await pixels();await page.waitForTimeout(200);
  if(await pixels()!==stationary)throw new Error('Stationary image changed');
  await pane.getByRole('button',{name:'Freeze',exact:true}).click();
  await page.getByRole('button',{name:'Roll clockwise',exact:true}).click();await page.waitForTimeout(200);
  if(await pixels()!==stationary)throw new Error('Frozen image changed during rotation');
  await pane.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForTimeout(200);
  if(await pixels()===stationary)throw new Error('Resuming did not sample the new pose');
  const beforeGain=await pixels();await page.getByLabel('Ultrasound gain',{exact:true}).focus();await page.keyboard.press('End');await page.waitForTimeout(200);
  if(await pixels()===beforeGain)throw new Error('Gain did not change the image');
  await page.getByRole('button',{name:'Advance',exact:true}).click();await page.getByRole('button',{name:'Withdraw',exact:true}).click();
  await writeFile(path.join(output,'browser-review.json'),JSON.stringify({stations:manifest.presets.length,stationary:true,freeze:true,resume:true,gain:true,advanceWithdraw:true,errors},null,2));
  console.log(JSON.stringify({output,errors}));
} finally {await context.close();await browser.close();}
if(errors.length)process.exitCode=1;
