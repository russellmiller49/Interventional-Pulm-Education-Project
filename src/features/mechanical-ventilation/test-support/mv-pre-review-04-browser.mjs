/**
 * MV-PRE-REVIEW-04 Chromium journeys: the learner map, parts, shown steps, feedback and sources,
 * through the public UI only. Nothing is injected except one saved reading location, written in
 * the store's own format, to exercise a position saved before the step consolidation.
 *
 *   MV_REVIEW_URL=http://127.0.0.1:3147 MV_REVIEW_OUTPUT=<dir> node <this file>
 *
 * Exits non-zero on any failed check. Screenshots are written to MV_REVIEW_OUTPUT.
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.MV_REVIEW_URL ?? 'http://127.0.0.1:3147'
const output = path.resolve(process.env.MV_REVIEW_OUTPUT ?? 'artifacts/mv-pre-review-04')
await mkdir(output, { recursive: true })

const viewports = [
  { name: '1280x900', width: 1280, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x740', width: 320, height: 740 },
]
const results = []
const failures = []
function check(viewport, name, pass, detail = '') {
  results.push({ viewport, name, pass, detail })
  if (!pass) failures.push(`${viewport} · ${name} · ${detail}`)
}

const browser = await chromium.launch()
for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const v = viewport.name
  const text = () => page.evaluate(() => document.body.innerText)
  const open = async (route) => {
    // The placeholder backend never goes idle, so wait for the page and then for hydration.
    await page.goto(`${base}${route}`, { waitUntil: 'load' })
    await page.waitForTimeout(900)
  }
  /** Module content wider than the viewport. The global site header is the platform lane's. */
  const overflow = () =>
    page.evaluate(() => {
      const root = document.querySelector('[data-task-flow], main') ?? document.body
      const wide = [...root.querySelectorAll('*')].filter((node) => {
        const box = node.getBoundingClientRect()
        return box.width > 0 && box.right > window.innerWidth + 1
      })
      return {
        document: document.documentElement.scrollWidth - window.innerWidth,
        offenders: wide
          .slice(0, 5)
          .map((node) => `${node.tagName}.${String(node.className).slice(0, 40)}`),
      }
    })
  const shot = (name) =>
    page.screenshot({ path: path.join(output, `${v}-${name}.png`), fullPage: true })

  /* Overview */
  await open('/mechanical-ventilation')
  let body = await text()
  check(
    v,
    'overview counts live and held entries',
    /14 live cases and 1 worked explanation/.test(body),
  )
  check(v, 'overview does not call 15 entries 15 cases', !/15 clinical cases/.test(body))
  check(
    v,
    'overview names the stage of sections 11–13 integration',
    /3 integration sections · 1 capstone/.test(body),
  )
  check(
    v,
    'overview names the five main settings and the shaping settings',
    /Five settings do most of the work/.test(body) &&
      /Flow or inspiratory time, trigger sensitivity, cycle-off and rise time are settings too/.test(
        body,
      ),
  )
  check(
    v,
    'overview states review status once with the audit folded',
    /Review status: reviewer preview/.test(body) &&
      (await page.locator('[data-source-audit]').count()) === 1 &&
      !(await page
        .locator('[data-source-audit]')
        .first()
        .evaluate((node) => node.open)),
  )
  await page.getByRole('button', { name: /Browse all 14 sections/ }).click()
  await page.waitForTimeout(150)
  const stageCases = await page.evaluate(() =>
    [...document.querySelectorAll('[data-pathway-accordion] details')].map((group) => ({
      stage: group.getAttribute('data-stage'),
      cases: [...group.querySelectorAll('[data-kind="case"]')].map((chip) =>
        chip.textContent.trim(),
      ),
      sections: [...group.querySelectorAll('[data-kind="section"]')].map((chip) =>
        chip.textContent.trim(),
      ),
    })),
  )
  check(
    v,
    'stages 1 and 2 pair no case',
    stageCases[0].cases.length === 0 && stageCases[1].cases.length === 0,
    JSON.stringify(stageCases.slice(0, 2).map((g) => g.cases)),
  )
  check(
    v,
    'section chips carry canonical numbers 1–14',
    stageCases
      .flatMap((g) => g.sections)
      .map((label) => Number(label.split('.')[0]))
      .join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14',
  )
  check(
    v,
    'a repeated pairing is labelled a revisit',
    stageCases.at(-1).cases.some((label) => /revisit/.test(label)),
    JSON.stringify(stageCases.at(-1).cases),
  )
  if (v === '1280x900' || v === '390x844') await shot('overview')
  // Measured with the audit view open, so the snapshot hashes inside it are laid out.
  await page.locator('[data-source-audit] > summary').first().click()
  await page.waitForTimeout(150)
  let over = await overflow()
  check(
    v,
    'overview: module content fits the viewport',
    over.offenders.length === 0,
    JSON.stringify(over),
  )

  /* Practice */
  await open('/mechanical-ventilation/practice')
  body = await text()
  const index = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-labelledby="mv-practice-all"] a')].map((link) => ({
      text: link.textContent.trim(),
      href: link.getAttribute('href'),
    })),
  )
  check(v, 'practice index lists all 15 entries', index.length === 15, String(index.length))
  check(
    v,
    'practice names sections by number and title',
    index.every(
      (entry) => !/builds on/.test(entry.text) || /builds on Section \d+ · /.test(entry.text),
    ),
  )
  check(
    v,
    'practice marks MV-03 as held',
    index
      .filter((entry) => /live simulation held for review/.test(entry.text))
      .map((entry) => entry.href)
      .join()
      .includes('case=MV-03') &&
      index.filter((entry) => /held for review/.test(entry.text)).length === 1,
  )
  check(v, 'practice states the counts', /14 live cases and 1 worked explanation/.test(body))
  if (v === '1280x900') await shot('practice')
  over = await overflow()
  check(
    v,
    'practice: module content fits the viewport',
    over.offenders.length === 0,
    JSON.stringify(over),
  )

  /* A live case: verdict, honest empty comparison, learner explanation, neutral action label */
  await open('/mechanical-ventilation/practice?case=MV-15&device=hamilton-c6&mode=practice')
  const launch = page
    .getByRole('button', { name: /Continue|Launch|Open the simulation|Start/ })
    .first()
  body = await text()
  check(
    v,
    'case opens live with its console region or launch gate',
    /Air hunger, anxiety, pain, and delirium/.test(body),
  )
  const question = page.locator('[data-reinforcement="MV-15-mechanism"]')
  await question.scrollIntoViewIfNeeded()
  check(
    v,
    'case question is described as a guided comparison',
    /A guided comparison, not a test/.test(await question.innerText()),
  )
  await question.getByRole('button', { name: 'Show explanation' }).click()
  check(
    v,
    'case explanation opens with no choice made',
    (await question.locator('[data-reinforcement-explanation]').count()) === 1 &&
      (await question.locator('[data-choice-verdict]').count()) === 0,
  )
  check(
    v,
    'no empty comparison disclosure on a case',
    (await question.getByText('Compare the possibilities').count()) === 0 &&
      /gives no written reason for each alternative/.test(await question.innerText()),
  )
  await question.locator('input[type=radio]').first().check()
  await question.getByRole('button', { name: 'Compare my choice' }).click()
  const verdict = await question.locator('[data-choice-verdict]').innerText()
  check(
    v,
    'case comparison leads with a verdict in words',
    /^(Best-supported answer\.|Not the best-supported answer\. Best supported: .+\.)$/.test(
      verdict.trim(),
    ),
    verdict,
  )
  check(
    v,
    'case explanation is addressed to the learner',
    !/The learner|simulator should|case should reward/i.test(
      await question.locator('[data-reinforcement-explanation]').innerText(),
    ),
  )
  const sedation = page.getByRole('button', { name: 'Deepen sedation', exact: true })
  if (await sedation.count()) {
    check(
      v,
      'sedation action is named neutrally with its teaching beneath',
      /does not address timing, load, pain, or delirium/.test(
        await sedation.locator('xpath=..').innerText(),
      ),
    )
  } else {
    // The actions sit behind the suitability gate on a narrow screen; the label is checked on the wide ones.
    check(
      v,
      'sedation action behind the launch gate at this width',
      (await launch.count()) > 0 || viewport.width < 700,
    )
  }
  if (v === '1280x900' || v === '390x844') await shot('case-mv15')

  /* MV-03: worked explanation on Practice, on Applications, and on a seeded URL */
  for (const route of [
    '/mechanical-ventilation/practice?case=MV-03&device=hamilton-c6&mode=practice',
    '/mechanical-ventilation/practice?case=MV-03&device=hamilton-c6&mode=guided',
    '/mechanical-ventilation/assess?case=MV-03&device=hamilton-c6&mode=assess&seed=catalog-challenge-v1',
    '/mechanical-ventilation/practice?case=MV-03',
  ]) {
    await open(route)
    const held = await page.locator('[data-mv03-model-hold]').count()
    const live = await page.locator('[data-case-flow]').count()
    const run = await page.getByRole('button', { name: /Run physiology/ }).count()
    const landed = /Double triggering/.test(await text())
    // A route that does not open the case at all (a picker or a setup page) is also not a live case.
    check(
      v,
      `MV-03 never opens live: ${route.split('?')[1]}`,
      live === 0 && run === 0,
      `held=${held} live=${live} run=${run} caseTitleShown=${landed}`,
    )
    if (held === 1) {
      const page03 = await page.locator('[data-mv03-model-hold]').innerText()
      check(
        v,
        `MV-03 worked explanation is learner-facing: ${route.split('?')[1]}`,
        /Its live simulation is not offered/.test(page03) &&
          !/simulator should calculate/i.test(page03.split('Why the live case is held')[0]),
      )
    }
  }
  await open('/mechanical-ventilation/practice?case=MV-03&device=hamilton-c6&mode=practice')
  check(
    v,
    'MV-03 direct practice link shows the held page',
    (await page.locator('[data-mv03-model-hold]').count()) === 1,
  )
  if (v === '1280x900' || v === '390x844') await shot('mv03-held')
  over = await overflow()
  check(
    v,
    'MV-03: module content fits the viewport',
    over.offenders.length === 0,
    JSON.stringify(over),
  )

  /* Applications */
  await open('/mechanical-ventilation/assess')
  body = await text()
  const options = await page.evaluate(() =>
    [...document.querySelectorAll('select[aria-label="Choose a worked application"] option')].map(
      (o) => o.textContent.trim(),
    ),
  )
  check(
    v,
    'applications are labelled by section, not 1–10',
    options.length === 10 && options.every((label) => /^Section \d+ · /.test(label)),
    JSON.stringify(options.slice(0, 2)),
  )
  check(
    v,
    'application 1 is filed under Section 4',
    /^Section 4 · Where does the pressure go\? — item 1 of 2$/.test(options[0] ?? ''),
    options[0],
  )
  check(
    v,
    'applications say what is not covered',
    /Sections 1, 2, 5, 7 and 12 have no item here/.test(body),
  )
  const review = page.getByRole('link', { name: /^Review Section 4 · / })
  check(v, 'application 1 review link names Section 4', (await review.count()) === 1)
  await page.getByRole('button', { name: 'Show explanation' }).first().click()
  check(
    v,
    'applications keep per-option reasons',
    (await page.getByText('Compare the possibilities').count()) === 1,
  )
  await page.locator('input[type=radio]').nth(0).check()
  await page.getByRole('button', { name: 'Compare my choice' }).click()
  check(
    v,
    'applications lead with the verdict',
    /Not the best-supported answer\. Best supported: The peak airway pressure during inspiration\./.test(
      await page.locator('[data-choice-verdict]').innerText(),
    ),
  )
  if (v === '1280x900') await shot('applications')
  await review.click()
  await page.waitForURL(/activity=mechanics-load-and-pressure/)
  await page.waitForTimeout(300)
  check(v, 'review link lands on Section 4', /Section 4 of 14/.test(await text()))
  over = await overflow()

  /* Learn: no-answer progression through the shown steps, parts, revisit and preview labels */
  for (const [unit, shown] of [
    ['breathing-with-support', 7],
    ['controls-and-goals', 8],
    ['expiration-and-air-trapping', 7],
    ['oxygenation-response', 4],
  ]) {
    await open(`/mechanical-ventilation/learn?activity=${unit}`)
    const seen = []
    for (let step = 0; step < shown + 2; step++) {
      const card = await page.locator('[data-current-step]').innerText()
      seen.push(
        card
          .match(/Step (\d+) of (\d+)/)
          ?.slice(1)
          .join('/'),
      )
      const next = page
        .locator('[data-current-step]')
        .getByRole('button', { name: 'Continue', exact: true })
      if (!(await next.count())) break
      await next.click()
      await page.waitForTimeout(120)
    }
    const expected = Array.from({ length: shown }, (_, i) => `${i + 1}/${shown}`).join(',')
    check(
      v,
      `${unit}: Continue walks ${shown} steps with no answer`,
      seen.join(',') === expected,
      seen.join(','),
    )
    check(
      v,
      `${unit}: nothing was answered on the way`,
      (await page.locator('input[type=radio]:checked').count()) === 0,
    )
  }
  await open('/mechanical-ventilation/learn?activity=expiration-and-air-trapping')
  body = await text()
  check(
    v,
    'section header says it is guided and gives an estimate',
    /This is a guided walk-through/.test(body) &&
      /an author’s estimate, not timed with learners/.test(body),
  )
  check(
    v,
    'in-section parts are Part 1 / Part 2',
    /Step 1 of 7 · Part 1 of 2/.test(body) && !/Application \d/.test(body),
  )
  await page.getByRole('combobox', { name: 'Choose step' }).selectOption({ index: 4 })
  await page.waitForTimeout(200)
  body = await page.locator('[data-current-step]').innerText()
  check(
    v,
    'Section 7 Part 2 is labelled a preview of Section 8',
    /Preview of Section 8 · Do the two breath clocks agree\?/.test(body),
    body.slice(0, 200),
  )
  check(
    v,
    'Section 7 Part 2 says it is a different simulated patient',
    /a different simulated patient from Part 1: the simulated patient of case MV-10/.test(body),
  )
  const part2 = await text()
  check(
    v,
    'cycle-off is expanded where Section 7 first uses it',
    /cycle-off threshold \(expiratory trigger sensitivity, ETS\)/.test(part2),
  )
  await page.locator('[data-reinforcement]').getByRole('button', { name: 'Hint' }).click()
  check(
    v,
    'the hint is a cue, not the look line',
    /Ask whether a higher percentage of that peak is reached earlier or later/.test(
      await page.locator('[data-reinforcement] [role=status]').innerText(),
    ),
  )
  if (v === '1280x900' || v === '390x844') await shot('section7-part2')
  over = await overflow()
  check(
    v,
    'Learn section: module content fits the viewport',
    over.offenders.length === 0,
    JSON.stringify(over),
  )

  await open('/mechanical-ventilation/learn?activity=dyssynchrony-mechanisms')
  await page.getByRole('combobox', { name: 'Choose step' }).selectOption({ index: 4 })
  await page.waitForTimeout(200)
  check(
    v,
    'Section 12 Part 2 is labelled a revisit of Section 7, Part 2',
    /Revisit of Section 7 · Does the breath have time to finish\?, Part 2/.test(
      await page.locator('[data-current-step]').innerText(),
    ),
  )

  /* Learn: a verdict against the unchanged key; the lung-protection source attribution */
  await open('/mechanical-ventilation/learn?activity=lung-protection')
  await page.getByRole('combobox', { name: 'Choose step' }).selectOption({ index: 1 })
  await page.waitForTimeout(200)
  const learn = page.locator('[data-reinforcement]').first()
  await learn.locator('input[type=radio]').nth(2).check()
  await learn.getByRole('button', { name: 'Compare my choice' }).click()
  check(
    v,
    'Learn item gives the best-supported verdict',
    (await learn.locator('[data-choice-verdict]').innerText()).trim() === 'Best-supported answer.',
  )
  body = await text()
  check(
    v,
    'limits are credited to 2017 and their retention to 2024',
    /2017 ATS\/ESICM\/SCCM guideline recommends 4–8 mL\/kg PBW/.test(body) &&
      /2024 ATS update keeps that recommendation/.test(body),
  )
  check(
    v,
    'source list cites Fan 2017 and states review status once',
    /Fan E, Del Sorbo L, Goligher EC/.test(body) &&
      (body.match(/No source listed here has a recorded clinical review/g) ?? []).length === 1,
  )
  check(
    v,
    'no file hash on the main path',
    !/SHA-256/.test(await page.locator('[data-source-list]').innerText()),
  )
  await page.locator('[data-source-audit] summary').last().click()
  check(
    v,
    'the audit view holds the identity checks and hashes',
    /SHA-256/.test(await page.locator('[data-source-audit]').last().innerText()) &&
      /Clinical review of how this module uses it: none recorded yet\./.test(
        await page.locator('[data-source-audit]').last().innerText(),
      ),
  )
  if (v === '1280x900') await shot('section6-sources')

  /* A reading location saved on a step that is no longer shown separately */
  await page.evaluate(() =>
    localStorage.setItem(
      'mechanical-ventilation-self-paced-v1',
      JSON.stringify({
        version: 1,
        visited: ['waveform-anatomy'],
        location: { section: 'learn', id: 'waveform-anatomy', step: 3 },
      }),
    ),
  )
  await open('/mechanical-ventilation/learn?activity=waveform-anatomy')
  check(
    v,
    'a saved position on the former observe step opens the task step',
    /Step 3 of 7 · Part 1 of 2/.test(await page.locator('[data-current-step]').innerText()),
  )
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('mechanical-ventilation-self-paced-v1')),
  )
  check(
    v,
    'the store keeps its format',
    Object.keys(stored).sort().join() === 'location,version,visited' &&
      stored.version === 1 &&
      stored.location.step === 2,
    JSON.stringify(stored),
  )
  const keys = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => /ventilation/i.test(key))
      .sort(),
  )
  check(
    v,
    'no new ventilation storage key appears',
    keys.every(
      (key) =>
        [
          'mechanical-ventilation-self-paced-v1',
          'mechanical-ventilation-device-preference-v1',
        ].includes(key) || /device|console/.test(key),
    ),
    keys.join(),
  )

  /* The PEEP comparison caption */
  await open('/mechanical-ventilation/learn?activity=oxygenation-response')
  body = await text()
  check(
    v,
    'PEEP comparison caption names the model, not the software',
    /Model-generated example values · no hold acquired/.test(body) &&
      !/Engine-generated/.test(body),
  )
  check(
    v,
    'teaching units use one style',
    !/cm H₂O|mm Hg/.test(await page.locator('[data-peep-comparison]').innerText()),
  )

  check(v, 'no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))
  await context.close()
}

