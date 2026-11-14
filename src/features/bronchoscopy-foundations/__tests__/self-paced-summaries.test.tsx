import { cleanup, render } from '@testing-library/react'

import { BronchoscopyFoundationsClosing } from '../components/BronchoscopyFoundationsClosing'
import { BRONCH_SECTION_IDS, type BronchSectionId } from '../content/pathway'
import { bronchSection } from '../content/sections'
import type { AuthoredItem } from '../content/types'
import { BRONCH_STORAGE_KEY, createEmptyBronchRecord } from '../engine/learnProgress'
import { inspectionReport } from '../engine/inspectionReport'
import {
  availableSurveySnapshot,
  BRONCH_SELF_PACED_STORAGE_KEY,
  parseBronchSelfPacedRecord,
  readBronchSelfPacedRecord,
} from '../engine/selfPacedProgress'
import { installDom, mountSection } from '../test-support/stageHarness'

jest.mock(
  '../components/scope/ScopePane',
  () =>
    jest.requireActual<typeof import('../test-support/ScopeTestDouble')>(
      '../test-support/ScopeTestDouble',
    ).scopePaneDouble,
)
jest.mock('../components/stage/scopeCaseLoader', () => ({
  loadStageScopeCase: () =>
    Promise.resolve(
      jest
        .requireActual<
          typeof import('../test-support/teachingCase')
        >('../test-support/teachingCase')
        .teachingCase(),
    ),
}))
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const EARLIER_AT = '2026-09-12T00:00:00.000Z'

/** An earlier record holding everything the examination-era course wrote, including a survey. */
function earlierRecordWithEverything(): string {
  return JSON.stringify({
    ...createEmptyBronchRecord(),
    completedSectionIds: ['systematic-survey', 'honest-report', 'what-completion-means'],
    sectionPerformance: {
      'systematic-survey': { inputModes: ['keyboard'], assistsUsed: [], unaided: true },
    },
    capstoneDebriefViewedAt: EARLIER_AT,
    inspectionSnapshot: {
      sectionId: 'systematic-survey',
      at: EARLIER_AT,
      rows: [
        {
          label: 'RB1',
          identified: true,
          ostiumVisualized: true,
          entered: true,
          distalViewObtained: true,
          inspected: 'declared',
          limitation: null,
        },
      ],
    },
    updatedAt: EARLIER_AT,
  })
}

function itemStrings(item: AuthoredItem): string[] {
  return [
    item.situation ?? '',
    item.stem,
    item.explanation,
    ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
  ]
}

/** A section's learner-facing strings, without ids, sources or authoring metadata. */
function learnerStrings(sectionId: BronchSectionId): string[] {
  const section = bronchSection(sectionId)
  const act = section.act
  const actStrings =
    act.kind === 'sort'
      ? [
          act.sort.prompt,
          ...act.sort.origins.flatMap((origin) => [origin.label, origin.definition]),
          ...act.sort.rows.flatMap((row) => [row.statement, row.rationale]),
        ]
      : []
  return [
    section.title,
    section.shortTitle,
    section.clinicalQuestion,
    section.recognizeTitle,
    section.objective,
    section.why,
    section.newConcept,
    section.incrementSentence,
    section.harmfulReflex,
    section.anchor.analogy,
    section.anchor.precise,
    ...section.anchor.checklist,
    section.controlStrip?.sentence,
    section.modelBoundary,
    section.physicalSkillNote ?? '',
    ...section.blocks.flatMap((block) => [block.heading, block.body, ...(block.points ?? [])]),
    ...actStrings,
    ...itemStrings(section.prediction),
    ...itemStrings(section.transfer),
  ].filter((text): text is string => text !== undefined)
}

/** Only the matched phrase is reported on failure, never the surrounding teaching text. */
function firstMatch(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[0] ?? null
}

describe('what finishing this course means (BF-03)', () => {
  it('says on the closing screen what the course cannot show, and issues no record', () => {
    render(<BronchoscopyFoundationsClosing />)
    const text = document.querySelector('[data-bronch-closing]')?.textContent ?? ''
    expect(text).toContain('None of them shows your hands on a scope in a patient.')
    expect(text).toContain('your institution grants privileges')
    expect(
      firstMatch(
        text,
        /issued by this course|this course (issues|certifies|grants|signs off)|certificate|sign-off|completion record/i,
      ),
    ).toBeNull()
    cleanup()
  })

  it.each(BRONCH_SECTION_IDS)(
    '%s claims no course-issued completion, certificate or sign-off',
    (sectionId) => {
      expect(
        firstMatch(
          learnerStrings(sectionId).join('\n'),
          /issued by this course|this course (issues|certifies|grants|signs off)|certificate|sign-off/i,
        ),
      ).toBeNull()
    },
  )

  it('counts on the closing screen only what this course keeps, not the earlier record', () => {
    const earlier = earlierRecordWithEverything()
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    render(<BronchoscopyFoundationsClosing />)
    const text = document.querySelector('[data-closing-record]')?.textContent ?? ''
    expect(text).toContain(`0 of ${BRONCH_SECTION_IDS.length} sections opened`)
    expect(text).toContain('0 marked reviewed')
    expect(
      firstMatch(text, /master|certif|passed|readiness|\bscore|unaided|worked through/i),
    ).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
    cleanup()
  })

  it('does not let a survey saved under the earlier record stand in for the learner’s own', async () => {
    const earlier = earlierRecordWithEverything()
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    await mountSection('describe-findings')
    // A report built from the record this course keeps has no survey to draw on.
    const report = inspectionReport({
      inspectionSnapshot: availableSurveySnapshot(readBronchSelfPacedRecord()),
    })
    expect(report.fields.find((field) => field.id === 'survey-source')!.evidence).toMatch(
      /No completed survey record/,
    )
    expect(report.fields.some((field) => field.id === 'survey-RB1')).toBe(false)
    expect(
      parseBronchSelfPacedRecord(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))
        ?.surveySnapshot ?? null,
    ).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })
})
