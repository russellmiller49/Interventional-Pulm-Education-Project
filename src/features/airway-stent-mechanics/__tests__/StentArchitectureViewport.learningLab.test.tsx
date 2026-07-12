import { render, screen } from '@testing-library/react'

import { StentArchitectureViewport } from '../components/learning-lab/StentArchitectureViewport'
import { getArchitectureProfile } from '../content/architectureRegistry'

describe('StentArchitectureViewport fallback', () => {
  it('provides an accessible static schematic when WebGL is unavailable', () => {
    const getContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => null)

    render(
      <StentArchitectureViewport
        active
        amplitude={0.72}
        mode="radial"
        playing={false}
        profile={getArchitectureProfile('laser-cut-covered')}
        reducedMotion={false}
        resetVersion={0}
        showAirway
        showCover
      />,
    )

    expect(screen.getByText(/Static accessible view/i)).toBeVisible()
    expect(
      screen.getByRole('img', { name: /Covered laser-cut lattice illustrative architecture/i }),
    ).toBeVisible()
    expect(screen.getByText(/not product CAD or a force model/i)).toBeVisible()
    expect(document.querySelector('canvas')).not.toBeInTheDocument()

    getContext.mockRestore()
  })
})
