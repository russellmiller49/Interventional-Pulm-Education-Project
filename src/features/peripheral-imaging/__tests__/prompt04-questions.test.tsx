import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render } from '@testing-library/react'

import { PeripheralImagingHub } from '../components/PeripheralImagingHub'
import { PeripheralImagingIntegratedCasesLanding } from '../components/PeripheralImagingIntegratedCasesLanding'
import {
  imagingCaseById,
  imagingCases,
  LEGACY_INTEGRATED_CASE_ADDRESSES,
  resolveIntegratedCaseAddress,
  validateImagingCases,
} from '../content/cases'
import {
  INTERPRETATION_CHECKS,
  RETIRED_INTERPRETATION_CHECKS,
} from '../content/interpretationChecks'
import { imagingMicroCaseById } from '../content/microCases'
import { imagingSectionSpec } from '../content/sectionSpecs'
import { imagingSectionItems } from '../content/stageItems'
import { imagingStageLesson } from '../content/stageLessons'
import {
  fixedExampleEvidence,
  illustrativeOnlyExampleIdentities,
} from '../content/teachingExamples'
import { transferOrigin, transferReviewInstruction } from '../content/transferOrigins'
import { QUESTION_BY_ID, QUESTIONS } from '../data/questions'
import {
  createEmptyImagingRecord,
  LEGACY_IMAGING_RECORD_KEY_V2,
  parseImagingRecord,
} from '../engine/learnProgress'
import {
  createEmptyImagingProgress,
  IMAGING_PROGRESS_STORAGE_KEY,
  parseImagingProgress,
  withLocation,
} from '../engine/selfPacedProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${
            href.query && Object.keys(href.query).length > 0
              ? `?${new URLSearchParams(href.query).toString()}`
              : ''
          }`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: jest.fn() }),
}))

beforeEach(() => localStorage.clear())
afterEach(cleanup)

/*
 * Prompt 04 runtime (owner decisions OD4-01, OD4-05, 2026-09-22). The versioning rule: a change to
 * a stem's evidence, a choice or a key's wording gets a new id, the old item stays in the bank so a
 * record written under it keeps its meaning, and a replaced integrated-case address redirects. The
 * one approved exception is practice case 9 (QS-5), whose decision, choices and key are unchanged.
 */

const PLAUSIBILITY = (itemChoices: readonly { id: string; plausibility: string }[]) =>
  Object.fromEntries(itemChoices.map((choice) => [choice.id, choice.plausibility]))

describe('question identity and versioning', () => {
  it('gives each changed section check a new id and keeps the questions it displaced in the bank', () => {
    expect(INTERPRETATION_CHECKS['imaging-questions']?.id).toBe(
      'imaging-questions-interpretation-v2',
    )
    expect(INTERPRETATION_CHECKS.signal?.id).toBe('signal-interpretation-v3')
    expect(INTERPRETATION_CHECKS['changing-anatomy']?.id).toBe('changing-anatomy-interpretation-v2')
    // The displaced items, unchanged, under their own ids.
    expect(QUESTION_BY_ID['choose-1'].stem).toBe(
      'Navigation places the catheter at the virtual target. The needle is visible on fluoroscopy, but the lesion is not. What does this evidence confirm?',
    )
    expect(QUESTION_BY_ID['change-1'].stem).toBe(
      'A CBCT reconstruction shows duplicated tool and lesion edges from motion during the spin. What most directly addresses the cause before repeating it?',
    )
    const retired = QUESTION_BY_ID['signal-interpretation-v2']
    expect(RETIRED_INTERPRETATION_CHECKS).toContain(retired)
    expect(retired.correct).toBe('c')
    expect(retired.choices.map((choice) => choice.text)).toEqual([
      'Quantum noise; use display zoom to restore missing photons.',
      'Superimposition; raising pulse rate separates overlapping anatomy.',
      'Scatter-related contrast loss; review field size and beam path.',
    ])
  })

  it('never reuses an id, and every new id is distinct from the one it supersedes', () => {
    const ids = [
      ...QUESTIONS.map((question) => question.id),
      ...Object.values(INTERPRETATION_CHECKS).map((question) => question!.id),
      ...RETIRED_INTERPRETATION_CHECKS.map((question) => question.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    for (const [previous, next] of [
      ['choose-1', 'imaging-questions-interpretation-v2'],
      ['signal-interpretation-v2', 'signal-interpretation-v3'],
      ['change-1', 'changing-anatomy-interpretation-v2'],
      ['case-4', 'case-4-v2'],
      ['case-5', 'case-5-v2'],
      ['case-8', 'case-8-v2'],
    ]) {
      expect(QUESTION_BY_ID[previous]).toBeDefined()
      expect(QUESTION_BY_ID[next]).toBeDefined()
      expect(QUESTION_BY_ID[next].stem).not.toBe(QUESTION_BY_ID[previous].stem)
    }
  })

  it('renders the new checks under section-scoped item ids, and leaves every closing question alone', () => {
    expect(imagingSectionItems('imaging-questions').prediction.id).toBe(
      'imaging-questions:imaging-questions-interpretation-v2',
    )
    expect(imagingSectionItems('signal').prediction.id).toBe('signal:signal-interpretation-v3')
    expect(imagingSectionItems('changing-anatomy').prediction.id).toBe(
      'changing-anatomy:changing-anatomy-interpretation-v2',
    )
    // choose-1 is still the worked example's twin and the optional review in Sections 2 and 4.
    expect(imagingSectionItems('chain-walk').transfer.id).toBe('chain-walk:choose-1')
    expect(imagingSectionItems('current-anatomy').transfer.id).toBe('current-anatomy:choose-1')
    expect(imagingSectionItems('changing-anatomy').transfer.id).toBe('changing-anatomy:prior-1')
  })

  it('carries the approved sample wording, keys and distractor tags', () => {
    const s1 = imagingSectionItems('imaging-questions').prediction
    expect(s1.stem).toBe(
      'Navigation places the catheter at the virtual target. On the frontal fluoroscopic projection, a faint rounded opacity now overlaps the needle tip. No other projection has been taken. What does this evidence establish?',
    )
    expect(s1.correctChoiceIds).toEqual(['b'])
    expect(PLAUSIBILITY(s1.choices)).toEqual({
      a: 'incorrect-mechanism',
      b: 'best',
      c: 'reasonable-but-incomplete',
    })

    const s6 = imagingSectionItems('signal').prediction
    expect(s6.stem).toBe(
      'Image B was made at the same projection as Image A, with the collimator open to the edges of the detector. In Image B the diaphragm, vessels and target are nearly the same gray; the background is smooth and the tool edge is sharp. Which limitation, and which response, fit Image B?',
    )
    expect(s6.choices.map((choice) => choice.label)).toEqual([
      'Quantum noise from too few detected photons; raise output or select a higher-dose preset.',
      'Anatomical superimposition; change the C-arm projection, planned from the CT.',
      'Scatter-related contrast loss; collimate to the task while keeping the required anatomy.',
    ])
    expect(s6.correctChoiceIds).toEqual(['c'])
    // Every option pairs a real cause with that cause's real response: no impossible fix remains.
    expect(s6.choices.map((choice) => choice.label).join(' ')).not.toMatch(
      /zoom.*photons|pulse rate separates/i,
    )

    const s16 = imagingSectionItems('changing-anatomy').prediction
    expect(s16.stem).toBe(
      'The first CBCT spin of the case is on the review monitor. The catheter and the nodule margin each appear twice, a few millimetres apart, on several planes. The table, the C-arm and the tool did not move between the start and the end of the spin. What should change before a second spin?',
    )
    // The stem describes the appearance and leaves the cause to the learner.
    expect(s16.stem).not.toMatch(/motion|breath/i)
    expect(s16.correctChoiceIds).toEqual(['b'])
    expect(s16.itemType).toBe('management-decision')

    const case4 = imagingCaseById.get('case-4-v2')!.item
    expect(case4.correctChoiceIds).toEqual(['c'])
    expect(PLAUSIBILITY(case4.choices)).toEqual({
      a: 'unsafe',
      b: 'reasonable-but-incomplete',
      c: 'best',
    })
    expect(imagingCaseById.get('case-4-v2')!.critical).toBe(true)

    const case5 = imagingCaseById.get('case-5-v2')!.item
    expect(case5.correctChoiceIds).toEqual(['a'])
    expect(case5.stem).toBe(
      'Linked thin axial, coronal and sagittal planes from a CBCT spin show the modeled lesion, the needle tip and the needle’s side-cutting window. Nothing has moved since the acquisition. Which documentation is most accurate?',
    )
    expect(case5.stem).not.toMatch(/fictional/i)
    expect(PLAUSIBILITY(case5.choices)).toMatchObject({
      b: 'incorrect-mechanism',
      c: 'reasonable-but-incomplete',
    })

    const case8 = imagingCaseById.get('case-8-v2')!.item
    expect(case8.correctChoiceIds).toEqual(['a'])
    expect(case8.stem).toMatch(/cumulative reference air kerma in mGy/)
    expect(case8.choices.map((choice) => choice.label).join(' ')).not.toMatch(/24 Gy/)
    expect(PLAUSIBILITY(case8.choices)).toMatchObject({
      b: 'incorrect-mechanism',
      c: 'reasonable-but-incomplete',
    })

    for (const item of [s1, s6, s16, case4, case5, case8]) expect(item.reviewStatus).toBe('draft')
  })

  it('keeps the Section 16 check’s image declared as the section’s teaching model, not evidence', () => {
    expect(fixedExampleEvidence('changing-anatomy', 0)).toBe('illustrative-model')
    expect(illustrativeOnlyExampleIdentities()).toEqual([
      'current-anatomy:example:0',
      'changing-anatomy:example:0',
      'staff-protection:example:0',
    ])
  })

  it('labels the two reviews of choose-1 truthfully now Section 1 renders its new check instead', () => {
    const chain = transferOrigin('chain-walk')!
    expect(chain.seenIn).toEqual([])
    expect(transferReviewInstruction(chain)).toMatch(/^This question reviews Section 1 \(/)
    expect(transferReviewInstruction(chain)).not.toMatch(/asked again/)
    const current = transferOrigin('current-anatomy')!
    expect(transferReviewInstruction(current)).toMatch(
      /it first appears at the end of Section 2 \(/,
    )
  })

  it('keeps every check self-paced: open gate, explanation first, nothing mandatory', () => {
    for (const sectionId of ['imaging-questions', 'signal', 'changing-anatomy'] as const) {
      const lesson = imagingStageLesson(sectionId)
      for (const step of lesson.steps) expect(step.gate).toBe('open')
    }
  })
})

describe('practice case 9 keeps its id and loses what the model cannot support (QS-5)', () => {
  it('keeps id, decision, choices and key; the stem and situation now describe the figure', () => {
    const practice = imagingMicroCaseById.get('dts-interpretation-practice-1')!
    expect(practice.item.id).toBe('practice:dts-interpretation-practice-1')
    expect(practice.item.stem).toBe(
      'Which interpretation of the reconstructed planes is best supported?',
    )
    expect(practice.item.correctChoiceIds).toEqual(['a'])
    expect(practice.item.choices.map((choice) => choice.label)).toEqual([
      'The lesion margin on these planes comes from another acquisition, since the catheter is absent from them.',
      'The catheter is too thin to appear on these planes, so the lesion margin comes from this DTS acquisition.',
      'Registration has drifted, so the catheter lies on other planes and the margin comes from this DTS.',
    ])
    const text = `${practice.presentationTitle} ${practice.situation}`
    // The authored nodule is in the posterior left lung, a smooth sphere, and no lobe is named.
    expect(text).not.toMatch(/right lower lobe|lower lobe|\blobe\b|lobulated|segment/i)
    // The learner finds the absence on the figure: neither title nor situation narrates it.
    expect(text).not.toMatch(/absent|appears on none|none of them/i)
    expect(practice.situation).toMatch(/The figure shows/)
  })

  it('claims no airway anywhere the learner reads it: the modeled catheter runs through lung-density CT', () => {
    const practice = imagingMicroCaseById.get('dts-interpretation-practice-1')!
    const question = QUESTION_BY_ID['dts-interpretation-practice-1']
    const everything = [
      practice.presentationTitle,
      practice.situation,
      question.stem,
      ...question.choices.flatMap((choice) => [choice.text, choice.rationale]),
      question.takeaway,
    ].join(' ')
    expect(everything).not.toMatch(/airway/i)
    // The one rationale that named it keeps its argument with the model's own word.
    expect(question.choices[2].rationale).toMatch(/moves the catheter and the anatomy around it/)
  })
})

describe('integrated-case slots and their old addresses', () => {
  it('replaces the fourth, fifth and eighth slots and redirects each old address to its slot', () => {
    expect(validateImagingCases()).toEqual([])
    expect(imagingCases.map((imagingCase) => imagingCase.id)).toEqual([
      'case-1',
      'case-2',
      'case-3',
      'case-4-v2',
      'case-5-v2',
      'case-6',
      'case-7',
      'case-8-v2',
    ])
    expect(LEGACY_INTEGRATED_CASE_ADDRESSES).toEqual({
      'case-4': 'case-4-v2',
      'case-5': 'case-5-v2',
      'case-8': 'case-8-v2',
    })
    for (const [legacy, current] of Object.entries(LEGACY_INTEGRATED_CASE_ADDRESSES)) {
      expect(resolveIntegratedCaseAddress(legacy)).toBe(current)
      expect(imagingCaseById.has(legacy)).toBe(false)
      expect(imagingCaseById.get(current)!.item.id).toBe(`capstone:${current}`)
    }
    expect(resolveIntegratedCaseAddress('case-1')).toBe('case-1')
    expect(resolveIntegratedCaseAddress('case-9')).toBeNull()
    expect(resolveIntegratedCaseAddress('constructor')).toBeNull()
    // A case title names the situation; the image-based case's no longer states its finding.
    expect(imagingCaseById.get('case-5-v2')!.presentationTitle).not.toMatch(/beyond/i)
  })

  it('points each section’s completion link at the case in its slot', () => {
    expect(imagingSectionSpec('cbct-acquisition').capstoneCaseId).toBe('case-4-v2')
    expect(imagingSectionSpec('tool-confirmation').capstoneCaseId).toBe('case-5-v2')
    expect(imagingSectionSpec('dose-reporting').capstoneCaseId).toBe('case-8-v2')
  })
})

describe('stored records keep their meaning', () => {
  it('leaves a device’s opened old cases exactly as written, and does not credit them to the new ones', () => {
    const progress = withLocation(
      withLocation(
        withLocation(createEmptyImagingProgress(), { kind: 'integrated-case', id: 'case-4' }, 'a'),
        {
          kind: 'integrated-case',
          id: 'case-5',
        },
        'b',
      ),
      { kind: 'integrated-case', id: 'case-8' },
      'c',
    )
    const serialized = JSON.stringify(progress)
    localStorage.setItem(IMAGING_PROGRESS_STORAGE_KEY, serialized)
    expect(parseImagingProgress(serialized)!.openedIntegratedCaseIds).toEqual([
      'case-4',
      'case-5',
      'case-8',
    ])
    render(<PeripheralImagingIntegratedCasesLanding />)
    for (const id of ['case-4-v2', 'case-5-v2', 'case-8-v2'])
      expect(document.querySelector(`[data-integrated-case-link="${id}"]`)).toHaveAttribute(
        'data-opened',
        'false',
      )
    // Rendering the landing reads the record and writes nothing back.
    expect(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY)).toBe(serialized)
  })

  it('keeps legacy first decisions under old ids readable, with their original keys', () => {
    const at = '2026-09-10T00:00:00.000Z'
    const stored = JSON.stringify({
      ...createEmptyImagingRecord(),
      firstAttempts: {
        'signal:signal-interpretation-v2': { choiceId: 'c', correct: true, at },
        'imaging-questions:choose-1': { choiceId: 'b', correct: true, at },
        'changing-anatomy:change-1': { choiceId: 'b', correct: true, at },
        'capstone:case-4': { choiceId: 'c', correct: true, at },
        'capstone:case-5': { choiceId: 'a', correct: true, at },
        'capstone:case-8': { choiceId: 'a', correct: false, at },
        'practice:dts-interpretation-practice-1': { choiceId: 'a', correct: true, at },
      },
    })
    localStorage.setItem(LEGACY_IMAGING_RECORD_KEY_V2, stored)
    const read = parseImagingRecord(stored)!
    expect(Object.keys(read.firstAttempts).sort()).toEqual([
      'capstone:case-4',
      'capstone:case-5',
      'capstone:case-8',
      'changing-anatomy:change-1',
      'imaging-questions:choose-1',
      'practice:dts-interpretation-practice-1',
      'signal:signal-interpretation-v2',
    ])
    // Each is judged against the item it names, not against the item now in its place.
    expect(read.firstAttempts['signal:signal-interpretation-v2'].correct).toBe(true)
    expect(read.firstAttempts['capstone:case-8'].correct).toBe(false)
    expect(read.firstAttempts['capstone:case-5'].correct).toBe(true)
    expect(read.firstAttempts['practice:dts-interpretation-practice-1'].correct).toBe(true)
    expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBe(stored)
  })
})

describe('OD4-01 · the Overview’s entry line', () => {
  it('keeps the broad audience, speaks to physician learners only, and gates nothing', () => {
    render(<PeripheralImagingHub />)
    const audience = document.querySelector('[data-hub-audience]')!
    expect(audience).toHaveTextContent(
      'Pulmonary and interventional pulmonology fellows, bronchoscopists, and the radiologic technologists and imaging team who support them.',
    )
    expect(document.querySelector('[data-hub-prerequisites]')).toHaveTextContent(
      'For physician learners, basic chest CT anatomy and bronchoscopy/navigation experience are helpful. No prior training in fluoroscopy physics, tomosynthesis, or cone-beam CT is assumed.',
    )
    // No longer "assumed" of everyone, technologists included; no gate or mastery language.
    expect(audience.textContent).not.toMatch(/are assumed|required|must|mastery|before you can/i)
    expect(document.querySelectorAll('[data-imaging-continue]')).toHaveLength(1)
  })
})
