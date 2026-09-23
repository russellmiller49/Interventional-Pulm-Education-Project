import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { CoursePage } from '../components/CoursePage'
import { LessonHost } from '../components/LessonHost'
import { PracticePage } from '../components/PracticePage'
import { SequenceActivity } from '../components/SequenceActivity'
import { ExaminationWorkspace } from '../components/ExaminationWorkspace'
import { TeachingDiagram } from '../components/Diagram'
import { CHAPTERS, LESSONS } from '../content/curriculum'
import { ACTIVITY_FLOWS, activitiesForLesson } from '../content/stage'
import { GLOSSARY, glossaryForLesson } from '../content/glossary'
import {
  TROUBLESHOOTING_PATIENT,
  TROUBLESHOOTING_PERSISTENT,
  TROUBLESHOOTING_RULE,
  TROUBLESHOOTING_STEPS,
} from '../content/troubleshooting'
import { EXAMINATION_CASE, MODEL_WINDOW_CASE } from '../content/examination-cases'
import { newExamination, saveExamination } from '../engine/examination'
import { PROGRESS_STORAGE_KEY } from '../engine/selfPacedProgress'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import {
  CONTACT_MODE_LABELS,
  MODEL_REVISION,
  MODEL_STEPS,
  initialModelState,
  modelFrameId,
  modelReducer,
  type ContactMode,
  type RouteState,
} from '@/lib/ebus-model-contract'
import { LINKED_LANDMARKS, structureDisplayName } from '@/lib/ebus-linked-contract'

/**
 * EBUS-PRE-REVIEW-04 — clearer teaching without exam conversion.
 *
 * Each block names the ledger row it holds. What is asserted is what the batch promises: the
 * course map is the registry, the marks mean navigation, definitions come from the course's own
 * text, titles say what the task does, scaffolded tasks say they are guided — and none of it
 * changes a key, an id, an accepted action, a gate, or what is stored.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const contactObservation = (mode: ContactMode): EbusObservation => ({
  ...EMPTY_EBUS_OBSERVATION,
  ready: true,
  frameReady: true,
  actionCount: 6,
  model: {
    package: 'contact',
    revision: MODEL_REVISION,
    frameId: 'contact-frame-' + mode,
    steps: [...MODEL_STEPS.contact],
    complete: true,
    annotations: false,
    contactMode: mode,
  },
})
const recordedCapture =
  (withExample: boolean) =>
  (sessionId: string): EbusObservation => ({
    ...EMPTY_EBUS_OBSERVATION,
    acquisitionSession: sessionId,
    ready: true,
    frameReady: true,
    actionCount: 3,
    lastAction: 'save',
    depth: 40,
    gain: 43,
    contrast: 43,
    frozen: true,
    measured: true,
    saved: true,
    recorded: {
      type: 'recorded-frame',
      version: 1,
      sessionId,
      taskId: 'capture',
      frameId: 'capture-frame',
      segmentId: 'Depth4_Gain_4',
      mediaTime: 2,
      width: 1920,
      height: 1080,
      settings: { depthMm: 40, gain: 43, contrast: 43, doppler: false },
      ...(withExample
        ? {
            example: {
              control: 'gain' as const,
              index: 4,
              levels: 8,
              segmentId: 'Depth4_Gain_4',
              file: 'Depth4.mp4',
              startSeconds: 10,
              endSeconds: 12,
              depthCm: 4,
            },
          }
        : {}),
      calipers: [
        { x: 10, y: 10 },
        { x: 40, y: 40 },
      ],
      held: true,
      captured: true,
    },
  })
const workbenchEmitters: Record<string, (sessionId: string) => EbusObservation> = {}
jest.mock('../components/Workbench', () => ({
  Workbench: ({
    onObservation,
    sessionId,
    demonstration,
  }: {
    onObservation: (s: EbusObservation) => void
    sessionId: string
    demonstration?: boolean
  }) => (
    <section data-mock-workbench={demonstration ? 'demonstration' : 'live'}>
      {Object.entries(workbenchEmitters).map(([label, emit]) => (
        <button key={label} onClick={() => onObservation(emit(sessionId))}>
          {label}
        </button>
      ))}
    </section>
  ),
}))
jest.mock('../components/StationFigure', () => ({
  StationFigure: ({ station }: { station: string }) => <figure data-mock-station={station} />,
}))

beforeEach(() => {
  localStorage.clear()
  for (const key of Object.keys(workbenchEmitters)) delete workbenchEmitters[key]
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  Element.prototype.scrollIntoView = jest.fn()
})
afterEach(cleanup)

const lesson = (id: string) => LESSONS.find((entry) => entry.id === id)!
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement
const next = () => fireEvent.click(primary())

/* A. One course map ------------------------------------------------------------------------- */

