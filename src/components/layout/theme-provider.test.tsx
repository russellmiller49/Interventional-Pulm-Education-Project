import { act, fireEvent, render, screen } from '@testing-library/react'

import { ThemeProvider, useTheme } from './theme-provider'

jest.mock('@/i18n/handoff', () => ({
  HandoffContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

/**
 * The site's theme provider when the browser refuses storage (independent review of the medical
 * thoracoscopy stack, R6): a browser that blocks site data can throw from the `localStorage` getter
 * itself, or from `getItem` and `setItem`. The page must still render, the theme must fall back to
 * the default, and a change of theme must apply for the visit without pretending it was saved.
 */
function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <p data-testid="theme">{theme}</p>
      <p data-testid="resolved">{resolvedTheme}</p>
      <button type="button" onClick={() => setTheme('dark')}>
        Dark
      </button>
    </div>
  )
}

const original = Object.getOwnPropertyDescriptor(window, 'localStorage')

function refuseStorage(how: 'getter' | 'methods') {
  if (how === 'getter') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
    return
  }
  const refusing = {
    getItem: jest.fn(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError')
    }),
    setItem: jest.fn(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError')
    }),
    removeItem: jest.fn(),
    clear: jest.fn(),
    key: jest.fn(),
    length: 0,
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: refusing })
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  })
})

afterEach(() => {
  if (original) Object.defineProperty(window, 'localStorage', original)
  window.localStorage.clear()
  document.documentElement.className = ''
})

describe('ThemeProvider', () => {
  it('reads and writes the stored theme as before when storage works', () => {
    window.localStorage.setItem('theme', 'dark')
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    })
    expect(window.localStorage.getItem('theme')).toBe('dark')
  })

  it('saves a return to the theme the visit started with', () => {
    function Both() {
      const { setTheme } = useTheme()
      return (
        <>
          <Probe />
          <button type="button" onClick={() => setTheme('light')}>
            Light
          </button>
        </>
      )
    }
    window.localStorage.setItem('theme', 'light')
    render(
      <ThemeProvider>
        <Both />
      </ThemeProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    })
    expect(window.localStorage.getItem('theme')).toBe('dark')
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    })
    expect(window.localStorage.getItem('theme')).toBe('light')
  })

  it.each(['getter', 'methods'] as const)(
    'renders with the default theme when storage is refused (%s throws)',
    (how) => {
      refuseStorage(how)
      render(
        <ThemeProvider defaultTheme="light">
          <Probe />
        </ThemeProvider>,
      )
      expect(screen.getByTestId('theme')).toHaveTextContent('light')
      expect(document.documentElement).toHaveClass('light')
    },
  )

  it.each(['getter', 'methods'] as const)(
    'changes the theme for the visit when storage is refused (%s throws), and saves nothing',
    (how) => {
      refuseStorage(how)
      render(
        <ThemeProvider defaultTheme="light">
          <Probe />
        </ThemeProvider>,
      )
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
      })
      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
      expect(document.documentElement).toHaveClass('dark')
      if (how === 'methods')
        expect((window.localStorage.setItem as jest.Mock).mock.calls.length).toBeGreaterThan(0)
    },
  )
})
