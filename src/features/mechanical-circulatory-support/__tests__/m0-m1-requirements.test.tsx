import { act, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockRouterPush }),
}))
jest.mock('../components/EcmoCannulationPreview', () => ({
  EcmoCannulationPreview: () => <div>ECMO preview</div>,
}))
jest.mock('../components/ImpellaVariantPreview', () => ({
  ImpellaVariantPreview: () => <div>Impella preview</div>,
}))

import { McsHub } from '../components/McsHub'
import {
  MCS_PRODUCT_FLOW_BOUNDARY,
  MCS_RECOMMENDED_FIRST_SECTION_ID,
  mcsRequiredDistinctions,
  mcsSupportPathwayCardById,
  mcsSupportPathwayCards,
} from '../content'

/**
 * The M0/M1 acceptance checklist, walked one requirement per test.
 *
 * The other suites prove the model and the cards are correct as *data*. This one proves the
 * requirements a reviewer signs off on are true of what a learner actually sees, so the checklist
 * can be read straight off the test names rather than reassembled from three files.
 */

async function renderHub(): Promise<HTMLElement> {
  let container!: HTMLElement
  await act(async () => {
    container = render(<McsHub />).container
  })
  return container
}

beforeEach(() => {
  mockRouterPush.mockReset()
  window.localStorage.clear()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  })
})

describe('M0/M1 §5 — the module front door', () => {
  it('keeps review and governance material behind the reviewer layer', async () => {
    const container = await renderHub()
    const governance = container.querySelector('[data-review-governance]') as HTMLElement
    expect(governance).not.toBeNull()

    const reviewerLayer = governance.querySelector(
      'details[data-reviewer-layer]',
    ) as HTMLDetailsElement
    expect(reviewerLayer).not.toBeNull()
    // Collapsed by default: a first-year fellow does not open the module into a release checklist.
    expect(reviewerLayer.open).toBe(false)

    // The gate list and the sign-off prose live inside it.
    expect(reviewerLayer.querySelectorAll('li').length).toBeGreaterThanOrEqual(10)
    expect(
      within(reviewerLayer).getByText(/Publication awaits review by an advanced-heart-failure/i),
    ).toBeInTheDocument()
    expect(
      within(reviewerLayer).getByText(/perfusionist, or clinical-engineer review/i),
    ).toBeInTheDocument()

    // And nowhere else on the page.
    const outsideLayer = Array.from(container.querySelectorAll('li')).filter(
      (node) =>
        !reviewerLayer.contains(node) && /Pending ·|Complete ·/.test(node.textContent ?? ''),
    )
    expect(outsideLayer).toEqual([])
  })

  it('keeps the preview warning in the primary path, outside the reviewer layer', async () => {
    const container = await renderHub()
    const governance = container.querySelector('[data-review-governance]') as HTMLElement

    const heading = within(governance).getByText(/Preview · pending clinical review/i)
    const warning = within(governance).getByText(/bounded teaching approximations/i)

    expect(heading.closest('details')).toBeNull()
    expect(warning.closest('details')).toBeNull()
    expect(warning.textContent).toMatch(
      /Nothing in this module is a source for a device specification/i,
    )
    expect(warning.textContent).toMatch(/current manufacturer instructions and local protocol/i)
  })

  it('states the recommended first section without gating any other', async () => {
    const container = await renderHub()

    const startHere = screen
      .getByRole('heading', { name: /Begin with the model/i })
      .closest('section')
    expect(startHere).not.toBeNull()
    expect(
      within(startHere!).getByText(/Validate the signal before the device/i),
    ).toBeInTheDocument()
    expect(within(startHere!).getByText(/Nothing here is locked/i)).toBeInTheDocument()
    expect(within(startHere!).getByText(/any order/i)).toBeInTheDocument()

    expect(
      screen.getByRole('link', { name: /Open the recommended first section/i }),
    ).toHaveAttribute(
      'href',
      `/mechanical-circulatory-support/learn?lesson=${MCS_RECOMMENDED_FIRST_SECTION_ID}`,
    )

    // Recommending is not gating: no gating mechanism exists on the front door.
    expect(container.querySelectorAll('a[aria-disabled="true"]')).toHaveLength(0)
    expect(container.querySelectorAll('button[disabled]')).toHaveLength(0)
    expect(container.querySelector('[data-locked="true"]')).toBeNull()
    expect(container.querySelector('[aria-describedby*="prerequisite"]')).toBeNull()

    // The only place the page says "locked" is the sentence denying that anything is.
    const lockMentions = Array.from(container.querySelectorAll('p, li, span, strong'))
      .map((node) => node.textContent ?? '')
      .filter((text) => /\block(ed|s)?\b/i.test(text))
    expect(lockMentions.every((text) => /Nothing here is locked/i.test(text))).toBe(true)

    // Every device track is reachable directly.
    expect(screen.getAllByRole('link', { name: /Enter track/i })).toHaveLength(3)
  })

  it('states that working through the module does not make anyone ready to run a device', async () => {
    const container = await renderHub()
    const boundary = container.querySelector(
      '[data-mcs-common-model="completion-boundary"]',
    ) as HTMLElement
    expect(boundary).not.toBeNull()
    expect(boundary.textContent).toMatch(/does not establish that you are ready to operate/i)
    expect(boundary.textContent).toMatch(/device-specific training on the equipment in use/i)
    expect(boundary.textContent).toMatch(
      /supervision by the responsible shock or mechanical-support team/i,
    )
  })
})

