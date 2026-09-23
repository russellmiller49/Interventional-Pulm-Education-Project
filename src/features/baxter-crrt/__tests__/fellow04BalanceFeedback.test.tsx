import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import {
  CRRT_BALANCE_GENERAL_HINT,
  diagnoseCrrtBalanceEntry,
  selectCrrtBalanceFeedback,
  type CrrtBalanceChart,
} from '../balanceFeedback'
import { CrrtRecordedBalanceQuestion } from '../components/CrrtOperationalTools'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY } from '../engine/progress'
import type { CrrtLearnEvidence } from '../learnEvidence'
import {
  createCrrtOperationalRun,
  crrtOperationalRunReducer,
  crrtRecordedFluidChart,
  nextCrrtOperationalCommand,
  type CrrtOperationalRun,
} from '../operationalModel'

/**
 * CRRT-FELLOW-04 — F-21. An entered whole-patient balance is compared with the recorded
 * arithmetic, the categories and sign convention are named, the worked calculation is always
 * available, and a specific diagnosis is given only when the number itself establishes it.
 */

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

/** The Lesson 7 delivery run recorded to its four-hour boundary, as the lesson does. */
function fourHourDeliveryRun(): CrrtOperationalRun {
  let run = createCrrtOperationalRun('delivery')
  for (let guard = 0; guard < 20; guard += 1) {
    const command = nextCrrtOperationalCommand(run, 'delivery-timeline')
    if (!command) break
    run = crrtOperationalRunReducer(run, 'delivery-timeline', { type: 'command', id: command.id })
  }
  expect(run.session.simulation.simulationTimeSeconds).toBe(14_400)
  return run
}

const run = fourHourDeliveryRun()
const chart = crrtRecordedFluidChart(run.session)
const context = {
  windowHours: run.session.simulation.deliveredTherapy.chartingWindowSeconds / 3600,
  effluentMl: run.session.simulation.deliveredTherapy.cumulativeActualEffluentMl,
}
const recorded = chart.balanceMl!

describe('the recorded chart this exercise uses', () => {
  it('is the lesson’s 0–4 hour chart with a finite recorded balance', () => {
    expect(context.windowHours).toBe(4)
    expect(Number.isFinite(recorded)).toBe(true)
    expect(chart.urineMl).not.toBeNull()
    expect(recorded).toBeCloseTo(
      chart.externalInputMl -
        chart.urineMl! -
        chart.otherOutputMl -
        chart.removalMl! +
        chart.additionalDeviceGainMl,
      6,
    )
  })
})

describe('balance feedback compares the entry with the supported arithmetic (F-21)', () => {
  it('says a correct entry matches, and still shows the full labelled ledger', () => {
    const feedback = selectCrrtBalanceFeedback(recorded, chart, context)
    expect(feedback.status).toBe('matches')
    expect(feedback.diagnosis).toBeNull()
    expect(feedback.ledger.map((line) => line.id)).toEqual([
      'intake',
      'urine',
      'other-output',
      'net-removal',
      'device-gain',
    ])
    expect(feedback.workedCalculation).toMatch(/^external intake .* − urine output .* = [+−]/)
    expect(feedback.workedCalculation).toContain('net CRRT removal')
    expect(feedback.signConvention).toMatch(/Positive means the patient gained fluid/)
    expect(feedback.notInLedger).toMatch(/effluent, dialysate, replacement and PBP/)
    expect(feedback.unitsAndWindow).toMatch(/same 4-hour charting window/)
  })

  it('says a clearly wrong entry does not match and gives the difference', () => {
    const feedback = selectCrrtBalanceFeedback(recorded + 100, chart, context)
    expect(feedback.status).toBe('does-not-match')
    expect(feedback.differenceMl).toBeCloseTo(100, 6)
    expect(feedback.ledger).toHaveLength(5)
  })

  it('identifies a sign error only when no other slip gives the same number', () => {
    // In this run the balance (+300 mL) equals net removal (300 mL), so −300 is both the balance
    // negated and "net removal taken as the balance": the number cannot say which, so no
    // specific misconception is named.
    expect(chart.removalMl).toBeCloseTo(recorded, 6)
    expect(diagnoseCrrtBalanceEntry(-recorded, chart, context)).toEqual({
      kind: 'general',
      errorId: null,
      text: CRRT_BALANCE_GENERAL_HINT,
    })
    // Where the two differ, the negated balance is unambiguous and is named.
    const distinct: CrrtBalanceChart = {
      externalInputMl: 1000,
      urineMl: 100,
      otherOutputMl: 50,
      removalMl: 400,
      additionalDeviceGainMl: 0,
      balanceMl: 450,
    }
    expect(diagnoseCrrtBalanceEntry(-450, distinct, context)).toMatchObject({
      kind: 'specific',
      errorId: 'sign-reversed',
    })
    expect(diagnoseCrrtBalanceEntry(380, chart, context)).toMatchObject({
      errorId: 'urine-left-out',
    })
  })

  it('identifies a unit error (liters) and a time-window error (hourly average)', () => {
    expect(diagnoseCrrtBalanceEntry(recorded / 1000, chart, context)).toMatchObject({
      kind: 'specific',
      errorId: 'liters-not-milliliters',
    })
    expect(diagnoseCrrtBalanceEntry(recorded / 4, chart, context)).toMatchObject({
      kind: 'specific',
      errorId: 'per-hour-average',
    })
  })

  it('names the category-mixing error the walkthrough entered, from its own arithmetic', () => {
    // Circuit fluids = effluent − net removal (the dialysate in this CVVHD run).
    const circuitFluids = context.effluentMl - chart.removalMl!
    const diagnosis = diagnoseCrrtBalanceEntry(recorded - circuitFluids, chart, context)
    expect(diagnosis?.kind).toBe('specific')
    expect(diagnosis?.errorId).toBe('circuit-fluids-counted')
    expect(diagnosis?.text).toMatch(/total effluent .* in place of net CRRT removal/)
  })

  it('gives only the general hint for an arbitrary unrelated number', () => {
    const diagnosis = diagnoseCrrtBalanceEntry(recorded + 1234.5, chart, context)
    expect(diagnosis).toEqual({ kind: 'general', errorId: null, text: CRRT_BALANCE_GENERAL_HINT })
  })

  it('does not diagnose a specific error when two different slips give the same number', () => {
    // Construct a chart where urine equals other output: both omissions give the same value.
    const ambiguous: CrrtBalanceChart = { ...chart, urineMl: 40, otherOutputMl: 40 }
    const balance =
      ambiguous.externalInputMl - 40 - 40 - ambiguous.removalMl! + ambiguous.additionalDeviceGainMl
    const diagnosis = diagnoseCrrtBalanceEntry(
      balance + 40,
      { ...ambiguous, balanceMl: balance },
      context,
    )
    expect(diagnosis?.kind).toBe('general')
  })

  it('keeps missing urine unavailable, never zero', () => {
    const missing = crrtRecordedFluidChart(run.session, true)
    expect(missing.urineMl).toBeNull()
    expect(missing.balanceMl).toBeNull()
    const feedback = selectCrrtBalanceFeedback(123, missing, context)
    expect(feedback.status).toBe('unavailable')
    expect(feedback.recordedMl).toBeNull()
    expect(feedback.diagnosis?.text).toMatch(/not recorded.*not zero/)
    expect(feedback.ledger.find((line) => line.id === 'urine')?.valueMl).toBeNull()
    expect(feedback.workedCalculation).toContain('urine output not recorded')
    expect(feedback.workedCalculation).toMatch(/= unavailable$/)
  })

  it('an empty entry produces no comparison and no diagnosis', () => {
    const feedback = selectCrrtBalanceFeedback(null, chart, context)
    expect(feedback.enteredMl).toBeNull()
    expect(feedback.diagnosis).toBeNull()
    expect(feedback.workedCalculation).toContain('=')
  })
})

