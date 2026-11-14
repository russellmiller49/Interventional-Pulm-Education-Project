/** @jest-environment node */
import { controlStripDistinguishes, imagingControlIds } from '../content/controlPanel'
import { imagingLearningActivities } from '../content/learningActivities'
import { microCasesForSection } from '../content/microCases'
import { peripheralImagingSectionIds } from '../content/pathway'
import {
  PERIPHERAL_IMAGING_ASSESS_HREF,
  PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF,
} from '../content/routes'
import { imagingSectionSpec } from '../content/sectionSpecs'
import { imagingStageLesson } from '../content/stageLessons'
import { transferOrigin } from '../content/transferOrigins'
import { LESSONS } from '../data/lessons'

/*
 * PI-FELLOW-01: the copy and reference surfaces that described something other than what the
 * screen does. Source IDs are the AI-assisted fellow walkthrough's own, with the PDF page.
 */

describe('report 1.2 — a prompt names the evidence the screen actually carries', () => {
  it('every check names the evidence its own screen carries, and no other', () => {
    for (const sectionId of peripheralImagingSectionIds) {
      const lesson = imagingStageLesson(sectionId)
      for (const step of lesson.steps) {
        if (step.interaction.kind !== 'prediction') continue
        const { round } = step.interaction
        if (round === 1 && transferOrigin(sectionId)) {
          // PI-FELLOW-03 (report CW1): a reused closing question is named as optional review of
          // the section it belongs to, and never as a new situation or an image to inspect.
          expect(step.instruction).not.toMatch(/inspect the image|different situation/i)
          expect(step.instruction).toMatch(/optional review/i)
        } else if (step.activity.visual === 'case') {
          // No visual at all: a written scenario, and it says so.
          expect(step.instruction).not.toMatch(/inspect the image/i)
          expect(step.instruction).toMatch(/read the scenario|stated evidence/i)
        } else if (step.activity.visual === 'dose') {
          // A procedure record, not an image.
          expect(step.instruction).not.toMatch(/inspect the image/i)
          expect(step.instruction).toMatch(/^Read the procedure record\./)
        } else {
          // A visual that is the evidence keeps its image-based instruction.
          expect(step.instruction).toMatch(/inspect the image|stated evidence/i)
        }
      }
    }
  })

  it('no check sends the learner away from its own image', () => {
    // Owner follow-up, 2026-10-12: a check shows the image it asks about or is a written scenario.
    // No instruction disclaims an image, so none may be shown that the question cannot be read off.
    for (const sectionId of peripheralImagingSectionIds) {
      const lesson = imagingStageLesson(sectionId)
      for (const step of lesson.steps)
        expect(step.instruction).not.toMatch(/not the situation|section’s example|teaching model/i)
    }
  })

  it('the seven text-only checks read as scenarios', () => {
    const textOnly = peripheralImagingSectionIds.filter((sectionId) => {
      const lesson = imagingStageLesson(sectionId)
      return lesson.steps[lesson.predictionStepIndex].activity.visual === 'case'
    })
    expect(textOnly).toEqual([
      'imaging-questions',
      // PR #279 sanity review (F3, CHK-S10): Section 10's conceptual check lost the single
      // reconstructed plane beside it, which could not show the elongation its stem describes.
      'dts-acquisition',
      'dts-interpretation',
      'fixed-suite',
      'mobile-suite',
      // Owner follow-up, 2026-10-12: a hand in the primary beam is not on the section's image.
      // (Sections 4 and 16 show their findings on images of their own.)
      'staff-protection',
      'suite-cases',
    ])
    for (const sectionId of textOnly) {
      const lesson = imagingStageLesson(sectionId)
      const step = lesson.steps[lesson.predictionStepIndex]
      expect(step.instruction).toMatch(/^Read the scenario\./)
      // The objective is untouched: each of these stems still states its own findings in words.
      if (step.interaction.kind !== 'prediction') throw new Error('unreachable')
      expect(step.interaction.item.stem.length).toBeGreaterThan(40)
    }
  })

  it('a debrief claims image work only where the section has hands-on image work', () => {
    for (const sectionId of peripheralImagingSectionIds) {
      const lesson = imagingStageLesson(sectionId)
      const debrief = lesson.steps.find((step) => step.interaction.kind === 'explain')!
      const sorts = imagingSectionSpec(sectionId).act.kind === 'sort'
      expect(/evidence from the image work/.test(debrief.instruction)).toBe(!sorts)
    }
  })
})