describe('M0/M1 §3 — every reference flow is descriptive, never a target', () => {
  it('renders no product figure without its measurand and its not-a-target boundary', async () => {
    const container = await renderHub()

    const productBlocks = container.querySelectorAll('[data-product-references]')
    // One block per card, whether or not the card publishes a figure.
    expect(productBlocks).toHaveLength(mcsSupportPathwayCards.length)

    for (const block of Array.from(productBlocks)) {
      const boundary = block.querySelector('[data-not-a-target]')
      expect(boundary).not.toBeNull()
      expect(boundary!.textContent?.trim()).not.toHaveLength(0)

      for (const figure of Array.from(block.querySelectorAll('[data-product-reference]'))) {
        // The number never stands alone: the measurand renders beside it.
        expect(figure.querySelector('[data-measurand]')).not.toBeNull()
        expect(figure.querySelector('[data-measurand]')!.textContent?.trim()).not.toHaveLength(0)
        // And the block it sits in carries the shared not-a-target sentence verbatim.
        expect(boundary!.textContent).toBe(MCS_PRODUCT_FLOW_BOUNDARY)
      }
    }
  })

  it('renders the five published figures, each naming a different measured quantity', async () => {
    const container = await renderHub()
    const figures = Array.from(container.querySelectorAll('[data-product-reference]'))
    expect(figures).toHaveLength(5)

    const measurands = figures.map((node) => node.querySelector('[data-measurand]')?.textContent)
    expect(measurands).toEqual([
      'Maximum mean flow',
      'Peak flow rate at systole',
      'Average flow observed during support',
      'Product-reported maximum flow',
      'Product-framed flow',
    ])
    // No two Impella CP figures claim to be the same quantity.
    expect(new Set(measurands).size).toBe(measurands.length)
  })

  it('publishes no figure at all for a pathway that reports no device flow', async () => {
    const container = await renderHub()
    const iabpCard = container.querySelector(
      '[data-pathway-id="iabp-counterpulsation"]',
    ) as HTMLElement
    expect(iabpCard.querySelectorAll('[data-product-reference]')).toHaveLength(0)
    expect(iabpCard.querySelector('[data-not-a-target]')!.textContent).toMatch(
      /publishes no product flow figure/i,
    )
  })
})

