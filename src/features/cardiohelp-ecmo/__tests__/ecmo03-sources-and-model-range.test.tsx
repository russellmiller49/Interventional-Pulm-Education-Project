import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, within } from '@testing-library/react'

import { criticalCareEvidenceById } from '@/features/critical-care/content/evidenceRegistry'

import { SourcesPanel } from '../components/SourcesPanel'
import { EcmoCitation } from '../components/evidence/EcmoCitation'
import { cardiohelpEvidence, evidenceById } from '../content/evidence'
import {
  ecmoEvidenceIdsBySourceClass,
  ecmoSourceClassLabels,
  ecmoSourceClasses,
  resolveEcmoEvidence,
} from '../content/evidenceResolver'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import {
  ecmoFoundationLessonRuntime,
  ecmoFoundationPrimaryVariant,
  ecmoFoundationVariant,
} from '../content/foundationLessonRuntime'
import {
  ECMO_MODULE_REVIEW_LINE,
  ECMO_SOURCE_REVIEW_LINE,
  ecmoSourceReviewMetadata,
  validateEcmoSourceReviewMetadata,
} from '../content/sourceReviewMetadata'
import { ecmoStoryProblems } from '../content/storyProblems'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
} from '../engine'
import type { EcmoSimulationState } from '../engine/types'
import {
  createEcmoFoundationSessionState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
} from '../session/foundationSession'

/**
 * ECMO-03 (2026-09-15): what each source is and when it was issued, kept apart from when anyone
 * checked it; a review status that no publication flag can promote; and the model ranges behind the
 * flow and gas teaching, run on the engine so the copy that describes a bound cannot drift from it.
 *
 * Nothing here is clinical or device review. The claim-review queue holds every item NOT REVIEWED.
 */

type Action = Parameters<typeof ecmoSimulationReducer>[1]

function settle(state: EcmoSimulationState, seconds: number): EcmoSimulationState {
  let next = state
  for (let tick = 0; tick < seconds; tick += 1) next = ecmoSimulationReducer(next, { type: 'STEP' })
  return next
}

function referenceAfter(profileId: 'vv-reference' | 'va-reference', action: Action, seconds = 60) {
  return settle(
    ecmoSimulationReducer(settle(createReferenceSimulationState(profileId), 8), action),
    seconds,
  )
}

function afterStory(storyId: string) {
  const story = ecmoStoryProblems.find((candidate) => candidate.id === storyId)
  if (!story) throw new Error(`No story ${storyId}`)
  const runtime = ecmoFoundationLessonRuntime(story.sectionId)
  const guided = runtime.guidedActions.find((action) => action.id === story.runGuidedActionId)
  if (!guided) throw new Error(`${storyId} names no guided action`)
  const variant = ecmoFoundationVariant(runtime, 'vv', guided.variantId ?? '')
  if (!variant) throw new Error(`No variant ${guided.variantId}`)
  const before = createEcmoFoundationSessionState(variant).simulation
  const after = ecmoFoundationSessionReducer(
    createEcmoFoundationSessionState(ecmoFoundationPrimaryVariant(runtime, 'vv')),
    ecmoFoundationRestoreAction(variant, guided),
  ).simulation
  return { story, before, after }
}

/** Source text with JSX line wrapping collapsed, so a sentence can be found whole. */
function sourceText(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8').replace(/\s+/g, ' ')
}

const MODULE = 'src/features/cardiohelp-ecmo'

afterEach(() => cleanup())

