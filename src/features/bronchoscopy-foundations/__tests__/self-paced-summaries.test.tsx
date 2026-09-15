import { reachCourseStep } from '../test-support/courseHarness'
import { cleanup } from '@testing-library/react'

import { BRONCH_SECTION_IDS, type BronchSectionId } from '../content/pathway'
import { bronchSection } from '../content/sections'
import type { AuthoredItem } from '../content/types'
import { BRONCH_STORAGE_KEY, createEmptyBronchRecord } from '../engine/learnProgress'
import {
  BRONCH_SELF_PACED_STORAGE_KEY,
  parseBronchSelfPacedRecord,
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
    section.controlStrip.sentence,
    section.modelBoundary,
    section.physicalSkillNote ?? '',
    ...section.blocks.flatMap((block) => [block.heading, block.body, ...(block.points ?? [])]),
    ...actStrings,
    ...itemStrings(section.prediction),
    ...itemStrings(section.transfer),
  ]
}

/** Only the matched phrase is reported on failure, never the surrounding teaching text. */
function firstMatch(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[0] ?? null
}

describe('what finishing this course means (BF-03)', () => {
  it('teaches training records without claiming this course issues a completion record or keeps answers', () => {
    const text = learnerStrings('what-completion-means').join('\n')
    expect(
      firstMatch(
        text,
        /issued by this course|record this course issues|Finishing this course establishes|finished every section of this course|the course’s completion record|decisions (mostly )?held|targeted remediation|this course sees activities, answers/i,
      ),
    ).toBeNull()
    expect(text.includes('This self-paced course issues no such record')).toBe(true)
    expect(text.includes('this self-paced course does neither')).toBe(true)
    expect(
      bronchSection('what-completion-means').physicalSkillNote?.includes(
        'not part of this self-paced course, which neither runs nor requires it',
      ),
    ).toBe(true)
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

  it('summarizes only what this course keeps and ignores everything the earlier record holds', async () => {
    const earlier = earlierRecordWithEverything()
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    await mountSection('what-completion-means')
    const summary = document.querySelector('[data-learning-record-summary]')
    expect(summary).not.toBeNull()
    const text = summary?.textContent ?? ''
    expect(text).toContain('0 marked reviewed by you')
    expect(text).toContain('No finished lower-airway survey.')
    expect(text).toContain('does not establish procedural competence')
    expect(
      firstMatch(text, /master|certif|passed|readiness|\bscore|unaided|worked through/i),
    ).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })

  it('does not let a survey saved under the earlier record stand in for the learner’s own', async () => {
    const earlier = earlierRecordWithEverything()
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    const { lesson } = await mountSection('honest-report')
    const yourRecord = lesson.steps.find((step) => step.course?.learnerRecord)!
    await reachCourseStep(lesson, yourRecord)
    expect(
      document.querySelector('[data-report-field="survey-source"] [data-report-field-evidence]')
        ?.textContent,
    ).toMatch(/No completed survey record/)
    expect(document.querySelector('[data-report-field="survey-RB1"]')).toBeNull()
    expect(
      parseBronchSelfPacedRecord(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))
        ?.surveySnapshot ?? null,
    ).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })
})