describe('reports 1.4 and 8.2 — a heading names the task the activity runs', () => {
  it('the section-one reading screen no longer says choose', () => {
    const evidence = imagingLearningActivities('imaging-questions').find((activity) =>
      activity.id.endsWith(':evidence'),
    )!
    expect(evidence.task).toBe('read')
    expect(evidence.title).toBe('Compare what each modality can and cannot show')
    // The activity id is the record key; it is not re-keyed by a rename.
    expect(evidence.id).toBe('imaging-questions:evidence')
  })

  it("the last section's hands-on step names the run-through it is, on the geometry lab", () => {
    // Expert-session round, part 2 (A7): the matching task of report 8.2 became a run-through of
    // one nodule through the workflow. The step keeps its record key.
    const lesson = imagingStageLesson('suite-cases')
    const act = lesson.steps.find((step) => step.interaction.kind === 'lab-task')!
    expect(act.id).toBe('suite-cases:guided')
    expect(act.title).toBe('Wedge, project, collimate and inspect')
    if (act.interaction.kind !== 'lab-task') throw new Error('unreachable')
    expect(act.interaction.lab).toBe('geometry')
    expect(act.suite.controls).toEqual(['wedge', 'orbit', 'tilt', 'field', 'zoom'])
    expect(lesson.steps.some((step) => step.interaction.kind === 'sort')).toBe(false)
  })

  it('pins the remaining reading screen whose title still says choose', () => {
    // Section 5's `projection:alignment` is a reading screen titled "Choose a view for alignment
    // or advancement": the same defect class as 1.4, in a section the walkthrough did not report
    // and this batch was not assigned. It is recorded in the PI-FELLOW-01 handoff as an additional
    // observation rather than renamed here, and this holds the inventory at one until it is.
    const titledChoose = peripheralImagingSectionIds.flatMap((sectionId) =>
      imagingStageLesson(sectionId)
        .steps.filter((step) => step.interaction.kind === 'read' && /^Choose\b/i.test(step.title))
        .map((step) => step.id),
    )
    expect(titledChoose).toEqual(['projection:alignment'])
  })
})

describe('report 1.7 — a section with nothing to adjust prints no control template', () => {
  it('the per-control reference list is kept only where it distinguishes one control', () => {
    const noControl = peripheralImagingSectionIds.filter(
      (sectionId) => !controlStripDistinguishes(imagingSectionSpec(sectionId).controlStrip.states),
    )
    expect(noControl).toEqual([
      'imaging-questions',
      'dts-interpretation',
      'fixed-suite',
      'mobile-suite',
      'staff-protection',
      'dose-reporting',
      'suite-cases',
    ])
    for (const sectionId of noControl) {
      const strip = imagingSectionSpec(sectionId).controlStrip
      // Every family is marked monitoring, so the list would repeat one phrase five times.
      expect(imagingControlIds.every((id) => strip.states[id] === 'monitoring')).toBe(true)
      // The section's own sentence stays and carries the point the list would have made.
      expect(strip.verdict).toMatch(/^no-control-/)
      expect(strip.sentence.trim().length).toBeGreaterThan(0)
    }
    const withControl = peripheralImagingSectionIds.filter((sectionId) =>
      controlStripDistinguishes(imagingSectionSpec(sectionId).controlStrip.states),
    )
    expect(withControl.length).toBeGreaterThan(0)
  })
})

describe('report 8.1 — the integrated cases are named and open', () => {
  it('no lesson still sends the learner to an Assess page after every section', () => {
    const bodies = LESSONS.flatMap((lesson) => lesson.blocks.map((block) => block.body))
    for (const body of bodies) {
      expect(body).not.toMatch(/Assess page/i)
      expect(body).not.toMatch(/once every section has been worked through/i)
    }
  })

  it('the last section names the Integrated cases tab and its open-at-any-time rule', () => {
    const body = LESSONS.find((lesson) => lesson.id === 'suite-cases')!
      .blocks.map((block) => block.body)
      .join(' ')
    expect(body).toMatch(/Integrated cases tab/)
    expect(body).toMatch(/open at any time/i)
    expect(body).toMatch(/no section has to be finished first/i)
  })

  it('the old address keeps working', () => {
    expect(PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF).toBe(PERIPHERAL_IMAGING_ASSESS_HREF)
    expect(PERIPHERAL_IMAGING_ASSESS_HREF).toBe('/peripheral-imaging/assess')
  })
})

describe('report PR2 — a reviewed section points at its own practice case, and invents none', () => {
  it('maps only the sections the case registry actually pairs', () => {
    const mapped = peripheralImagingSectionIds.filter(
      (sectionId) => microCasesForSection(sectionId).length > 0,
    )
    const unmapped = peripheralImagingSectionIds.filter(
      (sectionId) => microCasesForSection(sectionId).length === 0,
    )
    expect(mapped.length).toBeGreaterThan(0)
    // These four have no authored practice case; the reviewed card must link nothing for them
    // rather than borrow another section's case. (Sections 4 and 5 gained theirs in the
    // expert-session round.)
    expect(unmapped).toEqual(['imaging-questions', 'chain-walk', 'good-image', 'suite-cases'])
    for (const sectionId of mapped)
      expect(microCasesForSection(sectionId)[0].sectionId).toBe(sectionId)
  })
})
