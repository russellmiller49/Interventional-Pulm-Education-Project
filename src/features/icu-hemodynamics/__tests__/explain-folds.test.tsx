import { cleanup, fireEvent, render } from '@testing-library/react'

import {
  CardiacOutputMethodModel,
  CardiacOutputMethodSection,
} from '../components/CardiacOutputMethodModel'
import { requireCardiacOutputMethod } from '../content/cardiacOutputMethods'
import { FickMethodWorkbench } from '../components/FickMethodWorkbench'
import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import {
  clickPrimary,
  currentStepId,
  installDom,
  leaveTask,
  mountSection,
} from '../test-support/stageHarness'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/icu-hemodynamics/learn',
}))

/**
 * What a section has already shown is folded under its heading (owner, 2026-11-11).
 *
 * Measured on screen, the module's seventeen Explain cards held about 26,000 of its 36,900
 * task-card words (counting what is drawn, not the text equivalents a screen reader gets). Each
 * section has two, the Explain task and "What carried over", and the second printed the first
 * one's pattern table, control list and whole reference again, word for word. Four folds, none
 * of which removes a sentence:
 *
 *   A. on "What carried over", a block shown on the section's Explain task is a closed heading
 *      that says so;
 *   B. Section 3's Explain card no longer reprints the teaching of the task before it;
 *   C. the shock profiles and the validity sequence each have one home (Sections 8 and 2), and
 *      Section 9 shows them as closed headings.
 *   E. the flow section's Explain card does not reprint the reading pages of its tasks 1 and 4
 *      (E1 the six Fick episodes, E2 the thermodilution sequence and quality checks).
 *
 * After: about 25,300 words on screen, 32% fewer, every block one press away.
 */
