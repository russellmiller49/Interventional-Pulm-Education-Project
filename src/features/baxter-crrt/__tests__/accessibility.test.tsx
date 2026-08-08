import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useReducer, type AnchorHTMLAttributes, type ReactNode } from 'react'

import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { BaxterCrrtModuleNav } from '../components/BaxterCrrtModuleNav'
import { CrrtCitrateDifferential } from '../components/CrrtCitrateDifferential'
import { CrrtPilotCircuit } from '../components/CrrtPilotCircuit'
import { CrrtStagedPrescriptionBuilder } from '../components/CrrtStagedPrescriptionBuilder'
import { getBaxterCrrtCase } from '../content'
import { crrtCircuitOverlays } from '../content/circuitModel'
import { crrtCitrateDifferentialCategories } from '../content/citrateDifferential'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine'

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

function CasePlayerHarness() {
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition: getBaxterCrrtCase('CRRT-01'),
      experience: 'practice' as const,
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx' as const,
    },
    createCrrtLearningSession,
  )

  return (
    <CrrtCasePlayer
      session={session}
      dispatch={dispatch}
      onRoleChange={(roleLens) => dispatch({ type: 'RESET', roleLens })}
      onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
      idNamespace="accessibility-test"
    />
  )
}

describe('Baxter CRRT accessibility contract', () => {
  it('exposes four clear module destinations with the active page identified', () => {
    render(<BaxterCrrtModuleNav activeHref="/baxter-crrt/learn" />)

    const nav = screen.getByRole('navigation', { name: 'CRRT module sections' })
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links.map((link) => link.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Overview/),
        expect.stringMatching(/Learn/),
        expect.stringMatching(/Practice/),
        expect.stringMatching(/Challenge/),
      ]),
    )
    expect(within(nav).getByRole('link', { name: /Learn/ })).toHaveAttribute('aria-current', 'page')
  })

  it('provides four linked case surfaces with roving keyboard focus', () => {
    render(<CasePlayerHarness />)

    const tablist = screen.getByRole('tablist', { name: 'CRRT case surfaces' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    for (const tab of tabs) {
      const panelId = tab.getAttribute('aria-controls')
      expect(panelId).toBeTruthy()
      expect(document.getElementById(panelId ?? '')).toHaveAttribute('role', 'tabpanel')
      expect(document.getElementById(panelId ?? '')).toHaveAttribute('aria-labelledby', tab.id)
    }

    const caseTab = within(tablist).getByRole('tab', { name: 'Case' })
    const machineTab = within(tablist).getByRole('tab', { name: 'Machine + circuit' })
    const debriefTab = within(tablist).getByRole('tab', { name: 'Debrief' })
    caseTab.focus()
    fireEvent.keyDown(caseTab, { key: 'ArrowRight' })
    expect(machineTab).toHaveFocus()
    expect(machineTab).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(machineTab, { key: 'End' })
    expect(debriefTab).toHaveFocus()
  })

  it('encodes focus, 44-pixel targets, responsive reflow, and reduced motion', () => {
    const directory = join(process.cwd(), 'src/features/baxter-crrt/components')
    const shellCss = readFileSync(join(directory, 'baxter-crrt.module.css'), 'utf8')
    const playerCss = readFileSync(join(directory, 'crrt-case-player.module.css'), 'utf8')
    const drillCss = readFileSync(join(directory, 'crrt-rapid-drill-review.module.css'), 'utf8')

    expect(shellCss).toContain('.moduleShell button:focus-visible')
    expect(shellCss).toContain('min-height: 44px')
    expect(shellCss).toContain('@media (max-width: 900px)')
    expect(shellCss).toContain('@media (max-width: 640px)')
    expect(shellCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(playerCss).toContain('.surfaceSummary[data-mobile-active=')
    expect(playerCss).toContain('@media (max-width: 780px)')
    expect(drillCss).toContain('min-width: 0')
  })

  it.each(crrtCircuitOverlays.map((overlay) => [overlay.label, overlay.id] as const))(
    'renders the %s circuit view without an accessibility violation',
    async (_label, overlayId) => {
      const view = render(
        <CrrtPilotCircuit
          running={true}
          setReady={true}
          fluidsReady={true}
          bloodFlowMlMin={150}
          dialysateFlowMlHour={1_000}
          patientFluidRemovalMlHour={100}
          initialOverlayId={overlayId}
          pressure={{
            access: -72,
            filter: 146,
            return: 64,
            effluent: 28,
            TMP: 77,
            filterDrop: 82,
          }}
        />,
      )

      expect(await axe(view.container)).toHaveNoViolations()
      view.unmount()
    },
  )

  it('namespaces every generated circuit id so two mounted circuits cannot collide', () => {
    const view = render(
      <>
        <CrrtPilotCircuit
          running={false}
          setReady={false}
          fluidsReady={false}
          bloodFlowMlMin={null}
          dialysateFlowMlHour={null}
          patientFluidRemovalMlHour={null}
          pressure={{
            access: null,
            filter: null,
            return: null,
            effluent: null,
            TMP: null,
            filterDrop: null,
          }}
        />
        <CrrtPilotCircuit
          running={false}
          setReady={false}
          fluidsReady={false}
          bloodFlowMlMin={null}
          dialysateFlowMlHour={null}
          patientFluidRemovalMlHour={null}
          pressure={{
            access: null,
            filter: null,
            return: null,
            effluent: null,
            TMP: null,
            filterDrop: null,
          }}
        />
      </>,
    )

    const ids = [...view.container.querySelectorAll('[id]')].map((node) => node.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/** C2/C3 — the two surfaces this package adds. */
describe('Baxter CRRT staged builder and citrate accessibility contract', () => {
  it('renders all three prescription steps without an accessibility violation', async () => {
    const view = render(<CrrtStagedPrescriptionBuilder />)

    // Goals.
    expect(await axe(view.container)).toHaveNoViolations()
    fireEvent.click(screen.getByRole('button', { name: /Continue to Construction/ }))
    // Construction.
    expect(await axe(view.container)).toHaveNoViolations()
    fireEvent.click(screen.getByRole('button', { name: /Continue to Predicted consequences/ }))
    // Predicted consequences, resolved.
    expect(await axe(view.container)).toHaveNoViolations()

    // And the withheld state, which renders a different set of rows.
    fireEvent.click(screen.getByRole('button', { name: /Back to Construction/ }))
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Device makeup flow/ }), {
      target: { value: '40' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Predicted consequences/ }))
    expect(await axe(view.container)).toHaveNoViolations()
    view.unmount()
  })

  it('renders the citrate comparison without an accessibility violation, for each question', async () => {
    const view = render(<CrrtCitrateDifferential />)
    const picker = screen.getByRole('group', { name: 'Citrate comparison categories' })

    for (const button of within(picker).getAllByRole('button')) {
      fireEvent.click(button)
      expect(await axe(view.container)).toHaveNoViolations()
    }
    view.unmount()
  })

  it('names the current step and the open question for assistive technology', () => {
    const view = render(<CrrtStagedPrescriptionBuilder />)
    const rail = screen.getByRole('navigation', { name: 'Prescription building steps' })
    const current = within(rail)
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent(/Step 1 of 3/)
    // The live region announces the step by name, not only by number.
    expect(screen.getByRole('status')).toHaveTextContent(/step 1 of 3, Goals/i)
    view.unmount()

    render(<CrrtCitrateDifferential />)
    const pressed = within(screen.getByRole('group', { name: 'Citrate comparison categories' }))
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
    expect(pressed).toHaveLength(1)
  })

  it('nests no interactive element inside another on either surface', () => {
    const builder = render(<CrrtStagedPrescriptionBuilder />)
    const citrate = render(<CrrtCitrateDifferential />)
    // `tabindex="-1"` is a programmatic focus target, not a tab stop, so the stage panel wrapper
    // is deliberately not counted as an interactive ancestor.
    const interactive =
      'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'

    for (const view of [builder, citrate]) {
      for (const node of view.container.querySelectorAll(interactive)) {
        // A label wrapping its own input is the one legitimate pairing, and label is not
        // interactive; anything else nested here would be a double-activation trap.
        expect(node.querySelector(interactive)).toBeNull()
      }
    }
    builder.unmount()
    citrate.unmount()
  })

  it('encodes focus, 44-pixel targets, responsive reflow, and reduced motion in both stylesheets', () => {
    const directory = join(process.cwd(), 'src/features/baxter-crrt/components')
    const builderCss = readFileSync(
      join(directory, 'crrt-staged-prescription-builder.module.css'),
      'utf8',
    )
    const citrateCss = readFileSync(join(directory, 'crrt-citrate-differential.module.css'), 'utf8')

    for (const css of [builderCss, citrateCss]) {
      expect(css).toContain('focus-visible')
      expect(css).toContain('min-height: 44px')
      expect(css).toContain('@media (max-width: 780px)')
      expect(css).toContain('@media (prefers-reduced-motion: reduce)')
      expect(css).toContain('min-width: 0')
    }

    // Selected and current states carry a border-weight change, not colour alone.
    expect(builderCss).toContain("[aria-current='step']")
    expect(builderCss).toMatch(/\[aria-current='step'\][\s\S]*?border-left-width: 6px/)
    expect(citrateCss).toMatch(/\[aria-pressed='true'\][\s\S]*?border-left-width: 6px/)
    expect(citrateCss).toMatch(/\[data-support='held-open'\][\s\S]*?border-color/)
  })

  it('exposes every held-open row as text rather than by colour or hover', () => {
    render(<CrrtCitrateDifferential />)
    const heldOpenCount = crrtCitrateDifferentialCategories.reduce(
      (total, category) =>
        total +
        [
          category.circuitBehaviour,
          category.systemicCalciumContext,
          category.acidBaseContext,
          category.whatFindingsMaySupport,
        ].filter((field) => field.support === 'held-open').length,
      0,
    )
    expect(heldOpenCount).toBeGreaterThan(0)
    // Every one of them is written out in the always-available text equivalent.
    const textEquivalent = screen.getByText(/Four questions about citrate, kept apart/)
    expect(
      textEquivalent.textContent?.match(
        /open question, not answered by the sources registered for this module/g,
      ),
    ).toHaveLength(heldOpenCount)
  })
})
