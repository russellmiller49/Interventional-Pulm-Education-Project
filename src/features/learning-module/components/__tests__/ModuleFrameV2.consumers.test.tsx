import { render } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BaxterCrrtModuleFrame } from '@/features/baxter-crrt/components/BaxterCrrtModuleFrame'
import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { CardiohelpModuleFrame } from '@/features/cardiohelp-ecmo/components/CardiohelpModuleFrame'
import { EbusModuleFrame } from '@/features/ebus-guided/components/ModuleFrame'
import { IcuHemodynamicsModuleFrameV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2'
import { McsModuleFrame } from '@/features/mechanical-circulatory-support/components/McsModuleFrame'
import { MechanicalVentilationModuleFrame } from '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrame'
import { MedicalThoracoscopyModuleFrame } from '@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame'
import { PeripheralImagingModuleFrame } from '@/features/peripheral-imaging/components/PeripheralImagingModuleFrame'

import { ModuleFrameV2 } from '../ModuleFrameV2'

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

/**
 * What the shared frame puts directly inside its root, in order. Module stylesheets select on
 * this: several reach the activity body as `[data-activity-frame] > div:last-child`, and
 * Mechanical Ventilation as `[data-activity-frame='true'] > div`. Anything added to the frame
 * has to leave these shapes alone for every module that does not opt in.
 */
function frameChildren(container: HTMLElement): string[] {
  const frame = container.querySelector('[data-learning-module-v2-theme-root]')
  if (!frame) throw new Error('shared frame root not found')
  return Array.from(frame.children).map((child) => {
    const tag = child.tagName.toLowerCase()
    const role = child.getAttribute('role')
    return role ? `${tag}[role=${role}]` : tag
  })
}

const body = <div data-testid="module-body">Module body</div>

const chrome = ['header', 'nav', 'section[role=note]']

type FrameCase = {
  readonly name: string
  readonly english: ReactElement
  readonly otherLocale: ReactElement
  readonly activity: ReactElement
  /** The element each module uses for its own English-content notice. */
  readonly localeNotice: string
}

const consumers: readonly FrameCase[] = [
  {
    name: 'Baxter CRRT',
    english: (
      <BaxterCrrtModuleFrame locale="en" activeHref="/baxter-crrt">
        {body}
      </BaxterCrrtModuleFrame>
    ),
    otherLocale: (
      <BaxterCrrtModuleFrame locale="es" activeHref="/baxter-crrt">
        {body}
      </BaxterCrrtModuleFrame>
    ),
    activity: (
      <BaxterCrrtModuleFrame locale="en" activeHref="/baxter-crrt/practice" activityMode>
        {body}
      </BaxterCrrtModuleFrame>
    ),
    localeNotice: 'div[role=note]',
  },
  {
    name: 'Bronchoscopy Foundations',
    english: (
      <BronchoscopyFoundationsModuleFrame locale="en" activeHref="/bronchoscopy-foundations">
        {body}
      </BronchoscopyFoundationsModuleFrame>
    ),
    otherLocale: (
      <BronchoscopyFoundationsModuleFrame locale="es" activeHref="/bronchoscopy-foundations">
        {body}
      </BronchoscopyFoundationsModuleFrame>
    ),
    activity: (
      <BronchoscopyFoundationsModuleFrame
        locale="en"
        activeHref="/bronchoscopy-foundations/learn"
        activityMode
      >
        {body}
      </BronchoscopyFoundationsModuleFrame>
    ),
    localeNotice: 'div[role=note]',
  },
  {
    name: 'Cardiohelp ECMO',
    english: (
      <CardiohelpModuleFrame locale="en" activeHref="/cardiohelp-ecmo">
        {body}
      </CardiohelpModuleFrame>
    ),
    otherLocale: (
      <CardiohelpModuleFrame locale="es" activeHref="/cardiohelp-ecmo">
        {body}
      </CardiohelpModuleFrame>
    ),
    activity: (
      <CardiohelpModuleFrame locale="en" activeHref="/cardiohelp-ecmo/practice" activityMode>
        {body}
      </CardiohelpModuleFrame>
    ),
    localeNotice: 'div[role=note]',
  },
  {
    name: 'EBUS guided course',
    english: (
      <EbusModuleFrame locale="en" active="Overview">
        {body}
      </EbusModuleFrame>
    ),
    otherLocale: (
      <EbusModuleFrame locale="es" active="Overview">
        {body}
      </EbusModuleFrame>
    ),
    activity: (
      <EbusModuleFrame locale="en" active="Learn" activity>
        {body}
      </EbusModuleFrame>
    ),
    localeNotice: 'p[role=note]',
  },
  {
    name: 'ICU Hemodynamics',
    english: (
      <IcuHemodynamicsModuleFrameV2 locale="en" activeHref="/icu-hemodynamics">
        {body}
      </IcuHemodynamicsModuleFrameV2>
    ),
    otherLocale: (
      <IcuHemodynamicsModuleFrameV2 locale="es" activeHref="/icu-hemodynamics">
        {body}
      </IcuHemodynamicsModuleFrameV2>
    ),
    activity: (
      <IcuHemodynamicsModuleFrameV2 locale="en" activeHref="/icu-hemodynamics/learn" activityMode>
        {body}
      </IcuHemodynamicsModuleFrameV2>
    ),
    localeNotice: 'div[role=note]',
  },
  {
    name: 'Mechanical Circulatory Support',
    english: (
      <McsModuleFrame locale="en" activeHref="/mechanical-circulatory-support">
        {body}
      </McsModuleFrame>
    ),
    otherLocale: (
      <McsModuleFrame locale="es" activeHref="/mechanical-circulatory-support">
        {body}
      </McsModuleFrame>
    ),
    activity: (
      <McsModuleFrame locale="en" activeHref="/mechanical-circulatory-support/learn" activityMode>
        {body}
      </McsModuleFrame>
    ),
    localeNotice: 'div[role=note]',
  },
  {
    name: 'Mechanical Ventilation',
    english: (
      <MechanicalVentilationModuleFrame locale="en" activeHref="/mechanical-ventilation">
        {body}
      </MechanicalVentilationModuleFrame>
    ),
    otherLocale: (
      <MechanicalVentilationModuleFrame locale="es" activeHref="/mechanical-ventilation">
        {body}
      </MechanicalVentilationModuleFrame>
    ),
    activity: (
      <MechanicalVentilationModuleFrame
        locale="en"
        activeHref="/mechanical-ventilation/learn"
        activityMode
      >
        {body}
      </MechanicalVentilationModuleFrame>
    ),
    localeNotice: 'div[role=note]',
  },
  {
    name: 'Peripheral Imaging',
    english: (
      <PeripheralImagingModuleFrame locale="en" activeHref="/peripheral-imaging">
        {body}
      </PeripheralImagingModuleFrame>
    ),
    otherLocale: (
      <PeripheralImagingModuleFrame locale="es" activeHref="/peripheral-imaging">
        {body}
      </PeripheralImagingModuleFrame>
    ),
    activity: (
      <PeripheralImagingModuleFrame locale="en" activeHref="/peripheral-imaging/learn" activityMode>
        {body}
      </PeripheralImagingModuleFrame>
    ),
    localeNotice: 'div[role=note]',
  },
  {
    name: 'Medical Thoracoscopy',
    english: (
      <MedicalThoracoscopyModuleFrame locale="en" activeHref="/medical-thoracoscopy">
        {body}
      </MedicalThoracoscopyModuleFrame>
    ),
    otherLocale: (
      <MedicalThoracoscopyModuleFrame locale="es" activeHref="/medical-thoracoscopy">
        {body}
      </MedicalThoracoscopyModuleFrame>
    ),
    activity: (
      <MedicalThoracoscopyModuleFrame
        locale="en"
        activeHref="/medical-thoracoscopy/learn"
        activityMode
      >
        {body}
      </MedicalThoracoscopyModuleFrame>
    ),
    localeNotice: 'div[role=note]',
  },
]

/**
 * Every file that renders the shared frame. Therapeutic Bronchoscopy mounts a whole simulator
 * around it, so it is pinned through its source rather than rendered here.
 */
const consumerSources = [
  'src/features/baxter-crrt/components/BaxterCrrtModuleFrame.tsx',
  'src/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame.tsx',
  'src/features/cardiohelp-ecmo/components/CardiohelpModuleFrame.tsx',
  'src/features/ebus-guided/components/ModuleFrame.tsx',
  'src/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2.tsx',
  'src/features/mechanical-circulatory-support/components/McsModuleFrame.tsx',
  'src/features/mechanical-ventilation/components/MechanicalVentilationModuleFrame.tsx',
  'src/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame.tsx',
  'src/features/peripheral-imaging/components/PeripheralImagingModuleFrame.tsx',
  'src/features/therapeutic-bronchoscopy/TherapeuticBronchoscopyModule.tsx',
]

describe('shared module frame: what its consumers receive', () => {
  describe.each(consumers)('$name', ({ english, otherLocale, activity, localeNotice }) => {
    it('puts header, navigation and safety notice ahead of the page', () => {
      const { container, getByTestId } = render(english)

      expect(frameChildren(container)).toEqual([...chrome, 'div'])
      expect(getByTestId('module-body').parentElement).toHaveAttribute(
        'data-learning-module-v2-theme-root',
      )
    })

    it('adds only its own English-content notice on another locale', () => {
      const { container } = render(otherLocale)

      expect(frameChildren(container)).toEqual([...chrome, localeNotice, 'div'])
    })

    it('hands a lesson one body, the only div and the last child', () => {
      const { container, getByTestId } = render(activity)
      const frame = container.querySelector('[data-learning-module-v2-theme-root]')

      expect(frame).toHaveAttribute('data-activity-frame', 'true')
      expect(frameChildren(container)).toEqual([...chrome, 'div'])
      expect(frame?.lastElementChild?.tagName).toBe('DIV')
      expect(frame?.lastElementChild).toContainElement(getByTestId('module-body'))
    })
  })

  it('renders the same shape with no wrapper around it', () => {
    const props = {
      eyebrow: 'Eyebrow',
      title: 'Title',
      activeHref: '/module',
      navItems: [{ title: 'Overview', href: '/module', description: 'Map' }],
      safetyNotice: 'For education only.',
    }

    const page = render(<ModuleFrameV2 {...props}>{body}</ModuleFrameV2>)
    expect(frameChildren(page.container)).toEqual([...chrome, 'div'])
    expect(
      page.container.querySelector('[data-learning-module-v2-theme-root]'),
    ).not.toHaveAttribute('data-activity-frame')
    page.unmount()

    const lesson = render(
      <ModuleFrameV2 {...props} activityMode>
        {body}
      </ModuleFrameV2>,
    )
    expect(frameChildren(lesson.container)).toEqual([...chrome, 'div'])
  })

  it('names the safety notice for assistive technology', () => {
    const { getByRole } = render(consumers[0].english)

    expect(getByRole('note', { name: 'Educational safety notice' })).toBeInTheDocument()
  })

  it.each(consumerSources)('%s renders the shared frame', (path) => {
    const source = readFileSync(join(process.cwd(), path), 'utf8')

    expect(source).toMatch(/<ModuleFrameV2\b/)
  })

  it('lists every file that renders the shared frame', () => {
    // A new consumer must be added above, so it is characterised before the frame changes.
    const found = readdirSync(join(process.cwd(), 'src'), { recursive: true, encoding: 'utf8' })
      .filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
      .map((path) => join('src', path))
      .filter((path) => readFileSync(join(process.cwd(), path), 'utf8').includes('<ModuleFrameV2'))
      .sort()

    expect(found).toEqual([...consumerSources].sort())
  })
})