describe('the chapter registry is the one course map (OV-1, OV-2, L1-2, L2-8, L25-5)', () => {
  it('records the registry this batch was built against', () => {
    expect(CHAPTERS).toHaveLength(7)
    expect(LESSONS).toHaveLength(26)
  })

  it('summarizes the chapter registry on the Overview instead of a five-phase schematic', () => {
    const { container } = render(<CoursePage />)
    expect(container.querySelector('[data-teaching-diagram]')).toBeNull()
    expect(screen.queryByText('Authored schematic', { exact: false })).toBeNull()
    expect(screen.queryByText('Nodal survey')).toBeNull()
    const map = screen.getByRole('navigation', { name: 'The course in 7 chapters' })
    const links = within(map).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(CHAPTERS.map((chapter) => chapter.title))
    for (const chapter of CHAPTERS)
      expect(container.querySelector('#chapter-' + chapter.id)).not.toBeNull()
  })

  it('gives the four lessons that showed the schematic no figure at all', () => {
    for (const id of [
      'clinical-question',
      'preparation',
      'complications-recovery',
      'results-reporting',
    ]) {
      expect(lesson(id).diagram).toBeUndefined()
      expect(activitiesForLesson(lesson(id))[0].image).toBe('none')
    }
  })

  it('says what a drawn schematic is and marks the structure a name selects', () => {
    const { container } = render(<TeachingDiagram kind="stations" />)
    expect(container.querySelector('[data-diagram-caption]')).toHaveTextContent(
      'A schematic drawn for this course, not to scale and not a patient image.',
    )
    fireEvent.click(screen.getByRole('button', { name: '2. Carina' }))
    expect(screen.getByRole('button', { name: '2. Carina' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(container.querySelector('[data-diagram-marker="2"]')).toHaveAttribute('data-active')
  })
})

/* B. Navigation language -------------------------------------------------------------------- */

describe('reviewed is a navigation mark (NAV-1)', () => {
  it('explains the marks on the course map without introducing any new status', () => {
    const { container } = render(<CoursePage mode="Learn" />)
    const legend = container.querySelector('[data-course-marks-legend]')!
    expect(legend).toHaveTextContent('Reviewed: you reached its end, or marked it yourself')
    expect(legend).toHaveTextContent('does not record which tasks you completed, skipped or')
    expect(screen.queryByText(/attempted|skipped lesson|% complete/i)).toBeNull()
  })

  it('marks a lesson reviewed at its end whatever was skipped, says so, and can be undone', () => {
    render(<LessonHost lesson={lesson('clinical-question')} />)
    // Continue past every task and check without doing any of them.
    for (let step = 0; step < 10 && !document.querySelector('[data-session-summary]'); step++)
      next()
    expect(document.querySelector('[data-session-summary]')).toHaveTextContent('Task not completed')
    expect(document.querySelector('[data-task-instruction]')).toHaveTextContent(
      'Reviewed means you reached the end of the lesson, whether you completed, skipped or only read its tasks',
    )
    const stored = () => JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)!)
    expect(stored().reviewedLessonIds).toEqual(['clinical-question'])
    fireEvent.click(screen.getByRole('button', { name: 'Unmark as reviewed' }))
    expect(stored().reviewedLessonIds).toEqual([])
  })
})

/* C. Glossary -------------------------------------------------------------------------------- */

/** Every learner-facing string the course content carries, for provenance checks. */
const corpus = [
  ...LESSONS.flatMap((entry) => [
    entry.title,
    entry.objective,
    entry.recall,
    entry.concept,
    ...entry.paragraphs,
    ...entry.checklist,
    entry.worked.context,
    entry.worked.reasoning,
    ...entry.takeaways,
    entry.boundary,
    ...[entry.question, entry.observation, entry.transfer].flatMap((q) => [
      q.prompt,
      q.explanation,
      ...q.choices.flatMap((choice) => [choice.text, choice.rationale]),
    ]),
  ]),
  ...Object.values(ACTIVITY_FLOWS).flatMap((flow) => flow.map((spec) => spec.note ?? '')),
  readFileSync(join(__dirname, '../components/CoursePage.tsx'), 'utf8'),
  readFileSync(join(__dirname, '../components/ExaminationWorkspace.tsx'), 'utf8'),
]
  .join('\n')
  .replace(/\s+/g, ' ')
  .toLowerCase()
/*
 * Provenance, term by term. `sourced` is each fragment of the definition that must be found in the
 * course's own text; `framing` is the only wording allowed around them, and none of it is a
 * clinical claim. Once both are removed nothing may be left over but punctuation.
 */
const PROVENANCE: Record<string, { sourced: string[]; framing?: string[] }> = {
  'ebus-tbna': {
    sourced: [
      'endobronchial ultrasound-guided transbronchial needle aspiration',
      'linear ebus places an ultrasound transducer beside the airway and displays a needle in its imaging plane',
      'ebus-tbna can obtain material for diagnosis and nodal staging',
      'radial ebus, used to localize peripheral lesions, serves a different procedural role',
    ],
  },
  'examination-record': {
    sourced: [
      'an examination record connects the clinical request, planned coverage, specimens and unanswered questions',
      'plans and form entries are learner declarations',
      'specimen and result entries are supplied history',
    ],
    framing: ['in the course’s record tasks,'],
  },
  station: {
    sourced: [
      'the iaslc map names compartments',
      'a node’s station is determined by where it lies, not by its size, pet uptake, or sonographic appearance',
      'record the station before collecting and labeling a specimen',
    ],
  },
  'n-category': {
    sourced: [
      'n classification describes regional tumor involvement in the relevant cancer context, not all adenopathy',
      'a non-lung-cancer adenopathy case does not automatically receive an n category',
      'relative to the primary side',
      'ipsilateral hilar and intrapulmonary nodes, including interlobar nodes, are n1',
      'subcarinal involvement',
      'is n2 for either primary side',
      'contralateral mediastinal involvement is n3',
      '4l is n3, 7 is n2, and 11r is n1',
    ],
    framing: [
      'the categories are defined',
      'the course’s examples',
      // Lesson 12: "station 7 is an N2 station for either lung".
      '(station 7)',
      'for a right lung primary,',
      'these are the examples the course teaches, not the complete ninth-edition definitions',
    ],
  },
  'n2a-n2b': {
    sourced: [
      'in tnm ninth edition, n2a means involvement of a single ipsilateral mediastinal or subcarinal station; n2b means multiple such stations',
      'count involved stations, not individual nodes or needle passes',
      'this distinction does not itself prescribe treatment',
    ],
  },
  'systematic-staging': {
    sourced: [
      'survey of accessible relevant stations, including the core mediastinal stations 4r, 4l, and 7',
      'ct/pet findings and any inaccessible target',
      'a targeted examination',
    ],
    framing: ['a planned', 'reconciled with', 'rather than'],
  },
  'acoustic-contact': {
    sourced: [
      'air between the transducer and the airway wall reflects most of the incident ultrasound',
      'a usable window requires contact between the transducer or fluid-filled balloon and the wall',
      'gain amplifies received echoes; it cannot replace missing contact',
    ],
  },
  'eus-b': {
    sourced: [
      'eus-b uses the ebus endoscope from the esophagus',
      'changing the approach does not change a lymph node’s anatomical station',
      'complement airway ebus, particularly for 4l, 7, and lower mediastinal stations 8 and 9, depending on anatomy and operator expertise',
      'the esophageal route does not replace the airway examination of hilar or interlobar nodes',
    ],
    framing: ['it can'],
  },
  rose: {
    sourced: [
      'rapid on-site evaluation (rose) provides immediate feedback about the submitted material and may guide further acquisition or allocation',
      'it does not replace final pathology and does not automatically establish adequacy for all molecular or ancillary tests',
    ],
  },
  nonrepresentative: {
    sourced: [
      'blood-only or otherwise nonrepresentative material is not equivalent to a representative negative node',
      'an unexamined station has no tissue result',
    ],
  },
}

describe('glossary definitions come from the course (NAV-3, L1-4, L15-4)', () => {
  it('holds a provenance record for every entry', () => {
    expect(Object.keys(PROVENANCE).sort()).toEqual(GLOSSARY.map((entry) => entry.id).sort())
  })
  it.each(GLOSSARY.map((entry) => [entry.id, entry] as const))(
    '%s is assembled from the course’s own sentences',
    (id, entry) => {
      const { sourced, framing = [] } = PROVENANCE[id]
      expect(sourced.filter((part) => !corpus.includes(part))).toEqual([])
      let rest = entry.definition.toLowerCase()
      for (const part of [...sourced, ...framing]) {
        expect(rest).toContain(part)
        rest = rest.replace(part, ' ')
      }
      expect(rest.replace(/[\s.,;:]/g, '')).toBe('')
      expect(entry.sources.length).toBeGreaterThan(0)
    },
  )

  it('leaves out terms the course uses without defining, rather than defining them', () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase()).join(' ')
    for (const undefinedTerm of ['chs', 'central hilar', 'ifu', 'tnm ', 'nsclc'])
      expect(terms).not.toContain(undefinedTerm)
  })

  it('brings the staging terms to lesson 1, before lesson 17 teaches them, with a link forward', () => {
    render(<LessonHost lesson={lesson('clinical-question')} />)
    const terms = document.querySelector('[data-glossary]')!
    expect(within(terms as HTMLElement).getByText('N category (N1, N2, N3)')).toBeInTheDocument()
    expect(within(terms as HTMLElement).getByText('Examination record')).toBeInTheDocument()
    expect(within(terms as HTMLElement).getByText('EBUS-TBNA')).toBeInTheDocument()
    const forward = within(terms as HTMLElement).getByRole('link', {
      name: 'Full teaching: Lesson 17 · Systematic staging and TNM ninth edition',
    })
    expect(forward).toHaveAttribute('href', '/ebus-guided/learn?section=systematic-staging')
    expect(LESSONS.findIndex((entry) => entry.id === 'systematic-staging')).toBe(16)
  })

  it('offers the N categories where lesson 15 first assesses them, and never where a lesson teaches the term itself', () => {
    expect(glossaryForLesson('hilar-interlobar').map((entry) => entry.id)).toContain('n-category')
    // A lesson that shows a term does not already print its definition word for word.
    for (const entry of GLOSSARY)
      for (const lessonId of entry.firstUse) {
        const shown = lesson(lessonId)
        const text = [
          ...shown.paragraphs,
          ...(ACTIVITY_FLOWS[lessonId] ?? []).map((spec) => spec.note ?? ''),
        ]
        expect(text.some((part) => part.includes(entry.definition))).toBe(false)
      }
  })

  it('opens the whole glossary from Help', () => {
    render(<LessonHost lesson={lesson('image-depth')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Course glossary' })).toBeInTheDocument()
    for (const entry of GLOSSARY) expect(within(dialog).getByText(entry.term)).toBeInTheDocument()
  })
})

/* D. Refreshers and links ------------------------------------------------------------------- */

describe('refreshers and tool links say where they go (L1-3, part D)', () => {
  it('links the CT-orientation recall to existing open refreshers in a new tab, optionally', () => {
    render(<LessonHost lesson={lesson('clinical-question')} />)
    const refreshers = document.querySelector('[data-refreshers]') as HTMLElement
    expect(refreshers).toHaveTextContent('nothing here requires them')
    const links = within(refreshers).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/learn/anatomy/branch-tracing/learn?lesson=orientation',
      '/bronchoscopy-foundations/learn?section=right-side',
      '/bronchoscopy-foundations/learn?section=left-side',
    ])
    for (const link of links) expect(link).toHaveAttribute('target', '_blank')
  })

  it('says the separate EBUS tools need a site account', () => {
    render(<PracticePage />)
    expect(
      screen.getByRole('link', { name: /EBUS simulator \(separate tool, sign-in required\)/ }),
    ).toHaveAttribute('href', '/ebus-training/simulator')
    expect(
      screen.getByText(/They ask you to sign in to the site; this course does not/),
    ).toBeVisible()
  })
})

