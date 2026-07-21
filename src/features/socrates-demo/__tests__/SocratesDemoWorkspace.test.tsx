import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('../components/SocratesDemo', () => ({
  SocratesDemo: () => <div data-testid="demo-view">Demo viewer</div>,
}))

jest.mock('@/features/socrates-builder/components/SocratesBuilder', () => ({
  SocratesBuilder: ({ mode }: { mode: string }) => (
    <div data-testid="builder-view">Builder {mode}</div>
  ),
}))

import { createStarterSocratesDocument } from '@/features/socrates-builder/content/starter-document'

import { SocratesDemoWorkspace } from '../components/SocratesDemoWorkspace'

describe('SOCRATES combined demo workspace', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/en/socrates-demo')
  })

  it('opens the functional demo and switches to the no-login builder on the same path', async () => {
    const user = userEvent.setup()
    render(
      <SocratesDemoWorkspace
        publishedDocument={null}
        sandboxDocuments={[createStarterSocratesDocument()]}
      />,
    )

    expect(screen.getByTestId('demo-view')).toBeVisible()
    expect(screen.getByRole('button', { name: /Build a slide/ })).toHaveTextContent(
      '1 shared sandbox drafts',
    )

    await user.click(screen.getByRole('button', { name: /Build a slide/ }))

    expect(screen.getByTestId('builder-view')).toHaveTextContent('Builder sandbox')
    expect(window.location.pathname).toBe('/en/socrates-demo')
    expect(window.location.hash).toBe('#builder')
  })

  it('opens the builder directly from the shareable hash', async () => {
    window.history.replaceState(null, '', '/en/socrates-demo#builder')
    render(<SocratesDemoWorkspace publishedDocument={null} sandboxDocuments={[]} />)

    expect(await screen.findByTestId('builder-view')).toBeVisible()
    expect(screen.queryByTestId('demo-view')).not.toBeInTheDocument()
  })
})
