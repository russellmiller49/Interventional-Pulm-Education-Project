import { cleanup, render, screen } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { IcuHemodynamicsPracticeLandingV2 } from '../components/IcuHemodynamicsPracticeLandingV2'
import { HemodynamicsSimulatorPane } from '../components/stage/HemodynamicsSimulatorPane'
import { WaveformAtlasFigure } from '../components/WaveformAtlasFigure'
import { WaveformStrip } from '../components/WaveformStrip'
import { cardiacOutputAcquisitionParameters } from '../content/cardiacOutputSourceBoundaries'
import { fastFlushBaselinePressureMmHg } from '../content/pressureSystemVisuals'
import { hemodynamicsTaskPresentation } from '../content/taskPresentation'
import { waveformAtlasById, waveformValueAt } from '../content/waveformAtlas'
import { capstoneState, cleanState, reduceAll } from '../engine/stageRuntime'
import type { HemodynamicWaveformSample } from '../engine/types'
import { CARDIAC_PHASE } from '../engine/waveformMorphology'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
  }) => <a href={typeof href === 'string' ? href : href.pathname}>{children}</a>,
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('../components/HemodynamicHeart3DDynamic', () => ({
  HemodynamicHeart3DDynamic: () => <div>Mock heart</div>,
}))

afterEach(cleanup)

/**
 * HD-PRE-REVIEW-03 — the assigned defects, written only against what exists on the execution base
 * (`047d30b3`).
 *
 * Every test here reads behaviour through surfaces that both the base and this branch have: the
 * rendered DOM's text and geometry, and exports that pre-date the batch. Run on the base they fail
 * on their assertions; that is the reproduction. Nothing here depends on a class name, data
 * attribute or helper this batch introduced.
 */

/** Every drawn point of a strip's trace, whichever element carries it. */
function drawnYs(container: HTMLElement): number[] {
  return [...container.querySelectorAll('polyline')]
    .flatMap((polyline) => (polyline.getAttribute('points') ?? '').split(' ').filter(Boolean))
    .map((pair) => Number(pair.split(',')[1]))
}

function strip(samples: readonly HemodynamicWaveformSample[], maximum: number) {
  return render(
    <WaveformStrip
      samples={samples}
      field="papMmHg"
      label="PAP"
      unit="mmHg"
      minimum={0}
      maximum={maximum}
      color="#ffd166"
      sweepSeconds={6}
      showScale
      referenceValue={16}
      referenceLabel="model mPAP"
    />,
  )
}

describe('the live strip keeps each sample’s own height (L3-02 in this renderer, L2-06)', () => {
  it('does not move samples above the axis onto the axis', () => {
    const state = cleanState(510, 'pa')
    // A 0–20 axis under a pulmonary-artery tracing that peaks near 29: most of each systole is above it.
    const { container } = strip(state.waveforms, 20)
    const ys = drawnYs(container)
    const top = Math.min(...ys)
    // Clamped, every above-axis sample shares one height. Unclamped, they differ.
    expect(ys.filter((y) => y === top).length).toBeLessThan(3)
    expect(new Set(ys.filter((y) => y <= top + 4)).size).toBeGreaterThan(3)
  })
})

describe('nothing is written across the tracing (L2-01, L9-04, X-01, L3-01)', () => {
  it('draws no label text inside the strip’s plot', () => {
    const { container } = strip(cleanState(510, 'pa').waveforms, 40)
    expect(container.querySelectorAll('svg text')).toHaveLength(0)
    // The label is still on the page, as text a reader can find.
    expect(screen.getAllByText(/model mPAP 16/).length).toBeGreaterThan(0)
  })

  it('draws no label text inside a reference figure’s plot', () => {
    const { container } = render(
      <WaveformAtlasFigure entry={waveformAtlasById.get('rv-normal')!} ecgLandmarks />,
    )
    expect(container.querySelectorAll('svg text')).toHaveLength(0)
    expect(screen.getByText('RVEDP', { selector: 'span' })).toBeInTheDocument()
  })
})

describe('a rounded zero has no sign (P-07)', () => {
  it('does not print a range that starts at minus zero', () => {
    const samples = Array.from({ length: 40 }, (_, index) => ({
      ...cleanState(510, 'pa').waveforms[0],
      time: index * 0.02,
      cvpMmHg: -0.04 + index * 0.1,
    })) as HemodynamicWaveformSample[]
    render(
      <WaveformStrip
        samples={samples}
        field="cvpMmHg"
        label="CVP"
        unit="mmHg"
        minimum={-5}
        maximum={20}
        color="#55c6ff"
        sweepSeconds={6}
      />,
    )
    expect(document.body.textContent).not.toMatch(/-0\.0\b/)
  })
})

