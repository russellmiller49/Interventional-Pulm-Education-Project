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
const CURATED_PAGE = 'src/app/[locale]/admin/literature/curated/page.tsx'
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

  const MEASURED_STATES: LiteratureCapabilityState[] = [
    'foundation_ready_empty',
    'foundation_ready_populated',
    // A filtered read measures its own result set: the number is real, and the state simply makes
    // no claim about the size of the corpus.
    'foundation_ready_filtered',
  ]

  it('renders a filtered count as a number, without claiming a corpus size', () => {
    expect(literatureCountDisplay('foundation_ready_filtered', 0, UNAVAILABLE)).toBe(0)
    expect(literatureCountDisplay('foundation_ready_filtered', 7, UNAVAILABLE)).toBe(7)
  })

  it.each(LITERATURE_CAPABILITY_STATES.filter((state) => !MEASURED_STATES.includes(state)))(
    'renders %s as unavailable, even when a number is available',
    (state) => {
      // The second argument is deliberately a real number: a stale or partially populated value
      // must not leak through a state that did not measure it.
      expect(literatureCountDisplay(state as LiteratureCapabilityState, 0, UNAVAILABLE)).toBe(
        UNAVAILABLE,
      )
      expect(literatureCountDisplay(state as LiteratureCapabilityState, 132_350, UNAVAILABLE)).toBe(
        UNAVAILABLE,
      )
    },
  )
})

describe('the administration page cannot reintroduce a misleading zero', () => {
  const source = readFileSync(join(process.cwd(), ADMIN_PAGE), 'utf8')
  const executable = source
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/(^|[^:])\/\/.*$/gmu, '$1')

  it('routes every stats-derived count through the shared helper', () => {
    expect(executable).toContain('literatureCountDisplay(stats.capability.state')
  })

  it('applies no nullish-zero fallback anywhere', () => {
    /*
     * A blanket ban rather than a pattern match on the four shapes the defect happened to take.
     *
     * The earlier version enumerated `stats.data?.x ?? 0`, `relevance[state] ?? 0`, and friends,
     * which is exactly the wrong shape for this guard: the same defect reintroduced through a local
     * alias — `const rel = stats.data?.relevanceCounts ?? {}` then `rel.unreviewed ?? 0` — matches
     * none of those patterns. Every legitimate count on this page goes through
     * `literatureCountDisplay`, so the honest invariant is that the page contains no `?? 0` at all.
     */
    const offenders = [...executable.matchAll(/[^\n]*\?\?\s*0[^\n]*/gu)].map((match) =>
      match[0].trim(),
    )
    expect(offenders).toEqual([])
  })

  it('renders a count only through the helper, for every count it shows', () => {
    // `?? {}` on the counts maps is fine and still present — an absent map is genuinely empty when
    // the read succeeded. What matters is that reading OUT of those maps goes through the helper.
    const reads = [...executable.matchAll(/\{(relevance|visibility)\[[^\]]*\]\}/gu)].map(
      (match) => match[0],
    )
    expect(reads).toEqual([])
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

describe('the Curated page cannot reintroduce a misleading zero', () => {
  const source = readFileSync(join(process.cwd(), CURATED_PAGE), 'utf8')
  const executable = source
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/(^|[^:])\/\/.*$/gmu, '$1')

  it('routes every reviewed statistic through the shared capability helper', () => {
    expect(executable).toContain('literatureCountDisplay(stats.capability.state')
    expect(executable).not.toMatch(/\?\?\s*0/gu)
  })

  it('renders unavailable counts and empty filtered results as different states', () => {
    expect(executable).toContain('<LiteratureCapabilityNotice')
    expect(executable).toContain('stats.data ? (')
    expect(executable).toContain('collection.data.items.length > 0')
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
