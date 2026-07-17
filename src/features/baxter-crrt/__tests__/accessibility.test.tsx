import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import BaxterCrrtLab from '../components/BaxterCrrtLab'
import { CrrtPhase7ReviewPanel } from '../components/CrrtPhase7ReviewPanel'
import { CrrtPhase8ReviewPanel } from '../components/CrrtPhase8ReviewPanel'
import { CrrtResponsePanel } from '../components/CrrtResponsePanel'
import { createInitialCrrtSimulationState, type TrendSample } from '../engine'
import { createSyntheticFixture } from '../engine/testSupport/syntheticFixture'

function advanceOrientationToOperations() {
  fireEvent.click(screen.getByRole('button', { name: /New Patient/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm case-free context' }))
  fireEvent.click(screen.getByRole('button', { name: /CVVHD/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue with CVVHD pilot' }))
  fireEvent.change(screen.getByRole('spinbutton', { name: /^Blood flow/i }), {
    target: { value: '100' },
  })
  fireEvent.change(screen.getByRole('spinbutton', { name: /^Dialysate flow/i }), {
    target: { value: '1000' },
  })
  fireEvent.change(screen.getByRole('spinbutton', { name: /^Patient fluid removal/i }), {
    target: { value: '50' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Review and apply pilot values' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm training set path' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm bag and scale positions' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start prime sequence check' }))
  fireEvent.click(screen.getByRole('button', { name: 'Complete prime verification' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm review' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm simulated line path' }))
  fireEvent.click(screen.getByRole('button', { name: /Start interface run/i }))
}

function trendSample(
  timeSeconds: number,
  accessPressureMmHg: number,
  hemodynamicStressIndex: number,
  cumulativeWholePatientBalanceMl: number,
): TrendSample {
  return {
    timeSeconds,
    prescribedEffluentDoseMlKgHour: 25,
    deliveredDoseMlKgHour: 22,
    cumulativeActualEffluentMl: timeSeconds / 3.6,
    cumulativeMachinePatientFluidRemovalMl: timeSeconds / 36,
    cumulativeWholePatientBalanceMl,
    accessPressureMmHg,
    filterPressureMmHg: 120,
    returnPressureMmHg: 60,
    transmembranePressureMmHg: 45,
    foulingBurdenFraction: 0,
    clotBurdenFraction: 0,
    hemodynamicStressIndex,
    soluteConcentrationsPerLiter: { potassium: 4 },
  }
}

describe('Baxter CRRT Phase 6 accessibility engineering pass', () => {
  beforeEach(() => window.localStorage.clear())

  it('uses roving keyboard behavior and explicit panel relationships for mobile workspace tabs', () => {
    render(<BaxterCrrtLab />)
    fireEvent.click(screen.getByRole('tab', { name: /Learn/i }))

    const tablist = screen.getByRole('tablist', { name: 'CRRT mobile workspace surface' })
    const caseTab = within(tablist).getByRole('tab', { name: 'Case' })
    const machineTab = within(tablist).getByRole('tab', { name: 'Machine' })
    const debriefTab = within(tablist).getByRole('tab', { name: 'Debrief' })

    for (const tab of within(tablist).getAllByRole('tab')) {
      const panelId = tab.getAttribute('aria-controls')
      expect(panelId).not.toBeNull()
      const panel = document.getElementById(panelId ?? '')
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', tab.id)
    }

    expect(caseTab).toHaveAttribute('tabindex', '0')
    expect(machineTab).toHaveAttribute('tabindex', '-1')
    expect(caseTab).toHaveAttribute('aria-controls', 'baxter-crrt-mobile-panel-case')

    caseTab.focus()
    fireEvent.keyDown(caseTab, { key: 'ArrowRight' })
    expect(machineTab).toHaveFocus()
    expect(machineTab).toHaveAttribute('aria-selected', 'true')
    expect(machineTab).toHaveAttribute('tabindex', '0')
    expect(document.getElementById('baxter-crrt-mobile-panel-machine')).toBeInTheDocument()

    fireEvent.keyDown(machineTab, { key: 'End' })
    expect(debriefTab).toHaveFocus()
    expect(debriefTab).toHaveAttribute('aria-selected', 'true')
    expect(debriefTab).toHaveAttribute('aria-controls', 'baxter-crrt-mobile-panel-debrief')
  })

  it('focuses, traps, closes, and restores focus for the stop dialog using the keyboard', async () => {
    render(<BaxterCrrtLab />)
    advanceOrientationToOperations()

    expect(screen.getByText(/Priority status:/i).closest('p')).toHaveTextContent(
      'not mapped — independent device review required',
    )
    expect(screen.getByRole('list', { name: 'Synthetic pressure signals' })).toBeInTheDocument()

    const stopButton = screen.getByRole('button', { name: 'Stop' })
    stopButton.focus()
    fireEvent.click(stopButton)

    const dialog = screen.getByRole('dialog', { name: /End this equipment checkout/i })
    const resumeButton = screen.getByRole('button', { name: 'Resume interface' })
    const endButton = screen.getByRole('button', { name: 'End interface run' })
    await waitFor(() => expect(resumeButton).toHaveFocus())

    fireEvent.keyDown(resumeButton, { key: 'Tab', shiftKey: true })
    expect(endButton).toHaveFocus()
    fireEvent.keyDown(endButton, { key: 'Tab' })
    expect(resumeButton).toHaveFocus()

    const orientationTab = screen.getByRole('tab', { name: /Orientation/i })
    orientationTab.focus()
    expect(resumeButton).toHaveFocus()
    fireEvent.click(orientationTab)
    expect(screen.getByRole('dialog', { name: /End this equipment checkout/i })).toBeInTheDocument()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(stopButton).toHaveFocus())

    fireEvent.click(stopButton)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Resume interface' })).toHaveFocus(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'End interface run' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reload clean interface' })).toHaveFocus(),
    )
  })

  it('provides a visible trend summary and a keyboard-focusable narrow-screen table region', () => {
    const initialState = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    const state = {
      ...initialState,
      trends: [trendSample(300, -70, 0.1, 80), trendSample(1800, -105, 0.25, -120)],
    }
    render(<CrrtResponsePanel state={state} />)

    const summary = screen.getByText(/^Trend summary:/)
    expect(summary).not.toHaveAttribute('aria-live')
    expect(summary).not.toHaveAttribute('role', 'status')
    expect(summary).toHaveTextContent('2 simulated samples from 5 to 30 minutes')
    expect(summary).toHaveTextContent('Access pressure changed from -70 to -105')
    expect(summary).toHaveTextContent('whole-patient balance changed from 80 to -120')

    const tableRegion = screen.getByRole('region', {
      name: /Recent simulated trend table; horizontally scrollable/i,
    })
    expect(tableRegion).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('table')).toHaveAttribute('aria-describedby', summary.id)
  })

  it('locks all non-English routes to reviewed English and suppresses handoff translation', () => {
    render(<BaxterCrrtLab locale="zh-CN" />)

    expect(screen.getByRole('main')).toHaveAttribute('data-no-handoff-translate', 'true')
    expect(screen.getByText('Reviewed-English fallback:')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'CRRT Learn & Practice workspace' }),
    ).toBeInTheDocument()
  })

  it('gives the Phase 7 registry named, native disclosure controls with collapsed content hidden', () => {
    render(<CrrtPhase7ReviewPanel />)

    const registry = screen.getByRole('region', {
      name: 'Full PrisMax curriculum—mapped, not activated',
    })
    expect(
      within(registry)
        .getByText('Authorization to build is not clinical or device approval.')
        .closest('[role="note"]'),
    ).toHaveTextContent('Authorization to build is not clinical or device approval.')

    const stationGroup = within(registry).getByRole('group', {
      name: 'Phase 7 curriculum stations',
    })
    const stationOneSummary = within(stationGroup).getByText('Station 1').closest('summary')
    const stationTwoSummary = within(stationGroup).getByText('Station 2').closest('summary')
    const reviewerToolsSummary = within(registry)
      .getByText('Reviewer-only instructional tools')
      .closest('summary')
    const stationOneDetails = stationOneSummary?.closest('details')
    const stationTwoDetails = stationTwoSummary?.closest('details')
    const reviewerToolsDetails = reviewerToolsSummary?.closest('details')
    const stationTwoCases = document.getElementById('baxter-crrt-phase7-station-2-cases')
    const reviewerTools = document.getElementById('baxter-crrt-phase7-reviewer-tools')

    expect(stationOneSummary).toHaveAccessibleName(/Station 1.*Define the goal.*3 cases/i)
    expect(stationOneDetails).toHaveAttribute('open')
    expect(stationTwoSummary).toHaveAccessibleName(/Station 2.*Build the prescription.*3 cases/i)
    expect(stationTwoSummary).toHaveAttribute('aria-controls', 'baxter-crrt-phase7-station-2-cases')
    expect(stationTwoDetails).not.toHaveAttribute('open')
    expect(stationTwoCases).not.toBeVisible()
    expect(reviewerToolsSummary).toHaveAccessibleName(
      /Reviewer-only instructional tools.*\d+ bounded lab candidates.*No score, progress, or competency/i,
    )
    expect(reviewerToolsSummary).toHaveAttribute(
      'aria-controls',
      'baxter-crrt-phase7-reviewer-tools',
    )
    expect(reviewerToolsDetails).not.toHaveAttribute('open')
    expect(reviewerTools).not.toBeVisible()

    if (!stationTwoSummary) throw new Error('Expected the Station 2 disclosure summary.')
    fireEvent.click(stationTwoSummary)
    expect(stationTwoDetails).toHaveAttribute('open')
    expect(stationTwoCases).toBeVisible()

    if (!reviewerToolsSummary) throw new Error('Expected the reviewer-tool disclosure summary.')
    fireEvent.click(reviewerToolsSummary)
    expect(reviewerToolsDetails).toHaveAttribute('open')
    expect(reviewerTools).toBeVisible()
  })

  it('gives the Phase 8 reviewer surfaces named native disclosures and explicit isolation metadata', () => {
    render(<CrrtPhase8ReviewPanel />)

    const registry = screen.getByRole('region', {
      name: 'Prismaflex adapter—source-mapped, not activated',
    })
    expect(registry).toHaveAttribute('data-phase8-runtime', 'disabled')
    expect(registry).toHaveAttribute('data-analytics', 'none')
    expect(registry).toHaveAttribute('data-progress-write', 'none')

    const consoleSummary = within(registry)
      .getByText('Prismaflex reviewer-only softkey console')
      .closest('summary')
    const consoleDetails = consoleSummary?.closest('details')
    const consoleContent = document.getElementById('baxter-crrt-prismaflex-review-console')

    expect(consoleSummary).toHaveAccessibleName(
      /Prismaflex reviewer-only softkey console.*Setup, profile, calculation, and alarm mapping.*No device action/i,
    )
    expect(consoleSummary).toHaveAttribute('aria-controls', 'baxter-crrt-prismaflex-review-console')
    expect(consoleDetails).not.toHaveAttribute('open')
    expect(consoleContent).not.toBeVisible()

    if (!consoleSummary) throw new Error('Expected the Prismaflex console disclosure summary.')
    fireEvent.click(consoleSummary)
    expect(consoleDetails).toHaveAttribute('open')
    expect(consoleContent).toBeVisible()
  })

  it('keeps the rapid-drill reviewer surface shrinkable at a 320px viewport', () => {
    const rapidDrillCss = readFileSync(
      join(process.cwd(), 'src/features/baxter-crrt/components/crrt-rapid-drill-review.module.css'),
      'utf8',
    )

    expect(rapidDrillCss).toMatch(
      /\.review\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*min-width:\s*0;/,
    )
    expect(rapidDrillCss).toMatch(
      /\.header > div,\s*\.sequenceHeader > div\s*\{[^}]*min-width:\s*0;/,
    )
    expect(rapidDrillCss).toMatch(
      /\.selector select\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/,
    )
  })

  it('encodes visible focus, 44px targets, reduced motion, and reflow breakpoints', () => {
    const componentDirectory = join(process.cwd(), 'src/features/baxter-crrt/components')
    const shellCss = readFileSync(join(componentDirectory, 'baxter-crrt.module.css'), 'utf8')
    const learningCss = readFileSync(
      join(componentDirectory, 'crrt-learning-workflow.module.css'),
      'utf8',
    )
    const interfaceCss = readFileSync(
      join(componentDirectory, 'prismax-pilot-interface.module.css'),
      'utf8',
    )
    const circuitCss = readFileSync(
      join(componentDirectory, 'crrt-pilot-circuit.module.css'),
      'utf8',
    )
    const phase8Css = readFileSync(
      join(componentDirectory, 'crrt-phase8-review-panel.module.css'),
      'utf8',
    )
    const prismaflexConsoleCss = readFileSync(
      join(componentDirectory, 'prismaflex-reviewer-console.module.css'),
      'utf8',
    )

    expect(shellCss).toContain('.moduleShell button:focus-visible')
    expect(shellCss).toContain('min-height: 44px')
    expect(shellCss).toContain('overflow-x: clip')
    expect(shellCss).toContain('@media (max-width: 1180px)')
    expect(shellCss).toContain('@media (max-width: 780px)')
    expect(shellCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(shellCss).toMatch(/\.phase7StationList summary\s*\{[\s\S]*?min-height:\s*44px/)
    expect(shellCss).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.phase7StationList summary\s*\{[\s\S]*?minmax\(0, 1fr\)/,
    )
    expect(learningCss).toContain('.trendTableWrap:focus-visible')
    expect(learningCss).toContain('.masteryBoundary')
    expect(interfaceCss).toContain('.consoleShell button:focus-visible')
    expect(interfaceCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(interfaceCss).not.toContain('min-height: 38px')
    expect(interfaceCss).toMatch(/\.dialogBackdrop\s*\{[\s\S]*?position:\s*fixed;/)
    expect(circuitCss).toContain('.diagramViewport:focus-visible')
    expect(circuitCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(phase8Css).toContain('.disclosure > summary:focus-visible')
    expect(phase8Css).toContain('min-height: 3.5rem')
    expect(phase8Css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(prismaflexConsoleCss).toContain('.softkeyRail button:focus-visible')
    expect(prismaflexConsoleCss).toContain('min-height: 2.75rem')
    expect(prismaflexConsoleCss).toContain('@media (max-width: 360px)')
    expect(prismaflexConsoleCss).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
