import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { LESSONS } from '../../src/features/ebus-guided/content/curriculum'
import type { EbusBridgeMessage } from '../../src/lib/ebus-guided-bridge'

type ObservationMessage = Extract<EbusBridgeMessage, { type: 'observation' }>
declare global {
  interface Window {
    __ebusEvents: ObservationMessage[]
  }
}

async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3145'
  const out = 'artifacts/ebus-guided/linked-models'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } })
  const errors: string[] = [],
    results: object[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    window.__ebusEvents = []
    window.addEventListener('message', (e) => {
      if (e.origin === location.origin && e.data?.type === 'observation')
        window.__ebusEvents.push(e.data)
    })
  })
  const primary = () => page.locator('[data-now-primary]')
  const next = () => primary().click()
  const evidence = () => page.evaluate(() => window.__ebusEvents.at(-1)?.observation)
  const answer = async (question: (typeof LESSONS)[number]['question']) => {
    await page.getByLabel(question.choices.find((c) => c.correct)!.text, { exact: true }).check()
    await next()
    await next()
  }
  try {
    for (const lesson of LESSONS.filter((l) => l.lab?.linkedLesson)) {
      await page.goto(base + '/en/ebus-guided/learn?section=' + lesson.id)
      await expect(page.getByRole('heading', { name: 'Orientation', exact: true })).toBeVisible()
      await page.waitForTimeout(600)
      await next()
      const frame = page.frameLocator('iframe[title="EBUS workbench"]')
      await expect(frame.getByLabel('Inspect a structure')).toBeVisible({ timeout: 60000 })
      await expect
        .poll(async () =>
          Number(await frame.locator('.linked-canvas').getAttribute('data-model-triangles')),
        )
        .toBeGreaterThan(1000)
      if (lesson.id === 'scope-orientation') {
        await frame.getByRole('button', { name: 'Show whole scope', exact: true }).click()
        await frame.locator('.linked-canvas').screenshot({ path: out + '/scope-whole.png' })
        await frame.getByRole('button', { name: 'Show distal tip', exact: true }).click()
        await frame.locator('.linked-canvas').screenshot({ path: out + '/scope-distal.png' })
        await frame.getByRole('button', { name: 'Demonstrate flexion', exact: true }).click()
        await frame.locator('.linked-canvas').screenshot({ path: out + '/scope-flexion.png' })
      }
      await frame.getByRole('button', { name: 'Demonstrate rotation', exact: true }).click()
      const demo = await page.evaluate(() =>
        window.__ebusEvents.filter((e) => e.sessionId.endsWith('-demonstration')),
      )
      if (demo.some((e) => e.observation.actionCount || e.observation.ready))
        throw new Error('Demonstration supplied task evidence')
      await next()
      await expect(page.locator('iframe')).toHaveCount(0)
      await answer(lesson.question)
      await expect(frame.getByLabel('Inspect a structure')).toBeVisible({ timeout: 60000 })
      await expect(primary()).toBeDisabled()
      // The old session cannot supply the action or model-selection evidence for this lab.
      const child = page.frames().find((f) => f.url().includes('guided.html'))!
      await child.evaluate(() =>
        parent.postMessage(
          {
            version: 1,
            type: 'observation',
            sessionId: 'old-session',
            observation: {
              usedControls: ['roll'],
              actionCount: 99,
              lastAction: 'roll',
              ready: true,
              frameReady: true,
              contactQuality: 1,
              targetVisible: true,
              roll: 0,
              flexion: 0,
              depth: 40,
              gain: 0,
              contrast: 50,
              doppler: false,
              frozen: false,
              measured: false,
              saved: false,
              linked: {
                assetsReady: true,
                selectedStructure: 'carina',
                modelSectionViewed: true,
                approach: 'lms',
                scannedApproaches: ['rms', 'lms'],
                frameId: 'stale',
              },
            },
          },
          location.origin,
        ),
      )
      await expect(primary()).toBeDisabled()
      const control = frame.getByLabel(
        lesson.id === 'acoustic-contact' ? 'Tip flexion' : 'Scope rotation',
        { exact: true },
      )
      await expect(control).toBeEnabled()
      await control.fill(lesson.id === 'acoustic-contact' ? '10' : '0')
      if (lesson.id !== 'acoustic-contact') {
        const wrong = lesson.id === 'scope-orientation' ? 'optical_lens' : 'aorta'
        await frame.getByLabel('Inspect a structure').selectOption(wrong)
        await expect(primary()).toBeDisabled()
        await frame
          .getByLabel('Inspect a structure')
          .selectOption(
            lesson.id === 'scope-orientation'
              ? 'transducer_face'
              : lesson.id === 'right-paratracheal'
                ? 'azygous'
                : 'carina',
          )
      }
      if (lesson.id === 'ct-map') {
        await frame.getByRole('button', { name: 'Model section', exact: true }).click()
        await frame.getByRole('button', { name: 'Coronal', exact: true }).click()
      }
      if (lesson.id === 'station-seven') {
        await expect(
          frame.getByRole('button', { name: 'Right main bronchus · scanned', exact: true }),
        ).toBeVisible({ timeout: 30000 })
        await expect(primary()).toBeDisabled()
        await frame.locator('.linked-canvas').screenshot({ path: out + '/station-seven-rms.png' })
        await frame.getByRole('button', { name: 'Left main bronchus', exact: true }).click()
        await expect(primary()).toBeDisabled()
        await control.fill('0')
        await expect(
          frame.getByRole('button', { name: 'Left main bronchus · scanned', exact: true }),
        ).toBeVisible({ timeout: 30000 })
      }
      await expect(primary()).toBeEnabled({ timeout: 30000 })
      const before = await evidence()
      const beforePixels = await frame
        .getByLabel('Grayscale ultrasound image', { exact: true })
        .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
      await frame.getByRole('button', { name: 'Orbit right', exact: true }).click()
      expect(await evidence()).toEqual(before)
      await page.screenshot({ path: out + '/' + lesson.id + '-act.png', fullPage: true })
      await frame
        .locator('.guided-workbench')
        .screenshot({ path: out + '/' + lesson.id + '-workbench.png' })
      await next()
      await expect(
        frame.getByRole('heading', { name: 'Retained ultrasound', exact: true }),
      ).toBeVisible()
      await expect(frame.getByLabel('Inspect a structure')).toHaveCount(0)
      await expect(control).toBeDisabled()
      expect(
        await frame
          .getByLabel('Grayscale ultrasound image', { exact: true })
          .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
      ).toEqual(beforePixels)
      await frame.getByRole('button', { name: 'Orbit left', exact: true }).click()
      expect(
        await frame
          .getByLabel('Grayscale ultrasound image', { exact: true })
          .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
      ).toEqual(beforePixels)
      await page.screenshot({ path: out + '/' + lesson.id + '-observe.png', fullPage: true })
      await answer(lesson.observation)
      await next()
      await answer(lesson.transfer)
      await expect(
        page.getByRole('heading', { name: 'Lesson completed', exact: true }),
      ).toBeVisible()
      results.push({
        lesson: lesson.id,
        acquisition: before,
        retainedPixelsIdentical: true,
        observerIndependent: true,
        demoExcluded: true,
      })
      console.log('PASS ' + lesson.id)
    }
    for (const failure of ['asset', 'webgl'] as const) {
      const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
      if (failure === 'asset')
        await p.route('**/models/guided-v1/mediastinum-teaching.glb', (route) => route.abort())
      else
        await p.addInitScript(() => {
          const original = HTMLCanvasElement.prototype.getContext
          HTMLCanvasElement.prototype.getContext = new Proxy(original, {
            apply(target, receiver: HTMLCanvasElement, args: unknown[]) {
              return args[0] === 'webgl2' ? null : Reflect.apply(target, receiver, args)
            },
          })
        })
      await p.goto(base + '/en/ebus-guided/learn?section=scope-orientation')
      await expect(p.locator('[aria-label="EBUS guided lesson"]')).toHaveAttribute('style', /px/)
      await p.locator('[data-now-primary]').click()
      await p.locator('[data-now-primary]').click()
      const lesson = LESSONS.find((l) => l.id === 'scope-orientation')!
      await p
        .getByLabel(lesson.question.choices.find((c) => c.correct)!.text, { exact: true })
        .check()
      await p.locator('[data-now-primary]').click()
      await p.locator('[data-now-primary]').click()
      if (failure === 'webgl')
        await expect(
          p.getByRole('heading', { name: 'Desktop or tablet lab', exact: true }),
        ).toBeVisible()
      else {
        const f = p.frameLocator('iframe[title="EBUS workbench"]')
        await expect(f.locator('.linked-models [role="alert"]')).toBeVisible({ timeout: 30000 })
        await f.getByLabel('Scope rotation', { exact: true }).fill('0')
      }
      await expect(p.locator('[data-now-primary]')).toBeDisabled()
      results.push({ failure, completionBlocked: true })
      await p.close()
    }
    if (errors.length) throw new Error(errors.join('\n'))
    await writeFile(
      out + '/browser-result.json',
      JSON.stringify({ results, errors }, null, 2) + '\n',
    )
  } catch (error) {
    await page.screenshot({ path: out + '/failure.png', fullPage: true })
    console.error('Browser errors', errors)
    throw error
  } finally {
    await browser.close()
  }
}
void main()
