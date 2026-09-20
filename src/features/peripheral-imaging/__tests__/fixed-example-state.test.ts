/** @jest-environment node */
import {
  INDEPENDENT_IMAGE_PANEL_SECTIONS,
  imagingLearningActivities,
} from '../content/learningActivities'
import { peripheralImagingSectionIds, type ImagingSectionId } from '../content/pathway'
import { imagingStageLesson } from '../content/stageLessons'
import {
  fixedExampleIdentity,
  fixedExampleValues,
  independentValues,
} from '../content/teachingExamples'
import { LAB_CONTROLS, labValue } from '../engine/labMetrics'
import { toolTipForDepth, projectToDetector, LESION_CENTER } from '../lib/physics'

/*
 * PI-FELLOW-01, report 2.1 (AI-assisted fellow walkthrough, PDF p.16 with the screenshot on p.22).
 *
 * The banner over a check says the example stays fixed so the question and the image match. It did
 * not: `independentValues` was authored for four sections and returned null for the rest, and the
 * host fell back to `session.lab.values` — the learner's own controls. A learner who set the C-arm
 * to 47 degrees during the component walk then read a question about a superimposed tool and nodule
 * over an image that showed them clearly apart.
 *
 * These are the data-level guards. The rendered history-independence walk is in
 * `fixed-example-history.rendered.test.tsx`; the browser one is in the imaging Playwright spec.
 */

/**
 * The sections whose check renders the shared suite pane, so its state is visible on screen — the
 * sections that could inherit a learner's controls. Sections whose check draws self-contained
 * panels from authored numbers cannot, and need no suite state.
 */
const SUITE_BACKED_CHECKS: readonly ImagingSectionId[] = peripheralImagingSectionIds.filter(
  (sectionId) => {
    const lesson = imagingStageLesson(sectionId)
    const step = lesson.steps[lesson.predictionStepIndex]
    return (
      step?.activity.visual === 'suite' && !INDEPENDENT_IMAGE_PANEL_SECTIONS.includes(sectionId)
    )
  },
)

it('every suite-backed check has an authored state of its own, never the lab default alone', () => {
  expect(SUITE_BACKED_CHECKS.length).toBeGreaterThan(0)
  for (const sectionId of SUITE_BACKED_CHECKS) {
    const values = fixedExampleValues(sectionId, 0)
    expect(Object.keys(values).length).toBeGreaterThan(0)
  }
})

it('a fixed example resolves to a value for every section and round, so nothing can fall back', () => {
  for (const sectionId of peripheralImagingSectionIds) {
    for (const round of [0, 1] as const) {
      expect(fixedExampleValues(sectionId, round)).toBeDefined()
      expect(fixedExampleIdentity(sectionId, round)).toBe(`${sectionId}:example:${round}`)
    }
  }
})

it('resolving the same example twice gives equal values and a fresh object each time', () => {
  for (const sectionId of peripheralImagingSectionIds) {
    const first = fixedExampleValues(sectionId, 0)
    const second = fixedExampleValues(sectionId, 0)
    expect(second).toEqual(first)
    // A caller that spreads or mutates the result cannot reach the authored table.
    expect(second).not.toBe(first)
  }
})

it('authored example settings fit their control ranges without silent clamping', () => {
  for (const sectionId of peripheralImagingSectionIds) {
    const lab = imagingStageLesson(sectionId).lesson.lab
    if (!lab) continue
    for (const round of [0, 1] as const) {
      const values = fixedExampleValues(sectionId, round)
      for (const control of LAB_CONTROLS[lab]) {
        if (control.kind !== 'range' || values[control.key] === undefined) continue
        expect(labValue(lab, values, control.key, sectionId)).toBe(values[control.key])
      }
    }
  }
})

it('the four separately authored rounds are unchanged', () => {
  // These four sections author a different image for the check and the transfer. The repair added
  // states for the sections that had none; it did not re-key or re-author these.
  expect(independentValues('projection', 0)).toEqual({
    orbit: -28,
    tilt: 6,
    depth: -16,
    field: 100,
    zoom: 1,
  })
  expect(independentValues('projection', 1)).toEqual({
    orbit: 0,
    tilt: 0,
    depth: 0,
    field: 100,
    zoom: 1,
  })
  expect(independentValues('two-dimensional', 0)?.field).toBe(45)
  expect(independentValues('dts-acquisition', 0)).toEqual({ sweep: 20, plane: 10 })
  expect(independentValues('tool-confirmation', 0)?.revealed).toBe(false)
  for (const sectionId of ['projection', 'two-dimensional', 'dts-acquisition', 'tool-confirmation'])
    for (const round of [0, 1] as const)
      expect(fixedExampleValues(sectionId as ImagingSectionId, round)).toEqual(
        independentValues(sectionId as ImagingSectionId, round),
      )
})

it("the component walk's fixed example shows the superimposition its own question describes", () => {
  // "The needle tip and the nodule are superimposed on the image although they are two centimetres
  // apart along the X-ray path." At zero obliquity the two project onto the same detector point,
  // and the depth offset is the two centimetres the stem states.
  const lesson = imagingStageLesson('chain-walk')
  const stem = lesson.steps[lesson.predictionStepIndex].interaction
  expect(stem.kind).toBe('prediction')
  if (stem.kind !== 'prediction') throw new Error('unreachable')
  expect(stem.item.stem).toMatch(/superimposed/i)
  expect(stem.item.stem).toMatch(/two centimetres/i)

  const values = fixedExampleValues('chain-walk', 0)
  expect(values.orbit).toBe(0)
  expect(values.tilt).toBe(0)
  expect(values.depth).toBe(20)
  const tip = toolTipForDepth(Number(values.depth))
  projectToDetector(tip, Number(values.orbit)).forEach((coordinate, axis) =>
    expect(coordinate).toBeCloseTo(projectToDetector(LESION_CENTER, Number(values.orbit))[axis], 9),
  )
})

it('the stored-display check opens on the acquisition, with no display operation applied', () => {
  // good-image asks which change alters what is acquired rather than how it is displayed, so its
  // fixed example must not arrive already cropped or zoomed.
  const values = fixedExampleValues('good-image', 0)
  expect(values.field).toBe(100)
  expect(values.crop).toBe(false)
  expect(values.zoom).toBe(1)
})

it('a transfer round carries no image, so it asks the learner to read a scenario', () => {
  for (const sectionId of peripheralImagingSectionIds) {
    const transfer = imagingLearningActivities(sectionId).find(
      (activity) => activity.task === 'transfer',
    )!
    expect(transfer.visual).toBe('case')
  }
})
