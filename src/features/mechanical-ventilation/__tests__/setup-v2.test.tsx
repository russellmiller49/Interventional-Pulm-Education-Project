import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { readProgress } from '../engine'
import { MechanicalVentilationAssessSetupV2 } from '../components/MechanicalVentilationAssessSetupV2'
import { MechanicalVentilationPracticeSetupV2 } from '../components/MechanicalVentilationPracticeSetupV2'

const push = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}))

describe('mechanical ventilation sequential setup', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
  })

  it('separates console, support, and all fifteen cases while persisting the preferred console', async () => {
    render(<MechanicalVentilationPracticeSetupV2 />)

    expect(
      screen.getByRole('heading', { name: 'Choose one training console.' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('MV-01')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Puritan Bennett 980/i }))
    fireEvent.click(screen.getByRole('button', { name: /Save console and continue/i }))
    expect(
      screen.getByRole('heading', { name: 'Choose the amount of guidance.' }),
    ).toBeInTheDocument()
    expect(readProgress().lastDeviceId).toBe('puritan-bennett-980')

    fireEvent.click(screen.getByRole('button', { name: /^Practice/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to cases/i }))
    expect(screen.getByRole('heading', { name: 'Choose one clean case.' })).toBeInTheDocument()

    const caseLinks = screen.getAllByRole('link', { name: 'Start practice attempt' })
    expect(caseLinks).toHaveLength(15)
    expect(caseLinks[0]).toHaveAttribute(
      'href',
      expect.stringContaining('device=puritan-bennett-980&mode=practice'),
    )
  })

  it('draws the masked assessment only after the console is locked', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_721_670_000_000)
    render(<MechanicalVentilationAssessSetupV2 />)

    await waitFor(() => expect(screen.getByRole('button', { name: /Dräger Evita/i })).toBeVisible())
    fireEvent.click(screen.getByRole('button', { name: /Dräger Evita/i }))
    expect(screen.queryByRole('button', { name: /Draw seeded case/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Lock console/i }))
    fireEvent.click(screen.getByRole('button', { name: /Draw seeded case and begin/i }))

    expect(readProgress().lastDeviceId).toBe('drager-evita-v800-v600')
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/mechanical-ventilation\/assess\?case=masked-seeded&seed=[a-z0-9-]+&device=drager-evita-v800-v600$/,
      ),
    )
    jest.restoreAllMocks()
  })
})
