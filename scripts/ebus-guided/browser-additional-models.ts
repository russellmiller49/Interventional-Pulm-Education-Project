/**
 * The four model labs, walked on the real lesson page (self-paced course, EBUS-01).
 *
 * Each model is the second unit of a lesson since the consolidation of 2026-11-10 (the phantom is
 * the first unit of its lesson). A model unit is: a briefing (text and a diagram, no live model),
 * the acquisition (the one place the model workbench is live), and the held image, shown with
 * nothing asked except for the contact model's one check. The lesson then runs on to its own
 * closing check.
 */
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import {
  CONTENT_LESSONS,
  LESSONS,
  lessonById,
  partsOf,
} from '../../src/features/ebus-guided/content/curriculum'
import { activitiesForLesson } from '../../src/features/ebus-guided/content/stage'
import { labGoalRequirements } from '../../src/features/ebus-guided/content/types'
import { PROGRESS_STORAGE_KEY } from '../../src/features/ebus-guided/engine/selfPacedProgress'
import { STORAGE_KEY as LEGACY_STORAGE_KEY } from '../../src/features/ebus-guided/engine/progress'
import { EMPTY_EBUS_OBSERVATION } from '../../src/lib/ebus-guided-bridge'
import { MODEL_STEPS } from '../../src/lib/ebus-model-contract'
import { performModel } from './browser-model-actions'

type Question = (typeof LESSONS)[number]['question']
const ALL_DONE = 'All steps done. Select “Continue with this image” in the lesson.'
// Structures the model keeps out of hover and the selector until the explanation is open.
const CONCEALED = /needle tip|needle shaft|air gap|bubble|calcified/i

