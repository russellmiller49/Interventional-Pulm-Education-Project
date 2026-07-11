import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StentExampleGallery } from '../components/StentExampleGallery'

jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-canvas">{children}</div>
  ),
}))

jest.mock('@react-three/drei', () => ({
  useProgress: () => ({ active: false, progress: 100 }),
}))

jest.mock('framer-motion', () => ({
  useReducedMotion: () => true,
}))

jest.mock('../components/StentExampleScene', () => ({
  ModelLoading: () => null,
  StentExampleScene: ({ asset }: { asset: { label: string } }) => (
    <div>Rendered specimen: {asset.label}</div>
  ),
}))

describe('StentExampleGallery', () => {
  it('keeps the mechanical explanation and markers hidden until commitment', async () => {
    const user = userEvent.setup()
    render(<StentExampleGallery />)

    expect(screen.getByRole('heading', { name: '3D Mechanics Casebook' })).toBeInTheDocument()
    expect(screen.queryByText('Numbered teaching markers')).not.toBeInTheDocument()
    expect(screen.queryByText(/An eccentric lesion can preserve/i)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Minimum lumen or area retention plus contact distribution',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Lock prediction and run example' }))

    expect(screen.getByText('Mechanically sound.')).toBeInTheDocument()
    expect(screen.getByText(/An eccentric lesion can preserve/i)).toBeInTheDocument()
    expect(screen.getByText('Numbered teaching markers')).toBeInTheDocument()
    expect(screen.getByText(/Reduced motion is enabled/i)).toBeInTheDocument()
  })

  it('resets the reveal state when the learner changes examples', async () => {
    const user = userEvent.setup()
    render(<StentExampleGallery />)

    await user.click(
      screen.getByRole('button', {
        name: 'Minimum lumen or area retention plus contact distribution',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Lock prediction and run example' }))
    expect(screen.getByText('Numbered teaching markers')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Example 3 What adding a cover changes/i }))

    expect(screen.queryByText('Numbered teaching markers')).not.toBeInTheDocument()
    expect(screen.getByText(/After adding a cover/i)).toBeInTheDocument()
  })
})
