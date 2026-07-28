import { render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

const mockRouterPush = jest.fn()
const mockIcuSimulatorLab = jest.fn(
  (props: {
    mode: string
    locale?: string
    initialScenarioId?: string
    availableScenarioIds?: readonly string[]
    embedded?: boolean
  }) => (
    <div
      data-testid="icu-simulator-lab"
      data-mode={props.mode}
      data-scenario={props.initialScenarioId}
      data-available={props.availableScenarioIds?.join(',')}
      data-embedded={props.embedded || undefined}
    />
  ),
)

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
  useRouter: () => ({ push: mockRouterPush }),
}))

jest.mock('../components/IcuSimulatorLab', () => ({
  IcuSimulatorLab: (props: Parameters<typeof mockIcuSimulatorLab>[0]) => mockIcuSimulatorLab(props),
}))

import { IcuCapstoneEntry } from '../components/IcuCapstoneEntry'

describe('integrated ICU capstone entry', () => {
  beforeEach(() => mockRouterPush.mockReset())

  beforeEach(() => {
    mockIcuSimulatorLab.mockClear()
  })

  it('keeps Practice open and names the selected scenario', async () => {
    render(<IcuCapstoneEntry mode="practice" locale="en" />)

    expect(await screen.findByTestId('icu-simulator-lab')).toHaveAttribute(
      'data-scenario',
      'hemorrhagic',
    )
    expect(screen.getByTestId('icu-simulator-lab')).toHaveAttribute('data-embedded', 'true')
    expect(
      screen.getByTestId('icu-simulator-lab').closest('[data-icu-capstone-active]'),
    ).toHaveAttribute('data-icu-capstone-active', 'practice')
    expect(
      screen.getByRole('heading', { name: 'Active hemorrhagic hypovolemic shock' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/scenario remains available regardless of saved history/i),
    ).toBeInTheDocument()
  })

  it('keeps the capstone mobile gate pointed at the ICU Overview text alternative', async () => {
    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 })

    const rendered = render(<IcuCapstoneEntry mode="practice" locale="en" />)
    try {
      expect(
        await screen.findByRole('heading', { name: 'A larger screen is recommended' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open lightweight alternative' })).toHaveAttribute(
        'href',
        '/icu-simulation',
      )
      expect(screen.queryByTestId('icu-simulator-lab')).not.toBeInTheDocument()
    } finally {
      rendered.unmount()
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: originalWidth,
      })
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: originalHeight,
      })
    }
  })

  it('opens a requested Practice scenario directly without consulting history', async () => {
    render(<IcuCapstoneEntry mode="practice" locale="en" requestedScenarioId="lv-cardiogenic" />)

    expect(await screen.findByTestId('icu-simulator-lab')).toHaveAttribute(
      'data-scenario',
      'lv-cardiogenic',
    )
    expect(
      screen.getByRole('heading', { name: 'LV cardiogenic shock with pulmonary edema' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/optional refreshers and never prevent entry/i)).toBeInTheDocument()
  })

  it('opens a requested Challenge directly without an entry lock', async () => {
    render(<IcuCapstoneEntry mode="assess" locale="en" requestedScenarioId="lv-cardiogenic" />)

    expect(await screen.findByTestId('icu-simulator-lab')).toHaveAttribute(
      'data-scenario',
      'lv-cardiogenic',
    )
    expect(screen.queryByText(/locked|prerequisite/i)).not.toBeInTheDocument()
  })

  it('names every open Challenge in the chooser', async () => {
    render(<IcuCapstoneEntry mode="assess" locale="en" />)

    expect(
      await screen.findByRole('heading', { name: 'Harder cases, open from the start' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Open challenge' })).toHaveLength(6)
    expect(screen.getByText('Sepsis + ARDS + AKI')).toBeInTheDocument()
    expect(screen.getByText('LV cardiogenic shock')).toBeInTheDocument()
    expect(screen.queryByText(/masked|locked/i)).not.toBeInTheDocument()
  })

  it('mounts only the selected Challenge and passes no focused raw state', async () => {
    render(<IcuCapstoneEntry mode="assess" locale="en" requestedScenarioId="lv-cardiogenic" />)

    expect(await screen.findByTestId('icu-simulator-lab')).toHaveAttribute(
      'data-available',
      'lv-cardiogenic',
    )
    await waitFor(() => expect(mockIcuSimulatorLab).toHaveBeenCalledTimes(1))
    expect(mockIcuSimulatorLab.mock.calls[0]?.[0]).toEqual({
      mode: 'assess',
      locale: 'en',
      initialScenarioId: 'lv-cardiogenic',
      availableScenarioIds: ['lv-cardiogenic'],
      embedded: true,
    })
    expect(JSON.stringify(mockIcuSimulatorLab.mock.calls[0]?.[0])).not.toMatch(
      /activities|waveform|commands|replay|patient|deviceState|focusedState/i,
    )
  })
})