describe('the underdamped example shows what its caption says (L2-08)', () => {
  it('draws a systolic value above, and a diastolic value below, the 25/10 source', () => {
    const beat = Array.from({ length: 400 }, (_, index) =>
      fastFlushBaselinePressureMmHg('pulmonary-artery', 'underdamped', index / 400),
    )
    expect(Math.max(...beat)).toBeGreaterThan(26)
    expect(Math.min(...beat)).toBeLessThan(9)
  })
})

describe('the tricuspid-regurgitation example draws one systolic wave (L4-04)', () => {
  it('never falls between the c wave and the v wave', () => {
    const entry = waveformAtlasById.get('ra-tricuspid-regurgitation')!
    let previous = waveformValueAt(entry.trace, CARDIAC_PHASE.atrialCWave)
    let falls = 0
    for (let step = 1; step <= 340; step += 1) {
      const value = waveformValueAt(entry.trace, CARDIAC_PHASE.atrialCWave + step / 1000)
      if (value < previous - 1e-9) falls += 1
      previous = value
    }
    expect(falls).toBe(0)
  })
})

describe('an unavailable mixed-venous sample says why (L9-04)', () => {
  it('does not say "before PA" with the tip beyond the artery', () => {
    const state = capstoneState(808)
    expect(state.catheter.position).toBe('wedge')
    render(<BedsideMonitor state={state} dispatch={jest.fn()} />)
    const rail = screen.getByRole('group', { name: 'Mixed venous oxygen saturation' })
    expect(rail.textContent).not.toMatch(/before PA/)
    // And no value is supplied for it.
    expect(rail.querySelector('strong')?.textContent).toBe('—')
  })
})

describe('a control is offered only where its effect can be seen (L2-13)', () => {
  it('offers no arterial scale control beside a catheter-channel-only monitor', () => {
    const state = cleanState(510, 'pa')
    const presentation = hemodynamicsTaskPresentation('pressure-system', {
      surface: 'line',
      interaction: { kind: 'simulator-task', goals: [] },
    } as never)
    expect(presentation.monitor).toBe('pac')
    render(
      <HemodynamicsSimulatorPane
        state={state}
        dispatch={jest.fn()}
        surface="line"
        flushLine="pulmonary-artery"
        controlsEnabled
        chamberLabel="shown"
        stops={[]}
        tipVisible
        presentation={presentation}
      />,
    )
    expect(document.getElementById('hemodynamics-control-scale')).toBeNull()
    expect(document.getElementById('hemodynamics-control-level')).not.toBeNull()
  })
})

describe('a pure offset keeps one axis (L2-06)', () => {
  it('draws the same axis ticks before and after the transducer is lowered', () => {
    const baseline = cleanState(510, 'pa')
    const presentation = hemodynamicsTaskPresentation('pressure-system', {
      surface: 'level-demo',
      interaction: { kind: 'read' },
    } as never)
    const ticks = () =>
      [...document.querySelectorAll('figure')]
        .filter((figure) => figure.querySelector('figcaption strong')?.textContent === 'PAP')
        .flatMap((figure) => [...figure.querySelectorAll('*')])
        .filter((node) => node.children.length === 0 && /^-?\d+$/.test(node.textContent ?? ''))
        .map((node) => node.textContent)
        .sort()
    const pane = (state: typeof baseline) => (
      <HemodynamicsSimulatorPane
        state={state}
        dispatch={jest.fn()}
        surface="level-demo"
        flushLine="pulmonary-artery"
        controlsEnabled
        chamberLabel="shown"
        stops={[]}
        tipVisible
        presentation={presentation}
        baseline={baseline}
      />
    )
    const { rerender } = render(pane(baseline))
    const before = ticks()
    expect(before.length).toBeGreaterThan(0)
    rerender(
      pane(
        reduceAll(baseline, [
          { type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 },
          { type: 'TICK', seconds: 2 },
        ]),
      ),
    )
    expect(ticks()).toEqual(before)
  })
})

describe('Practice copy and landmarks (P-07)', () => {
  it('renders no second main landmark and does not call the cases "preserved"', () => {
    const { container } = render(<IcuHemodynamicsPracticeLandingV2 />)
    expect(container.querySelector('main')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/preserved/i)
  })

  it('has no learner-facing qualifier that ends in a dangling preposition', () => {
    for (const record of cardiacOutputAcquisitionParameters) {
      expect(record.learnerFacingQualifier).not.toMatch(/\boutside of\.(\s|$)/)
    }
  })
})
