import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { SourcesPanel } from '../components/SourcesPanel'
import { EcmoCitation } from '../components/evidence/EcmoCitation'
import { EcmoSourceList } from '../components/evidence/EcmoSourceList'
import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import { EcmoLocalizationCard } from '../components/teaching/EcmoLocalizationCard'
import { VaConfigurationStrategyCard } from '../components/teaching/VaConfigurationStrategyCard'
import { ecmoCircuitWalkStopsForSection } from '../content/circuitWalk'
import { cardiohelpEvidence, evidenceById } from '../content/evidence'
import {
  ECMO_UNREGISTERED_SOURCE_TITLE,
  ecmoEvidenceIdsBySourceClass,
  ecmoSourceClassLabels,
  ecmoSourceClasses,
  resolveEcmoEvidence,
  unregisteredEcmoCitation,
} from '../content/evidenceResolver'
import { ecmoFoundationSectionById } from '../content/foundationLessons'
import { ecmoLocalizationRow } from '../content/localizationCards'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'

/**
 * One citation surface.
 *
 * Four renderers used to show a source four different ways, and three of them printed the registry
 * id — "Sources: ecmo-book-ch9, …" — into learner copy. Everything now resolves through one
 * resolver and renders through `EcmoSourceList`, and this suite pins the contract from both ends:
 * what the resolver yields for every registered record, what one citation row shows and does, and
 * that none of the five replaced surfaces puts a registry id anywhere a learner reads.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/CardiohelpConsole', () => ({
  CardiohelpConsole: () => <div data-testid="cardiohelp-console" />,
}))
jest.mock('../components/CircuitAndMonitors', () => ({
  CircuitAndMonitors: () => <div data-testid="circuit-and-monitors" />,
}))

const REGISTERED_IDS = cardiohelpEvidence.map((reference) => reference.id)

/** No registry id anywhere a learner reads. Ids live only in `data-evidence-id`. */
function expectNoRawIds(text: string) {
  for (const id of REGISTERED_IDS) expect(text).not.toContain(id)
}

/**
 * The learner-readable text of a rendered surface, minus the lines the shared critical-care
 * renderers print. `DerivedValueReadout` and `HeldDisagreement` live outside this module and still
 * write their own "Sources: <ids>" lines under `data-evidence-ids`; those are not one of the five
 * surfaces this increment replaced, and scanning them here would pin a file this module does not own.
 */
function learnerText(root: Element): string {
  const clone = root.cloneNode(true) as Element
  for (const node of clone.querySelectorAll('[data-evidence-ids]')) node.remove()
  return clone.textContent ?? ''
}

function renderedIds(root: Element | null): readonly string[] {
  return [...(root?.querySelectorAll('[data-evidence-id]') ?? [])].map(
    (node) => node.getAttribute('data-evidence-id') ?? '',
  )
}

