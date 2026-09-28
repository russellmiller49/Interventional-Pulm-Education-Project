import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ModuleFrameV2, type ModuleFrameV2Props } from '../ModuleFrameV2'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const baseProps: Omit<ModuleFrameV2Props, 'children'> = {
  eyebrow: 'Eyebrow',
  title: 'Module title',
  activeHref: '/module',
  navItems: [
    { title: 'Overview', href: '/module', description: 'Map' },
    { title: 'Learn', href: '/module/learn', description: 'Sections' },
  ],
  navAriaLabel: 'Module sections',
  safetyNotice: <strong>For education only.</strong>,
}

const body = <div data-testid="module-body">Module body</div>

function frameRoot(container: HTMLElement): Element {
  const frame = container.querySelector('[data-learning-module-v2-theme-root]')
  if (!frame) throw new Error('shared frame root not found')
  return frame
}

function childTags(container: HTMLElement): string[] {
  return Array.from(frameRoot(container).children).map((child) => child.tagName.toLowerCase())
}

describe('shared module frame: sponsorship disclosure slot', () => {
  it.each([
    ['left out', undefined],
    ['null', null],
    ['false', false],
    ['an empty string', ''],
  ])('renders nothing for it when the notice is %s', (_label, sponsorNotice) => {
    const { container } = render(
      <ModuleFrameV2 {...baseProps} sponsorNotice={sponsorNotice}>
        {body}
      </ModuleFrameV2>,
    )

    expect(container.querySelector('[data-sponsor-notice]')).toBeNull()
    expect(container.querySelector('aside')).toBeNull()
    expect(childTags(container)).toEqual(['header', 'nav', 'section', 'div'])
  })

  it('prints the notice between the safety notice and the page', () => {
    const { container } = render(
      <ModuleFrameV2 {...baseProps} sponsorNotice="Supported by an education grant.">
        {body}
      </ModuleFrameV2>,
    )

    expect(childTags(container)).toEqual(['header', 'nav', 'section', 'aside', 'div'])

    const notice = screen.getByRole('note', { name: 'Sponsorship disclosure' })
    expect(notice.tagName).toBe('ASIDE')
    expect(notice).toHaveTextContent('Supported by an education grant.')
    expect(notice.previousElementSibling).toBe(
      screen.getByRole('note', { name: 'Educational safety notice' }),
    )
    expect(notice.nextElementSibling).toBe(screen.getByTestId('module-body'))
  })

  it('accepts markup, including a link', () => {
    render(
      <ModuleFrameV2
        {...baseProps}
        sponsorNotice={
          <>
            <strong>Sponsored.</strong>{' '}
            <a href="https://example.org/sponsorship">How sponsorship works</a>
          </>
        }
      >
        {body}
      </ModuleFrameV2>,
    )

    const notice = screen.getByRole('note', { name: 'Sponsorship disclosure' })
    expect(notice).toContainElement(screen.getByRole('link', { name: 'How sponsorship works' }))
  })

  it('leaves the notice out of a lesson, where the frame chrome is hidden', () => {
    const { container } = render(
      <ModuleFrameV2 {...baseProps} activityMode sponsorNotice="Supported by an education grant.">
        {body}
      </ModuleFrameV2>,
    )
    const frame = frameRoot(container)

    expect(screen.queryByRole('note', { name: 'Sponsorship disclosure' })).toBeNull()
    expect(container.querySelector('[data-sponsor-notice]')).toBeNull()
    expect(childTags(container)).toEqual(['header', 'nav', 'section', 'div'])
    expect(frame.lastElementChild?.tagName).toBe('DIV')
    expect(frame.lastElementChild).toContainElement(screen.getByTestId('module-body'))
    expect(Array.from(frame.children).filter((child) => child.tagName === 'DIV')).toHaveLength(1)
  })

  it('has no accessibility violations inside a module page', async () => {
    const { container } = render(
      <main>
        <ModuleFrameV2 {...baseProps} sponsorNotice="Supported by an education grant.">
          <h1>Page heading</h1>
          {body}
        </ModuleFrameV2>
      </main>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })

  it('is styled without touching the activity-mode rules', () => {
    const stylesheet = readFileSync(
      join(process.cwd(), 'src/features/learning-module/components/learning-module-v2.module.css'),
      'utf8',
    )

    expect(stylesheet).toMatch(/^\.sponsorNotice \{/m)
    // The hidden-chrome rule is unchanged: header, navigation, safety notice, and nothing else.
    expect(stylesheet).toContain(
      [
        ".moduleFrame[data-activity-frame='true'] > .moduleHeader,",
        ".moduleFrame[data-activity-frame='true'] > .moduleNav,",
        ".moduleFrame[data-activity-frame='true'] > .safetyNotice {",
        '  display: none;',
        '}',
      ].join('\n'),
    )
  })
})