describe('M0/M1 §4 — the required distinctions are present and rendered', () => {
  const cases = [
    [
      'counterpulsation changes timing and pressure and is not a chamber-to-artery pump',
      'mcs.distinction.iabp-is-not-a-pump',
    ],
    [
      'left and right microaxial pumps support different pathways',
      'mcs.distinction.left-versus-right-microaxial',
    ],
    [
      'combined right and left pumps are serial and their flows are not added',
      'mcs.distinction.serial-pumps-are-not-additive',
    ],
    [
      'a durable pump is not simply more temporary support',
      'mcs.distinction.durable-is-not-more-temporary',
    ],
    [
      'venovenous ECMO supports gas exchange without adding systemic flow',
      'mcs.distinction.vv-ecmo-adds-no-systemic-flow',
    ],
    [
      'venoarterial ECMO adds flow and gas exchange but can load the left ventricle',
      'mcs.distinction.va-ecmo-loads-the-lv',
    ],
    [
      'insertion direction is not blood-flow direction',
      'mcs.distinction.insertion-direction-is-not-flow-direction',
    ],
  ] as const

  it.each(cases)('renders the distinction that %s', async (_label, distinctionId) => {
    const container = await renderHub()
    const node = container.querySelector(`[data-distinction-id="${distinctionId}"]`)
    expect(node).not.toBeNull()

    const authored = mcsRequiredDistinctions.find((entry) => entry.id === distinctionId)
    expect(authored).toBeDefined()
    expect(node!.textContent).toContain(authored!.claim)
    // Each one also names the confusion it exists to prevent.
    expect(node!.textContent).toContain(authored!.confusedWith)
  })

  it('renders all seven and no fewer', async () => {
    const container = await renderHub()
    expect(container.querySelectorAll('[data-distinction-id]')).toHaveLength(7)
    expect(mcsRequiredDistinctions).toHaveLength(7)
  })

  it('backs each distinction with cards a learner can read side by side', async () => {
    const container = await renderHub()
    for (const distinction of mcsRequiredDistinctions) {
      expect(distinction.pathwayIds.length).toBeGreaterThanOrEqual(2)
      for (const pathwayId of distinction.pathwayIds) {
        expect(mcsSupportPathwayCardById.has(pathwayId)).toBe(true)
        // The card it points at is on the same page.
        expect(container.querySelector(`[data-pathway-id="${pathwayId}"]`)).not.toBeNull()
      }
    }
  })

  it('shows the venovenous and venoarterial cards disagreeing where they should', async () => {
    const container = await renderHub()
    const vv = container.querySelector('[data-pathway-id="vv-ecmo-comparison"]') as HTMLElement
    const va = container.querySelector('[data-pathway-id="va-ecmo-comparison"]') as HTMLElement

    // Both supply gas exchange.
    for (const card of [vv, va]) {
      expect(
        card
          .querySelector('[data-field="gasExchange"] [data-gas-exchange]')
          ?.getAttribute('data-gas-exchange'),
      ).toBe('yes')
    }
    // Only one of them adds systemic flow.
    expect(vv.querySelector('[data-additivity]')!.textContent).toMatch(/adds no systemic flow/i)
    expect(va.querySelector('[data-additivity]')!.textContent).toMatch(/not simply additive/i)
    // And only one of them loads the left ventricle.
    expect(va.querySelector('[data-field="chamberOrBedPotentiallyLoaded"]')!.textContent).toMatch(
      /left ventricle/i,
    )
    expect(vv.querySelector('[data-field="chamberOrBedPotentiallyLoaded"]')!.textContent).toMatch(
      /none directly/i,
    )
  })

  it('shows temporary and durable marked on every card', async () => {
    const container = await renderHub()
    const roles = Array.from(container.querySelectorAll('[data-pathway-id]')).map((node) =>
      node.getAttribute('data-support-role'),
    )
    expect(roles).toHaveLength(8)
    expect(new Set(roles)).toEqual(new Set(['temporary', 'durable']))
    expect(
      container
        .querySelector('[data-pathway-id="durable-continuous-flow-lvad"]')
        ?.getAttribute('data-support-role'),
    ).toBe('durable')
  })
})
