import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { readProgress } from '../engine'
import { MechanicalVentilationAssessSetupV2 } from '../components/MechanicalVentilationAssessSetupV2'

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

  it('opens the locally varied challenge after the console is fixed', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_721_670_000_000)
    render(<MechanicalVentilationAssessSetupV2 />)

    await waitFor(() => expect(screen.getByRole('button', { name: /Dräger Evita/i })).toBeVisible())
    fireEvent.click(screen.getByRole('button', { name: /Dräger Evita/i }))
    expect(screen.queryByRole('button', { name: /Open challenge/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Keep this console/i }))
    fireEvent.click(screen.getByRole('button', { name: /Open challenge/i }))

    expect(readProgress().lastDeviceId).toBe('drager-evita-v800-v600')
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/mechanical-ventilation\/assess\?case=masked-seeded&seed=[a-z0-9-]+&device=drager-evita-v800-v600$/,
      ),
    )
    jest.restoreAllMocks()
  })
})