/** The question with the in-session evidence the lesson keeps, and nothing persisted. */
function Harness() {
  const [evidence, setEvidence] = useState<CrrtLearnEvidence | undefined>()
  const [continued, setContinued] = useState(false)
  return (
    <>
      <CrrtRecordedBalanceQuestion
        run={run}
        evidence={evidence}
        onSubmit={(response, correct, inputs) =>
          setEvidence({
            module: 'baxter-crrt',
            lessonId: 'crrt-fluid-liberation',
            taskId: 'recorded-balance',
            version: 'test',
            attemptId: 'test',
            mode: 'independent',
            response,
            correct,
            inputs,
            feedbackDisplayed: false,
            reviewed: false,
          } as unknown as CrrtLearnEvidence)
        }
        onFeedbackDisplayed={() => {}}
        onContinue={() => setContinued(true)}
        onRetry={() => setEvidence(undefined)}
      />
      {continued ? <p>continued</p> : null}
    </>
  )
}

describe('the balance question in use (F-21)', () => {
  beforeEach(() => window.localStorage.clear())

  it('offers the worked calculation before any entry, and cannot check an empty entry', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Check recorded balance' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Show worked calculation' }))
    expect(screen.getByText('Worked calculation · no entry recorded.')).toBeVisible()
    expect(screen.getByRole('list', { name: 'Patient fluid ledger for this window' })).toBeVisible()
  })

  it('states the mismatch, the categories and the calculation on the first miss, then retries', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Signed whole-patient balance (mL)' })
    // The walkthrough's entry: −5,100 mL.
    fireEvent.change(input, { target: { value: '-5100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check recorded balance' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Your entry does not match the recorded balance')
    expect(status).toHaveTextContent('Your entry: −5,100 mL. Recorded balance: +300 mL.')
    expect(status).toHaveTextContent('What your number shows:')
    expect(status).toHaveTextContent('in place of net CRRT removal')
    expect(status).toHaveTextContent('Worked calculation:')
    expect(status).toHaveTextContent('Subtract net CRRT removal')
    expect(status).not.toHaveTextContent(/first answer|attempt/i)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const again = screen.getByRole('textbox', { name: 'Signed whole-patient balance (mL)' })
    expect(again).toHaveValue('')
    fireEvent.change(again, { target: { value: String(recorded) } })
    fireEvent.click(screen.getByRole('button', { name: 'Check recorded balance' }))
    expect(screen.getByRole('status')).toHaveTextContent('Your entry matches the recorded balance')
    fireEvent.click(screen.getByRole('button', { name: 'Review feedback and continue' }))
    expect(screen.getByText('continued')).toBeInTheDocument()
    expect(window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('gives the general hint for an arbitrary number, not an invented misconception', () => {
    render(<Harness />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Signed whole-patient balance (mL)' }), {
      target: { value: '777' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check recorded balance' }))
    expect(screen.getByRole('status')).toHaveTextContent('Hint:')
    expect(screen.getByRole('status')).toHaveTextContent(CRRT_BALANCE_GENERAL_HINT)
    expect(document.querySelector('[data-crrt-balance-diagnosis]')).toHaveAttribute(
      'data-crrt-balance-diagnosis',
      'general',
    )
  })
})