/* 200 % root text on a representative Learn step and the Practice index */
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.fontSize = '200%'
    })
  })
  for (const route of [
    '/mechanical-ventilation/learn?activity=expiration-and-air-trapping',
    '/mechanical-ventilation/practice',
    '/mechanical-ventilation/assess',
  ]) {
    await page.goto(`${base}${route}`, { waitUntil: 'load' })
    await page.waitForTimeout(900)
    const wide = await page.evaluate(() => {
      const selectors = [
        '[data-part-setup]',
        '[data-part-relation]',
        '[data-section-time]',
        '[data-application-coverage]',
        '[aria-labelledby="mv-practice-all"] a',
        '[data-source-review-status]',
      ]
      return selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)]
          .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 1)
          .map(() => selector),
      )
    })
    check(
      '1280x900@200%',
      `new copy wraps inside the viewport: ${route}`,
      wide.length === 0,
      wide.join(),
    )
  }
  await page.screenshot({
    path: path.join(output, '1280x900-200pct-applications.png'),
    fullPage: true,
  })
  await context.close()
}

await browser.close()
await writeFile(
  path.join(output, 'results.json'),
  JSON.stringify({ base, results, failures }, null, 2),
)
const passed = results.filter((entry) => entry.pass).length
console.log(`${passed}/${results.length} checks passed`)
for (const failure of failures) console.log(`FAIL ${failure}`)
process.exit(failures.length ? 1 : 0)
