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
import {
  fixedExampleEvidence,
  illustrativeOnlyExampleIdentities,
} from '../content/teachingExamples'
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
        } else if (fixedExampleEvidence(sectionId, round) === 'illustrative-model') {
          // A visual the question cannot be read off: it is named as a teaching model, and the
          // learner is sent to the written scenario.
          expect(step.instruction).not.toMatch(/inspect the image/i)
          expect(step.instruction).toMatch(/answer from the written scenario/i)
          expect(step.instruction).toMatch(/teaching model/i)
        } else {
          // A visual that is the evidence keeps its image-based instruction.
          expect(step.instruction).toMatch(/inspect the image|stated evidence/i)
        }
      }
    }
  })

  it('exactly three checks are declared illustrative, and nothing else is relabelled', () => {
    // The declaration is per question and round. Holding the list here means a fourth check cannot
    // quietly lose its image-based framing, and the transfer rounds cannot be caught by it.
    expect(illustrativeOnlyExampleIdentities()).toEqual([
      'current-anatomy:example:0',
      'changing-anatomy:example:0',
      'staff-protection:example:0',
    ])
    for (const sectionId of peripheralImagingSectionIds)
      expect(fixedExampleEvidence(sectionId, 1)).toBe('depicts-the-question')
    // The two checks whose image really is the evidence keep it.
    expect(fixedExampleEvidence('chain-walk', 0)).toBe('depicts-the-question')
    expect(fixedExampleEvidence('cbct-acquisition', 0)).toBe('depicts-the-question')
  })

  it('the five text-only checks read as scenarios', () => {
    const textOnly = peripheralImagingSectionIds.filter((sectionId) => {
      const lesson = imagingStageLesson(sectionId)
      return lesson.steps[lesson.predictionStepIndex].activity.visual === 'case'
    })
    expect(textOnly).toEqual([
      'imaging-questions',
      'dts-interpretation',
      'fixed-suite',
      'mobile-suite',
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

  it("the last section's matching activity names the components it matches to", () => {
    const lesson = imagingStageLesson('suite-cases')
    const sort = lesson.steps.find((step) => step.interaction.kind === 'sort')!
    expect(sort.id).toBe('suite-cases:guided')
    expect(sort.title).toBe('Match each finding to its component of image formation')
    if (sort.interaction.kind !== 'sort') throw new Error('unreachable')
    // Its origins really are the six components, and no decision is asked for.
    expect(sort.interaction.sort.origins).toHaveLength(6)
    expect(sort.title).not.toMatch(/decision/i)
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
    // These six have no authored practice case; the reviewed card must link nothing for them
    // rather than borrow another section's case.
    expect(unmapped).toEqual([
      'imaging-questions',
      'chain-walk',
      'good-image',
      'current-anatomy',
      'projection',
      'suite-cases',
    ])
    for (const sectionId of mapped)
      expect(microCasesForSection(sectionId)[0].sectionId).toBe(sectionId)
  })
})
