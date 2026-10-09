import { cleanup, render } from '@testing-library/react'

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { BlockCard } from '../components/stage/BronchTeachingBlock'
import { MonitorPanel, MONITOR_BOUNDARY } from '../components/stage/MonitorPanel'
import {
  BANNED_LEARNER_TERMS,
  measureSection,
  REWRITE_CAPS,
  rewriteRuleErrors,
  sentencesOf,
  testWiseScore,
  wordCount,
} from '../content/authoringRules'
import { COURSE_FLOWS, type CourseChunk } from '../content/courseFlow'
import { bronchLearnerCopyErrors, CLINICAL_VOCABULARY } from '../content/learnerCopy'
import {
  handTypedDigitErrors,
  num,
  NUMBER_IDS,
  NUMBER_REGISTER,
  numberIdsIn,
  numberRegisterErrors,
  numberSourceNames,
  numberTokenErrors,
  resolveNumbers,
} from '../content/numbers'
import { BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE } from '../content/release'
import { publishBlockers, withResolvedNumbers } from '../content/sectionNumbers'
import { bronchSectionErrors } from '../content/sectionValidation'
import { BRONCH_SECTIONS } from '../content/sections'
import { section as bleedingPriorities } from '../content/sections/bleeding-priorities'
import { section as clinicalQuestion } from '../content/sections/clinical-question'
import { section as fiveControls } from '../content/sections/five-controls'
import { section as preUseCheck } from '../content/sections/pre-use-check'
import { section as rightSide } from '../content/sections/right-side'
import { section as sedationAndMonitoring } from '../content/sections/sedation-and-monitoring'
import { bronchStageLessons } from '../content/stageLessons'
import type { BronchSectionDefinition, BronchTeachingBlock } from '../content/types'
import { REWRITTEN_FIXTURE, REWRITTEN_FIXTURE_FLOW } from '../test-support/rewrittenSectionFixture'

/**
 * The rewrite rules (plan of 2026-10-08), held as tests: what the numbers register allows, what the
 * authoring checks refuse, and how the shared surfaces render the things the rules add.
 */
afterEach(cleanup)

function errorsWith(
  patch: Partial<BronchSectionDefinition>,
  flow: readonly CourseChunk[] = REWRITTEN_FIXTURE_FLOW,
): readonly string[] {
  return rewriteRuleErrors({ ...REWRITTEN_FIXTURE, ...patch }, flow)
}

const withBlock = (patch: Partial<BronchTeachingBlock>): Partial<BronchSectionDefinition> => ({
  blocks: [{ ...REWRITTEN_FIXTURE.blocks[0], ...patch }, REWRITTEN_FIXTURE.blocks[1]],
})

