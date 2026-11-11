import { cleanup } from '@testing-library/react'

import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { currentStepId, installDom, leaveTask, mountSection } from '../test-support/stageHarness'

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
 * one's pattern table, control list and whole reference again, word for word. Three folds, none
 * of which removes a sentence:
 *
 *   A. on "What carried over", a block shown on the section's Explain task is a closed heading
 *      that says so;
 *   B. Section 3's Explain card no longer reprints the teaching of the task before it;
 *   C. the shock profiles and the validity sequence each have one home (Sections 8 and 2), and
 *      Section 9 shows them as closed headings.
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

/** The teaching blocks on the card: name, and whether each sits under a closed heading. */
function blocks() {
  return [...document.querySelectorAll<HTMLElement>('[data-now-card] [data-teaching-block]')]
    .filter((block) => block.parentElement?.closest('[data-teaching-block]') == null)
    .map((block) => {
      const fold = block.closest<HTMLDetailsElement>('details[data-stage-collapsed]')
      const repeat = block.closest('[data-repeated-block]')
      return {
        name: block.getAttribute('data-teaching-block')!,
        words: (block.textContent ?? '').trim().split(/\s+/).length,
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
  it.each([
    'pressure-system',
    'waveform-components',
    'thermodilution-series',
    'derived-hemodynamics',
  ])('%s folds nothing', (sectionId) => {
    openStep(sectionId, explainSteps(sectionId)[0].id)
    expect(document.querySelector('[data-repeated-block]')).toBeNull()
    const shown = blocks().filter((block) => block.name !== 'boundary')
    expect(shown.length).toBeGreaterThanOrEqual(3)
    for (const block of shown) expect(block.folded).toBe(false)
  })
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
