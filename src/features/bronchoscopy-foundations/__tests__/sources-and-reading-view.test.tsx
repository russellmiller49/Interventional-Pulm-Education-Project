import { cleanup, fireEvent, render, within } from '@testing-library/react'

import { BronchSourceList } from '../components/stage/BronchSourceList'
import { BronchoscopyFoundationsReference } from '../components/reference/BronchoscopyFoundationsReference'
import { BRONCH_GRAMMAR, grammarRow, grammarRowControl, type GrammarRow } from '../content/grammar'
import { BRONCH_SECTION_IDS, bronchSection, type BronchSectionId } from '../content/pathway'
import { bronchStageSources } from '../content/stageSources'
import {
  bronchSourceClass,
  formatSourceRef,
  manifestTranscript,
  PDF_PAGE_LOCATOR_NOTE,
  SOURCE_BY_ID,
  SOURCES,
  TRANSCRIPT_SENTENCE,
} from '../data/sources'
import { MANIFEST_SOURCES } from '../data/generated/sources.generated'
import {
  clickPrimary,
  currentStepId,
  installDom,
  mountSection,
  settle,
} from '../test-support/stageHarness'

/**
 * BF-PRE-REVIEW-02, sources and Reading the view (fellow walkthrough A8, A10, SUP-02).
 *
 * A8: the section source list read `manifest.transcript !== undefined`, which is true of the
 * `transcript: null` every textbook, manual and guideline carries, and so tagged all of them as
 * unreviewed lecture transcripts. A10: the lesson printed the Reading-the-view rows as loose lines
 * while the Reference printed a table. These cases fail on the unchanged baseline.
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
  installDom()
})
afterEach(() => {
  cleanup()
})

const occurrences = (text: string, sentence: string) => text.split(sentence).length - 1

const VALID_TRANSCRIPT = {
  collection: 'A lecture collection',
  duration: '00:40:00',
  durationSeconds: 2400,
  moduleIds: ['M01'],
  adoptedContribution: 'What the course adopted from it.',
  audioVideoReviewed: false,
  slidesAvailable: false,
  speakerIdentityVerified: false,
  publicationPermission: 'not_established',
}

describe('source identity is read from a validated transcript record (A8)', () => {
  it('reads a valid record, null and an absent field, and refuses a malformed one', () => {
    expect(manifestTranscript({ id: 'T01', transcript: VALID_TRANSCRIPT })).toBe(VALID_TRANSCRIPT)
    expect(manifestTranscript({ id: 'S1', transcript: null })).toBeNull()
    expect(manifestTranscript({ id: 'S1' })).toBeNull()
    for (const malformed of [
      {},
      'lecture',
      true,
      [],
      { ...VALID_TRANSCRIPT, collection: '' },
      { ...VALID_TRANSCRIPT, durationSeconds: Number.NaN },
      { ...VALID_TRANSCRIPT, audioVideoReviewed: 'no' },
      { ...VALID_TRANSCRIPT, moduleIds: 'M01' },
    ])
      expect(() => manifestTranscript({ id: 'T01', transcript: malformed })).toThrow(
        /malformed transcript record/,
      )
  })

  it('refuses a record whose transcript disagrees with the id it is registered under', () => {
    expect(bronchSourceClass({ id: 'S1', transcript: null })).toBe('reference')
    expect(bronchSourceClass({ id: 'U2' })).toBe('reference')
    expect(bronchSourceClass({ id: 'T08', transcript: VALID_TRANSCRIPT })).toBe('transcript')
    expect(() => bronchSourceClass({ id: 'S1', transcript: VALID_TRANSCRIPT })).toThrow(
      /registered as a published source/,
    )
    expect(() => bronchSourceClass({ id: 'T08', transcript: null })).toThrow(
      /registered as a lecture transcript/,
    )
  })

  it('classes the textbook, both manuals and the guidelines as published works, and every lecture as a transcript', () => {
    const expected: Readonly<Record<string, string>> = {
      S1: 'Textbook',
      S2: 'Training manual',
      S3: 'Faculty manual',
      U1: 'Guideline or official guidance',
      U2: 'Guideline or official guidance',
    }
    for (const [id, kindLabel] of Object.entries(expected)) {
      const source = SOURCE_BY_ID.get(id)!
      expect([id, source.sourceClass, source.kindLabel]).toEqual([id, 'reference', kindLabel])
      expect(source.limitation).not.toBe(TRANSCRIPT_SENTENCE)
    }
    for (const source of SOURCES) {
      const lecture = /^T\d{2}$/.test(source.id)
      expect([source.id, source.sourceClass]).toEqual([
        source.id,
        lecture ? 'transcript' : 'reference',
      ])
      if (lecture) expect(source.kindLabel).toBe('Lecture transcript')
    }
    // The generated records are unchanged: every non-transcript still carries an explicit null.
    expect(
      MANIFEST_SOURCES.filter((source) => !/^T/.test(source.id)).every(
        (source) => source.transcript === null,
      ),
    ).toBe(true)
  })

  it('keeps the fixed transcript sentence true of every transcript it is shown on', () => {
    // "The recording and slides were not reviewed": the sentence may stay fixed only while no
    // transcript record says its recording was reviewed. A record that changes must change this.
    for (const source of SOURCES.filter((entry) => entry.sourceClass === 'transcript'))
      expect([source.id, source.manifest.transcript?.audioVideoReviewed]).toEqual([
        source.id,
        false,
      ])
  })
})

describe('the section source list (A8, SUP-02)', () => {
  it('tags only the lecture with the transcript sentence, once, in Section 1', () => {
    render(<BronchSourceList records={bronchStageSources('shared-airway').records} />)
    const row = (id: string) => document.querySelector<HTMLElement>(`[data-evidence-id="${id}"]`)!
    for (const id of ['S1', 'S2', 'S3', 'U1']) {
      expect(row(id)).toHaveAttribute('data-source-class', 'reference')
      expect(row(id).textContent).not.toContain(TRANSCRIPT_SENTENCE)
      expect(row(id).querySelector('[data-source-transcript-note]')).toBeNull()
    }
    expect(row('S1').querySelector('[data-source-kind]')).toHaveTextContent('Textbook')
    expect(row('U1').querySelector('[data-source-kind]')).toHaveTextContent(
      'Guideline or official guidance',
    )
    expect(row('T08')).toHaveAttribute('data-source-class', 'transcript')
    expect(row('T08').querySelector('[data-source-kind]')).toHaveTextContent('Lecture transcript')
    expect(occurrences(row('T08').textContent ?? '', TRANSCRIPT_SENTENCE)).toBe(1)
  })

  it('agrees with the Reference about every source in every section', () => {
    render(<BronchoscopyFoundationsReference />)
    const reference = new Map(
      [...document.querySelectorAll<HTMLElement>('[data-source-id]')].map((item) => [
        item.getAttribute('data-source-id')!,
        {
          kind: item.querySelector('strong')?.textContent?.replace(/\.$/, ''),
          transcript: occurrences(item.textContent ?? '', TRANSCRIPT_SENTENCE),
        },
      ]),
    )
    cleanup()
    for (const sectionId of BRONCH_SECTION_IDS) {
      render(<BronchSourceList records={bronchStageSources(sectionId).records} />)
      for (const item of document.querySelectorAll<HTMLElement>('[data-evidence-id]')) {
        const id = item.getAttribute('data-evidence-id')!
        expect([sectionId, id, item.querySelector('[data-source-kind]')?.textContent]).toEqual([
          sectionId,
          id,
          reference.get(id)?.kind,
        ])
        expect([sectionId, id, occurrences(item.textContent ?? '', TRANSCRIPT_SENTENCE)]).toEqual([
          sectionId,
          id,
          reference.get(id)?.transcript,
        ])
      }
      cleanup()
    }
  })

  it('names a PDF locator as a PDF page, explains it once, and states no printed page', () => {
    expect(
      formatSourceRef({ sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 83 } }),
    ).toBe('S1, PDF pages 71–83')
    expect(formatSourceRef({ sourceId: 'S2', location: { kind: 'pdf-pages', from: 44 } })).toBe(
      'S2, PDF page 44',
    )
    render(<BronchSourceList records={bronchStageSources('shared-airway').records} />)
    const s1 = document.querySelector<HTMLElement>('[data-evidence-id="S1"]')!
    expect(s1.textContent).toMatch(/S1, PDF pages? \d+/)
    expect(s1.textContent).not.toMatch(/S1, PDF \d/)
    expect(s1.querySelectorAll('[data-source-locator-note]')).toHaveLength(1)
    expect(s1.querySelector('[data-source-locator-note]')).toHaveTextContent(PDF_PAGE_LOCATOR_NOTE)
    expect(s1.textContent).not.toMatch(/printed page \d|print(?:ed)? p\. ?\d/i)
    for (const id of ['U1', 'T08'])
      expect(
        document.querySelector(`[data-evidence-id="${id}"] [data-source-locator-note]`),
      ).toBeNull()
  })

  it('copies and opens the source the control belongs to', async () => {
    const writeText = jest.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<BronchSourceList records={bronchStageSources('shared-airway').records} />)
    const s2 = document.querySelector<HTMLElement>('[data-evidence-id="S2"]')!
    const copy = within(s2).getByRole('button', { name: 'Copy citation for S2' })
    fireEvent.click(copy)
    const source = SOURCE_BY_ID.get('S2')!
    expect(writeText).toHaveBeenCalledWith(`${source.byline}. ${source.title} (${source.year}).`)
    await settle()
    expect(within(s2).getByRole('button', { name: 'Citation for S2 copied' })).toHaveTextContent(
      'Copied',
    )
    expect(
      within(document.querySelector<HTMLElement>('[data-evidence-id="S3"]')!).getByRole('button', {
        name: 'Copy citation for S3',
      }),
    ).toHaveTextContent('Copy citation')
    const u1 = document.querySelector<HTMLElement>('[data-evidence-id="U1"]')!
    const open = within(u1).getByRole('link', { name: /Open source U1/ })
    expect(open).toHaveAttribute('href', SOURCE_BY_ID.get('U1')!.url)
    expect(open).toHaveAttribute('target', '_blank')
    expect(open.getAttribute('rel')).toMatch(/noopener/)
    // A source with no link offers none rather than a dead one.
    expect(document.querySelector('[data-evidence-id="S2"] [data-source-open]')).toBeNull()
  })
})

describe('focus scrolling reserves the continuation bar as measured (A9)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('reserves the pinned bar’s own height below, and nothing once the bar is not pinned', async () => {
    // jsdom lays nothing out; give the bar the height it measured at 200% text on a phone.
    const rect = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const height = this.hasAttribute('data-course-continuation') ? 135 : 0
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: height,
          right: 0,
          width: 0,
          height,
          toJSON() {},
        }
      })
    try {
      const { lesson } = await mountSection('shared-airway')
      const root = document.documentElement
      // A reading step pins the bar: its measured height plus a small gap, never a fixed 19rem.
      expect(lesson.steps[0].course?.presentation).toBe('illustrated')
      expect(root.style.getPropertyValue('--bronch-focus-clear-bottom')).toBe('147px')
      cleanup()
      expect(root.style.getPropertyValue('--bronch-focus-clear-bottom')).toBe('')
      // A skill step keeps its bar in the flow above the workbench, so nothing is reserved.
      await mountSection('five-controls')
      clickPrimary()
      await settle()
      expect(
        document
          .querySelector('[data-course-presentation]')
          ?.getAttribute('data-course-presentation'),
      ).toBe('skill')
      expect(root.style.getPropertyValue('--bronch-focus-clear-bottom')).toBe('')
    } finally {
      rect.mockRestore()
    }
  })
})

/** The sections the walkthrough found printing Reading the view as loose lines. */
const GRAMMAR_SECTIONS: readonly BronchSectionId[] = [
  'branch-entry',
  'view-loss',
  'larynx-and-entry',
  'right-side',
  'left-side',
  'systematic-survey',
  'poor-return',
  'protected-accessories',
  'deterioration',
  'bleeding-priorities',
  'scope-in-a-tube',
]

