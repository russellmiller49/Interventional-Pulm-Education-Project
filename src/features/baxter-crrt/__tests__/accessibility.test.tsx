import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useReducer, type AnchorHTMLAttributes, type ReactNode } from 'react'

import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { BaxterCrrtModuleNav } from '../components/BaxterCrrtModuleNav'
import { getBaxterCrrtCase } from '../content'
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

    const nav = screen.getByRole('navigation', { name: 'Baxter CRRT module sections' })
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links.map((link) => link.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Overview/),
        expect.stringMatching(/Learn/),
        expect.stringMatching(/Practice/),
        expect.stringMatching(/Assess/),
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
})
