import { chromium } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base=process.env.BRONCH_REVIEW_URL??'http://localhost:3130'
const output=path.resolve(process.env.BRONCH_REVIEW_OUTPUT??'artifacts/bronchoscopy-review')
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
page.on('console',message=>{if(message.type()==='error' && !message.text().includes('status of 500'))errors.push(message.text())})
await page.route('**/api/analytics',route=>route.fulfill({status:204}))
if(process.env.BRONCH_REVIEW_AUTH_FILE) {
  const {token}=JSON.parse(await readFile(process.env.BRONCH_REVIEW_AUTH_FILE,'utf8'))
  await page.context().addCookies([{name:'ip_local_dev_auth',value:token,url:base}])
  await page.goto(`${base}/en/learn/anatomy/airway`)
} else await page.goto(`${base}/en/learn/anatomy/airway`)
await page.getByRole('button',{name:'RUL reference',exact:true}).waitFor({timeout:120000})
console.log('Case controls loaded')
await page.getByRole('button',{name:'Realistic navigation',exact:true}).waitFor()
await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Realistic navigation' && !b.disabled),null,{timeout:60000})
for(const reference of ['RUL','RML','LUL']) {
  console.log(`Capturing ${reference}`)
  await page.getByRole('button',{name:`${reference} reference`,exact:true}).click()
  await page.getByText('Virtual bronchoscopy',{exact:true}).waitFor()
  await page.waitForTimeout(2000)
  await page.getByText('Virtual bronchoscopy',{exact:true}).scrollIntoViewIfNeeded()
  await page.screenshot({path:path.join(output,`${reference.toLowerCase()}.png`),fullPage:true})
  await page.getByText('Virtual bronchoscopy',{exact:true}).locator('..').screenshot({path:path.join(output,`${reference.toLowerCase()}-optical.png`)})
}
await page.getByRole('button',{name:'Realistic navigation',exact:true}).click()
await page.getByRole('button',{name:'Advance scope',exact:true}).click()
await page.waitForTimeout(500)
await page.getByRole('button',{name:'Withdraw scope',exact:true}).click()
await page.waitForTimeout(500)
await page.screenshot({path:path.join(output,'realistic.png'),fullPage:true})
await writeFile(path.join(output,'browser-review.json'),JSON.stringify({url:base,viewport:{width:1600,height:1100},errors},null,2))
console.log(JSON.stringify({output,errors}))
await browser.close()
if(errors.length)process.exitCode=1
