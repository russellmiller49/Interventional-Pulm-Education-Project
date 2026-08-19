import { render, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

// `@/i18n/navigation` re-exports next-intl's ESM-only navigation bundle, which jest cannot
// parse; the atlas index reaches it through the shared CatalogPagination component. The mock
// is the same plain-anchor shape the other feature suites use.
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
}))

import DevicesIndexPage from '@/app/[locale]/devices/page'
import DeviceDetailPage from '@/app/[locale]/devices/[productId]/page'

/**
 * The D2B Device Atlas surfaces. The pages are async server components; in jsdom they are
 * awaited and rendered as plain elements (jest.setup.ts supplies the next-intl mock over the
 * real `en` bundle, so every label asserted here is production copy).
 *
 * What is pinned: the compact index treatment (one market badge per row, a safety badge only
 * when a safety action was matched, no per-row warning block), the product-page "Market and
 * safety status" panel with its required statements, and the representative products for
 * every market status the committed overlay actually produces.
 */

jest.setTimeout(120_000)

async function renderPage(element: Promise<React.ReactElement>) {
  return render(await element)
}

const detailFor = (productId: string) =>
  renderPage(DeviceDetailPage({ params: Promise.resolve({ locale: 'en', productId }) }))

/** One representative per market status the 2026-08-13 snapshot produced. */
const CONFIRMED_CURRENT = 'PRD-2E043ED827' // Olympus radial probe, no exact action found
const LIKELY_CURRENT = 'PRD-0FECB0AD06' // Karl Storz suction tube
const CONFLICTED = 'PRD-027269F110' // Richard Wolf TipControl scissors
const UNVERIFIED = 'PRD-00C13A59AA' // Richard Wolf TEXAS tracheoscope tube
const ACTIVE_SAFETY = 'PRD-05670F1B5F' // ERBE Flexible Cryoprobe 2.4 mm
const HISTORICAL_SAFETY = 'PRD-1517AA42DA' // Teleflex Arrow-Clarke kit (terminated action)
const NOT_RESEARCHED = 'PRD-88E003F12B' // BF-1T180: prototype-visible, outside the snapshot

describe('D2B Device Atlas index', () => {
  it('states the inclusion-first cohort rule and what the status labels mean', async () => {
    const { getByRole, getByText, container } = await renderPage(
      DevicesIndexPage({ params: Promise.resolve({ locale: 'en' }) }),
    )
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('Device Atlas')
    getByText(/Cohort rule: verification_grade = verified_source/)
    getByText(/Current availability is not a condition of inclusion/)
    getByText(/Candidate-grade and unknown-grade catalog products are not shown here/)
    getByText(/do not establish present orderability/)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('gives every row one market badge and no per-row warning block', async () => {
    const { container } = await renderPage(
      DevicesIndexPage({ params: Promise.resolve({ locale: 'en' }) }),
    )
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.querySelectorAll('[data-market-status]')).toHaveLength(1)
      // At most one safety badge, and only for a matched action.
      const safety = row.querySelectorAll('[data-safety-display]')
      expect(safety.length).toBeLessThanOrEqual(1)
      for (const badge of safety) {
        expect([
          'active_safety_notice',
          'historical_safety_notice',
          'safety_identity_review_required',
        ]).toContain(badge.getAttribute('data-safety-display'))
      }
      // Compact treatment: the row carries badges, never a card-sized notice.
      expect(row.querySelector('[data-status-gate]')).toBeNull()
    }
  })

  it('surfaces a newly included hidden verified-source product in the results', async () => {
    const { container } = await renderPage(
      DevicesIndexPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ q: 'Flexible Cryoprobe 2.4 mm' }),
      }),
    )
    const link = container.querySelector(`a[href="/en/devices/${ACTIVE_SAFETY}"]`)
    expect(link).not.toBeNull()
    const row = link!.closest('tr')!
    expect(row.querySelector('[data-market-status]')!.getAttribute('data-market-status')).toBe(
      'confirmed_current_us',
    )
    expect(row.querySelector('[data-safety-display]')!.getAttribute('data-safety-display')).toBe(
      'active_safety_notice',
    )
  })
})

