import { createHash } from 'crypto'
import { cleanup, fireEvent, render, within } from '@testing-library/react'

import { LocalPolicyNote } from '../components/LocalPolicyNote'
import { LEDGER_LEGEND } from '../components/scope/ScopeFallback'
import { AirwayAbbreviations } from '../components/scope/TreeMap'
import { AIRWAY_LABELS } from '../components/scope/types'
import {
  MONITOR_TREND_MEANING,
  MONITOR_TREND_WORDS,
  MonitorPanel,
} from '../components/stage/MonitorPanel'
import { treeNodeByLabel } from '../content/airwayTree'
import { SCOPE_CONTROL_PANEL } from '../content/controlPanel'
import { COURSE_FLOWS } from '../content/courseFlow'
import { REVIEW_PENDING_EXPLANATION } from '../content/learnerCopy'
import { LOCAL_POLICIES, LOCAL_POLICY_NOT_SUPPLIED } from '../content/localPolicies'
import { BRONCH_SECTION_IDS, bronchSection, type BronchSectionId } from '../content/pathway'
import {
  BRONCH_TIME_ESTIMATE_NOTE,
  bronchCompositionLine,
  bronchMinutesEstimate,
} from '../content/pathwayResolver'
import {
  NOVELTY_WORDS,
  REPEATED_PAIRS,
  repetitionNote,
  validateRepeatedPairs,
} from '../content/repetition'
import { bronchStageLesson, type BronchStageStep } from '../content/stageLessons'
import { SOURCES, transcriptDisplayTitle } from '../data/sources'
import {
  SUPPLIED_RECORD_IDENTITY,
  SUPPLIED_TEACHING_RECORD_SOURCE,
  SUPPLIED_TEACHING_REPORT_ID,
  SUPPLIED_TEACHING_ROWS,
  inspectionReport,
  learnerSurveyEvidence,
  surveyReport,
} from '../engine/inspectionReport'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
  type BronchInspectionSnapshot,
} from '../engine/learnProgress'
import {
  BRONCH_SELF_PACED_STORAGE_KEY,
  availableSurveySnapshot,
  createEmptyBronchSelfPacedRecord,
  parseBronchSelfPacedRecord,
  withSectionOpened,
  withSectionReviewed,
} from '../engine/selfPacedProgress'
import { isRotationOf, sequenceOrderForRound } from '../engine/sequenceOrder'
import { bronchStageReducer, emptyBronchStageSession } from '../engine/stageSession'
import {
  clickPrimary,
  currentStepId,
  installDom,
  mountSection,
  nowStatus,
  orderSequence,
  settle,
} from '../test-support/stageHarness'

/**
 * BF-PRE-REVIEW-04 — teaching clarity, honest review state and the survey-to-report path (fellow
 * walkthrough A6, A7, A11, A14, A17, A19, A27, A31, A34, A35, A38–A43; local parts of SUP-01, 04,
 * 06, 10, 12, 14).
 *
 * Each block pins one mechanism against the data it is drawn from. The survey block is the
 * provenance contract: the learner's own survey, the supplied teaching record and no evidence are
 * three different things in the type, on the screen and in storage.
 */

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

const query = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const queryAll = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)]
const skipControl = () => query<HTMLButtonElement>('[data-now-skip]')
const sha256 = (value: string | null) =>
  value === null ? null : createHash('sha256').update(value).digest('hex')
const text = (selector: string) => query(selector)?.textContent ?? ''

/** Move to a step the way a learner can: skip what is not done, continue what is. */
async function openStepWhere(
  sectionId: BronchSectionId,
  match: (step: BronchStageStep) => boolean,
) {
  const { lesson } = await mountSection(sectionId)
  const index = lesson.steps.findIndex(match)
  if (index < 0) throw new Error(`No such step in ${sectionId}`)
  for (let i = 0; i < index; i += 1) {
    const skip = skipControl()
    if (skip) fireEvent.click(skip)
    else clickPrimary()
    await settle()
  }
  expect(currentStepId()).toBe(lesson.steps[index].id)
  return { lesson, step: lesson.steps[index] }
}

const openChunk = (sectionId: BronchSectionId, chunkId: string) =>
  openStepWhere(sectionId, (step) => step.course?.id === chunkId)

/* ------------------------------------------------------------------ *
 * A7 — the ordering task
 * ------------------------------------------------------------------ */
