import { fireEvent, render, screen } from '@testing-library/react'

import { NormalWaveformReference } from '../components/NormalWaveformReference'
import { WaveformAtlasFigure } from '../components/WaveformAtlasFigure'
import { waveformAtlasById } from '../content/waveformAtlas'

function traceCoordinates(container: HTMLElement) {
  const path = container.querySelector('path.atlasTrace')!
  const coordinates = [...path.getAttribute('d')!.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map(
    (match) => ({ x: Number(match[1]), y: Number(match[2]) }),
  )
  return { path, coordinates }
}

describe('atlas display-range integrity', () => {
  it('preserves pressure coordinates when the RA detail axis carries into RV and PA', () => {
    const { container, rerender } = render(<NormalWaveformReference fixedPosition="ra" />)
    fireEvent.click(screen.getByRole('radio', { name: /Low-pressure detail/ }))
    for (const position of ['rv', 'pa'] as const) {
      rerender(<NormalWaveformReference fixedPosition={position} />)
      expect(screen.getByRole('radio', { name: /Low-pressure detail/ })).toBeChecked()
      const { path, coordinates } = traceCoordinates(container)
      expect(Math.min(...coordinates.map(({ y }) => y))).toBeLessThan(66)
      expect(path).toHaveAttribute('clip-path')
      expect(screen.getByText(/Trace exceeds the displayed/)).toBeVisible()
      expect(path.closest('svg')).toHaveAccessibleName(/out-of-range portions are clipped/)
      for (const circle of container.querySelectorAll('.atlasAnnotation circle')) {
        expect(Number(circle.getAttribute('cy'))).toBeGreaterThanOrEqual(66)
        expect(Number(circle.getAttribute('cy'))).toBeLessThanOrEqual(192)
      }
    }
  })

  it('changes only coordinate scale, without flattening sampled peaks or troughs', () => {
    const entry = waveformAtlasById.get('rv-normal')!
    const { container, rerender } = render(<WaveformAtlasFigure entry={entry} scaleMaxMmHg={40} />)
    const wide = traceCoordinates(container).coordinates
    rerender(<WaveformAtlasFigure entry={entry} scaleMaxMmHg={20} />)
    const narrow = traceCoordinates(container).coordinates
    expect(narrow).toHaveLength(wide.length)
    narrow.forEach((point, index) => {
      expect(point.x).toBe(wide[index].x)
      expect(((192 - point.y) / 126) * 20).toBeCloseTo(((192 - wide[index].y) / 126) * 40, 1)
    })
  })

  it('clips below-axis coordinates too and preserves the authored fault and description', () => {
    const entry = waveformAtlasById.get('ra-normal')!
    const { container } = render(
      <WaveformAtlasFigure
        entry={entry}
        fault={{ levelOffsetMmHg: -20 }}
        figureDescription="Authored display-fault example."
      />,
    )
    const { path, coordinates } = traceCoordinates(container)
    expect(Math.max(...coordinates.map(({ y }) => y))).toBeGreaterThan(192)
    expect(path).toHaveAttribute('clip-path')
    expect(path.closest('svg')).toHaveAccessibleName(/Authored display-fault example.*out-of-range/)
    expect(container.querySelectorAll('.atlasAnnotation circle')).toHaveLength(0)
  })

  it('retains the in-range reference and its landmarks without a clipping warning', () => {
    const entry = waveformAtlasById.get('rv-normal')!
    const { container } = render(<WaveformAtlasFigure entry={entry} />)
    const { coordinates } = traceCoordinates(container)
    expect(Math.min(...coordinates.map(({ y }) => y))).toBeGreaterThan(66)
    expect(Math.max(...coordinates.map(({ y }) => y))).toBeLessThanOrEqual(192)
    expect(container.querySelectorAll('.atlasAnnotation circle')).toHaveLength(
      entry.annotations.length,
    )
    expect(screen.queryByText(/Trace exceeds the displayed/)).not.toBeInTheDocument()
  })
})