function settledReference(profileId: 'vv-reference' | 'va-reference') {
  let state = createReferenceSimulationState(profileId)
  for (let tick = 0; tick < 8; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

function defineClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

function restoreClipboard() {
  delete (navigator as unknown as Record<string, unknown>).clipboard
}

afterEach(() => {
  cleanup()
  restoreClipboard()
})

describe('resolveEcmoEvidence', () => {
  it('resolves every registered id to its title, class label, claim scope and copy text', () => {
    for (const reference of cardiohelpEvidence) {
      const [citation] = resolveEcmoEvidence([reference.id])
      expect(citation).toMatchObject({
        id: reference.id,
        title: reference.title,
        citation: reference.citation,
        sourceClass: reference.sourceClass,
        sourceClassLabel: ecmoSourceClassLabels[reference.sourceClass],
        supports: reference.supports,
        limitations: reference.limitations,
      })
      expect(citation.pages).toBe(reference.pages)
      const pages = reference.pages ? ` Pages ${reference.pages}.` : ''
      const link = citation.href ? ` ${citation.href}` : ''
      expect(citation.copyText).toBe(`${reference.title}. ${reference.citation}${pages}${link}`)
      expect(citation.copyText).not.toContain(reference.id)
    }
  })

  it('covers the whole registry when grouped by source class, once each', () => {
    const grouped = ecmoSourceClasses.flatMap((sourceClass) =>
      ecmoEvidenceIdsBySourceClass(sourceClass),
    )
    expect([...grouped].sort()).toEqual([...REGISTERED_IDS].sort())
    for (const sourceClass of ecmoSourceClasses) {
      expect(ecmoEvidenceIdsBySourceClass(sourceClass).length).toBeGreaterThan(0)
    }
  })

  it('prefers the DOI resolver over the record URL, then the URL, then no link', () => {
    const [va] = resolveEcmoEvidence(['elso-adult-va-2021'])
    expect(va.doi).toBe('10.1097/MAT.0000000000001510')
    expect(va.url).toMatch(/pubmed/)
    expect(va.href).toBe('https://doi.org/10.1097/MAT.0000000000001510')

    const [ifu] = resolveEcmoEvidence(['ifu-us-2025-scope'])
    expect(ifu.doi).toBeUndefined()
    expect(ifu.href).toBe(ifu.url)

    const [chapter] = resolveEcmoEvidence(['ecmo-book-ch9'])
    expect(chapter.href).toBeUndefined()

    for (const reference of cardiohelpEvidence) {
      if (!reference.doi) continue
      const [citation] = resolveEcmoEvidence([reference.id])
      expect(citation.href).toBe(`https://doi.org/${reference.doi}`)
      expect(citation.copyText).toContain(`https://doi.org/${reference.doi}`)
    }
  })

  it('lets a caller narrow the claim scope to what its own surface takes from a source', () => {
    const claim = 'Preload is one of the named limits on the blood flow a circuit can deliver.'
    const [narrowed, untouched] = resolveEcmoEvidence(['ecmo-book-ch17', 'ecmo-book-ch9'], {
      claims: { 'ecmo-book-ch17': claim },
    })
    expect(narrowed.supports).toEqual([claim])
    expect(untouched.supports).toEqual(evidenceById.get('ecmo-book-ch9')?.supports)
    // An empty claim is no claim, and a prototype key is never a claim.
    const [blank] = resolveEcmoEvidence(['ecmo-book-ch17'], { claims: { 'ecmo-book-ch17': '' } })
    expect(blank.supports).toEqual(evidenceById.get('ecmo-book-ch17')?.supports)
  })

  it('resolves each id once, in the caller order', () => {
    expect(
      resolveEcmoEvidence(['elso-circuit-2022', 'ecmo-book-ch9', 'elso-circuit-2022']).map(
        (citation) => citation.id,
      ),
    ).toEqual(['elso-circuit-2022', 'ecmo-book-ch9'])
  })

  it('throws on an unregistered id outside production, and never prints the id in production', () => {
    expect(() => resolveEcmoEvidence(['not-a-registered-source'])).toThrow(
      /not-a-registered-source/,
    )

    const placeholder = unregisteredEcmoCitation('not-a-registered-source')
    expect(placeholder.title).toBe(ECMO_UNREGISTERED_SOURCE_TITLE)
    expect(placeholder.sourceClass).toBe('unregistered')
    const { id, ...readable } = placeholder
    expect(id).toBe('not-a-registered-source')
    expect(JSON.stringify(readable)).not.toContain('not-a-registered-source')

    const env = process.env as Record<string, string | undefined>
    const previous = env.NODE_ENV
    env.NODE_ENV = 'production'
    try {
      const [citation] = resolveEcmoEvidence(['not-a-registered-source'])
      expect(citation.title).toBe(ECMO_UNREGISTERED_SOURCE_TITLE)
      expect(citation.copyText).not.toContain('not-a-registered-source')
    } finally {
      env.NODE_ENV = previous
    }
  })
})

describe('EcmoCitation', () => {
  const [full] = resolveEcmoEvidence(['ifu-console-workflow'])
  const [linked] = resolveEcmoEvidence(['elso-adult-va-2021'])

  it('shows the class badge, title, reference, pages, every claim, the limit and an openable link', () => {
    const { container } = render(
      <ol>
        <EcmoCitation citation={linked} />
      </ol>,
    )
    const row = container.querySelector('[data-evidence-id="elso-adult-va-2021"]')
    expect(row).not.toBeNull()
    expect(row?.querySelector('[data-source-class]')?.textContent).toBe('ECMO clinical guidance')
    expect(row?.querySelector('[data-citation-title]')?.textContent).toBe(linked.title)
    expect(row?.querySelector('[data-citation-reference]')?.textContent).toBe(linked.citation)
    expect(row?.querySelectorAll('[data-citation-supports]')).toHaveLength(linked.supports.length)
    expect(row?.querySelector('[data-citation-limit]')?.textContent).toContain(linked.limitations)

    const link = within(row as HTMLElement).getByRole('link', { name: /open source/i })
    expect(link).toHaveAttribute('href', 'https://doi.org/10.1097/MAT.0000000000001510')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(
      within(row as HTMLElement).getByRole('button', { name: /copy citation/i }),
    ).toHaveAttribute('type', 'button')
    expectNoRawIds(container.textContent ?? '')
  })

  it('prints the page range with the reference and omits the link when the record has none', () => {
    const [chapter] = resolveEcmoEvidence(['ecmo-book-ch9'])
    const { container } = render(
      <ol>
        <EcmoCitation citation={chapter} />
      </ol>,
    )
    expect(container.querySelector('[data-citation-reference]')?.textContent).toBe(
      `${chapter.citation} Pages ${chapter.pages}.`,
    )
    expect(container.querySelector('a')).toBeNull()
  })

  it('shows one claim and no limit in compact mode unless limitations are asked for', () => {
    expect(full.supports.length).toBeGreaterThan(1)
    const compact = render(
      <ol>
        <EcmoCitation citation={full} compact />
      </ol>,
    )
    expect(compact.container.querySelectorAll('[data-citation-supports]')).toHaveLength(1)
    expect(compact.container.querySelector('[data-citation-supports]')?.textContent).toContain(
      full.supports[0],
    )
    expect(compact.container.querySelector('[data-citation-limit]')).toBeNull()
    compact.unmount()

    const withLimit = render(
      <ol>
        <EcmoCitation citation={full} compact showLimitations />
      </ol>,
    )
    expect(withLimit.container.querySelector('[data-citation-limit]')?.textContent).toContain(
      full.limitations,
    )
    withLimit.unmount()

    const fullDensity = render(
      <ol>
        <EcmoCitation citation={full} />
      </ol>,
    )
    expect(fullDensity.container.querySelectorAll('[data-citation-supports]')).toHaveLength(
      full.supports.length,
    )
  })

  it('copies the citation text and says so', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    defineClipboard({ writeText })
    render(
      <ol>
        <EcmoCitation citation={linked} />
      </ol>,
    )
    fireEvent.click(screen.getByRole('button', { name: /copy citation/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Citation copied'))
    expect(writeText).toHaveBeenCalledWith(linked.copyText)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('reveals the text to select when the clipboard is unavailable', async () => {
    defineClipboard(undefined)
    render(
      <ol>
        <EcmoCitation citation={linked} />
      </ol>,
    )
    fireEvent.click(screen.getByRole('button', { name: /copy citation/i }))
    const field = await screen.findByRole<HTMLInputElement>('textbox')
    expect(field).toHaveValue(linked.copyText)
    expect(field).toHaveAttribute('readonly')
    expect(field).toHaveFocus()
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(linked.copyText.length)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Copy is not available here — select the text to copy it',
    )
  })

  it('reveals the text to select when the clipboard rejects', async () => {
    defineClipboard({ writeText: jest.fn().mockRejectedValue(new Error('denied')) })
    render(
      <ol>
        <EcmoCitation citation={linked} />
      </ol>,
    )
    fireEvent.click(screen.getByRole('button', { name: /copy citation/i }))
    const field = await screen.findByRole('textbox')
    expect(field).toHaveValue(linked.copyText)
    expect(screen.getByRole('status')).toHaveTextContent(/select the text to copy it/)
  })
})

describe('EcmoSourceList', () => {
  it('renders an ordered list of resolved rows under its own label, and nothing for no ids', () => {
    const { container } = render(<EcmoSourceList compact evidenceIds={['ecmo-book-ch9']} />)
    const list = container.querySelector('ol')
    expect(list).not.toBeNull()
    expect(within(container).getByRole('list', { name: 'Sources' })).toBe(list)
    expect(renderedIds(container)).toEqual(['ecmo-book-ch9'])

    const empty = render(<EcmoSourceList evidenceIds={[]} />)
    expect(empty.container.innerHTML).toBe('')
  })

  it('labels the list by a title heading at the requested level when given one', () => {
    render(<EcmoSourceList evidenceIds={['ecmo-book-ch9']} title="Read next" headingLevel={4} />)
    expect(screen.getByRole('heading', { level: 4, name: 'Read next' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Read next' })).toBeInTheDocument()
  })
})

describe('the five citing surfaces', () => {
  it('groups the hub sources panel by source class and keeps the profile and checklist', () => {
    const { container } = render(<SourcesPanel publicationStatus="draft" />)

    for (const sourceClass of ecmoSourceClasses) {
      const group = container.querySelector(`section[data-source-class="${sourceClass}"]`)
      expect(group).not.toBeNull()
      expect(within(group as HTMLElement).getByRole('heading', { level: 3 })).toHaveTextContent(
        ecmoSourceClassLabels[sourceClass],
      )
      expect(renderedIds(group)).toEqual([...ecmoEvidenceIdsBySourceClass(sourceClass)])
    }
    expect(container.querySelectorAll('[data-evidence-id]')).toHaveLength(cardiohelpEvidence.length)
    // The old card grid is gone; every row is one shared citation row.
    expect(container.querySelector('article')).toBeNull()

    expect(container.querySelector('dl')).not.toBeNull()
    const checklist = container.querySelector('details')
    expect(checklist?.querySelector('summary')?.textContent).toMatch(/Publication checklist/)
    expect(checklist?.querySelectorAll('li').length).toBeGreaterThan(0)

    for (const link of container.querySelectorAll('a[target="_blank"]')) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
    expectNoRawIds(container.textContent ?? '')
  })

  it.each(['circuit-flow-path', 'pump-and-pressure-zones'] as const)(
    'cites the %s walk stop by title, badge and claim',
    (sectionId) => {
      const { container } = render(
        <EcmoFoundationTeachingPanel
          sectionId={sectionId}
          state={settledReference('vv-reference')}
        />,
      )
      const walk = container.querySelector('[data-circuit-walk]')
      const sources = walk?.querySelector('[data-walk-sources]')
      expect(sources).not.toBeNull()
      const [firstStop] = ecmoCircuitWalkStopsForSection(sectionId)
      expect(renderedIds(sources ?? null)).toEqual([...firstStop.sourceIds])
      for (const id of firstStop.sourceIds) {
        const row = sources?.querySelector(`[data-evidence-id="${id}"]`)
        expect(row?.textContent).toContain(evidenceById.get(id)?.title)
        expect(row?.querySelectorAll('[data-citation-supports]')).toHaveLength(1)
      }
      expect(walk?.textContent).not.toMatch(/Sources:/)
      expectNoRawIds(learnerText(container))
    },
  )

  it('cites the foundation narrative sources by title', () => {
    const { container } = render(
      <EcmoFoundationLessonActivity sectionId="circuit-flow-path" supportMode="vv" />,
    )
    const sources = container.querySelector('[data-lesson-sources]')
    expect(sources).not.toBeNull()
    const section = ecmoFoundationSectionById.get('circuit-flow-path')
    expect(renderedIds(sources)).toEqual([...new Set(section?.sourceIds)])
    for (const id of section?.sourceIds ?? []) {
      expect(sources?.querySelector(`[data-evidence-id="${id}"]`)?.textContent).toContain(
        evidenceById.get(id)?.title,
      )
    }
    expectNoRawIds(learnerText(container))
  })

  it.each(['full', 'concise'] as const)(
    'cites the VA configuration card (%s) sources by title',
    (detail) => {
      const { container } = render(<VaConfigurationStrategyCard detail={detail} />)
      const sources = container.querySelector('[data-configuration-card-sources]')
      expect(renderedIds(sources)).toEqual([
        'elso-dual-circulation-2024',
        'elso-maastricht-nomenclature-2019',
        'elso-adult-va-2021',
      ])
      for (const id of renderedIds(sources)) {
        expect(sources?.querySelector(`[data-evidence-id="${id}"]`)?.textContent).toContain(
          evidenceById.get(id)?.title,
        )
      }
      expectNoRawIds(container.textContent ?? '')
    },
  )

  it('cites each localization-row source beside the claim that row takes from it', () => {
    const row = ecmoLocalizationRow('membrane-resistance')
    const { container } = render(
      <EcmoLocalizationCard mode="revealed-row" rowId={row.id} supportMode="vv" />,
    )
    const sources = container.querySelector('[data-localization-sources]')
    expect(renderedIds(sources)).toEqual(row.sourceSupport.map((support) => support.evidenceId))
    for (const support of row.sourceSupport) {
      const entry = sources?.querySelector(`[data-evidence-id="${support.evidenceId}"]`)
      expect(entry?.textContent).toContain(evidenceById.get(support.evidenceId)?.title)
      const claims = entry?.querySelectorAll('[data-citation-supports]') ?? []
      expect(claims).toHaveLength(1)
      expect(claims[0]?.textContent).toContain(support.claim)
      expect(entry?.querySelector('[data-citation-limit]')?.textContent).toContain(
        evidenceById.get(support.evidenceId)?.limitations,
      )
    }
    expectNoRawIds(container.textContent ?? '')
  })
})