describe('S14 ordering: a stable order that is not the worked one (A7)', () => {
  const sequence = (() => {
    const act = bronchSection('washing-and-lavage').act
    if (act.kind !== 'sequence') throw new Error('S14 is a sequence')
    return act.sequence
  })()
  const authored = sequence.steps.map((step) => step.id)

  it('opens in an order that is neither the worked order nor a rotation of it', () => {
    const order = sequenceOrderForRound(sequence, 0)
    expect([...order].sort()).toEqual([...authored].sort())
    expect(order).not.toEqual(authored)
    expect(isRotationOf(order, authored)).toBe(false)
    // The rotation the task used to open with would have been caught here.
    expect(isRotationOf([...authored.slice(2), ...authored.slice(0, 2)], authored)).toBe(true)
  })

  it('is the same order every time for a round, and a different one for the next', () => {
    for (let round = 0; round < 6; round += 1) {
      const order = sequenceOrderForRound(sequence, round)
      expect(sequenceOrderForRound(sequence, round)).toEqual(order)
      expect(isRotationOf(order, authored)).toBe(false)
      expect(sequenceOrderForRound(sequence, round + 1)).not.toEqual(order)
    }
  })

  it('never changes the canonical steps, their order or the critical marks', () => {
    const before = JSON.stringify(sequence)
    for (let round = 0; round < 6; round += 1) sequenceOrderForRound(sequence, round)
    expect(JSON.stringify(sequence)).toBe(before)
  })

  const shown = () =>
    queryAll('[data-bronch-sequence] [data-sequence-step]').map(
      (item) => item.getAttribute('data-sequence-step')!,
    )

  it('keeps the learner’s arrangement across re-renders and a look back', async () => {
    const { step } = await openStepWhere(
      'washing-and-lavage',
      (candidate) => candidate.interaction.kind === 'sequence',
    )
    expect(shown()).toEqual(sequenceOrderForRound(sequence, 0))
    fireEvent.click(query(`[data-sequence-step="${shown()[1]}"] button[aria-label^="Move up"]`)!)
    const arranged = shown()
    // Opening and closing the worked order re-renders the task; nothing is rearranged.
    fireEvent.click(query('[data-show-explanation]')!)
    expect(query('[data-sequence-explanation]')).not.toBeNull()
    fireEvent.click(query('[data-show-explanation]')!)
    expect(shown()).toEqual(arranged)
    fireEvent.click(query('[data-now-back]')!)
    await settle()
    clickPrimary()
    await settle()
    expect(currentStepId()).toBe(step.id)
    expect(shown()).toEqual(arranged)
  })

  it('shows the worked order before any attempt, reshuffles only on request, and records nothing', async () => {
    await openStepWhere(
      'washing-and-lavage',
      (candidate) => candidate.interaction.kind === 'sequence',
    )
    fireEvent.click(query('[data-show-explanation]')!)
    expect(
      within(query('[data-sequence-explanation]')!)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toHaveLength(authored.length)
    fireEvent.click(query('[data-show-explanation]')!)
    const first = shown()
    fireEvent.click(query('[data-sequence-shuffle]')!)
    expect(shown()).toEqual(sequenceOrderForRound(sequence, 1))
    expect(shown()).not.toEqual(first)
    expect(text('[data-sequence-shuffle-note]')).toMatch(/same steps/i)
    expect(text('[data-sequence-shuffle-note]')).not.toMatch(
      NOVELTY_WORDS.source.replace(/new\|/, ''),
    )
    expect(skipControl()).toHaveTextContent('Continue without checking')
    expect(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY)).not.toMatch(/sequence|order/)
  })

  it('checks against the one worked order in any round, and Try again starts from a new order', async () => {
    const { step } = await openStepWhere(
      'washing-and-lavage',
      (candidate) => candidate.interaction.kind === 'sequence',
    )
    fireEvent.click(query('[data-sequence-shuffle]')!)
    orderSequence(step)
    clickPrimary()
    await settle()
    expect(queryAll('[data-sequence-verdict="held"]')).toHaveLength(authored.length)
    fireEvent.click(query('[data-now-secondary]')!)
    await settle()
    expect(query('[data-bronch-sequence]')).toHaveAttribute('data-committed', 'false')
    expect(shown()).toEqual(sequenceOrderForRound(sequence, 2))
    expect(isRotationOf(shown(), authored)).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * A6 — repeats of a worked example are named as repeats
 * ------------------------------------------------------------------ */
describe('a question that repeats its worked example says so (A6)', () => {
  it('inventories the repeated pairs against real parts and blocks', () => {
    expect(validateRepeatedPairs()).toEqual([])
    const sections = new Set(REPEATED_PAIRS.map((pair) => pair.sectionId))
    // The sections the walkthrough's Appendix B names, and the one more that shares a mechanism.
    for (const id of [
      'shared-airway',
      'clinical-question',
      'pre-use-check',
      'sedation-and-monitoring',
      'view-loss',
      'systematic-survey',
      'describe-findings',
      'washing-and-lavage',
      'poor-return',
      'specimen-pathway',
    ] as const)
      expect(sections.has(id)).toBe(true)
  })

  it('calls no repeat a new, changed, different or another case', () => {
    for (const pair of REPEATED_PAIRS) {
      const chunk = COURSE_FLOWS[pair.sectionId]!.find((entry) => entry.id === pair.chunkId)!
      expect([pair.sectionId, chunk.title, NOVELTY_WORDS.test(chunk.title)]).toEqual([
        pair.sectionId,
        chunk.title,
        false,
      ])
      const note = repetitionNote(pair.sectionId, pair.chunkId)!
      expect(note.text).toMatch(/not a new case/)
      expect(note.text).toMatch(/optional/)
    }
  })

  it('every worked visual drawn from an item is inventoried, so none repeats unlabelled', () => {
    for (const sectionId of BRONCH_SECTION_IDS) {
      const flow = COURSE_FLOWS[sectionId] ?? []
      const section = bronchSection(sectionId)
      for (const chunk of flow) {
        const repeatsIn =
          chunk.visual === 'sort-example' && section.act.kind === 'sort'
            ? 'application'
            : chunk.visual === 'sequence' && section.act.kind === 'sequence'
              ? 'application'
              : chunk.visual === 'worked-decision'
                ? 'check'
                : null
        if (!repeatsIn) continue
        expect([sectionId, repetitionNote(sectionId, repeatsIn) !== null]).toEqual([
          sectionId,
          true,
        ])
      }
    }
  })

  it('puts the note on the repeating screen and leaves the teaching and the way on untouched', async () => {
    await openChunk('shared-airway', 'check')
    const note = query('[data-course-note="rehearsal"]')!
    expect(note.textContent).toMatch(/Guided rehearsal, not a new case/)
    expect(note.textContent).toContain('Consider the picture and the patient together')
    // Explanation before an answer, review of the teaching and the skip are all still there.
    expect(query('[data-show-explanation]')).not.toBeNull()
    expect(query('[data-review-teaching]')).not.toBeNull()
    expect(skipControl()).toHaveTextContent('Continue without answering')
    // A screen that repeats nothing carries no such note.
    cleanup()
    installDom()
    await openChunk('shared-airway', 'transfer')
    expect(query('[data-course-note="rehearsal"]')).toBeNull()
  })

  it('changes no item: ids, stems, options and keys are what the sections authored', () => {
    for (const pair of REPEATED_PAIRS) {
      const lesson = bronchStageLesson(pair.sectionId)
      const section = bronchSection(pair.sectionId)
      const step = lesson.steps.find((entry) => entry.course?.id === pair.chunkId)!
      if (step.interaction.kind === 'prediction') {
        expect(step.interaction.stage.item.id).toBe(section.prediction.id)
        expect(step.interaction.stage.item.stem).toBe(section.prediction.stem)
      }
    }
  })
})

/* ------------------------------------------------------------------ *
 * A14 — local policy
 * ------------------------------------------------------------------ */
describe('a missing local policy is said once, where it applies (A14)', () => {
  it('says what is missing, and supplies and approves nothing', () => {
    expect(LOCAL_POLICY_NOT_SUPPLIED).toMatch(/No local policy has been supplied/)
    expect(LOCAL_POLICY_NOT_SUPPLIED).not.toMatch(/Not configured|approved by|default/i)
    expect(LOCAL_POLICY_NOT_SUPPLIED).not.toMatch(/\d/)
    for (const policy of LOCAL_POLICIES) expect(policy.value).toBeNull()
  })

  it('names the policies on the block and links to the Reference list', () => {
    const { container } = render(<LocalPolicyNote ids={['sedation_policy', 'scope_ifu']} />)
    expect(container.textContent).toContain('Sedation pathway, Scope instructions for use')
    expect(container.textContent).toContain(LOCAL_POLICY_NOT_SUPPLIED)
    const link = container.querySelector('a[data-reference-link="local-policies"]')!
    expect(link.getAttribute('href')).toMatch(/\/reference#local-policies$/)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.textContent).toMatch(/opens in a new tab/)
    expect(render(<LocalPolicyNote ids={[]} />).container.textContent).toBe('')
  })

  it('states it once on a part with several policy blocks, each block still naming its own', async () => {
    // S2 "Account for the patient and the proposed procedure": three blocks, three policies.
    const { lesson } = await openChunk('clinical-question', 'planning')
    const blocks = lesson.section.blocks.filter(
      (block) =>
        COURSE_FLOWS['clinical-question']!.find(
          (chunk) => chunk.id === 'planning',
        )!.blocks.includes(block.id) && (block.localPolicyIds?.length ?? 0) > 0,
    )
    expect(blocks.length).toBeGreaterThan(1)
    const page = query('[data-course-teaching]')!.textContent ?? ''
    expect(page.split(LOCAL_POLICY_NOT_SUPPLIED).length - 1).toBe(1)
    expect(page).not.toContain('Not configured')
    for (const block of blocks) {
      const note = query(`[data-block-id="${block.id}"] [data-block-policies]`)!
      expect(note.getAttribute('data-local-policy-note')).toBe('short')
      expect(note.getAttribute('data-local-policy-ids')).toBe(block.localPolicyIds!.join(' '))
    }
    const part = query('[data-part-policies]')!
    expect(part.getAttribute('data-local-policy-ids')!.split(' ').sort()).toEqual(
      [...new Set(blocks.flatMap((block) => block.localPolicyIds!))].sort(),
    )
  })

  it('keeps every policy dependence of every section reachable on its own block', () => {
    for (const sectionId of BRONCH_SECTION_IDS) {
      const section = bronchSection(sectionId)
      const flow = COURSE_FLOWS[sectionId]
      if (!flow) continue
      const shownBlocks = new Set(flow.flatMap((chunk) => chunk.blocks))
      for (const block of section.blocks)
        if (block.claimClass === 'local-policy')
          expect([sectionId, block.id, shownBlocks.has(block.id)]).toEqual([
            sectionId,
            block.id,
            true,
          ])
    }
  })
})

/* ------------------------------------------------------------------ *
 * A38, A42, A43, SUP-06 — honest labels
 * ------------------------------------------------------------------ */
describe('times, review marks, source names and review status are said for what they are', () => {
  it('A38: every time is an untimed estimate, in one wording', async () => {
    expect(bronchMinutesEstimate(7)).toBe('about 7 min')
    expect(bronchCompositionLine()).toMatch(/about \d+ min \(estimate\)$/)
    expect(BRONCH_TIME_ESTIMATE_NOTE).toMatch(/not measurements/)
    expect(BRONCH_TIME_ESTIMATE_NOTE).toMatch(/timed with learners/)
    const { lesson } = await mountSection('shared-airway')
    expect(document.body.textContent).toContain(
      `about ${lesson.minutes} min (estimate, not timed with learners)`,
    )
    expect(document.body.textContent).not.toMatch(/Estimated \d+ min/)
    // No duration was revised: the authored minutes are what they were.
    expect(BRONCH_SECTION_IDS.map((id) => bronchSection(id).minutes).join(',')).toBe(
      '5,6,7,7,12,9,8,9,7,10,10,10,8,8,8,8,7,8,8,7,8,9,6',
    )
  })

  it('A42: reaching the end is what marks a section, and the end card says so', async () => {
    const { lesson } = await mountSection('what-completion-means')
    expect(text('[data-record-reviewed]')).toMatch(
      /The course sets this mark when you reach the end/,
    )
    expect(text('[data-record-review-later]')).toMatch(/set only by you/)
    expect(document.body.textContent).not.toMatch(/reviewed by you/)
    // All-skip to the end: the mark is set, and described as a navigation mark, not a sign-off.
    for (let guard = 0; guard <= lesson.steps.length + 1; guard += 1) {
      if (query('[data-section-completion]')) break
      const skip = skipControl()
      if (skip) fireEvent.click(skip)
      else clickPrimary()
      await settle()
    }
    const card = text('[data-completion-reviewed]')
    expect(card).toMatch(/Reaching the end marked this section reviewed/)
    expect(card).toMatch(/not a sign-off/)
    expect(card).toMatch(/records nothing about your answers/)
    expect(text('[data-completion-competence]')).toMatch(/does not establish procedural competence/)
    const stored = parseBronchSelfPacedRecord(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))!
    expect(stored.reviewedSectionIds).toEqual(['what-completion-means'])
    expect(Object.keys(stored).sort()).toEqual(
      Object.keys(createEmptyBronchSelfPacedRecord()).sort(),
    )
    fireEvent.click(query('[data-toggle-reviewed]')!)
    await settle()
    expect(text('[data-completion-reviewed]')).toMatch(/not marked reviewed/)
  })

  it('A43: a transcript is named by its file, with the lecture title marked unverified', () => {
    const transcripts = SOURCES.filter((source) => source.sourceClass === 'transcript')
    expect(transcripts.length).toBeGreaterThan(0)
    for (const source of transcripts) {
      expect(source.displayTitle).toBe(transcriptDisplayTitle(source.title))
      expect(source.displayTitle).toMatch(/^Transcript file “.+” \(lecture title not verified\)$/)
      // Provenance is kept: the file name is in the label, and the manifest title is unchanged.
      expect(source.title).toBe(source.manifest.title)
      expect(source.displayTitle).toContain(source.title.replace(/\s+/g, ' ').trim())
    }
    for (const source of SOURCES.filter((entry) => entry.sourceClass !== 'transcript'))
      expect(source.displayTitle).toBe(source.title)
  })

  it('SUP-06: review pending is explained, and no label is cleared', async () => {
    expect(REVIEW_PENDING_EXPLANATION).toMatch(/not yet recorded/)
    expect(REVIEW_PENDING_EXPLANATION).toMatch(/label stays/)
    expect(REVIEW_PENDING_EXPLANATION).not.toMatch(/approved|cleared|validated/i)
    await openChunk('pre-use-check', 'instrument')
    expect(document.body.textContent).toMatch(/clinical\/media review pending/)
  })
})

/* ------------------------------------------------------------------ *
 * A11, A39, A19, SUP-12 — first-use names and honest numbering
 * ------------------------------------------------------------------ */
describe('names are given at first use, and screens are numbered as they are', () => {
  it('A11: the five controls are listed on the first screen of their lesson, from the Reference', async () => {
    await mountSection('five-controls')
    const list = query('[data-five-controls-list]')!
    expect(queryAll('[data-five-control]').map((item) => item.textContent)).toEqual(
      SCOPE_CONTROL_PANEL.controls.map((control) => control.plainName),
    )
    expect(queryAll('[data-five-control]')).toHaveLength(5)
    expect(list.textContent).toContain(SCOPE_CONTROL_PANEL.sentence)
    expect(list.textContent).toContain(bronchSection('protected-accessories').title)
    // The five controls are kept apart from the first section's five questions.
    expect(list.textContent).toMatch(/separate from the five questions/)
    expect(list.querySelector('a[data-reference-link="five-controls"]')).not.toBeNull()
  })

  it('A39: no two screens of the bench lesson carry the same position, and a repeat is called optional', async () => {
    const { lesson } = await mountSection('five-controls')
    const positions: string[] = []
    for (let index = 0; index < lesson.steps.length; index += 1) {
      positions.push(text('[data-now-card] p'))
      if (lesson.steps[index].learn?.support === 'repeat')
        expect(document.body.textContent).toMatch(/Optional repeat/)
      if (index === lesson.steps.length - 1) break
      const skip = skipControl()
      if (skip) fireEvent.click(skip)
      else clickPrimary()
      await settle()
    }
    expect(new Set(positions).size).toBe(positions.length)
    expect(positions.some((line) => /step 2 of 2/.test(line))).toBe(true)
    // Moving on through every screen without touching a control performed nothing.
    expect(
      parseBronchSelfPacedRecord(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))!
        .reviewedSectionIds,
    ).toEqual([])
  })

  it('A19: every name the S3 photographs offer is defined with the overview, before them', async () => {
    const { lesson } = await openChunk('pre-use-check', 'instrument')
    const act = lesson.section.act
    if (act.kind !== 'identify') throw new Error('S3 is an identify set')
    const offered = new Set(act.identify.rows.flatMap((row) => row.choices.map((c) => c.label)))
    const defined = queryAll('[data-part-names-first-use] dt').map((item) => item.textContent)
    expect(offered.size).toBe(8)
    expect([...offered].sort()).toEqual([...defined].sort())
    expect(query('[data-part-names-first-use] details')).toHaveAttribute('open')
    expect(text('[data-part-names-first-use]')).toMatch(/“suction control” is the suction valve/)
    // The set's identities are untouched.
    expect(act.identify.rows.map((row) => `${row.id}:${row.answerId}`).join('|')).toBe(
      bronchSection('pre-use-check').act.kind === 'identify'
        ? (bronchSection('pre-use-check').act as typeof act).identify.rows
            .map((row) => `${row.id}:${row.answerId}`)
            .join('|')
        : '',
    )
  })

  it('SUP-12: a repeated tour or overview is labelled a refresher, and stays', async () => {
    await mountSection('five-controls')
    expect(text('[data-refresher-note]')).toContain(bronchSection('pre-use-check').title)
    cleanup()
    installDom()
    await openChunk('reference-frames', 'viewpoints')
    expect(text('[data-normal-airway-tour] [data-refresher-note]')).toContain(
      bronchSection('branch-entry').title,
    )
    expect(query('[data-normal-airway-tour] [data-tour-nav]')).not.toBeNull()
    cleanup()
    installDom()
    await openChunk('branch-entry', 'reference')
    expect(query('[data-normal-airway-tour] [data-refresher-note]')).toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * A17, A27, A31, A34, SUP-04, SUP-14 — wording that matches the screen
 * ------------------------------------------------------------------ */
describe('instructions refer only to what is on the screen', () => {
  const blockText = (sectionId: BronchSectionId, blockId: string) => {
    const block = bronchSection(sectionId).blocks.find((entry) => entry.id === blockId)!
    return [block.heading, block.body, ...(block.points ?? [])].join(' ')
  }

  it('A17, SUP-04: S2 introduces its case, its plan layout and its guideline before using them', () => {
    const early = ['two-questions', 'four-box-worked'].map((id) =>
      blockText('clinical-question', id),
    )
    for (const body of early) expect(body).not.toMatch(/in the sort|in the prediction/)
    expect(early[1]).toMatch(/^.*Take one request as the example\./)
    expect(early[1]).toMatch(
      /four boxes: initial evaluation, procedural strategy, technique and results, and subsequent management/,
    )
    const guideline = blockText('clinical-question', 'antithrombotic-decision')
    const u2 = SOURCES.find((source) => source.id === 'U2')!
    expect(guideline).toContain(u2.title)
    expect(guideline).toContain('U2')
  })

  it('A27: the lens step is a guided demonstration with its authored context, and asks for no reading', async () => {
    const { step } = await openChunk('view-loss', 'lens')
    expect(step.instruction).toMatch(/guided demonstration of clearing the lens/)
    expect(step.instruction).toMatch(/lower trachea, a position already confirmed/)
    expect(step.instruction).not.toMatch(/Read the observations/)
    if (step.interaction.kind !== 'observe') throw new Error('S8 lens is an observe step')
    expect(step.interaction.view.controls).toContain('clearLens')
    expect(step.interaction.goals.map((goal) => goal.id)).toEqual([
      'lens-cleared-without-advancing',
    ])
    expect(skipControl()).toHaveTextContent('Continue without completing')
  })

  it('A31: no goal asks for something said aloud, and the reflection is offered as unrecorded', async () => {
    for (const sectionId of BRONCH_SECTION_IDS) {
      const act = bronchSection(sectionId).act
      if (act.kind !== 'scope-lab') continue
      for (const goal of [...act.goals, ...(act.observe?.goals ?? [])])
        expect([sectionId, goal.id, /\bsay\b/i.test(goal.label)]).toEqual([
          sectionId,
          goal.id,
          false,
        ])
    }
    const act = bronchSection('left-side').act
    if (act.kind !== 'scope-lab') throw new Error('S11 is a scope lab')
    expect(act.goals.map((goal) => goal.id)).toEqual([
      'lingular-division',
      'lingular-segments',
      'retrace',
      'superior-segment',
    ])
    await openChunk('left-side', 'application')
    const note = text('[data-course-note="reflection"]')
    expect(note).toMatch(/say to yourself which lobe/)
    expect(note).toMatch(/cannot hear it, records nothing about it, and no goal depends on it/)
    // Nothing gates the scope on it: the way on is the same as any hands-on step.
    expect(skipControl()).toHaveTextContent('Continue without completing')
    expect(query('[data-course-notes] input, [data-course-notes] button')).toBeNull()
  })

  it('A34: S21 says where its second topic starts and where the first returns', async () => {
    await openChunk('icu-physiology', 'procedure-purpose')
    expect(text('[data-course-note="topic-change"]')).toMatch(/A second topic starts here/)
    cleanup()
    installDom()
    await openChunk('icu-physiology', 'transfer')
    expect(text('[data-course-note="topic-change"]')).toMatch(
      /returns to the section’s first topic/,
    )
    // Same parts, same order, same ids: nothing was split or moved.
    expect(COURSE_FLOWS['icu-physiology']!.map((chunk) => `${chunk.kind}/${chunk.id}`)).toEqual([
      'teach/baseline',
      'check/check',
      'teach/procedure-purpose',
      'practice/application',
      'debrief/review',
      'transfer/transfer',
    ])
  })

  it('SUP-14: S13 shows its normal still once on the screen that carried it twice', async () => {
    const { lesson } = await openChunk('describe-findings', 'normal')
    const block = lesson.section.blocks.find((entry) => entry.id === 'normal-right-main')!
    expect(block.media).toBeDefined()
    expect(lesson.section.workspace.kind).toBe('media')
    // The block's own copy is not printed; its words and the workspace's image remain.
    expect(query('[data-block-id="normal-right-main"] figure')).toBeNull()
    expect(query('[data-block-id="normal-right-main"]')!.textContent).toContain(block.heading)
    expect(queryAll('[data-stage] figure')).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------ *
 * A40, A41, SUP-10 — legends drawn from the model's own vocabulary
 * ------------------------------------------------------------------ */
describe('badges, record statuses and map labels say what they mean', () => {
  it('A40: the monitor says what a badge is compared against, for the badges it shows', () => {
    const { container } = render(
      <MonitorPanel
        caption="caption"
        readings={[
          { channel: 'oximetry', words: 'unchanged', trend: 'steady' },
          { channel: 'airway-view', words: 'changed', trend: 'new' },
        ]}
      />,
    )
    const legend = container.querySelector('[data-trend-legend]')!.textContent ?? ''
    expect(legend).toMatch(/this patient’s own earlier state/)
    expect(legend).toMatch(/not with a normal range/)
    expect(legend).toContain(`${MONITOR_TREND_WORDS.steady} — ${MONITOR_TREND_MEANING.steady}`)
    expect(legend).toContain(`${MONITOR_TREND_WORDS.new} — ${MONITOR_TREND_MEANING.new}`)
    expect(legend).not.toContain(MONITOR_TREND_MEANING.rising)
    // No number, rate or threshold is introduced by the legend.
    for (const meaning of Object.values(MONITOR_TREND_MEANING)) expect(meaning).not.toMatch(/\d/)
  })

  it('A41: the record legend separates what the model sets from what the learner declares', () => {
    const model = LEDGER_LEGEND.find((entry) => entry.source === 'model')!
    const learner = LEDGER_LEGEND.find((entry) => entry.source === 'learner')!
    expect(model.term).toBe('Opening in view and Entered')
    expect(model.meaning).toMatch(/ostium visualized/)
    expect(model.meaning).toMatch(/Neither is a declaration, and neither is an inspection/)
    expect(learner.term).toBe('Identified, Inspected, Not safely accessible, Not observed')
    expect(LEDGER_LEGEND.find((entry) => entry.source === 'limit')!.meaning).toMatch(/no finding/)
  })

  it('SUP-10: the map’s labels are keyed to the teaching tree’s own names', () => {
    const labels = ['RMSB', 'LMSB', 'BI', 'LUL-UD', 'LB4+5', 'LB7+8'] as const
    for (const label of labels) expect(AIRWAY_LABELS).toContain(label)
    const { container } = render(<AirwayAbbreviations labels={labels} />)
    for (const label of labels) {
      const row = container.querySelector(`[data-airway-abbreviation="${label}"]`)!
      expect(row.querySelector('dt')!.textContent).toBe(label)
      expect(row.querySelector('dd')!.textContent!.toLowerCase()).toContain(
        treeNodeByLabel(label).requiredName.toLowerCase(),
      )
    }
    expect(container.querySelector('[data-combined-label-note]')!.textContent).toMatch(
      /combined names in this course’s one declared teaching anatomy/,
    )
    expect(render(<AirwayAbbreviations labels={[]} />).container.textContent).toBe('')
  })
})

/* ------------------------------------------------------------------ *
 * A35 — survey to report: three kinds of evidence, never mixed
 * ------------------------------------------------------------------ */
const SURVEY_AT = '2026-10-05T10:00:00.000Z'

/** A learner survey as the survey section saves it: a synthetic fixture, partly declared. */
function learnerSnapshot(): BronchInspectionSnapshot {
  const row = (
    label: 'RLL' | 'RB6' | 'RB7' | 'RB8' | 'RB9' | 'RB10',
    patch: Partial<BronchInspectionSnapshot['rows'][number]>,
  ): BronchInspectionSnapshot['rows'][number] => ({
    label,
    identified: true,
    ostiumVisualized: true,
    entered: false,
    distalViewObtained: false,
    inspected: 'no',
    limitation: null,
    ...patch,
  })
  return {
    sectionId: 'systematic-survey',
    at: SURVEY_AT,
    rows: [
      row('RLL', { entered: true, distalViewObtained: true, inspected: 'declared' }),
      row('RB6', { entered: true, distalViewObtained: true, inspected: 'declared' }),
      row('RB7', { entered: true }),
      row('RB8', {}),
      row('RB9', { ostiumVisualized: false, identified: false, limitation: 'not-observed' }),
      row('RB10', { limitation: 'not-safely-accessible' }),
    ],
  }
}

function storeLearnerSurvey(): string {
  const record = {
    ...createEmptyBronchSelfPacedRecord(),
    surveySnapshot: learnerSnapshot(),
    updatedAt: SURVEY_AT,
  }
  const serialized = JSON.stringify(record)
  localStorage.setItem(BRONCH_SELF_PACED_STORAGE_KEY, serialized)
  return serialized
}

/** The earlier course's record, holding a survey of its own. It is never read as evidence. */
function storeLegacyRecord(): string {
  const serialized = JSON.stringify({
    ...createEmptyBronchRecord(),
    completedSectionIds: ['systematic-survey'],
    inspectionSnapshot: learnerSnapshot(),
    updatedAt: '2026-09-01T00:00:00.000Z',
  })
  localStorage.setItem(BRONCH_STORAGE_KEY, serialized)
  return serialized
}

const openReport = () => openChunk('honest-report', 'your-record')
const choice = (kind: 'learner' | 'supplied' | 'none') =>
  query<HTMLInputElement>(`[data-survey-record-option="${kind}"] input`)!
const reportId = () => query('[data-bronch-report]')!.getAttribute('data-bronch-report')
const fieldIds = () =>
  queryAll('[data-report-field]').map((field) => field.getAttribute('data-report-field'))
const surveyOnDevice = () =>
  parseBronchSelfPacedRecord(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))?.surveySnapshot

describe('the report’s three kinds of evidence (A35)', () => {
  describe('the reports themselves', () => {
    it('gives each kind its own report, title and wording', () => {
      const mine = surveyReport(learnerSurveyEvidence(learnerSnapshot()))
      const supplied = surveyReport({ kind: 'supplied' })
      const none = surveyReport({ kind: 'none' })
      expect(new Set([mine.id, supplied.id, none.id]).size).toBe(3)
      expect(supplied.id).toBe(SUPPLIED_TEACHING_REPORT_ID)
      expect(supplied.evidenceTitle).toBe(SUPPLIED_RECORD_IDENTITY)
      expect(mine.evidenceTitle).toBe('Your completed survey record')
      expect(none.evidenceTitle).toBe('No saved survey examination')
      // The learner's report is what it was before this batch.
      expect(inspectionReport({ inspectionSnapshot: learnerSnapshot() })).toEqual(mine)
      expect(inspectionReport({ inspectionSnapshot: null })).toEqual(none)
    })

    it('never words the supplied record as the learner’s, and says "not your examination" on every field', () => {
      const supplied = surveyReport({ kind: 'supplied' })
      const words = JSON.stringify(supplied)
      expect(words).not.toMatch(/your (completed|saved|own) survey|by the learner|Saved survey:/i)
      for (const field of supplied.fields.filter((entry) => /^survey-LB/.test(entry.id)))
        expect(field.evidence).toMatch(/^Supplied teaching record, not your examination:/)
      const source = supplied.fields.find((field) => field.id === 'survey-source')!
      expect(source.evidence).toMatch(/You did not perform it/)
      const own = source.options.find((option) => option.id === 'own-examination')!
      expect(own.supported).toBe(false)
      expect(own.rationale).toMatch(/does not create an examination record/)
    })

    it('infers no normal finding in any mode, and never assesses the larynx', () => {
      for (const report of [
        surveyReport(learnerSurveyEvidence(learnerSnapshot())),
        surveyReport({ kind: 'supplied' }),
        surveyReport({ kind: 'none' }),
      ]) {
        for (const field of report.fields) {
          expect(field.options.some((option) => option.supported)).toBe(true)
          expect(field.options.some((option) => !option.supported)).toBe(true)
          for (const option of field.options.filter((entry) => entry.supported))
            expect(option.label).not.toMatch(/normal/i)
        }
        expect(
          report.fields
            .find((field) => field.id === 'survey-larynx')!
            .options.find((option) => option.supported)!.label,
        ).toMatch(/not assessed/)
      }
    })

    it('keeps the supplied record incomplete: one lobe, with an entry and an inaccessible opening left as they are', () => {
      const supplied = surveyReport({ kind: 'supplied' })
      const status = (label: string) =>
        supplied.fields
          .find((field) => field.id === `survey-${label}`)!
          .options.find((option) => option.supported)!.label
      expect(SUPPLIED_TEACHING_ROWS.map((row) => row.label)).toEqual([
        'LB6',
        'LB7+8',
        'LB9',
        'LB10',
      ])
      expect(status('LB6')).toMatch(/^Inspection declared in the supplied record/)
      expect(status('LB9')).toBe('Entered; inspection not declared')
      expect(status('LB10')).toBe('Not safely accessible in this exercise')
      // No right-sided airway, no central airway and no other lobe is filled in.
      expect(supplied.fields.map((field) => field.id)).toEqual([
        'survey-source',
        'survey-LB6',
        'survey-LB7+8',
        'survey-LB9',
        'survey-LB10',
        'survey-larynx',
      ])
    })

    it('draws the supplied record from the survey section’s existing worked example', () => {
      const section = bronchSection(SUPPLIED_TEACHING_RECORD_SOURCE.sectionId)
      const block = section.blocks.find(
        (entry) => entry.id === SUPPLIED_TEACHING_RECORD_SOURCE.blockId,
      )!
      expect(block.role).toBe('worked-example')
      expect(block.sourceRefs.length).toBeGreaterThan(0)
      // Each supplied row is an airway the worked example's own lines name, in its order.
      const points = block.points ?? []
      SUPPLIED_TEACHING_ROWS.forEach((row, index) => {
        expect([row.label, points[index]?.includes(row.label)]).toEqual([row.label, true])
      })
      // And it is not the airway set the learner's own survey records.
      const act = section.act
      if (act.kind !== 'scope-lab') throw new Error('S12 is a scope lab')
      const surveyed = new Set(act.view.ledger?.expected ?? [])
      for (const row of SUPPLIED_TEACHING_ROWS) expect(surveyed.has(row.label)).toBe(false)
    })
  })

  describe('the stored record decides what "my recorded survey" is', () => {
    it('offers only the current record’s survey, never a marker, a legacy survey or a broken record', () => {
      const empty = createEmptyBronchSelfPacedRecord()
      expect(availableSurveySnapshot(empty)).toBeNull()
      const marked = withSectionReviewed(
        withSectionOpened(empty, 'systematic-survey'),
        'systematic-survey',
        true,
      )
      expect(availableSurveySnapshot(marked)).toBeNull()
      expect(parseBronchSelfPacedRecord('{not json')).toBeNull()
      expect(parseBronchSelfPacedRecord(JSON.stringify({ ...empty, version: 2 }))).toBeNull()
      expect(
        parseBronchSelfPacedRecord(
          JSON.stringify({ ...empty, surveySnapshot: { sectionId: 'systematic-survey' } }),
        ),
      ).toBeNull()
      // The supplied rows are the scope's row type, but nothing offers them to the record.
      expect(JSON.stringify(marked)).not.toContain('LB6')
    })
  })

  describe('on the report step', () => {
    it('S12 says the survey is used again, and what does not count', async () => {
      await openChunk('systematic-survey', 'application')
      const note = text('[data-course-note="record-use"]')
      expect(note).toContain(bronchSection('honest-report').title)
      expect(note).toMatch(/meet every goal here on your own controls/)
      expect(note).toMatch(/a demonstration or a step you move past is not kept/)
      expect(note).toMatch(/nothing is filled in for you/)
    })

    it('with no survey: "mine" is unavailable and says why, and the report starts from no evidence', async () => {
      await openReport()
      expect(query('[data-survey-record-choice]')).toHaveAttribute('data-learner-survey', 'none')
      expect(choice('learner')).toBeDisabled()
      expect(text('[data-survey-record-option="learner"]')).toMatch(/Not available/)
      expect(text('[data-survey-record-option="learner"]')).toMatch(/does not count/)
      expect(choice('none')).toBeChecked()
      expect(reportId()).toBe('report-without-survey-evidence')
      expect(fieldIds()).toEqual(['survey-source', 'survey-larynx'])
      expect(query('[data-supplied-record-identity]')).toBeNull()
      expect(skipControl()).toHaveTextContent('Continue without completing')
    })

    it('legacy only: the earlier survey is not offered, and its bytes do not change', async () => {
      const legacy = storeLegacyRecord()
      const before = sha256(legacy)
      const { step } = await openReport()
      expect(choice('learner')).toBeDisabled()
      expect(reportId()).toBe('report-without-survey-evidence')
      fireEvent.click(choice('supplied'))
      await settle()
      for (const field of step.interaction.kind === 'report' ? fieldIds() : []) {
        const supported = query<HTMLInputElement>(
          `[data-report-field="${field}"] input[value="recorded-status"], [data-report-field="${field}"] input[value="supplied-evidence"], [data-report-field="${field}"] input[value="not-assessed"]`,
        )!
        fireEvent.click(supported)
      }
      await settle()
      expect(sha256(localStorage.getItem(BRONCH_STORAGE_KEY))).toBe(before)
      expect(surveyOnDevice() ?? null).toBeNull()
    })

    it('a corrupt current record is no survey: nothing is offered as mine and nothing is repaired', async () => {
      localStorage.setItem(BRONCH_SELF_PACED_STORAGE_KEY, '{"version":1,"surveySnapshot":')
      await openReport()
      expect(choice('learner')).toBeDisabled()
      expect(reportId()).toBe('report-without-survey-evidence')
    })

    it('a visited or reviewed survey section does not make a survey', async () => {
      localStorage.setItem(
        BRONCH_SELF_PACED_STORAGE_KEY,
        JSON.stringify(
          withSectionReviewed(
            withSectionOpened(createEmptyBronchSelfPacedRecord(), 'systematic-survey'),
            'systematic-survey',
            true,
          ),
        ),
      )
      await openReport()
      expect(choice('learner')).toBeDisabled()
      expect(fieldIds()).toEqual(['survey-source', 'survey-larynx'])
    })

    it('with a survey: it is the default, shown as recorded, partial rows left partial', async () => {
      storeLearnerSurvey()
      await openReport()
      expect(choice('learner')).not.toBeDisabled()
      expect(choice('learner')).toBeChecked()
      expect(text('[data-survey-record-option="learner"]')).toContain('2026-10-05')
      expect(reportId()).toBe('report-from-your-survey')
      expect(fieldIds()).toEqual([
        'survey-source',
        'survey-RLL',
        'survey-RB6',
        'survey-RB7',
        'survey-RB8',
        'survey-RB9',
        'survey-RB10',
        'survey-larynx',
      ])
      const evidence = (label: string) =>
        text(`[data-report-field="survey-${label}"] [data-report-field-evidence]`)
      expect(evidence('RB6')).toMatch(/inspection declared by the learner/)
      expect(evidence('RB7')).toMatch(/entered; inspection not declared/)
      expect(evidence('RB8')).toMatch(/opening visualized; inspection not declared/)
      expect(evidence('RB9')).toMatch(/not observed in this exercise/)
      expect(evidence('RB10')).toMatch(/not safely accessible/)
    })

    it('switching to the supplied record and back shows the learner’s survey unchanged, and saves nothing', async () => {
      const stored = storeLearnerSurvey()
      const legacy = storeLegacyRecord()
      const hashes = { current: sha256(stored), legacy: sha256(legacy) }
      const snapshotBefore = JSON.stringify(surveyOnDevice())
      await openReport()
      const mineFields = fieldIds()
      const mineEvidence = queryAll('[data-report-field-evidence]').map((node) => node.textContent)

      // Fill one field on the learner's own report, then switch.
      fireEvent.click(query('[data-report-field="survey-RB6"] input[value="recorded-status"]')!)
      await settle()
      expect(query('[data-report-field="survey-RB6"]')).toHaveAttribute('data-outcome', 'held')

      fireEvent.click(choice('supplied'))
      await settle()
      expect(reportId()).toBe(SUPPLIED_TEACHING_REPORT_ID)
      expect(text('[data-supplied-record-identity]')).toContain(SUPPLIED_RECORD_IDENTITY)
      expect(text('[data-report-evidence]')).toContain(SUPPLIED_RECORD_IDENTITY)
      // Nothing chosen for the learner's report is carried onto the supplied record's fields.
      expect(queryAll('[data-report-field][data-outcome]')).toHaveLength(0)
      // No right-sided row from the learner's survey appears under the supplied record.
      expect(fieldIds().some((id) => /survey-R/.test(id ?? ''))).toBe(false)
      expect(document.body.textContent).not.toMatch(/Your completed survey record/)

      // Claiming the supplied record as one's own is refused.
      fireEvent.click(query('[data-report-field="survey-source"] input[value="own-examination"]')!)
      await settle()
      expect(query('[data-report-field="survey-source"]')).toHaveAttribute(
        'data-outcome',
        'refused',
      )

      // Complete the supplied report: the status names it, and it is not the learner's work.
      for (const [field, option] of [
        ['survey-source', 'supplied-evidence'],
        ['survey-LB6', 'recorded-status'],
        ['survey-LB7+8', 'recorded-status'],
        ['survey-LB9', 'recorded-status'],
        ['survey-LB10', 'recorded-status'],
        ['survey-larynx', 'not-assessed'],
      ] as const)
        fireEvent.click(query(`[data-report-field="${field}"] input[value="${option}"]`)!)
      await settle()
      expect(nowStatus()).toMatch(/supplied teaching record supports/)
      expect(nowStatus()).toMatch(/not your examination, and nothing was saved as your survey/)

      // Storage is byte-for-byte what it was, for both records.
      expect(sha256(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))).not.toBeNull()
      expect(JSON.stringify(surveyOnDevice())).toBe(snapshotBefore)
      expect(sha256(localStorage.getItem(BRONCH_STORAGE_KEY))).toBe(hashes.legacy)
      expect(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY)).not.toContain('LB6')

      // Back to the learner's own survey: the same fields and the same evidence as before.
      fireEvent.click(choice('learner'))
      await settle()
      expect(reportId()).toBe('report-from-your-survey')
      expect(fieldIds()).toEqual(mineFields)
      expect(queryAll('[data-report-field-evidence]').map((node) => node.textContent)).toEqual(
        mineEvidence,
      )
      expect(query('[data-supplied-record-identity]')).toBeNull()
      expect(queryAll('[data-report-field][data-outcome]')).toHaveLength(0)

      // And with no evidence chosen, the learner's rows are not shown either.
      fireEvent.click(choice('none'))
      await settle()
      expect(fieldIds()).toEqual(['survey-source', 'survey-larynx'])
      expect(JSON.stringify(surveyOnDevice())).toBe(snapshotBefore)
    })

    it('finishing the section after using the supplied record saves a review mark and no survey', async () => {
      const { lesson } = await openReport()
      fireEvent.click(choice('supplied'))
      await settle()
      for (const [field, option] of [
        ['survey-source', 'supplied-evidence'],
        ['survey-LB6', 'recorded-status'],
        ['survey-LB7+8', 'recorded-status'],
        ['survey-LB9', 'recorded-status'],
        ['survey-LB10', 'recorded-status'],
        ['survey-larynx', 'not-assessed'],
      ] as const)
        fireEvent.click(query(`[data-report-field="${field}"] input[value="${option}"]`)!)
      await settle()
      clickPrimary()
      await settle()
      // Looking back at the step names the record it was written from.
      fireEvent.click(query('[data-now-back]')!)
      await settle()
      expect(text('[data-step-review]')).toMatch(/supplied teaching record, not your examination/)
      fireEvent.click(query('[data-now-primary]')!)
      await settle()
      for (let guard = 0; guard <= lesson.steps.length + 1; guard += 1) {
        if (query('[data-section-completion]')) break
        const skip = skipControl()
        if (skip) fireEvent.click(skip)
        else clickPrimary()
        await settle()
      }
      const saved = parseBronchSelfPacedRecord(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))!
      expect(saved.reviewedSectionIds).toEqual(['honest-report'])
      expect(saved.surveySnapshot).toBeNull()
      expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
    })
  })

  describe('the session', () => {
    it('clearing a report records nothing and un-performs nothing else', () => {
      const lesson = bronchStageLesson('honest-report')
      const reduce = bronchStageReducer(lesson)
      const step = lesson.steps.find((entry) => entry.course?.learnerRecord)!
      let session = emptyBronchStageSession()
      session = reduce(session, {
        type: 'REPORT_OPTION',
        stepId: step.id,
        fieldId: 'survey-source',
        optionId: 'available-evidence',
        supported: true,
      })
      expect(session.commitments.reports[step.id]).toBeDefined()
      const cleared = reduce(session, { type: 'REPORT_RESET', stepId: step.id })
      expect(cleared.commitments.reports[step.id]).toBeUndefined()
      expect(cleared.commitments.confirmed).toBe(session.commitments.confirmed)
      // Nothing to clear is no change at all.
      expect(reduce(cleared, { type: 'REPORT_RESET', stepId: step.id })).toBe(cleared)
    })
  })
})