describe('D2B product page — market and safety panel', () => {
  it.each([
    ['a confirmed-current product', CONFIRMED_CURRENT, 'confirmed_current_us', 'clear'],
    ['a likely-current product', LIKELY_CURRENT, 'likely_current_us', 'clear'],
    ['a conflicted product', CONFLICTED, 'current_status_conflicted', 'review_required'],
    ['an unverified product', UNVERIFIED, 'current_status_unverified', 'clear'],
    [
      'an active-safety product',
      ACTIVE_SAFETY,
      'confirmed_current_us',
      'blocked_active_safety_action',
    ],
    ['a historical-safety product', HISTORICAL_SAFETY, 'current_status_unverified', 'clear'],
    ['an unresearched product', NOT_RESEARCHED, 'current_status_unverified', 'review_required'],
  ])(
    'renders %s with its controlled labels and required statements',
    async (_label, productId, marketStatus, gate) => {
      const { container, getByRole, getByText } = await detailFor(productId)
      getByRole('heading', { level: 2, name: 'Market and safety status' })
      expect(
        container.querySelector('[data-market-status]')!.getAttribute('data-market-status'),
      ).toBe(marketStatus)
      expect(container.querySelector('[data-status-gate]')!.getAttribute('data-status-gate')).toBe(
        gate,
      )
      // The two mandatory statements are on every product page.
      getByText(/does not establish present orderability/)
      getByText(/Safety notices may be lot-specific/)
      // No research rationale or raw source text ever reaches the page.
      expect(container.textContent).not.toMatch(
        /Identity method:|UDI assessment:|Manufacturer finding:/,
      )
      expect(container.textContent).not.toMatch(/https?:\/\//)
    },
  )

  it('gives an active safety action a prominent, non-alarmist notice with its recall number', async () => {
    const { container, getByText } = await detailFor(ACTIVE_SAFETY)
    // Prominent: its own bordered notice card, not a page-wide banner or an interstitial.
    const notice = container.querySelector<HTMLElement>('.border-rose-600\\/50')
    expect(notice).not.toBeNull()
    const inNotice = within(notice!)
    inNotice.getByText('Active FDA safety action')
    inNotice.getByText(/recorded as active at the research snapshot/)
    inNotice.getByText('Reported scope: specific lots.')
    inNotice.getByText(/^Z-1568-2026$/)
    // The product itself is still fully described alongside it.
    expect(container.querySelector('h1')!.textContent).toBe('Flexible Cryoprobe 2.4 mm')
    getByText(/must not be presented as a default or a recommended option/)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows a historical action as history and does not block it', async () => {
    const { container, getByText, queryByText } = await detailFor(HISTORICAL_SAFETY)
    getByText(/recorded as no longer active at the research snapshot/)
    getByText(/shown as history, not as a current action/)
    expect(queryByText('Active FDA safety action')).toBeNull()
    expect(container.querySelector('[data-status-gate]')!.getAttribute('data-status-gate')).toBe(
      'clear',
    )
  })

  it('says plainly when a product was never covered by the research snapshot', async () => {
    const { container, getByText } = await detailFor(NOT_RESEARCHED)
    getByText(/was not covered by the U.S. status research snapshot/)
    // Never rendered as safe or recall-free.
    getByText(/not a finding that no action exists/)
    expect(container.textContent).not.toMatch(/recall-free/)
  })

  it('shows the research snapshot date and confidence only where it means something', async () => {
    // Scoped with `within` because both pages stay mounted for the duration of this test.
    const confirmed = within((await detailFor(CONFIRMED_CURRENT)).container)
    confirmed.getByText('2026-08-13')
    confirmed.getByText(/Research confidence:/)
    // An unverified market status carries no confidence line — a "low confidence" caption on
    // "not recently verified" would be noise, not information.
    const unverified = within((await detailFor(UNVERIFIED)).container)
    expect(unverified.queryByText(/Research confidence:/)).toBeNull()
    unverified.getByText('2026-08-13')
  })

  it('renders the D2C normalized device type in the results table, never source categories or codes', async () => {
    const { container, getAllByText } = await renderPage(
      DevicesIndexPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ q: 'MAXXwire' }),
      }),
    )
    // Both MAXXwire lengths show the normalized subtype label in the Device type column.
    expect(getAllByText('Pulmonary guidewire').length).toBeGreaterThanOrEqual(2)
    // The retired mixed-axis source category never renders on the index.
    expect(container.textContent).not.toContain('Airway stenting')
    // Internal codes never render.
    expect(container.textContent).not.toContain('pulmonary_guidewire')
    expect(container.textContent).not.toContain('guidewire (')
  })

  it('offers the Device class facet with localized labels and cohort counts', async () => {
    const { container } = await renderPage(
      DevicesIndexPage({ params: Promise.resolve({ locale: 'en' }) }),
    )
    const select = container.querySelector<HTMLSelectElement>('#atlas-device-class')!
    expect(select).not.toBeNull()
    expect(select.getAttribute('name')).toBe('deviceClass')
    const options = [...select.querySelectorAll('option')]
    // "Any" plus the populated classes; the legacy Category select is gone.
    expect(options.length).toBeGreaterThanOrEqual(20)
    expect(container.querySelector('select[name="category"]')).toBeNull()
    const guidewireOption = options.find((option) => option.getAttribute('value') === 'guidewire')!
    expect(guidewireOption.textContent).toBe('Guidewire (4)')
    const bronchoscopeOption = options.find(
      (option) => option.getAttribute('value') === 'bronchoscope',
    )!
    expect(bronchoscopeOption.textContent).toMatch(/^Bronchoscope \(\d+\)$/)
  })

  it('reports a stale legacy category filter honestly instead of applying it', async () => {
    const { container, getByText } = await renderPage(
      DevicesIndexPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ category: 'Airway stenting' }),
      }),
    )
    getByText(/The Category filter has been replaced by the normalized Device class filter/)
    // Not applied: the unfiltered first page renders (canonical "Airway stenting" holds
    // only 3 products, so a full default page proves the filter was ignored).
    expect(container.querySelectorAll('tbody tr').length).toBe(25)
  })

  it('shows normalized class and subtype on the product page, with source fields only as labeled provenance', async () => {
    const AEROSIZER = 'PRD-513E7E5BCD'
    const { container, getByText, getByRole } = await detailFor(AEROSIZER)
    getByText(/Device class: Sizing or measuring device/)
    getByText(/Device subtype: Airway sizing device/)
    // Source category appears ONLY inside the explicitly labeled provenance area.
    const provenance = getByRole('region', { name: 'Source catalog classification' })
    expect(within(provenance).getByText('Airway stenting')).toBeInTheDocument()
    const headerText = container.querySelector('header')!.textContent!
    expect(headerText).not.toContain('Airway stenting')
    // The taxonomy caption denies equivalence/substitution readings.
    getByText(/never clinical-equivalence, substitution, compatibility/)
    // Internal codes never render.
    expect(container.textContent).not.toContain('sizing_measuring')
    expect(container.textContent).not.toContain('airway_sizing_device')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('keeps the atlas accessible at every verified viewport width', async () => {
    // Layout is CSS-driven (the results table scrolls inside its own labeled region), so the
    // structural guarantee is asserted here and the visual pass is recorded in the D2B doc.
    const { container } = await renderPage(
      DevicesIndexPage({ params: Promise.resolve({ locale: 'en' }) }),
    )
    const region = container.querySelector('[role="region"]')!
    expect(region.getAttribute('aria-label')).toBe('Results table (scrolls horizontally)')
    expect(region.getAttribute('tabindex')).toBe('0')
    expect(region.className).toContain('overflow-x-auto')
  })
})