beforeAll(() => installDom())
beforeEach(() => {
  jest.useFakeTimers()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const explainSteps = (sectionId: string) =>
  hemodynamicsStageLesson(sectionId).steps.filter((step) => step.interaction.kind === 'explain')

function openStep(sectionId: string, stepId: string) {
  mountSection(sectionId)
  for (let guard = 0; currentStepId() !== stepId && guard < 60; guard += 1) leaveTask()
  expect(currentStepId()).toBe(stepId)
}

/**
 * A block's body words, without headings. A part's heading is a summary where it is folded and a
 * heading where it is open, and a summary also says where the part is read, so headings differ
 * between two cards whose content is the same.
 */
function ownWords(block: Element): number {
  const copy = block.cloneNode(true) as Element
  copy.querySelectorAll('summary, h3, h4').forEach((heading) => heading.remove())
  return (copy.textContent ?? '').trim().split(/\s+/).length
}

/** The teaching blocks on the card: name, and whether each sits under a closed heading. */
function blocks() {
  return [...document.querySelectorAll<HTMLElement>('[data-now-card] [data-teaching-block]')]
    .filter((block) => block.parentElement?.closest('[data-teaching-block]') == null)
    .map((block) => {
      const fold = block.closest<HTMLDetailsElement>('details[data-stage-collapsed]')
      const repeat = block.closest('[data-repeated-block]')
      return {
        name: block.getAttribute('data-teaching-block')!,
        words: ownWords(block),
        folded: fold !== null && !fold.open,
        heading: fold?.querySelector('summary')?.textContent ?? null,
        repeat: repeat?.getAttribute('data-repeated-block') ?? null,
      }
    })
}

const twoCardSections = hemodynamicsSectionIds.filter((id) => explainSteps(id).length === 2)

describe('which sections have two Explain cards', () => {
  it('is every section but the first', () => {
    expect(twoCardSections).toEqual(hemodynamicsSectionIds.slice(1))
    expect(explainSteps('why-measure')).toHaveLength(1)
  })
})

describe('A. "What carried over" folds what the Explain task showed', () => {
  it.each(twoCardSections)('%s', (sectionId) => {
    const [first, second] = explainSteps(sectionId)

    openStep(sectionId, first.id)
    const shown = blocks()
    expect(document.querySelector('[data-carried-over-note]')).toBeNull()
    cleanup()

    openStep(sectionId, second.id)
    const again = blocks()
    // Every block of the first card is still on the second, with its content.
    expect(again.map((block) => block.name)).toEqual(shown.map((block) => block.name))
    for (const [index, block] of again.entries()) {
      expect(block.words).toBe(shown[index].words)
      // A model-limit note keeps the stage's own rule; everything else is a closed heading that
      // says where it was shown open.
      if (block.name === 'boundary') continue
      expect({ name: block.name, folded: block.folded }).toEqual({ name: block.name, folded: true })
      expect(block.heading).toMatch(/ · (shown on task \d+|from Section \d)$/)
    }
    expect(document.querySelector('[data-carried-over-note]')).toHaveTextContent(
      `shown on task ${first.ordinal}`,
    )
    // The worked explanation of the question stays open.
    const recap = document.querySelector('[data-now-card] [data-explain-recap]')
    expect(recap).not.toBeNull()
    expect(recap!.closest('details')).toBeNull()
  })
})

describe('the first Explain card of a section still shows its reference open', () => {
  it.each(['pressure-system', 'waveform-components', 'derived-hemodynamics'])(
    '%s folds nothing',
    (sectionId) => {
      openStep(sectionId, explainSteps(sectionId)[0].id)
      expect(document.querySelector('[data-repeated-block]')).toBeNull()
      const shown = blocks().filter((block) => block.name !== 'boundary')
      expect(shown.length).toBeGreaterThanOrEqual(3)
      for (const block of shown) expect(block.folded).toBe(false)
    },
  )
})

describe('B. Section 3’s Explain card does not reprint the task before it', () => {
  it('folds the RV-versus-PA comparison and says which task it is from', () => {
    const lesson = hemodynamicsStageLesson('waveform-interpretation')
    const [first] = explainSteps('waveform-interpretation')
    const earlier = lesson.steps.find(
      (step) => step.teaching === first.teaching && step.ordinal < first.ordinal,
    )!
    expect(first.teaching).toBe('rv-pa')

    openStep('waveform-interpretation', first.id)
    const teaching = document.querySelector('[data-now-card] [data-current-teaching="rv-pa"]')!
    const fold = teaching.closest<HTMLDetailsElement>('details[data-stage-collapsed]')!
    expect(fold.open).toBe(false)
    expect(fold.querySelector('summary')).toHaveTextContent(
      `Right ventricle versus pulmonary artery · from task ${earlier.ordinal}`,
    )
    // Still there, in full.
    expect(teaching.querySelector('[data-ventricle-artery-comparison]')).not.toBeNull()
    // The card's own reference is open: this is the first time it is shown.
    for (const block of blocks()) expect(block.folded).toBe(false)
  })

  it('leaves that comparison open on the task that teaches it', () => {
    const lesson = hemodynamicsStageLesson('waveform-interpretation')
    const reading = lesson.steps.find(
      (step) => step.teaching === 'rv-pa' && step.interaction.kind === 'read',
    )!
    openStep('waveform-interpretation', reading.id)
    const teaching = document.querySelector('[data-now-card] [data-current-teaching="rv-pa"]')!
    expect(teaching.closest('details')).toBeNull()
  })
})

describe('E. the flow section’s Explain card does not reprint its reading pages', () => {
  const lesson = hemodynamicsStageLesson('thermodilution-series')
  const [first] = explainSteps('thermodilution-series')
  const fickPages = lesson.steps.find((step) => step.interaction.kind === 'observe')!
  const part = (block: string) =>
    [
      ...document.querySelectorAll<HTMLDetailsElement>(
        `[data-now-card] [data-teaching-block="${block}"] details[data-repeated-part]`,
      ),
    ].map((fold) => ({
      open: fold.open,
      heading: fold.querySelector('summary')!.textContent!.replace(/\s+/g, ' ').trim(),
      words: (fold.textContent ?? '').trim().split(/\s+/).length,
    }))

  it('reads the Fick episodes on the Observe task and the method on the first task', () => {
    // The pages the Explain card would otherwise print again.
    expect(fickPages.ordinal).toBeLessThan(first.ordinal)
    expect(lesson.steps[0].interaction.kind).toBe('read')
  })

  it('E1: folds the six Fick episodes and keeps the comparison after them open', () => {
    openStep('thermodilution-series', first.id)
    const folds = part('fick-episodes')
    expect(folds).toHaveLength(1)
    expect(folds[0].open).toBe(false)
    expect(folds[0].heading).toBe(`The 6 episodes, in full · shown on task ${fickPages.ordinal}`)
    // Still there, in full: six episode cards inside the fold.
    const block = document.querySelector('[data-now-card] [data-teaching-block="fick-episodes"]')!
    expect(block.querySelectorAll('details[data-repeated-part] > article')).toHaveLength(6)
    expect(folds[0].words).toBeGreaterThan(1500)
    // The comparison is new on this card, so it is not inside the fold.
    const comparison = [...block.querySelectorAll('h3')].find((heading) =>
      /same input error does not always matter/.test(heading.textContent ?? ''),
    )!
    expect(comparison).toBeDefined()
    expect(comparison.closest('details')).toBeNull()
  })

  it('E2 and E3: every part of the thermodilution method says where it is read, on that tab only', () => {
    openStep('thermodilution-series', first.id)
    expect(part('method-model').map((fold) => fold.heading)).toEqual([
      'Where every value came from · on the pages after this card',
      'How the calculation runs · on the pages after this card',
      'Acquisition sequence · from task 1',
      'Quality checks before the number is used · from task 1',
      'What repeating it does and does not show · on the pages after this card',
      'How it breaks down · from task 1',
      'Repeat the acquisition when · from task 1',
      'Withhold the result when · from task 1',
      'Sources · on the pages after this card',
      'Where the methods are uncertain · on the pages after this card',
    ])
    for (const fold of part('method-model')) expect(fold.open).toBe(false)
    // Each closed heading still holds its content.
    for (const fold of part('method-model')) expect(fold.words).toBeGreaterThan(20)

    // Another method's account is read nowhere else: nothing folds on its tab.
    const method = document.querySelector('[data-now-card] [data-teaching-block="method-model"]')!
    const tabs = [...method.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    fireEvent.click(tabs.find((tab) => tab.getAttribute('aria-selected') === 'false')!)
    expect(part('method-model').map((fold) => fold.heading.replace(/ · .*/, ''))).toEqual([
      'Where the methods are uncertain',
    ])
    expect(
      [...method.querySelectorAll('h4')].map((heading) => heading.textContent?.trim()),
    ).toEqual(
      expect.arrayContaining([
        'Acquisition sequence',
        'How it breaks down',
        'Withhold the result when',
        'Sources',
      ]),
    )
  })

  it('E3a: reads how the method breaks down, and when to repeat or withhold, before the questions', () => {
    mountSection('thermodilution-series')
    const titles: string[] = []
    const kickers: string[] = []
    for (let guard = 0; guard < 8; guard += 1) {
      const page = document.querySelector('[data-now-card] [data-reading-part]')
      if (!page) break
      titles.push(document.querySelector('[data-now-card] h2')!.textContent!)
      kickers.push(
        document.querySelector('[data-now-card]')!.textContent!.match(/Introduction \d of \d/)![0],
      )
      // The reference curve is beside every page.
      expect(
        document.querySelector('[data-flow-visual] [data-section-figure="td-curve"]'),
      ).not.toBeNull()
      clickPrimary()
    }
    expect(titles).toEqual([
      'What thermodilution acquires',
      'Read the raw temperature curve',
      'How thermodilution breaks down',
      'When to repeat, and when to withhold',
    ])
    expect(kickers.at(-1)).toBe('Introduction 4 of 4')
    // Still the first task, and the questions come after it.
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(lesson.steps[0].ordinal).toBeLessThan(lesson.steps[lesson.predictionStepIndex].ordinal)
  })

  it('E3a: the page is the card’s own account of that part', () => {
    mountSection('thermodilution-series')
    clickPrimary()
    clickPrimary()
    const page = document.querySelector('[data-now-card] [data-reading-part="td-breakdown"]')!
    const { container } = render(
      <CardiacOutputMethodSection
        method={requireCardiacOutputMethod('thermodilution')}
        section="breakdown"
      />,
    )
    expect(page.textContent).toBe(container.textContent)
    expect(page.textContent!.trim().split(/\s+/).length).toBeGreaterThan(200)
    // The lists were drawn for a light card; on the page's dark card they could not be read.
    const lists = page.querySelectorAll('dl, ul, ol')
    expect(lists.length).toBeGreaterThan(0)
    lists.forEach((list) => expect(list.closest('[data-method-surface]')).not.toBeNull())
  })

  it('E3b: the Explain task gives its explanation first, then reads on a page at a time', () => {
    openStep('thermodilution-series', first.id)
    const primary = () =>
      document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-primary]')!
    const secondary = () =>
      document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-secondary]')!
    // The card itself: the explanation is on it, and the way on reads the pages.
    expect(document.querySelector('[data-now-card] [data-explain-recap]')).not.toBeNull()
    expect(primary()).toHaveTextContent('Read on: the method, 3 pages')
    expect(secondary()).toHaveTextContent('Continue without these pages')

    const titles: string[] = []
    fireEvent.click(primary())
    for (let guard = 0; guard < 5; guard += 1) {
      if (currentStepId() !== first.id) break
      const page = document.querySelector('[data-now-card] [data-reading-part]')
      if (!page) break
      titles.push(document.querySelector('[data-now-card] h2')!.textContent!)
      expect(document.querySelector('[data-now-card]')!.textContent).toMatch(
        new RegExp(`The method ${titles.length} of 3`),
      )
      expect(
        document.querySelector('[data-flow-visual] [data-section-figure="td-curve"]'),
      ).not.toBeNull()
      expect(document.querySelector('[data-now-card] [data-explain-recap]')).toBeNull()
      fireEvent.click(primary())
    }
    expect(titles).toEqual([
      'Where every value came from',
      'How the calculation runs, and what repeating it shows',
      'Sources, and where the methods are uncertain',
    ])
    // The last page's way on is the task's own: it leaves for the next task.
    expect(currentStepId()).toBe(lesson.steps[lesson.steps.indexOf(first) + 1].id)
  })

  it('E3b: the pages can be skipped, and left for the explanation again', () => {
    openStep('thermodilution-series', first.id)
    fireEvent.click(
      document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-primary]')!,
    )
    expect(document.querySelector('[data-now-card] [data-reading-part="td-values"]')).not.toBeNull()
    const back = [...document.querySelectorAll<HTMLButtonElement>('[data-now-card] button')].find(
      (button) => button.textContent?.trim() === 'Back to the explanation',
    )!
    fireEvent.click(back)
    expect(document.querySelector('[data-now-card] [data-explain-recap]')).not.toBeNull()
    const skip = [...document.querySelectorAll<HTMLButtonElement>('[data-now-card] button')].find(
      (button) => button.textContent?.trim() === 'Continue without these pages',
    )!
    fireEvent.click(skip)
    expect(currentStepId()).toBe(lesson.steps[lesson.steps.indexOf(first) + 1].id)
  })

  it('E3b: "What carried over" has no pages of its own', () => {
    const [, second] = explainSteps('thermodilution-series')
    openStep('thermodilution-series', second.id)
    expect(document.querySelector('[data-now-card] [data-now-primary]')).not.toHaveTextContent(
      'Read on',
    )
  })

  it('folds nothing of the kind outside the lesson stage', () => {
    // The components keep their full form wherever no earlier page has shown the content.
    const { container } = render(
      <>
        <FickMethodWorkbench />
        <CardiacOutputMethodModel />
      </>,
    )
    expect(container.querySelector('details[data-repeated-part]')).toBeNull()
  })
})

