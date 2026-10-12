/** @jest-environment node */
import { teachingDemonstration, independentValues } from '../content/teachingExamples'
import { LAB_CONTROLS, labReadouts, labValue } from '../engine/labMetrics'
import { peripheralImagingSectionIds } from '../content/pathway'
import { emptyLabState, labStateAfterChange, labGoalsMet } from '../engine/labGoalEvaluation'
import { imagingLabGoals } from '../content/labGoals'
import {
  fieldContextCoverage,
  spineInField,
  toolTipForDepth,
  projectToDetector,
  LESION_CENTER,
  beamDirection,
} from '../lib/physics'
import { temporal, suiteFrame } from '../components/suite/suiteModel'
import { createEmptyImagingRecord, parseImagingRecord } from '../engine/learnProgress'
import { INTERPRETATION_CHECKS } from '../content/interpretationChecks'

it('authored demonstration settings fit the actual control ranges without silent clamping', () => {
  for (const section of peripheralImagingSectionIds) {
    const demo = teachingDemonstration(section)
    if (!demo?.lab) continue
    for (const example of demo.examples) {
      for (const control of LAB_CONTROLS[demo.lab]) {
        if (control.kind !== 'range' || example.values[control.key] === undefined) continue
        expect(labValue(demo.lab, example.values, control.key, section)).toBe(
          example.values[control.key],
        )
      }
    }
  }
})

it('rotating the source changes the projection without changing tool or lesion coordinates', () => {
  const [baseline, changed] = teachingDemonstration('projection')!.examples
  const tip = toolTipForDepth(Number(baseline.values.depth))
  expect(changed.values.depth).toBe(baseline.values.depth)
  projectToDetector(tip, 0).forEach((value, i) =>
    expect(value).toBeCloseTo(projectToDetector(LESION_CENTER, 0)[i], 9),
  )
  expect(projectToDetector(tip, Number(changed.values.orbit))).not.toEqual(
    projectToDetector(LESION_CENTER, Number(changed.values.orbit)),
  )
  expect(toolTipForDepth(Number(changed.values.depth))).toEqual(tip)
  expect(independentValues('projection', 0)?.depth).not.toBe(baseline.values.depth)
})

it('documents the verified patient axes and cone beam/image-display conventions', () => {
  expect(beamDirection(0)).toEqual([-0, 1, 0])
  expect(suiteFrame(0, 0).source[1]).toBeLessThan(0) // posterior source
  expect(projectToDetector([10, 0, 0], 0)[0]).toBeGreaterThan(0) // patient left → screen right
  expect(projectToDetector([0, 0, 10], 0)[1]).toBeGreaterThan(0) // superior → SVG y decreases
})

it('display edits preserve the physical field, and a cropped context cannot pass on narrowness alone', () => {
  let lab = emptyLabState('field', 'field')
  lab = labStateAfterChange('field', lab, { field: 90 }, 'field')
  const acquisition = labReadouts('field', lab.values, 'field').irradiatedAreaPct
  lab = labStateAfterChange('field', lab, { crop: true, cropWidth: 45, zoom: 2 }, 'field')
  expect(lab.values.field).toBe(90)
  expect(labReadouts('field', lab.values, 'field').irradiatedAreaPct).toBe(acquisition)
  expect(fieldContextCoverage(90)).toBe(true)
  expect(fieldContextCoverage(45)).toBe(false)
  // Display edits and a first notch of collimation satisfy neither stage of the task.
  expect(labGoalsMet(imagingLabGoals('field')!.act, lab, 'field', 'field')).toBe(false)
})

it('the collimation task has two stages, and narrowness alone meets only the second', () => {
  const goals = imagingLabGoals('field')!.act
  // Straight to a tight field: the spine is out, but the field for the tool path was never held.
  let lab = labStateAfterChange('field', emptyLabState('field', 'field'), { field: 40 }, 'field')
  expect(labReadouts('field', lab.values, 'field').spineInField).toBe(false)
  expect(lab.events).toContain('spine-excluded')
  expect(lab.events).not.toContain('path-kept-collimated')
  expect(labGoalsMet(goals, lab, 'field', 'field')).toBe(false)
  // The field for the tool path, then the field for the lesion.
  lab = labStateAfterChange('field', emptyLabState('field', 'field'), { field: 70 }, 'field')
  expect(labReadouts('field', lab.values, 'field')).toMatchObject({
    contextRetained: true,
    spineInField: true,
  })
  expect(labGoalsMet(goals, lab, 'field', 'field')).toBe(false)
  lab = labStateAfterChange('field', lab, { field: 40 }, 'field')
  expect(labGoalsMet(goals, lab, 'field', 'field')).toBe(true)
  // The two cannot hold at once in this geometry, which is why each is recorded when achieved.
  for (let field = 30; field <= 100; field++)
    expect(fieldContextCoverage(field) && !spineInField(field)).toBe(false)
})

it('timing examples hold the intended variables fixed; combined changes cannot satisfy isolated practice', () => {
  const [baseline, width, rate] = teachingDemonstration('time')!.examples.map(
    (example) => example.values,
  )
  expect(width.rate).toBe(baseline.rate)
  expect(width.speed).toBe(baseline.speed)
  expect(rate.width).toBe(baseline.width)
  expect(rate.speed).toBe(baseline.speed)
  const m = (values: typeof baseline) =>
    temporal({
      pulseRate: Number(values.rate),
      pulseWidthMs: Number(values.width),
      speedMmS: Number(values.speed),
      phase: 0.5,
    })
  expect(m(width).interFrameTravel).toBe(m(baseline).interFrameTravel)
  expect(m(width).inFrameBlur).toBe(m(baseline).inFrameBlur * 2)
  expect(m(rate).inFrameBlur).toBe(m(baseline).inFrameBlur)
  expect(m(rate).interFrameTravel).toBe(m(baseline).interFrameTravel * 2)
  const combined = labStateAfterChange(
    'temporal',
    emptyLabState('temporal', 'time'),
    { rate: 3.75, width: 10 },
    'time',
  )
  expect(combined.events).not.toContain('width-isolated')
  expect(combined.events).not.toContain('rate-isolated')
})

it('a stored legacy record keeps both historical and changed item keys readable', () => {
  // The self-paced course writes no first attempts (PI-01); records written before it keep their
  // keys, including the pre-v2 question ids, and still parse.
  const at = '2026-09-10T00:00:00.000Z'
  const firstAttempts: Record<string, { choiceId: string; correct: boolean; at: string }> = {
    'projection:geometry-1': { choiceId: 'a', correct: true, at },
  }
  for (const [section, item] of Object.entries(INTERPRETATION_CHECKS))
    firstAttempts[`${section}:${item.id}`] = { choiceId: 'a', correct: true, at }
  const stored = JSON.stringify({ ...createEmptyImagingRecord(), firstAttempts })
  const read = parseImagingRecord(stored)!
  expect(read.firstAttempts['projection:geometry-1'].choiceId).toBe('a')
  for (const [section, item] of Object.entries(INTERPRETATION_CHECKS)) {
    expect(read.firstAttempts[`${section}:${item.id}`].choiceId).toBe('a')
  }
})