/* E. Titles that say what the task does ------------------------------------------------------ */

describe('activity titles describe the actual task (L15-3, L16-3, L20-5, L23-4)', () => {
  const titled = (lessonId: string, activityId: string) =>
    activitiesForLesson(lesson(lessonId)).find((a) => a.id === lessonId + ':' + activityId)!
  it.each([
    [
      'hilar-interlobar',
      'regional-identity',
      'Match bronchial relationships to interlobar stations',
      'matching',
    ],
    [
      'node-characterization',
      'node-description',
      'Choose the description the vignette supports',
      'record',
    ],
    [
      'needle-safety',
      'apply-another-situation',
      'Respond to resistance at a calcified target',
      'questions',
    ],
    [
      'specimen-triage',
      'apply-another-situation',
      'Discuss granulomas when microbiology was not sent',
      'questions',
    ],
    [
      'needle-assembly-model',
      'apply-another-situation',
      'Respond to resistance with the tip visible',
      'questions',
    ],
    ['ct-map', 'review-acquisition', 'Identify what determines a station name', 'questions'],
  ])('%s %s', (lessonId, activityId, expected, interaction) => {
    const activity = titled(lessonId, activityId)
    expect(activity.title).toBe(expected)
    // The activity id, its interaction and the question slots it answers are unchanged.
    expect(activity.interaction).toBe(interaction)
  })
  it('keeps the checks those titles sit over', () => {
    expect(lesson('needle-safety').transfer.prompt).toMatch(/calcified target resists needle entry/)
    expect(lesson('specimen-triage').transfer.prompt).toMatch(/no microbiology was sent/)
    expect(lesson('needle-assembly-model').transfer.prompt).toMatch(
      /resistance despite a recognizable tip/,
    )
  })
})