function cellTexts(row: Element) {
  const text = (selector: string) =>
    row
      .querySelector(selector)
      ?.textContent?.replace(
        /^(You see|Where it lives|Shortlist|Which control, if any|Taught in)/,
        '',
      )
  return {
    see: text('[data-grammar-cell="see"]'),
    lives: text('[data-grammar-cell="lives"]'),
    shortlist: [...row.querySelectorAll('[data-grammar-cell="shortlist"] li')].map(
      (item) => item.textContent,
    ),
    control: text('[data-grammar-cell="control"]'),
  }
}

function expectedCells(row: GrammarRow) {
  return {
    see: row.see,
    lives: row.lives,
    shortlist: [...row.shortlist],
    control: grammarRowControl(row),
  }
}

function expectGrammarTable(table: Element | null, rows: readonly GrammarRow[]) {
  expect(table).not.toBeNull()
  expect(table!.tagName).toBe('TABLE')
  expect([...table!.querySelectorAll('thead th[scope="col"]')].map((th) => th.textContent)).toEqual(
    expect.arrayContaining(['You see', 'Where it lives', 'Shortlist', 'Which control, if any']),
  )
  const trs = [...table!.querySelectorAll('tbody tr[data-grammar-row]')]
  expect(trs.map((tr) => tr.getAttribute('data-grammar-row'))).toEqual(rows.map((row) => row.id))
  for (const [index, tr] of trs.entries()) {
    expect(tr.querySelector('th[scope="row"]')).not.toBeNull()
    expect(cellTexts(tr)).toEqual(expectedCells(rows[index]))
  }
}