describe('ECMO-03 source dates, revisions and document checks', () => {
  it('keeps exactly one dating record per registered source', () => {
    expect(validateEcmoSourceReviewMetadata()).toEqual([])
    for (const { id } of cardiohelpEvidence) {
      expect({ id, dated: ecmoSourceReviewMetadata(id) !== undefined }).toEqual({ id, dated: true })
    }
  })

  it('never presents a check date or a review as the date a document was issued', () => {
    for (const { id } of cardiohelpEvidence) {
      const record = ecmoSourceReviewMetadata(id)!
      expect(`${record.published} ${record.publishedBasis}`).not.toMatch(/review|approv|checked/i)
      for (const check of record.checks) {
        expect(check.on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(check.by === null || /AI authoring assistant/.test(check.by)).toBe(true)
        expect(check.what).not.toMatch(/\bapproved\b/i)
      }
    }
    expect(ecmoSourceReviewMetadata('ifu-us-2025-scope')).toMatchObject({
      published: 'Issue date 2025-01',
      revision: expect.stringContaining('Revision 2.3'),
    })
    for (const id of ['ecmo-book-ch9', 'ecmo-book-ch16', 'ecmo-book-ch17', 'ecmo-book-ch18']) {
      expect(ecmoSourceReviewMetadata(id)?.published).toMatch(/^Not stated/)
    }
    for (const id of cardiohelpEvidence
      .filter((reference) => reference.sourceClass === 'clinical-guidance')
      .map((reference) => reference.id)) {
      expect(ecmoSourceReviewMetadata(id)?.publishedBasis).toMatch(/not available locally/)
      expect(ecmoSourceReviewMetadata(id)?.checks).toEqual([])
    }
  })

  it('classes the supplied case curriculum on its own and no longer calls it reviewed', () => {
    const curriculum = evidenceById.get('attached-ecmo-case-curriculum')
    expect(curriculum?.sourceClass).toBe('supplied-curriculum')
    expect(curriculum?.citation).not.toMatch(/review/i)
    expect(ecmoSourceClasses).toContain('supplied-curriculum')
    expect(ecmoEvidenceIdsBySourceClass('educational-model')).toEqual(['bounded-educational-model'])
    expect(ecmoSourceClassLabels['supplied-curriculum']).toMatch(/unpublished/i)
  })

  it('leaves the claim types the shared critical-care registry projects from ECMO unchanged', () => {
    const expected: Readonly<Record<string, string>> = {
      'ifu-us-2025-scope': 'device-workflow',
      'ifu-console-workflow': 'device-workflow',
      'ifu-anomaly-boundary': 'device-workflow',
      'attached-ecmo-case-curriculum': 'model-behavior',
    }
    for (const { id, sourceClass } of cardiohelpEvidence) {
      const record = criticalCareEvidenceById.get(id)
      if (record?.sourceRegistry !== 'ecmo') continue
      const claimType =
        expected[id] ?? (sourceClass === 'educational-model' ? 'model-behavior' : 'clinical')
      expect({ id, claimType: record.claimType }).toEqual({ id, claimType })
    }
    expect(criticalCareEvidenceById.get('attached-ecmo-case-curriculum')?.sourceRegistry).toBe(
      'ecmo',
    )
  })

  it('shows date, revision, each check and the review line on separate lines of a full citation', () => {
    const [ifu] = resolveEcmoEvidence(['ifu-us-2025-scope'])
    const { container } = render(
      <ol>
        <EcmoCitation citation={ifu} />
      </ol>,
    )
    expect(container.querySelector('[data-citation-published]')?.textContent).toContain(
      'Issue date 2025-01',
    )
    expect(container.querySelector('[data-citation-revision]')?.textContent).toContain(
      'Revision 2.3',
    )
    const checks = container.querySelectorAll('[data-citation-check]')
    expect(checks).toHaveLength(1)
    expect(checks[0]?.textContent).toContain('2026-09-15')
    expect(checks[0]?.textContent).toContain('page 13')
    expect(container.querySelector('[data-citation-review]')?.textContent).toBe(
      ECMO_SOURCE_REVIEW_LINE,
    )
    // The document's date and the date it was checked never share a line.
    expect(container.querySelector('[data-citation-published]')?.textContent).not.toContain(
      '2026-09-15',
    )
  })

  it('keeps only the date line in a compact card, and the check date without its detail in a footnote', () => {
    const [guideline] = resolveEcmoEvidence(['elso-adult-vv-2021'])
    const compact = render(
      <ol>
        <EcmoCitation citation={guideline} compact />
      </ol>,
    )
    expect(compact.container.querySelector('[data-citation-published]')?.textContent).toContain(
      '2021',
    )
    expect(compact.container.querySelector('[data-citation-check]')).toBeNull()
    expect(compact.container.querySelector('[data-citation-review]')).toBeNull()
    cleanup()

    const [chapter] = resolveEcmoEvidence(['ecmo-book-ch9'])
    const footnote = render(
      <ol>
        <EcmoCitation citation={chapter} density="footnote" />
      </ol>,
    )
    const check = footnote.container.querySelector('[data-citation-check]')
    expect(check?.textContent).toContain('2026-09-15')
    expect(check?.textContent).not.toContain('printed page 92')
    expect(footnote.container.querySelector('[data-citation-review]')).not.toBeNull()
  })

  it.each(['draft', 'published'] as const)(
    'never turns a %s publication flag into a review claim on the hub',
    (publicationStatus) => {
      const { container } = render(<SourcesPanel publicationStatus={publicationStatus} />)
      const text = container.textContent ?? ''
      expect(text).not.toMatch(/REVIEW APPROVED|Reviewed release|review approved|review required/i)
      expect(container.querySelector('[data-review-status]')?.textContent).toContain(
        ECMO_MODULE_REVIEW_LINE,
      )
      expect(text).toMatch(/Clinical and device review\s*None recorded/)
      expect(text).toContain('currency not checked')
      expect(text).not.toMatch(/The current U\.S\. IFU/)
      const curriculum = container.querySelector('section[data-source-class="supplied-curriculum"]')
      expect(
        within(curriculum as HTMLElement).getByRole('heading', { level: 3 }),
      ).toHaveTextContent(ecmoSourceClassLabels['supplied-curriculum'])
    },
  )
})

describe('ECMO-03 model range behind the flow and gas teaching', () => {
  it('VV reference: saturation stops at 100 by about 4000 rpm while flow and drainage suction keep rising', () => {
    const runs = [3600, 4000, 4500, 5000].map((rpm) =>
      referenceAfter('vv-reference', { type: 'SET_RPM', rpm }),
    )
    const [below, ...atCeiling] = runs
    expect(below.patient.spo2).toBeLessThan(100)
    for (const run of atCeiling) expect(run.patient.spo2).toBe(100)
    for (let index = 1; index < runs.length; index += 1) {
      expect(runs[index].circuit.bloodFlow).toBeGreaterThan(runs[index - 1].circuit.bloodFlow)
      expect(runs[index].circuit.pVen).toBeLessThanOrEqual(runs[index - 1].circuit.pVen)
      expect(runs[index].circuit.recirculationFraction).toBe(runs[0].circuit.recirculationFraction)
    }
    const preOxygenator = atCeiling.map((run) => run.circuit.preOxygenatorSaturation)
    expect(new Set(preOxygenator).size).toBe(1)
  })

  it('VV reference: PaCO₂ falls in a straight line with sweep and stops at 20 mmHg from about 7.5 L/min', () => {
    const paCO2 = (sweep: number) =>
      referenceAfter('vv-reference', { type: 'SET_SWEEP', sweep }, 120).patient.paCO2
    expect(paCO2(4) - paCO2(6)).toBeCloseTo(15, 0)
    expect(paCO2(6)).toBeGreaterThan(20)
    for (const sweep of [7.5, 8, 10, 15]) expect(paCO2(sweep)).toBe(20)
  })

  it('the doubled-sweep story aims past that bound and is still falling toward it when its run ends', () => {
    const { story, before, after } = afterStory('story-doubled-sweep')
    expect(after.gas.sweepLpm).toBe(8)
    expect(after.patient.paCO2).toBeLessThan(before.patient.paCO2)
    expect(after.patient.paCO2).toBeGreaterThan(20)
    expect(settle(after, 120).patient.paCO2).toBe(20)
    // Story copy carries no numbers (story-problems.test.ts); the bound is named, its value is not.
    expect(story.item.explanation).toContain('until it stops at a fixed lower bound')
    expect(story.item.explanation).not.toMatch(/no plateau/i)
  })

  it('the raised-speed story nudges saturation up below the ceiling and leaves PaCO₂ where it was', () => {
    const { story, before, after } = afterStory('story-raised-speed')
    expect(after.patient.spo2).toBeGreaterThan(before.patient.spo2)
    expect(after.patient.spo2).toBeLessThan(100)
    expect(after.patient.paCO2).toBe(before.patient.paCO2)
    expect(story.item.explanation).toContain(
      'has a fixed ceiling, reached on this circuit a little above the speed this change sets',
    )
    // "A little above": the ceiling is not reached at the story's speed, and is reached by 4000 rpm.
    expect(
      referenceAfter('vv-reference', { type: 'SET_RPM', rpm: after.device.rpmSetpoint }).patient
        .spo2,
    ).toBeLessThan(100)
  })

  it('VV recirculation drill: more speed raises displayed flow and the recirculating share while support and saturation fall', () => {
    const opening = settle(createInitialSimulationState('vv-recirculation', 'guided'), 20)
    const openingRpm = opening.device.rpmSetpoint
    const runs = [0, 500, 1000].map((delta) =>
      settle(ecmoSimulationReducer(opening, { type: 'SET_RPM', rpm: openingRpm + delta }), 60),
    )
    for (let index = 1; index < runs.length; index += 1) {
      const [previous, current] = [runs[index - 1], runs[index]]
      expect(current.circuit.bloodFlow).toBeGreaterThan(previous.circuit.bloodFlow)
      expect(current.circuit.recirculationFraction).toBeGreaterThan(
        previous.circuit.recirculationFraction,
      )
      expect(current.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(
        previous.circuit.recirculationAdjustedCircuitFlowLpm,
      )
      expect(current.patient.spo2).toBeLessThan(previous.patient.spo2)
    }
  })

  it('VA reference: regional saturations do not change with speed', () => {
    const slow = referenceAfter('va-reference', { type: 'SET_RPM', rpm: 2500 })
    const fast = referenceAfter('va-reference', { type: 'SET_RPM', rpm: 5000 })
    expect(fast.circuit.bloodFlow).toBeGreaterThan(slow.circuit.bloodFlow)
    expect(fast.patient.rightRadialSpo2).toBe(slow.patient.rightRadialSpo2)
    expect(fast.patient.femoralArterialSpo2).toBe(slow.patient.femoralArterialSpo2)
  })
})

describe('ECMO-03 copy states the bounds the model has', () => {
  it('names the 20 mmHg bound wherever the sweep response is described, and no longer claims no plateau', () => {
    for (const file of [
      `${MODULE}/components/teaching/BloodFlowVsSweepPanel.tsx`,
      `${MODULE}/components/CircuitAndMonitors.tsx`,
    ]) {
      const text = sourceText(file)
      expect({ file, noPlateau: /no plateau/i.test(text) }).toEqual({ file, noPlateau: false })
      expect({ file, bound: text.includes('fixed lower bound of 20 mmHg') }).toEqual({
        file,
        bound: true,
      })
    }
    expect(sourceText(`${MODULE}/content/storyProblems.ts`)).not.toMatch(/no plateau/i)
  })

  it('names the VV saturation ceiling beside pump speed', () => {
    expect(sourceText(`${MODULE}/components/teaching/BloodFlowVsSweepPanel.tsx`)).toContain(
      'until it stops at 100, which the reference circuit reaches at about 4000 rpm',
    )
  })

  it('separates the reference circuit from a recirculation case wherever the share is said to rise', () => {
    const series = sourceText(`${MODULE}/components/teaching/VvSeriesPhysiologyPanel.tsx`)
    expect(series).not.toContain('Each case sets where this starts')
    expect(series).toContain('On the reference circuit it stays at its baseline at every speed.')
    expect(series).toContain(
      'The reference circuit has no established recirculation, so its share stays at the baseline whatever the speed.',
    )
    expect(sourceText(`${MODULE}/content/ecmoValueGuides.ts`)).toContain(
      'On the reference circuit the fraction stays at its baseline, so this value rises with flow.',
    )
  })

  it('tells the learner what to read after each control comparison, and what to check next', () => {
    const { explanation } = ecmoFoundationLearningItemsFor('blood-flow-versus-sweep').prediction
    expect(explanation).toContain('After the sweep comparison, read PaCO₂ and pH')
    expect(explanation).toContain('After the speed comparison, read circuit flow and PaCO₂')
    expect(explanation).toContain('check the gas path itself')
  })
})