/* I. Wording corrections that keep the meaning ---------------------------------------------- */

describe('wording corrections keep every key (L1-11, L4-5, L20-4)', () => {
  it('L1-11 no longer calls an aspirate result histology, and the key is unchanged', () => {
    const q = lesson('clinical-question').question
    const keyed = q.choices.find((choice) => choice.correct)!
    expect(keyed.id).toBe('b')
    expect(keyed.text).toBe('Whether disease involves other relevant nodal stations')
    expect(keyed.rationale).toBe(
      'A result from one station does not supply the rest of the nodal map.',
    )
    expect(q.explanation).toBe(keyed.rationale)
    expect(q.prompt).toMatch(/malignant station 7 aspirate/)
  })
  it('L4-5 recall names the control the activity actually uses', () => {
    const entry = lesson('acoustic-contact')
    expect(entry.recall).toMatch(
      /tip flexion and advancement also change its relationship to the wall/,
    )
    expect(entry.recall).toMatch(/This activity uses tip flexion\./)
    expect(entry.lab!.controls).toEqual(['flexion'])
  })
  it('L20-4 says what an exposed tip can harm, as the lesson’s own takeaway does', () => {
    const entry = lesson('needle-safety')
    const keyed = entry.observation.choices.find((choice) => choice.correct)!
    expect(keyed.text).toBe('An exposed tip can harm the patient or the equipment')
    expect(entry.takeaways).toContain('Retraction checks protect the patient and equipment.')
    expect(keyed.id).toBe('b')
  })
})

