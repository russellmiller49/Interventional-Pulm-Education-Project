import { render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { axe } from 'jest-axe'

import {
  MedicalThoracoscopyModuleFrame,
  medicalThoracoscopyNavItems,
} from '../components/MedicalThoracoscopyModuleFrame'

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

const body = <p data-testid="page-body">Page body</p>

describe('medical thoracoscopy module frame', () => {
  it('names the five tabs in order, with Cases at the assess address', () => {
    expect(medicalThoracoscopyNavItems.map((item) => [item.title, item.href])).toEqual([
      ['Overview', '/medical-thoracoscopy'],
      ['Learn', '/medical-thoracoscopy/learn'],
      ['Practice', '/medical-thoracoscopy/practice'],
      ['Cases', '/medical-thoracoscopy/assess'],
      ['Reference', '/medical-thoracoscopy/reference'],
    ])

    render(
      <MedicalThoracoscopyModuleFrame activeHref="/medical-thoracoscopy/learn">
        {body}
      </MedicalThoracoscopyModuleFrame>,
    )
    const nav = screen.getByRole('navigation', { name: 'Medical thoracoscopy sections' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(medicalThoracoscopyNavItems.map((item) => expect.stringContaining(item.title)))
  })

  it('marks its content English, and says so on another locale', () => {
    const { container, rerender } = render(
      <MedicalThoracoscopyModuleFrame activeHref="/medical-thoracoscopy">
        {body}
      </MedicalThoracoscopyModuleFrame>,
    )
    expect(container.querySelector('main')).toHaveAttribute('lang', 'en')
    expect(screen.queryByText(/written in English only/)).not.toBeInTheDocument()

    rerender(
      <MedicalThoracoscopyModuleFrame locale="es" activeHref="/medical-thoracoscopy">
        {body}
      </MedicalThoracoscopyModuleFrame>,
    )
    expect(screen.getByText(/written in English only/)).toBeInTheDocument()
    expect(container.querySelector('main')).toHaveAttribute('lang', 'en')
  })

  it('shows the safety boundary and the release stage', () => {
    render(
      <MedicalThoracoscopyModuleFrame activeHref="/medical-thoracoscopy">
        {body}
      </MedicalThoracoscopyModuleFrame>,
    )
    const notice = screen.getByRole('note', { name: 'Educational safety notice' })

    expect(notice).toHaveTextContent('For education only')
    expect(notice).toHaveTextContent('Completing the course is not competence')
    expect(screen.getByText('In development · direct link')).toBeInTheDocument()
  })

  it('shows no sponsorship disclosure until the owner approves its wording', () => {
    render(
      <MedicalThoracoscopyModuleFrame activeHref="/medical-thoracoscopy">
        {body}
      </MedicalThoracoscopyModuleFrame>,
    )

    expect(screen.queryByRole('note', { name: 'Sponsorship disclosure' })).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/sponsor|Richard Wolf/i)
  })

  it('hands a lesson the viewport without its chrome', () => {
    const { container } = render(
      <MedicalThoracoscopyModuleFrame activeHref="/medical-thoracoscopy/learn" activityMode>
        {body}
      </MedicalThoracoscopyModuleFrame>,
    )

    expect(container.querySelector('main')).toHaveAttribute('data-activity-mode', 'true')
    expect(container.querySelector('[data-activity-frame]')).toContainElement(
      screen.getByTestId('page-body'),
    )
  })

  it('has no automatically detectable accessibility problems', async () => {
    const { container } = render(
      <MedicalThoracoscopyModuleFrame locale="zh-CN" activeHref="/medical-thoracoscopy">
        {body}
      </MedicalThoracoscopyModuleFrame>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
