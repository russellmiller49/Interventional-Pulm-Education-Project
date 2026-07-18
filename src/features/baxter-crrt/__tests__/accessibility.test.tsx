import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import BaxterCrrtLab from '../components/BaxterCrrtLab'

describe('Baxter CRRT v1 accessibility contract', () => {
  beforeEach(() => window.localStorage.clear())

  it('provides roving keyboard navigation for the five learning experiences', () => {
    render(<BaxterCrrtLab />)

    const tablist = screen.getByRole('tablist', { name: 'CRRT learning experiences' })
    const learn = within(tablist).getByRole('tab', { name: /^Learn/ })
    const practice = within(tablist).getByRole('tab', { name: /^Practice/ })
    const tools = within(tablist).getByRole('tab', { name: /^Tools/ })

    expect(learn).toHaveAttribute('tabindex', '0')
    expect(practice).toHaveAttribute('tabindex', '-1')
    learn.focus()
    fireEvent.keyDown(learn, { key: 'ArrowRight' })
    expect(practice).toHaveFocus()
    expect(practice).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(practice, { key: 'End' })
    expect(tools).toHaveFocus()
    expect(tools).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'baxter-crrt-workspace-tab-tools',
    )
  })

  it('exposes a five-tab mobile surface with linked panels and focus restoration', () => {
    render(<BaxterCrrtLab />)

    const tablist = screen.getByRole('tablist', { name: 'CRRT mobile workspace surface' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    for (const tab of tabs) {
      const panelId = tab.getAttribute('aria-controls')
      expect(panelId).toBeTruthy()
      const panel = document.getElementById(panelId ?? '')
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', tab.id)
    }

    const caseTab = within(tablist).getByRole('tab', { name: 'Case' })
    const machineTab = within(tablist).getByRole('tab', { name: 'Machine' })
    const debriefTab = within(tablist).getByRole('tab', { name: 'Debrief' })
    caseTab.focus()
    fireEvent.keyDown(caseTab, { key: 'ArrowRight' })
    expect(machineTab).toHaveFocus()
    expect(document.getElementById(machineTab.getAttribute('aria-controls') ?? '')).toHaveAttribute(
      'data-mobile-active',
      'true',
    )
    fireEvent.keyDown(machineTab, { key: 'End' })
    expect(debriefTab).toHaveFocus()
  })

  it('encodes focus, 44-pixel targets, reduced motion, 320-pixel reflow, and tablet layout', () => {
    const directory = join(process.cwd(), 'src/features/baxter-crrt/components')
    const shellCss = readFileSync(join(directory, 'baxter-crrt.module.css'), 'utf8')
    const workflowCss = readFileSync(join(directory, 'crrt-learning-workflow.module.css'), 'utf8')
    const drillCss = readFileSync(join(directory, 'crrt-rapid-drill-review.module.css'), 'utf8')

    expect(shellCss).toContain('.moduleShell button:focus-visible')
    expect(shellCss).toContain('min-height: 44px')
    expect(shellCss).toContain('@media (max-width: 1180px)')
    expect(shellCss).toContain('@media (max-width: 780px)')
    expect(shellCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(workflowCss).toContain('.surfaceSummary[data-mobile-active=')
    expect(workflowCss).toContain('@media (max-width: 780px)')
    expect(drillCss).toContain('min-width: 0')
  })
})