describe('C. one home for the references two sections share', () => {
  const section = (id: (typeof hemodynamicsSectionIds)[number]) =>
    hemodynamicsSectionIds.indexOf(id) + 1

  it('shows the shock profiles open in Section 8 and as a closed heading in Section 9', () => {
    openStep('derived-hemodynamics', explainSteps('derived-hemodynamics')[0].id)
    expect(blocks().find((block) => block.name === 'shock-profiles')).toMatchObject({
      folded: false,
    })
    cleanup()

    openStep('pac-signal-validation', explainSteps('pac-signal-validation')[0].id)
    expect(blocks().find((block) => block.name === 'shock-profiles')).toMatchObject({
      folded: true,
      heading: `Shock profiles · from Section ${section('derived-hemodynamics')}`,
    })
    expect(
      document.querySelector('[data-teaching-block="shock-profiles"] [data-shock-profiles]'),
    ).not.toBeNull()
  })

  it('shows the validity sequence open in Section 2 and as a closed heading in Section 9', () => {
    openStep('pressure-system', explainSteps('pressure-system')[0].id)
    expect(blocks().find((block) => block.name === 'validity-sequence')).toMatchObject({
      folded: false,
    })
    cleanup()

    openStep('pac-signal-validation', explainSteps('pac-signal-validation')[0].id)
    expect(blocks().find((block) => block.name === 'validity-sequence')).toMatchObject({
      folded: true,
      heading: `The validity sequence, in full · from Section ${section('pressure-system')}`,
    })
  })

  it('keeps Section 9’s own pattern table and control list open: every row, in order', () => {
    openStep('pac-signal-validation', explainSteps('pac-signal-validation')[0].id)
    for (const name of ['grammar', 'control-strip'])
      expect(blocks().find((block) => block.name === name)).toMatchObject({ folded: false })
  })
})