describe('the numbers register', () => {
  it('is internally consistent', () => {
    expect(numberRegisterErrors()).toEqual([])
    expect(NUMBER_IDS.length).toBeGreaterThan(30)
  })

  it('holds a value for every verified row and none for a row still to extract', () => {
    for (const id of NUMBER_IDS) {
      const row = NUMBER_REGISTER[id]
      if (row.status === 'verified' || row.status === 'signed') expect(row.value).not.toBeNull()
      if (row.status === 'to-extract') expect(row.value).toBeNull()
    }
  })

  it('renders a value through its token, never through a typed number', () => {
    const copy = `Check the platelets: at least ${num('platelets-biopsy')} before a biopsy.`
    expect(copy).not.toMatch(/\d/)
    expect(numberIdsIn(copy)).toEqual(['platelets-biopsy'])
    expect(resolveNumbers(copy)).toBe('Check the platelets: at least 50,000/µL before a biopsy.')
    expect(handTypedDigitErrors('copy', copy)).toEqual([])
  })

  it('refuses a token that is not in the register', () => {
    expect(numberTokenErrors('copy', 'Give {{num:made-up}} now.')[0]).toMatch(/not in the register/)
    expect(() => resolveNumbers('Give {{num:made-up}} now.')).toThrow(/no value/)
  })

  it('has no row left to extract: every row can be rendered', () => {
    for (const id of NUMBER_IDS) {
      expect(NUMBER_REGISTER[id].status).not.toBe('to-extract')
      expect(numberTokenErrors('copy', num(id))).toEqual([])
    }
  })

  it('refuses a clinical number typed by hand and allows the digits that are names', () => {
    expect(handTypedDigitErrors('copy', 'Hold clopidogrel for 5 days.')[0]).toMatch(
      /types a number by hand \(5\)/,
    )
    expect(handTypedDigitErrors('copy', 'Give 8 mg/kg at most.')).toHaveLength(1)
    for (const allowed of [
      'RB1, RB2 and RB3 leave the upper lobe.',
      'LB1+2 and LB7+8 are combined segments.',
      'Keep the membranous wall at 6 o’clock.',
      'This is a grade 2 bleed; grades 3 and 4 need airway isolation.',
    ])
      expect(handTypedDigitErrors('copy', allowed)).toEqual([])
  })

  it('names each source once for the line under a card', () => {
    expect(numberSourceNames(['fasting-solids', 'fasting-clear-fluids'])).toEqual([
      'BTS 2013',
      'ICS/NCCP(I)/IAB 2019',
    ])
    expect(numberSourceNames(['nashville-grade-1'])).toEqual(['Nashville scale, Chest 2020'])
  })

  it('resolves a section’s tokens and records which rows each card used', () => {
    const authored: BronchSectionDefinition = {
      ...REWRITTEN_FIXTURE,
      ...withBlock({ body: `Biopsy needs at least ${num('platelets-biopsy')}.` }),
    }
    const resolved = withResolvedNumbers(authored)
    expect(resolved.blocks[0].body).toBe('Biopsy needs at least 50,000/µL.')
    expect(resolved.blocks[0].numberIds).toEqual(['platelets-biopsy'])
    expect(resolved.blocks[1].numberIds).toEqual([])
    expect(withResolvedNumbers(REWRITTEN_FIXTURE)).toBe(REWRITTEN_FIXTURE)
  })

  it('blocks publication on any unsigned row a section uses, and only then', () => {
    const authored: BronchSectionDefinition = {
      ...REWRITTEN_FIXTURE,
      ...withBlock({ body: `Biopsy needs at least ${num('platelets-biopsy')}.` }),
    }
    expect(publishBlockers('unlisted-preview', [authored])).toEqual([])
    expect(publishBlockers('published', [authored])).toEqual([
      'right-side uses "platelets-biopsy", which faculty has not signed.',
    ])
    expect(publishBlockers(BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE, BRONCH_SECTIONS)).toEqual([])
  })
})

describe('clinical vocabulary', () => {
  it('lets the clinical uses through and leaves the shared gate as it was', () => {
    expect(flaggedLearnerCopyTerms('Spray 1% lidocaine and grade the bleeding.')).toEqual(
      expect.arrayContaining(['%', 'grade']),
    )
    expect(
      bronchLearnerCopyErrors('copy', 'Spray 1% lidocaine, then run the leak test again.'),
    ).toEqual([])
    expect(bronchLearnerCopyErrors('copy', 'Pass the scope by the nasal route.')).toEqual([])
    expect(Object.keys(CLINICAL_VOCABULARY)).not.toEqual(
      expect.arrayContaining(['score', 'exam', 'quiz', 'mastery']),
    )
  })

  it('still refuses scoring vocabulary', () => {
    expect(bronchLearnerCopyErrors('copy', 'Your score on this quiz is saved.')[0]).toMatch(
      /score, quiz/,
    )
  })
})

