import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import {
  CRRT_ACCESS_ART_HEIGHT,
  CRRT_ACCESS_ART_WIDTH,
  CrrtAccessSiteFigure,
} from '../components/CrrtAccessSite'
import { CrrtFoundationLesson } from '../components/CrrtFoundationLesson'
import { CrrtPilotCircuit } from '../components/CrrtPilotCircuit'
import {
  CRRT_ACCESS_SITE_IDS,
  crrtAccessSiteTextEquivalent,
  crrtAccessSites,
} from '../content/accessSite'

/**
 * The access-site picture (critical care plan 2026-11-10, CRRT round): the catheter in its vein,
 * as an inset above the PATIENT circle of a lesson's teaching circuit and as an enlarged,
 * labelled figure.
 */

jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}))

beforeEach(() => window.localStorage.clear())

const noPressures = {
  access: null,
  filter: null,
  return: null,
  effluent: null,
  TMP: null,
  filterDrop: null,
}
const picturePane = () => document.querySelector<HTMLElement>('[data-crrt-visual-pane]')!
function renderLesson(lessonId: 'crrt-indications-modality' | 'crrt-circuit-pressures') {
  return render(
    <CrrtFoundationLesson
      lessonId={lessonId}
      onNavigate={() => {}}
      onRestart={() => {}}
      panes="two"
    />,
  )
}

describe('the two sites', () => {
  it('are the right internal jugular and the femoral vein, each with its route and labels', () => {
    expect([...CRRT_ACCESS_SITE_IDS]).toEqual(['jugular', 'femoral'])
    for (const id of CRRT_ACCESS_SITE_IDS) {
      const site = crrtAccessSites[id]
      expect(site.route).toMatch(/Its tip lies/)
      const ids = site.labels.map((label) => label.id)
      for (const required of ['access-limb', 'return-limb', 'vein', 'tip'])
        expect(ids).toContain(required)
      // Every labelled point is inside the drawing, and no two labels share a row.
      for (const label of site.labels) {
        expect(label.at.x).toBeGreaterThanOrEqual(0)
        expect(label.at.x).toBeLessThanOrEqual(CRRT_ACCESS_ART_WIDTH)
        expect(label.at.y).toBeGreaterThanOrEqual(0)
        expect(label.at.y).toBeLessThanOrEqual(CRRT_ACCESS_ART_HEIGHT)
      }
      expect(new Set(site.labels.map((label) => label.row)).size).toBe(site.labels.length)
    }
  })

  it('say the same thing in words: the site, the two limbs and which way blood moves', () => {
    expect(crrtAccessSiteTextEquivalent('jugular')).toMatch(
      /right internal jugular.*superior vena cava meets the right atrium.*access limb, marked A.*return limb, marked V/s,
    )
    expect(crrtAccessSiteTextEquivalent('femoral')).toMatch(
      /femoral.*inferior vena cava.*access limb, marked A.*return limb, marked V/s,
    )
  })

  it('rank no site and state no number', () => {
    const copy = CRRT_ACCESS_SITE_IDS.map(
      (id) => `${crrtAccessSites[id].route} ${crrtAccessSiteTextEquivalent(id)}`,
    ).join(' ')
    expect(copy).not.toMatch(/\d/)
    expect(copy).not.toMatch(/prefer|first choice|avoid|best|should/i)
  })
})

describe('the inset in the circuit', () => {
  it('is not drawn unless a site is passed: every other circuit is as it was', () => {
    render(
      <CrrtPilotCircuit
        presentation="focused"
        overlayId="blood-path"
        running={false}
        setReady
        fluidsReady
        bloodFlowMlMin={null}
        dialysateFlowMlHour={null}
        patientFluidRemovalMlHour={null}
        pressure={noPressures}
      />,
    )
    expect(document.querySelector('[data-crrt-access-site]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Access site' })).toBeNull()
  })

  it('is in the lesson from lesson 1 task 1, in the circuit drawing and in its description', () => {
    renderLesson('crrt-indications-modality')
    const drawing = picturePane().querySelector('svg[data-overlay]')!
    expect(drawing.querySelector('[data-crrt-access-site]')).toHaveAttribute(
      'data-crrt-access-site',
      'jugular',
    )
    expect(drawing.querySelector('desc')).toHaveTextContent(/Access site, right internal jugular/)
    expect(within(picturePane()).getByRole('button', { name: 'Access site' })).toBeVisible()
  })

  it('lights the access limb at the first stop of the blood walk and the return limb at the last', () => {
    renderLesson('crrt-circuit-pressures')
    const art = () => picturePane().querySelector('[data-crrt-access-art]')!
    expect(art()).not.toHaveAttribute('data-highlight')
    fireEvent.click(screen.getByRole('button', { name: 'Patient access' }))
    expect(art()).toHaveAttribute('data-highlight', 'access')
    for (const stop of ['Pre-pump segment', 'Blood pump', 'Filter', 'Return segment'])
      fireEvent.click(screen.getByRole('button', { name: stop }))
    expect(art()).not.toHaveAttribute('data-highlight')
    fireEvent.click(screen.getByRole('button', { name: 'Patient return' }))
    expect(art()).toHaveAttribute('data-highlight', 'return')
  })

  it('is not added to a live run circuit', () => {
    renderLesson('crrt-circuit-pressures')
    // Task 4 is the pressure lab, which draws its own circuit from the run.
    const map = document.querySelector('[data-crrt-task-map]')!
    fireEvent.click(map.querySelectorAll('ol button')[3])
    expect(picturePane().querySelector('svg[data-overlay]')).not.toBeNull()
    expect(picturePane().querySelector('[data-crrt-access-site]')).toBeNull()
  })
})

describe('the enlarged figure', () => {
  it('opens from the button under the circuit, and the site chosen there is the site in the inset', () => {
    renderLesson('crrt-indications-modality')
    fireEvent.click(within(picturePane()).getByRole('button', { name: 'Access site' }))
    const dialog = screen.getByRole('dialog', { name: 'Where the circuit meets the patient' })
    expect(dialog).toHaveTextContent(/One catheter with two lumens sits in a large central vein/)
    const choice = within(dialog).getByRole('group', { name: 'Catheter site' })
    expect(within(choice).getByRole('button', { name: 'Right internal jugular' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      within(dialog).getByRole('img', { name: /Access site, right internal jugular/ }),
    ).toBeInTheDocument()
    fireEvent.click(within(choice).getByRole('button', { name: 'Femoral' }))
    expect(within(dialog).getByRole('img', { name: /Access site, femoral/ })).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/Its tip lies in the inferior vena cava/)
    expect(picturePane().querySelector('[data-crrt-access-site]')).toHaveAttribute(
      'data-crrt-access-site',
      'femoral',
    )
  })

  it('names every labelled part and shows the tip detail, for both sites', () => {
    for (const id of CRRT_ACCESS_SITE_IDS) {
      const view = render(<CrrtAccessSiteFigure site={id} onSiteChange={() => {}} />)
      for (const label of crrtAccessSites[id].labels)
        expect(
          view.container.querySelector(`[data-crrt-access-label="${label.id}"]`),
        ).toHaveTextContent(label.text)
      expect(view.container.querySelector('[data-crrt-access-tip]')).toHaveTextContent(
        /The access openings are a short way back from the tip and the return opening is at the tip/,
      )
      expect(
        within(view.container).getByRole('img', { name: /The catheter tip inside the vein/ }),
      ).toBeInTheDocument()
      view.unmount()
    }
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<CrrtAccessSiteFigure site="jugular" onSiteChange={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