/* G. Hints for the check on screen ----------------------------------------------------------- */

describe('the hint helps with the check on screen (L1-9)', () => {
  it('quotes the lesson passage for a lesson-1 check instead of the CT prerequisite', () => {
    for (const q of ['question', 'observation', 'transfer'] as const) {
      const hint = lesson('clinical-question')[q].hint!
      expect(lesson('clinical-question').paragraphs.join(' ')).toContain(hint)
    }
    render(<LessonHost lesson={lesson('clinical-question')} />)
    next() // briefing → matching
    next() // skip matching; its first check appears
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    const hint = document.querySelector('[data-question-hint]') as HTMLElement
    expect(hint).toHaveTextContent(
      'From this lesson: A diagnostic procedure asks what the lesion is.',
    )
    expect(hint).not.toHaveTextContent('axial chest CT orientation')
  })
  it('keeps the recall in lessons whose checks carry no passage', () => {
    expect(lesson('image-depth').question.hint).toBeUndefined()
  })
})

/* H. Honest guided-practice framing --------------------------------------------------------- */

describe('scaffolded tasks say they are guided practice, and nothing is hidden (part H)', () => {
  it('labels every check that sits beside the key points as guided practice', () => {
    for (const entry of LESSONS)
      for (const activity of activitiesForLesson(entry))
        if (activity.teaching.includes('takeaways') && activity.questions.length) {
          expect(activity.purpose).toMatch(/^Guided practice: the lesson’s key points stay beside/)
          expect(activity.support).toBe('guided')
        }
  })
  it('names the activity in learner words, and keeps the key points and limits on screen', () => {
    render(<LessonHost lesson={lesson('clinical-question')} />)
    next() // briefing → matching
    next() // leave the matching task
    next() // past its first check
    next() // past its second check, to the transfer
    expect(document.querySelector('[data-activity-kind="transfer"]')).toHaveTextContent(
      'Guided practice · new situation',
    )
    expect(document.querySelector('[data-activity-purpose]')).toHaveTextContent(
      'the lesson’s key points stay beside this check on purpose',
    )
    expect(
      screen.getByRole('heading', { name: 'Carry this into the next examination' }),
    ).toBeVisible()
    expect(screen.getByText('Plan tissue handling before the first pass.')).toBeVisible()
  })
  it('explains the scaffolding on L6-3, L12-2, L17-3 and L23-2 without changing the task', () => {
    const find = (lessonId: string, id: string) =>
      activitiesForLesson(lesson(lessonId)).find((a) => a.id === lessonId + ':' + id)!
    expect(find('image-depth', 'depth-comparison').purpose).toMatch(
      /names the teaching example’s settings/,
    )
    expect(find('station-seven', 'station-decision').purpose).toMatch(
      /The stem names the node’s compartment/,
    )
    expect(find('systematic-staging', 'sampling-order').purpose).toMatch(
      /each step names that target’s N category/,
    )
    expect(find('specimen-triage', 'allocation-plan').purpose).toMatch(
      /shows the laboratory’s instruction/,
    )
    expect(lesson('image-depth').lab!.instruction).toMatch(/Compare the 3 cm and 4 cm recordings/)
  })
})

