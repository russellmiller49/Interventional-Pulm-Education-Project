/**
 * The hub opens on the one thing to do (2026-10-17).
 *
 * The ECMO beta tester walked that module's hub on 2026-10-13 and asked: "one thing to do, then what
 * is all the other stuff for?" ECMO's answer (PR #399) was a hero that holds the start action, one
 * closed "About this module" for everything else, and the module's boundary statement as a closed
 * disclosure instead of a banner. The MCS hub had the same shape problem — an audience paragraph,
 * five objectives, a time note, a refresher and a history card before the pathway, then a route
 * orientation, five reference blocks and a second boundary statement — and now has the same answer.
 *
 * These are rendered checks: each mounts the real hub or workbench and reads what a learner sees.
 */
import { act, cleanup, render, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)
jest.mock('../components/EcmoCannulationPreview', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').ecmoPreviewModule(),
)
jest.mock('../components/ImpellaVariantPreview', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').impellaPreviewModule(),
)

import { McsHub } from '../components/McsHub'
import { MCS_HUB_OBJECTIVES } from '../content/hubObjectives'
import {
  renderWorkbench,
  setupMcsWorkbenchEnvironment,
  teardownMcsWorkbenchEnvironment,
} from '../test-support/mcsWorkbench'

async function renderHub() {
  const view = render(<McsHub />)
  // The Continue and the accordion read stored progress in a `setTimeout(0)`.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
  return view
}

/** The page with the About disclosure taken out: what a learner reads before opening anything. */
function outsideAbout(container: HTMLElement): HTMLElement {
  const outside = container.cloneNode(true) as HTMLElement
  outside.querySelector('details[data-hub-about]')?.remove()
  return outside
}

beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support' }))
afterEach(() => {
  cleanup()
  teardownMcsWorkbenchEnvironment()
})

describe('the hub opens on the one thing to do', () => {
  it('holds the title, one line and the one Continue in the hero, and nothing else', async () => {
    const { container } = await renderHub()
    const hero = container.querySelector<HTMLElement>('header[data-hub-hero]')!
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Mechanical Circulatory Support ICU Lab',
    )
    expect(hero.querySelector('[data-hub-summary]')).toHaveTextContent(
      /^IABP, Impella and durable LVAD support for the adult ICU, on one simulated circulation\./,
    )
    // The one link in the hero is the Continue; it starts a new learner on section one.
    const links = within(hero).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('data-mcs-continue', 'resolved')
    expect(links[0]).toHaveTextContent(/^Start — /)
    expect(hero.querySelectorAll('p')).toHaveLength(1)
  })

  it('keeps the pathway directly under the hero, open where the learner is', async () => {
    const { container } = await renderHub()
    const hero = container.querySelector('header[data-hub-hero]')!
    const pathway = container.querySelector('#mcs-hub-pathway')!
    expect(hero.nextElementSibling?.contains(pathway)).toBe(true)
    // The group holding the next section is open, so a section link is one look away.
    expect(pathway.querySelector('details[open] [data-recommended="true"] a')).not.toBeNull()
  })

  it('folds everything else into one closed About this module', async () => {
    const { container } = await renderHub()
    const abouts = container.querySelectorAll<HTMLDetailsElement>('details[data-hub-about]')
    expect(abouts).toHaveLength(1)
    const about = abouts[0]!
    expect(about.open).toBe(false)
    expect(about.querySelector('summary h2')).toHaveTextContent('About this module')

    // Who it is for, what a learner will be able to do, how it is organised, and the reference.
    for (const selector of [
      '[data-hub-audience]',
      '[data-hub-refresher]',
      '[data-hub-objectives]',
      '[data-route-orientation]',
      '[data-track-increments]',
      '[data-hub-time-note]',
      '[data-hub-progress-note]',
    ]) {
      expect(about.querySelector(selector)).not.toBeNull()
    }
    expect(about.querySelectorAll('[data-hub-objective]')).toHaveLength(MCS_HUB_OBJECTIVES.length)
    const references = about.querySelectorAll<HTMLDetailsElement>('details[data-reference]')
    expect([...references].map((block) => block.dataset.reference)).toEqual([
      'glossary',
      'common-model',
      'pathways',
      'devices',
      'sources',
    ])

    // None of it is left outside the disclosure.
    const outside = outsideAbout(container)
    expect(
      outside.querySelector(
        '[data-hub-audience], [data-hub-objectives], [data-hub-refresher], [data-route-orientation], [data-reference]',
      ),
    ).toBeNull()
  })

  it('says nothing about how the page works or what may be skipped', async () => {
    const { container } = await renderHub()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/PERSONAL HISTORY|Stored locally|fresh model|not replayed/)
    expect(text).not.toMatch(/No ranking, comparison, or claim/)
    expect(text).not.toMatch(/Predictions are optional|without performing an action/)
    expect(text).not.toMatch(/recommendation, not a lock|Each block is folded/)
    expect(text).not.toMatch(/Browse all \d+ sections/)
  })
})

describe('the module states its boundary once, as a closed disclosure', () => {
  it('on the hub, in the frame, and nowhere else on the page', async () => {
    const { container } = await renderHub()
    const notes = container.querySelectorAll<HTMLDetailsElement>('details[data-mcs-boundary]')
    expect(notes).toHaveLength(1)
    const note = notes[0]!
    expect(note.open).toBe(false)
    expect(note.closest('[role="note"]')).toHaveAttribute('aria-label', 'Educational safety notice')
    expect(note.querySelector('summary')).toHaveTextContent(/^Teaching simulator/)
    // The statement itself is unchanged.
    expect(note.querySelector('p')).toHaveTextContent(
      /^Its numbers come from a model, not from a patient or a real console\. At the bedside, work from the patient and the device’s instructions for use\.$/,
    )
    // The hub's own second statement, under the reference blocks, is gone.
    expect(container.querySelector('[data-review-governance]')).toBeNull()
    expect(container.textContent).not.toMatch(/This is a teaching simulator\./)
  })

  it.each(['practice', 'assess'] as const)('on the %s route as well', async (section) => {
    const view = await renderWorkbench({ section })
    const notes = view.container.querySelectorAll<HTMLDetailsElement>('details[data-mcs-boundary]')
    expect(notes).toHaveLength(1)
    expect(notes[0]!.open).toBe(false)
  })
})
