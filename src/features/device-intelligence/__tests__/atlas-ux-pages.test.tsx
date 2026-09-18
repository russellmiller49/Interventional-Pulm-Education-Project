import { render, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

// `@/i18n/navigation` re-exports next-intl's ESM-only navigation bundle, which jest cannot
// parse; the atlas index reaches it through the shared CatalogPagination component.
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
jest.mock('next/navigation', () => ({
  usePathname: () => '/en/devices',
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

import DevicesIndexPage from '@/app/[locale]/devices/page'
import DeviceDetailPage from '@/app/[locale]/devices/[productId]/page'
import DeviceComparisonPage from '@/app/[locale]/devices/compare/page'
import ProceduresIndexPage from '@/app/[locale]/procedures/page'
import ProcedureWorkspacePage from '@/app/[locale]/procedures/[procedureCode]/page'
import { getAtlasProductDetail } from '@/features/device-intelligence/server/atlas.server'

/**
 * The redesigned Device Atlas surfaces, rendered as the async server components they are
 * (jest.setup.ts supplies the next-intl mock over the real `en` bundle, so asserted labels are
 * production copy). The mock does not format ICU plurals, so counts are asserted from the DOM,
 * never from plural headings.
 */

jest.setTimeout(120_000)

const renderPage = async (element: Promise<React.ReactElement>) => render(await element)
const index = (searchParams: Record<string, string> = {}) =>
  renderPage(
    DevicesIndexPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve(searchParams),
    }),
  )
const detail = (productId: string, from?: string) =>
  renderPage(
    DeviceDetailPage({
      params: Promise.resolve({ locale: 'en', productId }),
      searchParams: Promise.resolve(from === undefined ? {} : { from }),
    }),
  )

const VIZISHOT_2_22G = 'PRD-1BCD8D38BC' // active FDA safety action; NA-U401SX-4022-A
const RADIAL_PROBE = 'PRD-2E043ED827' // no exact action found; one same-line sibling
const EXACT_CATALOG_NUMBER = 'NA-U401SX-4022-A'

describe('Devices index — browse, filter and result hierarchy', () => {
  it('shows device types without opening a filter panel, driven by the taxonomy', async () => {
    const { container, getByRole } = await index()
    getByRole('heading', { level: 2, name: 'Browse by device type' })
    const needle = container.querySelector<HTMLAnchorElement>('a[data-device-class="needle"]')!
    expect(needle.getAttribute('href')).toBe('/en/devices?deviceClass=needle')
    expect(needle.textContent).toContain('Needle')
    // Every populated class is reachable: featured tiles plus the "all device types" list.
    const classOptions = container.querySelectorAll(
      '#atlas-device-class option[value]:not([value=""])',
    )
    expect(container.querySelectorAll('a[data-device-class]')).toHaveLength(classOptions.length)
    // Task navigation is retained.
    const nav = within(getByRole('navigation', { name: 'Device Intelligence' }))
    expect(nav.getByRole('link', { name: 'Find a device' })).toHaveAttribute('aria-current', 'page')
    nav.getByRole('link', { name: 'Prepare a procedure' })
    nav.getByRole('link', { name: 'Saved devices & compare' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('exposes subtypes once a class is chosen and keeps them in the normal URL state', async () => {
    const { container, getByRole } = await index({ deviceClass: 'needle', q: 'olympus' })
    getByRole('heading', { level: 3, name: 'Needle: subtypes' })
    const subtype = container.querySelector<HTMLAnchorElement>(
      'a[data-device-subtype="ebus_tbna_needle"]',
    )!
    expect(subtype.getAttribute('href')).toBe(
      '/en/devices?q=olympus&deviceClass=needle&deviceSubtype=ebus_tbna_needle',
    )
    expect(
      container.querySelector('a[data-device-subtype="all"]')!.getAttribute('aria-current'),
    ).toBe('true')
    // The always-visible controls carry the same state as stable codes.
    expect(container.querySelector<HTMLSelectElement>('#atlas-device-class')!.value).toBe('needle')
    const subtypeSelect = container.querySelector<HTMLSelectElement>('#atlas-device-subtype')!
    expect(subtypeSelect.disabled).toBe(false)
    expect([...subtypeSelect.options].map((option) => option.value)).toContain('ebus_fnb_needle')
    expect(container.querySelector('#atlas-manufacturer')).not.toBeNull()
    expect(container.querySelector<HTMLInputElement>('#atlas-q')!.placeholder).toBe(
      'Search device, brand, manufacturer, model, or catalog number',
    )
  })

  it('reports an unknown subtype honestly and renders no misleading empty list', async () => {
    const { container, getByText } = await index({ deviceSubtype: 'retired_subtype_code' })
    getByText(/The "device subtype" filter value is not recognized/)
    expect(container.querySelector('[data-family-key]')).toBeNull()
    expect(container.querySelector('tbody tr')).toBeNull()
  })

  it('lists active filters as chips whose removal preserves the others', async () => {
    const { container } = await index({
      deviceClass: 'needle',
      deviceSubtype: 'ebus_tbna_needle',
      manufacturer: 'MFR-954E57FBB9',
      gauge: '21',
    })
    const chips = [...container.querySelectorAll<HTMLAnchorElement>('[data-filter-chip]')]
    expect(chips.map((chip) => chip.getAttribute('data-filter-chip'))).toEqual([
      'deviceClass',
      'deviceSubtype',
      'manufacturer:MFR-954E57FBB9',
      'gauge',
    ])
    const gauge = chips.find((chip) => chip.getAttribute('data-filter-chip') === 'gauge')!
    expect(gauge.textContent).toContain('Recorded gauge: 21G')
    expect(gauge.getAttribute('aria-label')).toBe('Remove filter: Recorded gauge: 21G')
    expect(gauge.getAttribute('href')).toBe(
      '/en/devices?manufacturer=MFR-954E57FBB9&deviceClass=needle&deviceSubtype=ebus_tbna_needle',
    )
    const manufacturer = chips.find((chip) =>
      chip.getAttribute('data-filter-chip')!.startsWith('manufacturer:'),
    )!
    expect(manufacturer.textContent).toContain('Olympus')
    expect(manufacturer.getAttribute('href')).toBe(
      '/en/devices?deviceClass=needle&deviceSubtype=ebus_tbna_needle&gauge=21',
    )
    // "More filters" opens itself when one of its filters is active — never hidden state.
    expect(container.querySelector<HTMLDetailsElement>('form details')!.open).toBe(true)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('groups discovery results into product lines built from matching models only', async () => {
    const { container } = await index({ deviceClass: 'needle', deviceSubtype: 'ebus_tbna_needle' })
    const families = [...container.querySelectorAll<HTMLElement>('[data-family-key]')]
    expect(families.length).toBeGreaterThan(2)
    const viziShot2 = families.find((family) => within(family).queryByText('ViziShot 2'))!
    expect(viziShot2).toBeDefined()
    // The line's own facts: manufacturer, subtype, recorded spec summary, model rows.
    within(viziShot2).getByText('Olympus')
    expect(within(viziShot2).getAllByText('Gauge').length).toBeGreaterThan(0)
    const rows = viziShot2.querySelectorAll('tbody tr')
    expect(rows.length).toBeGreaterThan(1)
    // Model-level safety: the notice counts affected models, and only those rows are badged.
    const notice = viziShot2.querySelector('[data-family-safety-notice]')!
    const badged = [...rows].filter((row) => row.querySelector('[data-safety-display]'))
    expect(badged.length).toBeGreaterThan(0)
    expect(badged.length).toBeLessThan(rows.length)
    expect(notice.textContent).toContain(`${badged.length}`)
    expect(notice.textContent).toMatch(/applies to the marked models only/)
    // Save/Compare act on exact models; every model row links back to this search.
    for (const row of rows) {
      expect(within(row as HTMLElement).getByRole('button', { name: /^Compare:/ })).toBeDefined()
      expect(row.querySelector('a')!.getAttribute('href')).toMatch(
        /^\/en\/devices\/PRD-[0-9A-F]+\?from=deviceClass%3Dneedle%26deviceSubtype%3Debus_tbna_needle$/,
      )
    }
    expect(await axe(container)).toHaveNoViolations()
  })

  it('pins an exact identifier match above the families, visibly marked and unexpanded', async () => {
    const { container, getByRole } = await index({ q: EXACT_CATALOG_NUMBER })
    const section = container.querySelector<HTMLElement>('[data-exact-match-section]')!
    expect(section).not.toBeNull()
    // It precedes every family card and sits outside any collapsed <details>.
    const firstFamily = container.querySelector('[data-family-key]')!
    expect(
      section.compareDocumentPosition(firstFamily) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(section.closest('details')).toBeNull()
    const row = section.querySelector<HTMLElement>('tbody tr')!
    expect(row.getAttribute('data-product-id')).toBe(VIZISHOT_2_22G)
    expect(row.querySelector('[data-exact-identifier-match]')!.textContent).toBe(
      'Exact identifier match',
    )
    within(row).getByText(EXACT_CATALOG_NUMBER)
    getByRole('region', { name: 'Exact identifier matches' })
  })

  it('keeps the individual-model view available and the view in the URL', async () => {
    const { container, getByRole } = await index({ deviceClass: 'needle', view: 'models' })
    expect(container.querySelector('[data-family-key]')).toBeNull()
    expect(container.querySelectorAll('tbody tr').length).toBe(25)
    const tabs = within(getByRole('navigation', { name: 'Result view' }))
    expect(tabs.getByRole('link', { name: 'Individual models' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(tabs.getByRole('link', { name: 'Product lines' })).toHaveAttribute(
      'href',
      '/en/devices?deviceClass=needle',
    )
    // Sort re-submits the whole search; pagination carries the view.
    const sortForm = container.querySelector<HTMLSelectElement>('#atlas-sort')!.form!
    expect(sortForm.querySelector<HTMLInputElement>('input[name="view"]')!.value).toBe('models')
    expect(sortForm.querySelector<HTMLInputElement>('input[name="deviceClass"]')!.value).toBe(
      'needle',
    )
    expect(getByRole('link', { name: /Next/ }).getAttribute('href')).toBe(
      '/devices?deviceClass=needle&view=models&page=2',
    )
  })

  it('separates unrecorded values from non-matches and lets them be inspected', async () => {
    const matched = await index({ deviceClass: 'needle', gauge: '21', view: 'models' })
    const notice = matched.container.querySelector<HTMLElement>('[data-missing-spec-notice]')!
    expect(notice.textContent).toMatch(/could not be evaluated because this value is not recorded/)
    expect(notice.textContent).toContain('Gauge')
    expect(notice.textContent).toMatch(/does not establish that devices are compatible/)
    const link = notice.querySelector<HTMLAnchorElement>('[data-show-unknown-spec]')!
    expect(link.getAttribute('href')).toBe(
      '/en/devices?deviceClass=needle&gauge=21&specUnknown=only&view=models',
    )
    const matchedIds = [...matched.container.querySelectorAll('tbody tr')].map((row) =>
      row.getAttribute('data-product-id'),
    )
    matched.unmount()

    const unknown = await index({
      deviceClass: 'needle',
      gauge: '21',
      specUnknown: 'only',
      view: 'models',
    })
    const unknownIds = [...unknown.container.querySelectorAll('tbody tr')].map((row) =>
      row.getAttribute('data-product-id'),
    )
    expect(unknownIds.length).toBeGreaterThan(0)
    expect(unknownIds.some((id) => matchedIds.includes(id))).toBe(false)
    expect(unknown.container.querySelector('[data-missing-spec-notice]')!.textContent).toMatch(
      /They were not evaluated against your filter/,
    )
  })

  it('words procedure filtering as discovery, not as listed equipment', async () => {
    const { getByText } = await index({ procedure: 'EBUS_TBNA' })
    getByText(/^Devices related to this procedure/)
    getByText(/To see the devices actually listed for an equipment requirement/)
  })
})

describe('Device detail — rapid reference first, evidence intact', () => {
  it('returns to the exact search it was opened from', async () => {
    const context =
      'q=ebus&manufacturer=MFR-954E57FBB9&deviceClass=needle&view=models&sort=name&page=2'
    // The context is re-serialized canonically, so the round trip is exact for a canonical URL.
    const { container } = await detail(VIZISHOT_2_22G, context)
    const back = container.querySelector<HTMLAnchorElement>('[data-back-to-results]')!
    expect(back.textContent).toContain('Back to results')
    expect(back.getAttribute('href')).toBe(`/en/devices?${context}`)
    // Moving to another model in the line keeps the same way back.
    const sibling = container.querySelector<HTMLAnchorElement>('#device-other-models tbody a')!
    expect(sibling.getAttribute('href')).toContain(`?from=${encodeURIComponent(context)}`)
  })

  it('falls back to the plain index for a missing or hostile context', async () => {
    for (const from of [undefined, 'https://evil.example/', '//evil.example', 'page=-1']) {
      const view = await detail(RADIAL_PROBE, from)
      const back = view.container.querySelector<HTMLAnchorElement>('[data-back-to-results]')!
      expect(back.getAttribute('href')).toBe('/en/devices')
      expect(back.textContent).toContain('Back to Device Atlas')
      view.unmount()
    }
  })

  it('answers what, who, which exact model and the key specifications before the evidence', async () => {
    const { container } = await detail(RADIAL_PROBE)
    const header = container.querySelector<HTMLElement>('header')!
    within(header).getByText('Olympus')
    expect(header.querySelector('h1')!.textContent).toBe('Radial Ultrasound Miniature Probe')
    within(header).getByText('UM-S20-20R')
    within(header).getByText(/^Device subtype: /)
    const keySpecs = header.querySelector<HTMLElement>('[data-key-specs]')!
    within(keySpecs).getByText('Working length')
    within(keySpecs).getByText('205 cm')
    within(header).getByRole('button', { name: /^Save device:/ })
    within(header).getByRole('button', { name: /^Compare:/ })
    // Routine evidence follows the specifications; nothing was removed.
    const order = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
    const position = (name: string) => order.indexOf(name)
    expect(position('Dimensions and configuration')).toBeGreaterThan(-1)
    expect(position('Dimensions and configuration')).toBeLessThan(
      position('Market and safety status'),
    )
    expect(position('Market and safety status')).toBeLessThan(position('Sources'))
    const nav = within(container.querySelector<HTMLElement>('nav[aria-label="On this page"]')!)
    for (const name of [
      'Overview',
      'Specifications',
      'Configuration & use',
      'Safety & status',
      'Sources',
    ]) {
      const target = nav.getByRole('link', { name }).getAttribute('href')!
      expect(container.querySelector(target)).not.toBeNull()
    }
    expect(await axe(container)).toHaveNoViolations()
  })

  it('lifts a recorded safety issue above everything routine, never collapsed', async () => {
    const { container } = await detail(VIZISHOT_2_22G)
    const panel = container.querySelector<HTMLElement>('#device-safety')!
    within(panel).getByText('Active FDA safety action')
    // Not inside any disclosure, and ahead of the in-page navigation and the spec cards.
    expect(panel.closest('details')).toBeNull()
    const nav = container.querySelector('nav[aria-label="On this page"]')!
    expect(panel.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The header marks it and points at it.
    const header = within(container.querySelector<HTMLElement>('header')!)
    expect(header.getByRole('link', { name: 'Review safety notices' })).toHaveAttribute(
      'href',
      '#device-safety',
    )
    expect(container.querySelectorAll('#device-safety')).toHaveLength(1)
  })

  it('keeps sources, provenance and rule details available', async () => {
    const { container, getByRole } = await detail(RADIAL_PROBE)
    const sources = getByRole('region', { name: 'Sources' })
    expect(sources.querySelectorAll('li').length).toBeGreaterThan(0)
    getByRole('region', { name: 'Source catalog classification' })
    // Recorded requirement leads in plain words; identifiers stay one disclosure away.
    const configuration = container.querySelector<HTMLElement>('#device-configuration')!
    within(configuration).getByText('Recorded minimum working channel: 2 mm.')
    within(configuration).getByText(/A recorded catalog value; confirm against current/)
    expect(configuration.textContent).not.toMatch(/\bcompatible with your\b|\bwill fit\b/i)
  })

  it('never restates a bronchoscope’s own channel as a tool minimum-channel requirement', async () => {
    const scope = 'PRD-CB1622624D' // BF-MP190F
    expect(getAtlasProductDetail(scope)!.taxonomy.deviceClassCode).toBe('bronchoscope')
    const { container } = await detail(scope)
    expect(container.querySelector('[data-recorded-min-channel]')).toBeNull()
    const keySpecs = container.querySelector('[data-key-specs]')
    expect(keySpecs?.textContent ?? '').not.toContain('Min. working channel')
  })

  it('lists only validated same-line, same-subtype models — each with its own status', async () => {
    const { container, getByText } = await detail(VIZISHOT_2_22G)
    const section = container.querySelector<HTMLElement>('#device-other-models')!
    within(section).getByRole('heading', { name: 'Same manufacturer product line' })
    getByText(/is not a clinical equivalence group/)
    const expected = getAtlasProductDetail(VIZISHOT_2_22G)!.sameManufacturerLine
    const rows = [...section.querySelectorAll('tbody tr')]
    expect(rows.map((row) => row.getAttribute('data-product-id'))).toEqual(
      expected.map((sibling) => sibling.productId),
    )
    for (const [position, row] of rows.entries()) {
      const badge = row.querySelector('[data-market-status]')!
      expect(badge.getAttribute('data-market-status')).toBe(expected[position].status.marketStatus)
      expect(Boolean(row.querySelector('[data-safety-display="active_safety_notice"]'))).toBe(
        expected[position].status.safetyDisplay === 'active_safety_notice',
      )
    }
    // The line mixes affected and unaffected models; the page shows that, model by model.
    const active = expected.filter(
      (sibling) => sibling.status.safetyDisplay === 'active_safety_notice',
    )
    expect(active.length).toBeGreaterThan(0)
    expect(active.length).toBeLessThan(expected.length)
  })
})

describe('Device comparison — technical differences first, safety never hidden', () => {
  const compare = (searchParams: Record<string, string>) =>
    renderPage(
      DeviceComparisonPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve(searchParams),
      }),
    )
  const ids = 'PRD-2302DA77DA,PRD-5CBD1FD1E3' // two Expect Pulmonary EBUS-TBNA needles
  const rowKeys = (container: HTMLElement) =>
    [...container.querySelectorAll('tbody tr')].map(
      (row) => row.getAttribute('data-comparison-field') ?? row.getAttribute('data-comparison-row'),
    )

  it('leads with the category-specific specifications and keeps evidence below them', async () => {
    const { container } = await compare({ ids })
    const keys = rowKeys(container)
    expect(keys[0]).toBe('type')
    expect(keys.indexOf('gauge')).toBeLessThan(keys.indexOf('safety'))
    expect(keys.indexOf('safety')).toBeLessThan(keys.indexOf('summary'))
    expect(keys.indexOf('configuration')).toBeLessThan(keys.indexOf('reuse'))
    expect(container.querySelectorAll('[data-missing-value]').length).toBeGreaterThan(0)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('differences-only folds agreeing spec rows but never safety, status or sources', async () => {
    const all = await compare({ ids })
    const allKeys = rowKeys(all.container)
    const citationCount = all.container.querySelectorAll('[id^="comparison-source-"]').length
    all.unmount()

    const { container, getByRole } = await compare({ ids, diff: '1' })
    const keys = rowKeys(container)
    expect(keys.length).toBeLessThan(allKeys.length)
    for (const always of ['type', 'safety', 'summary', 'configuration'])
      expect(keys).toContain(always)
    expect(keys).toContain('gauge') // 22G vs 25G
    expect(keys).not.toContain('reuse') // identical
    const safetyRow = container.querySelector<HTMLElement>('[data-comparison-row="safety"]')!
    expect(safetyRow.querySelectorAll('[data-market-status]')).toHaveLength(2)
    expect(container.querySelector('[data-differences-note]')!.textContent).toMatch(
      /Device type, safety and market status are always shown/,
    )
    // Citations and the boundary statement are untouched by the toggle.
    expect(container.querySelectorAll('[id^="comparison-source-"]')).toHaveLength(citationCount)
    expect(container.textContent).toMatch(/do not establish interchangeability, compatibility/)
    expect(
      within(getByRole('navigation', { name: 'Comparison rows' })).getByRole('link', {
        name: 'All fields',
      }),
    ).toHaveAttribute('href', `/en/devices/compare?ids=${encodeURIComponent(ids)}`)
    // No winner, ranking or score anywhere on the page.
    expect(container.textContent).not.toMatch(/\b(winner|best|recommended choice|score|rank)/i)
  })

  it('offers a field-by-field layout with every value tagged by device, and per-device removal', async () => {
    const { container, getAllByRole } = await compare({ ids })
    const gaugeRow = container.querySelector<HTMLElement>('[data-comparison-field="gauge"]')!
    // Mobile tags are visual duplicates of the column headers, hidden from assistive tech.
    const tags = gaugeRow.querySelectorAll('td > span[aria-hidden="true"]')
    expect(tags).toHaveLength(2)
    expect(tags[0].textContent).toContain('M00558220')
    const remove = getAllByRole('link', { name: /^Remove from comparison: / })
    expect(remove.length).toBeGreaterThanOrEqual(2)
    expect(remove[0].getAttribute('href')).toBe('/en/devices/compare?ids=PRD-5CBD1FD1E3')
  })
})

describe('Procedure discovery', () => {
  it('leads with the procedure, its equipment groups and its draft status', async () => {
    const { container, getAllByRole } = await renderPage(
      ProceduresIndexPage({ params: Promise.resolve({ locale: 'en' }) }),
    )
    const cards = [...container.querySelectorAll<HTMLElement>('.grid > *')].filter((card) =>
      card.querySelector('h2'),
    )
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      const details = card.querySelector<HTMLDetailsElement>('details')!
      // Implementation bookkeeping is kept, but only inside "Template details".
      expect(details.open).toBe(false)
      within(details).getByText('Template details')
      for (const label of [
        'Procedure code',
        'Template version',
        'Release bundle',
        'Requirement slots',
      ]) {
        within(details).getByText(label)
        const outside = [...card.querySelectorAll('dt')].filter((node) => !details.contains(node))
        expect(outside.map((node) => node.textContent)).not.toContain(label)
      }
      within(card).getByText('Equipment groups')
      expect(card.querySelector('[data-state], .font-mono:not(details *)')).toBeNull()
      expect(within(card).getByRole('link', { name: 'Prepare this procedure' })).toHaveAttribute(
        'href',
        expect.stringMatching(/^\/en\/procedures\/[A-Z_]+\?view=sections$/),
      )
    }
    expect(getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toContain(
      'EBUS-TBNA / EBUS-FNB',
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('groups authored equipment by its own section without inferring requiredness', async () => {
    const { getByRole } = await renderPage(
      ProcedureWorkspacePage({
        params: Promise.resolve({ locale: 'en', procedureCode: 'EBUS_TBNA' }),
        searchParams: Promise.resolve({ view: 'sections' }),
      }),
    )
    const tabs = within(getByRole('navigation', { name: 'Requirement view' }))
    expect(tabs.getByRole('link', { name: 'By equipment group' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const browser = getByRole('region', { name: 'Requirement browser' })
    const groups = [...browser.querySelectorAll('h3')].map((heading) => heading.textContent)
    expect(groups).toEqual(expect.arrayContaining(['Sampling', 'Platform', 'Imaging']))
    // Listed devices and role discovery are worded apart on every requirement card.
    const related = browser.querySelectorAll<HTMLAnchorElement>('[data-related-devices-link]')
    expect(related.length).toBeGreaterThan(5)
    expect(related[0].getAttribute('href')).toMatch(/^\/en\/devices\?role=/)
    expect(related[0].textContent).toMatch(/discovery only — not listed for this requirement/)
    within(browser).getAllByText('Devices listed for this equipment requirement')
  })
})
