/**
 * Unavailable-versus-empty, at the two levels where it can regress.
 *
 * The administration page is a server component behind site-admin authentication, so rendering it
 * whole in jest would mostly exercise mocks. What actually broke — and what an operator sees — is
 * narrower than the page:
 *
 *   1. the decision "render a number or render unavailable", which now lives in one shared helper;
 *   2. the call sites, which regress by someone writing `?? 0` next to a stats value again.
 *
 * The first is a unit test. The second is a source assertion, in the same style as the existing
 * dedicated-Supabase authority lockdown: the defect is textual, so the guard is textual.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'

import { LiteratureCapabilityNotice } from '@/features/literature/components/LiteratureCapabilityNotice'
import {
  LITERATURE_CAPABILITY_STATES,
  capabilityFromArticleCount,
  capabilityFromFailure,
  literatureCountDisplay,
  type LiteratureCapabilityState,
} from '@/features/literature/server/runtime-capability'

const ADMIN_PAGE = 'src/app/[locale]/admin/literature/page.tsx'
const UNAVAILABLE = 'Unavailable'

describe('the shared count display', () => {
  it('renders a measured zero as zero', () => {
    expect(literatureCountDisplay('foundation_ready_empty', 0, UNAVAILABLE)).toBe(0)
    // A key absent from a counts map on a healthy read really is zero.
    expect(literatureCountDisplay('foundation_ready_empty', undefined, UNAVAILABLE)).toBe(0)
  })

  it('renders a measured population as its number', () => {
    expect(literatureCountDisplay('foundation_ready_populated', 25, UNAVAILABLE)).toBe(25)
  })

  it.each(
    LITERATURE_CAPABILITY_STATES.filter(
      (state) => state !== 'foundation_ready_empty' && state !== 'foundation_ready_populated',
    ),
  )('renders %s as unavailable, even when a number is available', (state) => {
    // The second argument is deliberately a real number: a stale or partially populated value must
    // not leak through a state that did not measure it.
    expect(literatureCountDisplay(state as LiteratureCapabilityState, 0, UNAVAILABLE)).toBe(
      UNAVAILABLE,
    )
    expect(literatureCountDisplay(state as LiteratureCapabilityState, 132_350, UNAVAILABLE)).toBe(
      UNAVAILABLE,
    )
  })
})

describe('the administration page cannot reintroduce a misleading zero', () => {
  const source = readFileSync(join(process.cwd(), ADMIN_PAGE), 'utf8')
  const executable = source
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/(^|[^:])\/\/.*$/gmu, '$1')

  it('routes every stats-derived count through the shared helper', () => {
    expect(executable).toContain('literatureCountDisplay(stats.capability.state')
  })

  it('applies no nullish-zero fallback to a stats value', () => {
    // The exact shape of the original defect: `stats.data?.x ?? 0`, `relevance[state] ?? 0`,
    // `visibility[state] ?? 0`, `sourceKindCounts[k] ?? 0`.
    const offenders = [
      ...executable.matchAll(
        /(stats\.data\?[^\n]*|relevance\[[^\]]*\]|visibility\[[^\]]*\])\s*\?\?\s*0/gu,
      ),
    ].map((match) => match[0])
    expect(offenders).toEqual([])
  })

  it('renders the capability state rather than only an error string', () => {
    expect(executable).toContain('LiteratureCapabilityNotice')
    expect(executable).toContain('capabilityT(`state.${stats.capability.state}`)')
  })

  it('offers the gold-set entry point only when the operation is carried', () => {
    expect(executable).toContain("literatureOperationActivated('gold_set_read')")
    expect(executable).toMatch(/goldWorkflowAvailable \?/u)
  })
})

describe('the capability notice', () => {
  it('exposes the state for assertion and shows the resolved project', () => {
    const capability = capabilityFromArticleCount(0, 'itcttmkxdxvwmwcmzmey')
    const { container } = render(
      <LiteratureCapabilityNotice
        capability={capability}
        title="Literature database status"
        description="The foundation schema is present and holds no records yet."
        projectLabel="Dedicated project"
      />,
    )
    expect(
      container.querySelector('[data-capability-state="foundation_ready_empty"]'),
    ).not.toBeNull()
    expect(screen.getByText('itcttmkxdxvwmwcmzmey')).toBeInTheDocument()
  })

  it('renders a failure state without claiming anything about record counts', () => {
    const capability = capabilityFromFailure(
      { code: 'PGRST205' },
      { projectRef: 'itcttmkxdxvwmwcmzmey', surface: 'foundation' },
    )
    const { container } = render(
      <LiteratureCapabilityNotice
        capability={capability}
        title="Literature database status"
        description="The dedicated Literature project is reachable, but its foundation tables are absent."
        projectLabel="Dedicated project"
      />,
    )
    expect(container.querySelector('[data-capability-state="foundation_missing"]')).not.toBeNull()
    expect(container.textContent).not.toMatch(/\b0\b/u)
  })
})