describe('the rewrite rules', () => {
  it('pass a section that follows them', () => {
    expect(errorsWith({})).toEqual([])
    const contract = bronchSectionErrors(REWRITTEN_FIXTURE).filter(
      (error) => !/rewrite|screen|flow|open with|prediction before|close by/.test(error),
    )
    expect(contract.filter((error) => /is missing/.test(error))).toEqual([])
  })

  it('count words and sentences the way a reader meets them', () => {
    expect(wordCount(`At least ${num('platelets-biopsy')} first.`)).toBe(4)
    expect(sentencesOf('Stop. Say it out loud.\n\nLook at the patient.')).toHaveLength(3)
    const measure = measureSection(REWRITTEN_FIXTURE, REWRITTEN_FIXTURE_FLOW)
    expect(measure.teachingWords).toBeLessThan(200)
    expect(measure.screens.map((screen) => screen.id)).toEqual(['hook', 'upper-lobe', 'review'])
    expect(measure.computedMinutes).toBeGreaterThan(3)
  })

  it('cap a screen and a section', () => {
    const long = Array.from({ length: 16 }, () => 'Name the parent before the branch every time.')
    expect(errorsWith(withBlock({ body: long.join(' ') }))).toEqual(
      expect.arrayContaining([expect.stringMatching(/screen "upper-lobe" has \d+ teaching words/)]),
    )
    const points = Array.from({ length: 6 }, () => long.join(' '))
    const wordy = errorsWith({
      blocks: REWRITTEN_FIXTURE.blocks.map((block) => ({ ...block, points, pointsLabel: 'More' })),
    })
    expect(wordy).toEqual(
      expect.arrayContaining([expect.stringMatching(/teaching words; at most 1000/)]),
    )
  })

  it('cap a sentence, a paragraph, an option and a rationale', () => {
    const sentence = `${Array.from({ length: 31 }, () => 'word').join(' ')}.`
    expect(errorsWith(withBlock({ body: sentence }))).toEqual(
      expect.arrayContaining([expect.stringMatching(/sentence of 31 words/)]),
    )
    expect(errorsWith(withBlock({ body: 'One. Two. Three. Four.' }))).toEqual(
      expect.arrayContaining([expect.stringMatching(/paragraph of 4 sentences/)]),
    )
    const choices = REWRITTEN_FIXTURE.prediction.choices.map((choice) =>
      choice.id === 'c'
        ? {
            ...choice,
            label: Array.from({ length: 21 }, () => 'turn').join(' '),
            rationale: Array.from({ length: 36 }, () => 'because').join(' '),
          }
        : choice,
    )
    const errors = errorsWith({ prediction: { ...REWRITTEN_FIXTURE.prediction, choices } })
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/choice c runs to 21 words; at most 20/),
        expect.stringMatching(/choice c rationale runs to 36 words; at most 35/),
      ]),
    )
  })

  it('hold the stated time to the reading and the activities', () => {
    expect(errorsWith({ minutes: 2 })).toEqual(
      expect.arrayContaining([expect.stringMatching(/states 2 minutes/)]),
    )
    expect(errorsWith({ activityMinutes: undefined })).toEqual(
      expect.arrayContaining([expect.stringMatching(/measured time of its activities/)]),
    )
  })

  it.each(BANNED_LEARNER_TERMS.map((term) => term.name))(
    'refuse course-talk in a lesson: %s',
    (name) => {
      const sample: Record<string, string> = {
        'model boundary': 'The model boundary is the far end of the tree.',
        authored: 'The scope starts at the authored changed view.',
        declared: 'Use the declared combined basal convention.',
        'teaching profile': 'This is one teaching profile of the right lung.',
        'this course does not': 'This course does not teach biopsy technique.',
        'the lecture': 'In the lecture, the upper lobe had two openings.',
      }
      expect(errorsWith(withBlock({ body: sample[name] }))).toEqual(
        expect.arrayContaining([expect.stringContaining(`says "${name}"`)]),
      )
    },
  )

  it('take numbers from the register in teaching and feedback, and leave a case its own values', () => {
    expect(errorsWith(withBlock({ body: 'Stop clopidogrel 5 days before a biopsy.' }))).toEqual(
      expect.arrayContaining([expect.stringMatching(/types a number by hand/)]),
    )
    expect(
      errorsWith({
        prediction: {
          ...REWRITTEN_FIXTURE.prediction,
          situation: 'A 64-year-old man, 82 kg, SpO₂ 93% on 2 L.',
        },
      }),
    ).toEqual([])
  })

  it('flag a choice unsafe only when it is the section’s harmful reflex', () => {
    const choices = REWRITTEN_FIXTURE.prediction.choices.map((choice) =>
      choice.id === 'c' ? { ...choice, plausibility: 'unsafe' as const } : choice,
    )
    expect(errorsWith({ prediction: { ...REWRITTEN_FIXTURE.prediction, choices } })).toEqual([
      expect.stringMatching(/choice c is flagged unsafe but is not the section's harmful reflex/),
    ])
    expect(errorsWith({ harmfulReflexPatterns: [] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/no phrase that names its harmful reflex/)]),
    )
  })

  it('refuse a key that only hands the decision to someone else', () => {
    const choices = REWRITTEN_FIXTURE.prediction.choices.map((choice) =>
      choice.id === 'a' ? { ...choice, label: 'Ask the attending what to do next' } : choice,
    )
    expect(errorsWith({ prediction: { ...REWRITTEN_FIXTURE.prediction, choices } })).toEqual([
      expect.stringMatching(/keys a hand-off/),
    ])
  })

  it('limit how often a section points to the attending', () => {
    const body = Array.from(
      { length: REWRITE_CAPS.deferralMentions + 1 },
      () => 'Tell the attending.',
    )
    expect(
      errorsWith(
        withBlock({ body: body.slice(0, 3).join(' '), points: [body[3]], pointsLabel: 'And' }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/names the attending, supervisor or faculty 4 times/),
      ]),
    )
  })

  it('open with the hook, predict before teaching, check after it, and close on the checklist', () => {
    const [hook, check, teach, practice, transfer, review] = REWRITTEN_FIXTURE_FLOW
    expect(errorsWith({}, [teach, hook, check, practice, transfer, review])).toEqual(
      expect.arrayContaining([expect.stringMatching(/must open with the clinical question/)]),
    )
    expect(errorsWith({}, [hook, teach, check, practice, transfer, review])).toEqual(
      expect.arrayContaining([expect.stringMatching(/prediction before the teaching/)]),
    )
    expect(errorsWith({}, [hook, check, transfer, teach, practice, review])).toEqual(
      expect.arrayContaining([expect.stringMatching(/check after the teaching/)]),
    )
    expect(errorsWith({}, [hook, check, teach, practice, transfer])).toEqual(
      expect.arrayContaining([expect.stringMatching(/close by repeating the hook's checklist/)]),
    )
    expect(
      errorsWith({}, [hook, check, { ...teach, visual: 'none' }, practice, transfer, review]),
    ).toEqual(
      expect.arrayContaining([expect.stringMatching(/teaches something visible with no picture/)]),
    )
  })

  it('keep the hook short: one sentence and four checklist items', () => {
    const { anchor } = REWRITTEN_FIXTURE
    expect(
      errorsWith({ anchor: { ...anchor, precise: 'Name the parent. Then the branch.' } }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/hook sentence must be one sentence/)]))
    expect(errorsWith({ anchor: { ...anchor, checklist: anchor.checklist.slice(0, 3) } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/hook checklist has 3 items; 4/)]),
    )
  })

  it('assess each outcome at least three times', () => {
    expect(
      errorsWith({
        outcomes: [
          ...(REWRITTEN_FIXTURE.outcomes ?? []),
          { id: 'second', text: 'Recover an origin left behind.' },
        ],
      }),
    ).toEqual([expect.stringMatching(/outcome second is assessed 0 times; at least three/)])
    expect(errorsWith({ outcomes: [] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/states 0 outcomes; one or two/)]),
    )
  })

  it('want a first-move card for a complication: moves in order, and when to call for help', () => {
    const bleeding = { ...REWRITTEN_FIXTURE, id: 'bleeding-priorities' as const }
    expect(rewriteRuleErrors(bleeding, REWRITTEN_FIXTURE_FLOW)).toEqual(
      expect.arrayContaining([expect.stringMatching(/has no first-move card/)]),
    )
    const card: BronchTeachingBlock = {
      ...REWRITTEN_FIXTURE.blocks[0],
      role: 'first-moves',
      steps: ['Keep the scope in and wedge it', 'Suction beside the wedge'],
    }
    const errors = rewriteRuleErrors(
      { ...bleeding, blocks: [card, REWRITTEN_FIXTURE.blocks[1]] },
      REWRITTEN_FIXTURE_FLOW,
    )
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/first-move card with fewer than three moves/),
        expect.stringMatching(/does not say when to call for help/),
      ]),
    )
  })

  it('measure every section that is not rewritten without failing it', () => {
    for (const section of BRONCH_SECTIONS) {
      if (section.authoringContract === 2) continue
      const flow = COURSE_FLOWS[section.id] ?? []
      expect(() => measureSection(section, flow)).not.toThrow()
      expect(() => rewriteRuleErrors(section, flow)).not.toThrow()
    }
  })

  it('hold every rewritten section to them, as authored', () => {
    expect(
      BRONCH_SECTIONS.filter((section) => section.authoringContract === 2).map(
        (section) => section.id,
      ),
    ).toEqual([
      'clinical-question',
      'pre-use-check',
      'sedation-and-monitoring',
      'five-controls',
      'right-side',
      'bleeding-priorities',
    ])
    for (const section of [
      clinicalQuestion,
      preUseCheck,
      sedationAndMonitoring,
      fiveControls,
      rightSide,
      bleedingPriorities,
    ]) {
      expect(bronchSectionErrors(section)).toEqual([])
      expect(rewriteRuleErrors(section, COURSE_FLOWS[section.id] ?? [])).toEqual([])
    }
  })

  it('score a test-wise reader: the key that pauses among options that argue', () => {
    const cued = {
      choices: [
        { label: 'Pause and reassess the patient', plausibility: 'best' },
        { label: 'Advance, since the view is clear', plausibility: 'incorrect-mechanism' },
        { label: 'Suction, because blood is present', plausibility: 'incorrect-mechanism' },
      ],
    }
    const fair = {
      choices: [
        { label: 'Wedge the scope in the segment', plausibility: 'best' },
        { label: 'Pause and call for the blocker', plausibility: 'incorrect-mechanism' },
        { label: 'Withdraw to the carina', plausibility: 'incorrect-mechanism' },
      ],
    }
    expect(testWiseScore([cued])).toBe(1)
    expect(testWiseScore([fair])).toBe(0)
    expect(testWiseScore([cued, fair])).toBe(0.5)
  })
})

