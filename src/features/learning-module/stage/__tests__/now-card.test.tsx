import { cleanup, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { FlowContent } from '../FlowContent'
import { NowCard, type NowCardModel } from '../NowCard'

/**
 * The two Now card options ported from the ECMO shell in October 2026 — the pinned action row and
 * the primary action ahead of the card's body — and the shared flow body. Both options are opt-in:
 * a card that passes neither renders exactly the markup every adopter had before.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

const base: NowCardModel = {
  kicker: 'Task 2 of 6 · Act',
  heading: 'Set PEEP to 10',
  body: 'Open Controls on the console, then select PEEP.',
  primary: { label: 'Continue', onActivate: () => undefined },
  secondary: { label: 'Show me where', onActivate: () => undefined },
  why: 'A change you can see is a change you can explain.',
}

function card(model: NowCardModel) {
  render(
    <NowCard model={model}>
      <p data-testid="body-child">Goal list</p>
    </NowCard>,
  )
  return document.querySelector('[data-now-card]') as HTMLElement
}

describe('NowCard options', () => {
  it('renders the unpinned markup unchanged when neither option is passed', () => {
    const root = card(base)
    expect(root.hasAttribute('data-pinned-actions')).toBe(false)
    expect(root.querySelector('[data-now-footer]')).toBeNull()
    // Actions follow the children; the disclosure is last.
    const order = [...root.children].map(
      (el) =>
        el.getAttribute('data-testid') ??
        (el.querySelector('[data-now-primary]') ? 'actions' : null) ??
        (el.hasAttribute('data-now-why') ? 'why' : el.tagName.toLowerCase()),
    )
    expect(order.indexOf('body-child')).toBeLessThan(order.indexOf('actions'))
    expect(order.indexOf('actions')).toBeLessThan(order.indexOf('why'))
  })

  it('pins the action row: data-now-footer="pinned" as the last child, after the disclosure', () => {
    const root = card({ ...base, pinActions: true })
    expect(root.hasAttribute('data-pinned-actions')).toBe(true)
    const footer = root.querySelector('[data-now-footer="pinned"]')
    expect(footer).not.toBeNull()
    expect(root.lastElementChild).toBe(footer)
    expect(footer!.querySelector('[data-now-primary]')).not.toBeNull()
    expect(footer!.querySelector('[data-now-secondary]')).not.toBeNull()
    const why = root.querySelector('[data-now-why]')!
    expect(why.compareDocumentPosition(footer!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the disabled reason inside the pinned row', () => {
    const root = card({
      ...base,
      pinActions: true,
      primary: { label: 'Continue', disabled: true, disabledReason: 'Set PEEP first.' },
    })
    const footer = root.querySelector('[data-now-footer="pinned"]')!
    expect(footer.querySelector('[data-now-disabled-reason]')?.textContent).toBe('Set PEEP first.')
  })

  it('does not pin a card that has no actions', () => {
    const root = card({ ...base, primary: undefined, secondary: undefined, pinActions: true })
    expect(root.hasAttribute('data-pinned-actions')).toBe(false)
    expect(root.querySelector('[data-now-footer]')).toBeNull()
  })

  it('puts the primary before the children in DOM order with primaryBeforeContent', () => {
    const root = card({ ...base, primaryBeforeContent: true })
    const primary = screen.getByRole('button', { name: 'Continue' })
    const child = screen.getByTestId('body-child')
    expect(primary.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(root.querySelectorAll('[data-now-primary]')).toHaveLength(1)
    // The secondary stays in the action row after the children.
    const secondary = screen.getByRole('button', { name: 'Show me where' })
    expect(child.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('FlowContent', () => {
  it('orders teaching then visual by default, and the visual first on request', () => {
    const { rerender } = render(
      <FlowContent kind="console-lab" teaching={<p>Teach</p>} visual={<p>Console</p>}>
        <p>Response</p>
      </FlowContent>,
    )
    let root = document.querySelector('[data-flow-content]') as HTMLElement
    expect(root.getAttribute('data-flow-content')).toBe('console-lab')
    expect(root.firstElementChild?.hasAttribute('data-flow-teaching')).toBe(true)
    rerender(
      <FlowContent kind="console-lab" teaching={<p>Teach</p>} visual={<p>Console</p>} visualFirst>
        <p>Response</p>
      </FlowContent>,
    )
    root = document.querySelector('[data-flow-content]') as HTMLElement
    expect(root.firstElementChild?.hasAttribute('data-flow-visual')).toBe(true)
    expect(root.getAttribute('data-visual-first')).toBe('true')
  })

  it('is a single reading column without a visual', () => {
    render(<FlowContent kind="concept" teaching={<p>Teach</p>} visualFirst />)
    const root = document.querySelector('[data-flow-content]') as HTMLElement
    expect(root.hasAttribute('data-has-visual')).toBe(false)
    expect(root.hasAttribute('data-visual-first')).toBe(false)
    expect(root.querySelector('[data-flow-visual]')).toBeNull()
  })
})