describe('Try it yourself is the learner’s choice and changes nothing that is checked (L17-3)', () => {
  const sequence = lesson('systematic-staging').sequence!
  it('shows the worked labels by default, hides them on request, and still checks the same order', () => {
    const onComplete = jest.fn()
    render(<SequenceActivity sequence={sequence} onComplete={onComplete} />)
    expect(
      screen.getByRole('button', { name: 'Sample the confirmed 4R target (N3)' }),
    ).toBeVisible()
    const toggle = screen.getByRole('button', { name: 'Try it yourself: hide the N categories' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Show the N categories again' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText(/\(N[123]\)/)).toBeNull()
    for (const text of [
      'Sample the confirmed 4R target',
      'Sample the confirmed station 7 target',
      'Sample the confirmed 11L target',
    ])
      fireEvent.click(screen.getByRole('button', { name: text }))
    fireEvent.click(screen.getByRole('button', { name: 'Check sequence' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
    // The result shows the full steps and the explanation again.
    expect(screen.getByText('Sample the confirmed 4R target (N3)')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('4R → 7 → 11L follows N3 → N2 → N1')
  })
  it('keeps Show the sequence available while the labels are hidden', () => {
    const onReveal = jest.fn()
    render(<SequenceActivity sequence={sequence} onComplete={jest.fn()} onReveal={onReveal} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try it yourself: hide the N categories' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show the sequence' }))
    expect(onReveal).toHaveBeenCalled()
    expect(screen.getByText('Sample the confirmed station 7 target (N2)')).toBeInTheDocument()
  })
  it('offers no toggle on a sequence without worked labels', () => {
    render(<SequenceActivity sequence={lesson('preparation').sequence!} onComplete={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /Try it yourself/ })).toBeNull()
  })
})

/* J / K. Demonstration versus learner work; L5-1 stays protected ---------------------------- */

describe('what counts, and the held contact frame (L5-2, L5-1)', () => {
  it('says once, beside the demonstration, what records and what does not', () => {
    render(<LessonHost lesson={lesson('contact-cutaway-model')} />)
    expect(document.querySelector('[data-evidence-identity="demonstration"]')).toHaveTextContent(
      'nothing you do here is recorded. Your own acquisition is the next task, and it counts once you hold it.',
    )
  })

  it.each(['bubble', 'gap', 'direct', 'balloon'] as const)(
    'held %s: the reflector check says it names another condition and the frame is untouched',
    (mode) => {
      workbenchEmitters['Complete the contact model'] = () => contactObservation(mode)
      render(<LessonHost lesson={lesson('contact-cutaway-model')} />)
      next() // demonstration → acquisition
      fireEvent.click(screen.getByText('Complete the contact model'))
      next() // hold
      expect(document.querySelector('[data-evidence-identity="held"]')).toHaveTextContent(
        'Contact condition held: ' + CONTACT_MODE_LABELS[mode] + '.',
      )
      next() // past the first check (a described situation)
      const check = document.querySelector('[data-question-id]')!
      expect(check.getAttribute('data-question-id')).toBe('cutaway-observe')
      expect(check).toHaveTextContent(
        'Why did changing gain fail to remove the dark region behind the reflector?',
      )
      expect(document.querySelector('[data-task-instruction]')).toHaveTextContent(
        'This check names a different contact condition (contact with a reflector) from the one your held image shows (' +
          CONTACT_MODE_LABELS[mode] +
          '). Your held image stays as you acquired it.',
      )
      // The held evidence is still the frame the learner acquired.
      expect(document.querySelector('[data-evidence-identity="held"]')).toHaveTextContent(
        CONTACT_MODE_LABELS[mode],
      )
    },
  )

  it('says nothing extra when the held condition is the one the check names', () => {
    workbenchEmitters['Complete the contact model'] = () => contactObservation('shadow')
    render(<LessonHost lesson={lesson('contact-cutaway-model')} />)
    next()
    fireEvent.click(screen.getByText('Complete the contact model'))
    next()
    next()
    expect(document.querySelector('[data-task-instruction]')).toHaveTextContent(
      'This is the image you acquired. Interpret it, or open the explanation first.',
    )
  })
})

/* M. Learner language for internal labels (L10-4, L22-5) ------------------------------------ */

describe('internal labels become learner language without losing what they said (L10-4, L22-5)', () => {
  it.each([
    [true, 'Recorded teaching example at 4 cm depth, gain example 4 of 8'],
    [false, 'Recorded teaching example · Selected depth 4 cm'],
  ])('capture record, example described: %s', (withExample, expected) => {
    workbenchEmitters['Capture'] = recordedCapture(withExample)
    render(<LessonHost lesson={lesson('capture')} />)
    next() // briefing
    next() // plane decision
    fireEvent.click(screen.getByText('Capture'))
    next() // hold (acknowledged: recorded.held)
    const card = document.querySelector('[data-capture-example]')!
    expect(card).toHaveTextContent(expected)
    expect(card).not.toHaveTextContent('Depth4_Gain_4')
    expect(
      screen.getByText(/Station identity and clinical borders are not validated/),
    ).toBeVisible()
  })

  it('says a restored draft is from an earlier session and that model work needs a new acquisition', () => {
    saveExamination(MODEL_WINDOW_CASE, newExamination(MODEL_WINDOW_CASE))
    render(
      <ExaminationWorkspace
        caseData={MODEL_WINDOW_CASE}
        task="station-window"
        onComplete={jest.fn()}
      />,
    )
    const status = document.querySelector('[data-record-restored]')!
    expect(status).toHaveTextContent(
      'Your earlier entries for this case were restored from this browser.',
    )
    expect(status).toHaveTextContent('a record from that earlier session, not a new acquisition')
    expect(status).toHaveTextContent('model tasks start again and need a new acquisition')
    expect(status).not.toHaveTextContent(/historical metadata/i)
  })
})

/* O. Diagrams that render only existing content (L22-6, L24-2) ------------------------------ */

describe('source-bound figures (L22-6, L24-2)', () => {
  it('the troubleshooting flow is the lesson’s own questions, in its order, with its own pairs', () => {
    const entry = lesson('difficult-acquisition')
    expect(TROUBLESHOOTING_STEPS.map((step) => step.question)).toEqual([
      'Is the airway position understood?',
      'Is the transducer coupled?',
      'Is the target framed and the image usable?',
      'Is the path acceptable?',
      'Is the needle tip visible?',
    ])
    for (const step of TROUBLESHOOTING_STEPS) expect(entry.paragraphs[0]).toContain(step.question)
    const pairs = entry.matching!.pairs.map((pair) => [pair.cue, pair.response])
    for (const step of TROUBLESHOOTING_STEPS.filter((s) => s.example))
      expect(pairs).toContainEqual([step.example!.observed, step.example!.response])
    expect(TROUBLESHOOTING_STEPS.filter((s) => !s.example)).toHaveLength(2)
    expect(entry.paragraphs[0]).toContain(TROUBLESHOOTING_RULE)
    expect(entry.paragraphs[1]).toContain(TROUBLESHOOTING_PERSISTENT.text)
    expect(entry.paragraphs[2].startsWith(TROUBLESHOOTING_PATIENT)).toBe(true)
  })

  it('renders the flow beside the lesson 24 briefing, and the safety paragraph stays in the lesson text', () => {
    render(<LessonHost lesson={lesson('difficult-acquisition')} />)
    const flow = document.querySelector('[data-troubleshooting-flow]') as HTMLElement
    expect(
      within(flow)
        .getAllByRole('listitem')
        .filter((li) => li.hasAttribute('data-ladder-step')),
    ).toHaveLength(5)
    expect(screen.getByText(lesson('difficult-acquisition').paragraphs[2])).toBeVisible()
  })

  it('the running-case specimen figure shows only what the case supplies', () => {
    render(<LessonHost lesson={lesson('adequacy-rose')} />)
    const figure = document.querySelector('[data-case-specimens]') as HTMLElement
    for (const specimen of EXAMINATION_CASE.specimens)
      expect(figure.querySelector('[data-case-specimen="' + specimen.id + '"]')).not.toBeNull()
    for (const result of EXAMINATION_CASE.results)
      expect(within(figure).getByText(result.text)).toBeInTheDocument()
    expect(figure).not.toHaveTextContent(/\bN3\b|stage|diagnos/i)
  })
})

/* L3-10, L19-2: display names and view-specific notices; identities unchanged --------------- */

describe('display names and route notices change words only (L3-10, L19-2)', () => {
  it('shows the course spelling while every id stays as it was', () => {
    expect(structureDisplayName('azygous', 'azygous')).toBe('azygos vein')
    expect(structureDisplayName('left_atrium', 'Left Atrium')).toBe('left atrium')
    expect(structureDisplayName('atrial_appendage_left', 'atrial appendage left')).toBe(
      'left atrial appendage',
    )
    expect(structureDisplayName('node_station_11ri', 'Example node 11RI')).toBe('Example node 11Ri')
    expect(structureDisplayName('aorta', 'aorta')).toBe('aorta')
    expect(LINKED_LANDMARKS['right-paratracheal']).toContain('azygous')
  })

  it('names each recorded route view and counts them, without moving any frame', () => {
    let state = initialModelState('routes') as RouteState
    const notices: string[] = []
    for (const [station, route] of [
      ['4L', 'airway'],
      ['4L', 'esophagus'],
      ['7', 'airway'],
      ['7', 'esophagus'],
      ['8', 'esophagus'],
    ] as const) {
      state = modelReducer(state, { type: 'station', value: station }) as RouteState
      state = modelReducer(state, { type: 'route', value: route }) as RouteState
      const before = modelFrameId(state)
      state = modelReducer(state, { type: 'inspect' }) as RouteState
      expect(modelFrameId(state)).toBe(before)
      notices.push(state.notice)
    }
    expect(new Set(notices).size).toBe(5)
    expect(notices[0]).toBe(
      'Recorded: the airway (EBUS) view of 4L example. The target and the surrounding anatomy stay where they were; only the locator and viewing direction change. 1 of 5 supported views recorded.',
    )
    expect(notices[4]).toMatch(
      /esophageal \(EUS-B\) view of the lower paraesophageal example \(8\)\. .* 5 of 5 supported views recorded\./,
    )
    expect(state.steps).toEqual([
      '4L-airway',
      '4L-esophagus',
      '7-airway',
      '7-esophagus',
      '8-esophagus',
    ])
  })
})

/* N. Repeated practice says what changes (L12-7, L13-5) ------------------------------------- */

describe('repeated practice says what changes, and keeps its own evidence (L12-7, L13-5)', () => {
  it.each([
    ['station-seven', 'changed-position'],
    ['right-paratracheal', 'right-changed'],
  ])('%s %s', (lessonId, id) => {
    const activity = activitiesForLesson(lesson(lessonId)).find(
      (entry) => entry.id === lessonId + ':' + id,
    )!
    expect(activity.purpose).toMatch(/^Repeated on purpose, from a changed scope position/)
    expect(activity.task).toBe('changed-window')
    expect(lesson(lessonId).transferLab!.linkedVariant).toBe('changed-window')
  })
  it('labels lesson times as estimates on the map', () => {
    render(<CoursePage mode="Learn" />)
    expect(screen.getAllByText(/· about \d+ min/).length).toBe(LESSONS.length)
  })
})

it('keeps the registry: every lesson in every chapter, once, in order', () => {
  expect(CHAPTERS.flatMap((chapter) => chapter.lessons.map((entry) => entry.id))).toEqual(
    LESSONS.map((entry) => entry.id),
  )
})