async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3146',
    out = 'artifacts/ebus-guided/additional-models'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 }, hasTouch: true })
  const errors: string[] = [],
    results: object[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const primary = () => page.locator('[data-now-primary]'),
    next = () => primary().click(),
    flow = () => page.locator('[data-ebus-flow]'),
    title = () => page.locator('#ebus-task-title'),
    note = () => page.locator('[data-advance-note]'),
    workbench = () => page.locator('iframe[title="EBUS workbench"]')
  const card = (q: Question) => page.locator(`[data-question-id="${q.id}"]`)
  /** Select a response and check it. Checks are optional; nothing waits on them. */
  const respond = async (q: Question, text: string) => {
    await expect(card(q)).toHaveAttribute('data-answered', 'false')
    await expect(card(q).locator('fieldset')).toBeEnabled()
    await page.getByLabel(text, { exact: true }).check()
    await card(q).getByRole('button', { name: 'Check response', exact: true }).click()
    await expect(card(q)).toHaveAttribute('data-answered', 'true')
  }
  const answer = (q: Question) => respond(q, q.choices.find((c) => c.correct)!.text)
  const onActivity = async (activity: { id: string; title: string }) => {
    await expect(flow()).toHaveAttribute('data-activity-id', activity.id, { timeout: 60000 })
    await expect(title()).toHaveText(activity.title)
  }
  /**
   * Continue to a step of the open lesson. A lab on the way is left without an image; the model
   * units sit inside a lesson that may have another lab before them (consolidation of 2026-11-10).
   */
  const toActivity = async (activity: { id: string; title: string }) => {
    for (let guard = 0; guard < 20; guard++) {
      if ((await flow().getAttribute('data-activity-id')) === activity.id) break
      const skip = page.locator('[data-skip-acquisition]')
      await ((await skip.count()) ? skip : primary()).click()
    }
    await onActivity(activity)
  }
  /** The steps of the holding lesson that belong to one model unit. */
  const stepsOf = (unit: (typeof CONTENT_LESSONS)[number]) => {
    const lesson = lessonById(unit.id)!
    const activities = activitiesForLesson(lesson)
    const own = activities.filter((a) => a.lessonId === unit.id)
    return { lesson, activities, own }
  }
  const modelUnits = CONTENT_LESSONS.filter((l) => l.lab?.modelPackage)
  try {
    expect(modelUnits).toHaveLength(4)
    for (const unit of modelUnits) {
      const pkg = unit.lab!.modelPackage!,
        frame = page.frameLocator('iframe[title="EBUS workbench"]'),
        { lesson, activities, own } = stepsOf(unit),
        // Flow of 2026-11-10: the model's image is shown with nothing asked, except the contact
        // model, which keeps one check on the learner's own image. A unit's own prediction is
        // asked only where it opens the lesson (the phantom).
        prediction = own.find((a) => a.kind === 'prediction'),
        briefing = own.find((a) => a.kind === 'briefing')!,
        acquisition = own.find((a) => a.interaction === 'acquire')!,
        // The needle lab ends with the assembly out, so its explanation is read on the lab's two
        // pictures (tip in the image, tip turned out of it) and not on a held frame.
        held = own.find((a) => a.image === 'held') ?? own[own.indexOf(acquisition) + 1],
        after = activities[activities.indexOf(held) + 1],
        closing = activities.at(-1)!,
        closingUnit = partsOf(lesson).find((part) => part.id === closing.lessonId)!
      const modelFrame = frame.locator('[data-model-frame]')
      const readout = frame.locator('[data-model-reference-readout]')
      const selector = frame.getByLabel('Find a structure in the model', { exact: true })
      const stepsText = (done: number) => `Steps: ${done} of ${MODEL_STEPS[pkg].length} done`
      const unmetStep = labGoalRequirements(unit.lab!, EMPTY_EBUS_OBSERVATION).find(
        (r) => r.id === 'model-steps',
      )!.text

      // The briefing is text and a diagram. No live model is embedded before the acquisition.
      await page.goto(base + '/en/ebus-guided/learn?section=' + lesson.id)
      if (prediction) {
        // The commitment comes before any teaching, figure or model.
        await onActivity(prediction)
        await expect(workbench()).toHaveCount(0)
        await expect(page.locator('[data-evidence-identity]')).toHaveCount(0)
        await answer(unit.question)
        await expect(primary()).toHaveText('Continue to ' + briefing.title)
        await next()
      }
      // The model unit's briefing: straight after the prediction, or after the lesson's first unit.
      await toActivity(briefing)
      await expect(page.locator('[data-evidence-identity="supplied"]')).toBeVisible()
      await expect(workbench()).toHaveCount(0)
      await expect(primary()).toHaveText('Continue to ' + acquisition.title)
      await next()

      // The acquisition: the one live model. Nothing is done yet, so the image cannot be held.
      await onActivity(acquisition)
      // The needle lab is worked in the one-screen console; the other models keep the reading
      // layout with the advance row beside the heading.
      const consoleLab = pkg === 'needle'
      await expect(page.locator('[data-now-card]')).toHaveAttribute(
        consoleLab ? 'data-console' : 'data-top-advance',
        'true',
      )
      await expect(page.locator('[data-evidence-identity="live"]')).toBeVisible()
      await expect(modelFrame).toHaveAttribute('data-model-frame', /additional-models-v1/, {
        timeout: 60000,
      })
      await expect(primary()).toHaveText('Continue with this image')
      await expect(primary()).toBeDisabled()
      // In the console the open steps are listed beside the button, so the note under it is empty.
      if (consoleLab)
        await expect(page.locator('[data-acquisition-outstanding]')).toContainText(unmetStep)
      else await expect(note()).toHaveText('To turn this on: ' + unmetStep)
      await expect(page.locator('[data-skip-acquisition]')).toHaveText('Continue without an image')
      // The advance row sits beside the heading, above the workbench.
      const advanceBox = (await primary().boundingBox())!,
        benchBox = (await workbench().boundingBox())!
      expect(advanceBox.y + advanceBox.height).toBeLessThanOrEqual(benchBox.y)
      await expect(frame.locator('.model-kicker')).toHaveText('Model activity')
      await expect(frame.locator('.model-controls h2')).toHaveText(
        consoleLab ? stepsText(0) : 'Controls',
      )
      await expect(frame.locator('.model-steps')).toContainText(stepsText(0))
      await expect(frame.getByText(ALL_DONE)).toHaveCount(0)
      await expect(frame.locator('.model-controls fieldset')).toBeEnabled()

      // Real mesh hover and an equivalent discoverable selector, independent of activity evidence.
      const canvas = frame.locator('.model-viewport canvas')
      await canvas.scrollIntoViewIfNeeded()
      let discovered = ''
      for (const y of [0.5, 0.4, 0.6, 0.3, 0.7]) {
        if (discovered) break
        for (const x of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
          const b = (await canvas.boundingBox())!
          await canvas.hover({ position: { x: b.width * x, y: b.height * y } })
          const tooltip = frame.locator('.model-viewport [role=tooltip]')
          if (await tooltip.isVisible()) {
            discovered = (await tooltip.innerText()).trim()
            break
          }
        }
      }
      expect(discovered).not.toBe('')
      expect(discovered).not.toMatch(CONCEALED)
      await page.screenshot({ path: `${out}/${pkg}-worked-hover.png` })
      await canvas.press('Escape')
      await expect(frame.getByRole('tooltip')).toHaveCount(0)
      await expect(
        frame.locator('details', { hasText: 'How to move the model' }),
      ).not.toHaveAttribute('open', '')
      // Choosing a structure outlines it and says so; the list holds nothing the activity conceals.
      // The needle lab names the handle's parts on the handle itself and has no list to choose from;
      // nothing in it is concealed, because the learner works the needle and watches it.
      const concealedOptions = await selector.locator('option').allInnerTexts()
      expect(concealedOptions.length).toBeGreaterThan(1)
      if (consoleLab) {
        await expect(selector).toBeHidden()
        await expect(frame.locator('.needle-handle-name')).toHaveText([
          'Sheath adjuster',
          'Sheath lock',
          'Needle stop',
          'Needle slider',
          'Stylet',
        ])
      } else {
        expect(concealedOptions.filter((label) => CONCEALED.test(label))).toEqual([])
        await selector.selectOption({ index: 1 })
        await expect(frame.locator('.model-inspector [role=status]')).toHaveText(
          concealedOptions[1].trim() + ': outlined in violet in the model.',
        )
      }
      await expect(frame.locator('.model-image [role=tooltip]')).toHaveCount(0)
      if (pkg === 'measurement') await expect(readout).toHaveCount(0)
      // Looking around the model is not a step: the image still cannot be held.
      await expect(frame.locator('.model-steps')).toContainText(stepsText(0))
      await expect(primary()).toBeDisabled()

      await performModel(frame, pkg)
      await expect(frame.locator('.model-steps')).toContainText(stepsText(MODEL_STEPS[pkg].length))
      await expect(primary()).toBeEnabled()
      await expect(note()).toHaveText('')
      await page.screenshot({ path: `${out}/${pkg}-act-complete.png` })
      const id = await modelFrame.getAttribute('data-model-frame')
      expect(id).toMatch(/additional-models-v1/)
      await next()

      // The held image: the same frame, locked, nothing revealed before a response.
      await onActivity(held)
      let revealedOptions: string[] = []
      if (held.image !== 'held') {
        await expect(workbench()).toHaveCount(0)
        await expect(page.locator('[data-needle-tip-figure] img')).toHaveCount(2)
        await expect(page.locator('[data-needle-tip-figure]')).toContainText('Tip in the image.')
        await expect(page.locator('[data-needle-tip-figure]')).toContainText(
          'The line now ends short of the tip',
        )
        await expect(page.locator('[data-question-id]')).toHaveCount(0)
      } else {
        await expect(page.locator('[data-evidence-identity="held"]')).toBeVisible()
        await expect(frame.locator('.model-controls fieldset')).toHaveAttribute('disabled', '')
        await expect(
          frame.getByRole('button', { name: 'Reset activity', exact: true }),
        ).toBeDisabled()
        await expect(frame.locator('.model-kicker')).toHaveText('Your image')
        await expect(frame.locator('.model-controls h2')).toHaveText('Your image')
        await expect(frame.locator('.model-steps')).toHaveCount(0)
        await expect(modelFrame).toHaveAttribute('data-model-frame', id!)
        await page.screenshot({ path: `${out}/${pkg}-observe.png` })
        if (held.questions.length) {
          // A check on the learner's own image: nothing is revealed before a response.
          await expect(frame.locator('.model-image [role=tooltip]')).toHaveCount(0)
          await expect(primary()).toHaveText('Continue without answering')
          await expect(card(unit.observation)).toBeVisible()
          await answer(unit.observation)
          await expect(modelFrame).toHaveAttribute('data-model-frame', id!)
          // The held contact state has a reflector, which the list names only once a response is in.
          // The reveal reaches the lab as a message, so the list is polled rather than read once.
          if (pkg === 'contact')
            await expect
              .poll(async () =>
                (await selector.locator('option').allInnerTexts()).filter((label) =>
                  CONCEALED.test(label),
                ),
              )
              .toHaveLength(1)
        } else {
          // Nothing is asked here, so the model's own reference for the held plane is shown at once.
          await expect(page.locator('[data-question-id]')).toHaveCount(0)
          if (pkg === 'measurement') {
            await expect(readout).toBeVisible()
            await expect(readout).toContainText('short axis 16.0 phantom mm')
            await expect(frame.locator('[data-model-reference]')).toHaveCount(1)
          }
          if (pkg === 'routes') {
            // Unsupported final state still retains a visible anatomy view, with no invented route arrow.
            await expect(
              frame.getByText('No supported orientation preset for this selection.', {
                exact: true,
              }),
            ).toBeVisible()
          }
        }
        // What the structure list names once the held image is revealed (after the response, or
        // at once where nothing is asked).
        revealedOptions = await selector.locator('option').allInnerTexts()
      }
      await page.screenshot({ path: `${out}/${pkg}-explain.png` })
      await expect(primary()).toHaveText('Continue to ' + after.title)
      await next()

      // The rest of the lesson, to its closing check (the lesson's own, not the model unit's).
      await toActivity(closing)
      const closingCheck = closingUnit.transfer
      const unsafe = closingCheck.choices.find((c) => c.unsafe)
      if (pkg === 'needle' && unsafe) {
        // An unsafe response is named as unsafe and can be tried again; nothing is blocked.
        await respond(closingCheck, unsafe.text)
        await expect(card(closingCheck)).toContainText(
          'Unsafe — this would put a real patient at risk',
        )
        await expect(primary()).toBeEnabled()
        await card(closingCheck).getByRole('button', { name: 'Try again', exact: true }).click()
      }
      await answer(closingCheck)
      await expect(primary()).toHaveText('Finish lesson')
      await next()
      await expect(title()).toHaveText('Lesson finished')
      const summary = page.locator('[data-session-summary]')
      await expect(summary).toContainText(briefing.title + ': Read')
      await expect(summary).toContainText(acquisition.title + ': Image acquired')
      if (prediction) await expect(summary).toContainText(prediction.title + ': Check answered')
      await expect(summary).toContainText(
        held.title + (held.questions.length ? ': Check answered' : ': Read'),
      )
      await expect(summary).toContainText(closing.title + ': Check answered')
      results.push({
        lesson: lesson.id,
        unit: unit.id,
        package: pkg,
        frameId: id,
        hover: discovered,
        concealed: true,
        structures: {
          beforeSteps: concealedOptions.slice(1),
          heldRevealed: revealedOptions.slice(1),
        },
        completed: true,
      })
    }
    // Only the place and the reviewed lessons are stored: no responses, no held images.
    const stored = await page.evaluate(
      ([key, legacy]) => ({
        record: JSON.parse(localStorage.getItem(key)!),
        legacy: localStorage.getItem(legacy),
      }),
      [PROGRESS_STORAGE_KEY, LEGACY_STORAGE_KEY],
    )
    // The four lessons that hold a model unit are the ones reviewed.
    const holders = modelUnits.map((unit) => lessonById(unit.id)!)
    expect([...stored.record.reviewedLessonIds].sort()).toEqual(holders.map((l) => l.id).sort())
    expect(Object.keys(stored.record).sort()).toEqual(
      [
        'lastLocation',
        'openedIntegratedCaseIds',
        'openedPracticeCaseIds',
        'reviewLaterLessonIds',
        'reviewedLessonIds',
        'updatedAt',
        'version',
        'visitedLessonIds',
      ].sort(),
    )
    expect(stored.legacy).toBeNull()
    // A reload starts the lesson from its first task and keeps the reviewed marks.
    await page.reload()
    await onActivity(activitiesForLesson(holders.at(-1)!)[0])
    await expect(page.locator('[data-lesson-chrome]')).toContainText(
      `4 of ${LESSONS.length} lessons reviewed`,
    )

    const phantom = stepsOf(modelUnits.find((unit) => unit.lab?.modelPackage === 'measurement')!)
    await page.goto(base + '/en/ebus-guided/learn?section=' + phantom.lesson.id)
    await toActivity(phantom.own.find((a) => a.interaction === 'acquire')!)
    await page.setViewportSize({ width: 900, height: 1050 })
    const frame = page.frameLocator('iframe[title="EBUS workbench"]')
    await expect(frame.locator('.model-viewport canvas')).toBeVisible({ timeout: 60000 })
    await expect(frame.locator('.model-steps')).toBeVisible()
    await page.screenshot({ path: out + '/compact-900.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('heading', { name: 'Desktop or tablet lab' })).toBeVisible()
    await expect(workbench()).toBeHidden()
    await expect(primary()).toBeDisabled()
    await page.screenshot({ path: out + '/phone-gate.png' })
    await page.setViewportSize({ width: 1500, height: 1050 })
    // A failed new model must not yield a held image.
    await page.route('**/guided-v2/*.glb*', (route) => route.abort())
    // The old address of the contact model opens the lesson that now holds it.
    const contact = stepsOf(modelUnits.find((unit) => unit.id === 'contact-cutaway-model')!)
    await page.goto(base + '/en/ebus-guided/learn?section=contact-cutaway-model')
    await toActivity(contact.own.find((a) => a.interaction === 'acquire')!)
    await expect(frame.getByRole('alert')).toContainText('could not', { timeout: 60000 })
    await expect(primary()).toHaveText('Continue with this image')
    await expect(primary()).toBeDisabled()
    await expect(page.locator('[data-skip-acquisition]')).toBeVisible()
    expect(errors).toEqual([])
    await writeFile(
      out + '/browser-result.json',
      JSON.stringify(
        {
          results,
          errors,
          reviewedLessons: stored.record.reviewedLessonIds,
          responsesStored: false,
          compact: 900,
          phoneGate: 390,
          assetFailureBlocked: true,
        },
        null,
        2,
      ),
    )
    console.log('All four additional model journeys passed')
  } catch (e) {
    await page.screenshot({ path: out + '/failure.png' })
    throw e
  } finally {
    await browser.close()
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