describe('what the rules add to the shared surfaces', () => {
  it('no step tells the learner the question is optional', () => {
    for (const lesson of bronchStageLessons())
      for (const step of lesson.steps) expect(step.instruction).not.toMatch(/optional/i)
  })

  it('a monitor reading shows its number with its unit, and the monitor says once that it is a case', () => {
    render(
      <MonitorPanel
        caption="Two minutes after the biopsy"
        readings={[
          {
            channel: 'oximetry',
            words: 'Falling from 96',
            trend: 'falling',
            value: '89',
            unit: '%',
            provenance: 'authored',
          },
          {
            channel: 'blood-pressure',
            words: 'Unchanged',
            trend: 'steady',
            value: '128/76',
            unit: 'mmHg',
            provenance: 'authored',
          },
          { channel: 'airway-view', words: 'Red, tip wedged', trend: 'new' },
        ]}
      />,
    )
    const values = [...document.querySelectorAll('[data-monitor-value]')].map(
      (node) => node.textContent,
    )
    expect(values).toEqual(['89%', '128/76 mmHg'])
    expect(document.querySelector('[data-model-boundary]')?.textContent).toBe(MONITOR_BOUNDARY)
    expect(document.body.textContent).not.toMatch(/model boundary|never a threshold/i)
  })

  it('a first-move card lists its moves in order and ends with when to call for help', () => {
    render(
      <BlockCard
        listId="card"
        role="mechanism"
        block={{
          ...REWRITTEN_FIXTURE.blocks[0],
          role: 'first-moves',
          heading: 'First moves',
          body: 'Blood fills the view after a biopsy.',
          steps: [
            'Keep the scope in and wedge it',
            'Suction beside the wedge',
            'Bleeding side down',
          ],
          callForHelp: 'when the wedge does not hold.',
        }}
      />,
    )
    const moves = [...document.querySelectorAll('[data-first-moves] li')].map(
      (li) => li.textContent,
    )
    expect(moves).toEqual([
      'Keep the scope in and wedge it',
      'Suction beside the wedge',
      'Bleeding side down',
    ])
    expect(document.querySelector('[data-first-moves]')?.tagName).toBe('OL')
    expect(document.querySelector('[data-call-for-help]')?.textContent).toBe(
      'Call for help when the wedge does not hold.',
    )
  })

  it('a card names the sources of its numbers once, and says once to check the local protocol', () => {
    const block = withResolvedNumbers({
      ...REWRITTEN_FIXTURE,
      ...withBlock({
        body: `Food ${num('fasting-solids')} before; clear fluids ${num('fasting-clear-fluids')} before.`,
      }),
    }).blocks[0]
    render(<BlockCard listId="card" role="framing" block={block} />)
    const note = document.querySelector('[data-number-sources]')
    expect(note?.textContent).toBe(
      'Sources: BTS 2013; ICS/NCCP(I)/IAB 2019. Check your local protocol.',
    )
    expect(document.body.textContent).toContain('Food 4 hours before; clear fluids 2 hours before.')
    expect(document.body.textContent?.match(/local protocol/g)).toHaveLength(1)
  })

  it('a definition names its source without sending the learner to a local protocol', () => {
    const block = withResolvedNumbers({
      ...REWRITTEN_FIXTURE,
      ...withBlock({ body: `Grade 1 is ${num('nashville-grade-1')}.` }),
    }).blocks[0]
    render(<BlockCard listId="card" role="framing" block={block} />)
    expect(document.querySelector('[data-number-sources]')?.textContent).toBe(
      'Source: Nashville scale, Chest 2020.',
    )
  })

  it('a card says nothing about local policy until the institution has configured one', () => {
    render(
      <BlockCard
        listId="card"
        role="mechanism"
        block={{ ...REWRITTEN_FIXTURE.blocks[0], localPolicyIds: ['bleeding_rescue'] }}
      />,
    )
    expect(document.querySelector('[data-local-policies]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/local policy|not configured/i)
  })
})