describe('Reading the view is one table in the lessons and the Reference (A10)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('keeps the control wording the lesson printed, row for row', () => {
    // The strings the lesson excerpt printed before it became a table; no clinical wording moves.
    const before = (row: GrammarRow) =>
      row.verdict === 'this-control'
        ? null
        : row.verdict === 'no-control-retrace'
          ? 'Stop, name the last certain landmark, retrace'
          : row.verdict === 'no-control-stop-and-communicate'
            ? 'Stop the provoking action, communicate, get help'
            : 'The plan, the question or the record changes'
    for (const row of BRONCH_GRAMMAR)
      if (before(row) !== null) expect(grammarRowControl(row)).toBe(before(row))
    expect(grammarRowControl(grammarRow('lens-obscured'))).toBe('Suction')
  })

  it.each(GRAMMAR_SECTIONS)(
    'the %s lesson shows its rows as a table at every step that shows them',
    async (sectionId) => {
      const { lesson } = await mountSection(sectionId)
      const rows = BRONCH_GRAMMAR.filter((row) =>
        bronchSection(sectionId).grammarRowIds.includes(row.id),
      )
      const grammarSteps = lesson.steps
        .map((step, index) => ({ step, index }))
        .filter(({ step }) => step.course?.grammar)
      expect(grammarSteps.length).toBeGreaterThan(0)
      let seen = 0
      for (const [index, step] of lesson.steps.entries()) {
        expect(currentStepId()).toBe(step.id)
        if (step.course?.grammar) {
          const block = document.querySelector('[data-teaching-block="grammar"]')
          expectGrammarTable(block?.querySelector('table[data-grammar]') ?? null, rows)
          // Named by the block's own heading, and the trend rule still printed under it.
          const table = block!.querySelector('table')!
          expect(document.getElementById(table.getAttribute('aria-labelledby')!)).toHaveTextContent(
            'Connect the observation to the problem',
          )
          expect(block!.querySelector('[data-grammar-trend-rule]')).not.toBeNull()
          seen += 1
        }
        if (index === lesson.steps.length - 1) break
        const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
        if (skip) fireEvent.click(skip)
        else clickPrimary()
        await settle()
      }
      expect(seen).toBe(grammarSteps.length)
    },
  )

  it('renders the Reference from the same rows and cells, with where each is taught', () => {
    render(<BronchoscopyFoundationsReference />)
    const table = document.querySelector('#reading-the-view table[data-grammar]')
    expectGrammarTable(table, BRONCH_GRAMMAR)
    expect(table!.getAttribute('aria-labelledby')).toBe('ref-view-heading')
    for (const row of BRONCH_GRAMMAR)
      expect(
        table!.querySelector(`[data-grammar-row="${row.id}"] [data-grammar-cell="taught-in"] a`),
      ).toHaveTextContent(bronchSection(row.taughtIn).shortTitle)
  })
})
