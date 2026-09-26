import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

import { ArtifactCauseStrip } from '../components/figures/ArtifactCauseStrip'
import { FixedMobileComparison, TeamReadinessAid } from '../components/figures/CbctReferenceAids'
import { ConspicuityComparison } from '../components/figures/ConspicuityComparison'
import { TwoAxisWorkedExample } from '../components/figures/TwoAxisWorkedExample'
import {
  axialRayLine,
  targetRayGeometry,
  TOOL_VIEW_FRAME,
} from '../components/figures/teachingFigureModel'
import { SignalComparison, TeachingPanels } from '../components/stage/TeachingPanels'
import {
  FIXED_MOBILE_COMPARISON,
  REMOVED_ORGANIZATIONAL_SUGGESTIONS,
  TEAM_READINESS_ROWS,
  TEAM_READINESS_STATUS,
  teamReadinessText,
  validateCbctReferences,
} from '../content/cbctReferences'
import {
  imagingLearningActivities,
  IMAGING_FIGURE_REFS,
  validateImagingLearningActivities,
} from '../content/learningActivities'
import {
  CLINICAL_ANGLE_LABEL,
  SIGNAL_LATER_DEMONSTRATION_OBLIQUITY,
  teachingFigureDeclarations,
  TWO_AXIS_EXAMPLE,
  validateTeachingFigures,
} from '../content/teachingFigures'
import { fovCylinder, GANTRY_VARIANTS } from '../components/suite/suiteModel'
import { WARNING_INVENTORY } from '../content/warningInventory'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

// A small synthetic chest, so the CT figures reach their ready state and print real numbers:
// lung everywhere, a soft-tissue block in front of the lesion, the lesion itself soft tissue.
jest.mock('../lib/anatomy', () => {
  const actual = jest.requireActual<typeof import('../lib/anatomy')>('../lib/anatomy')
  const { sizeXyz, originMm, spacingMm, huRange } = actual.ANATOMY
  const encode = (hu: number) => Math.round(((hu - huRange[0]) / (huRange[1] - huRange[0])) * 255)
  const volume = new Uint8Array(sizeXyz[0] * sizeXyz[1] * sizeXyz[2])
  for (let z = 0; z < sizeXyz[2]; z++)
    for (let y = 0; y < sizeXyz[1]; y++)
      for (let x = 0; x < sizeXyz[0]; x++) {
        const mm = [x, y, z].map((n, i) => originMm[i] + n * spacingMm[i])
        const inBlock =
          mm[0] > 55 && mm[0] < 115 && mm[1] > 0 && mm[1] < 100 && Math.abs(mm[2] + 30) < 40
        volume[(z * sizeXyz[1] + y) * sizeXyz[0] + x] = encode(inBlock ? 40 : -850)
      }
  return { ...actual, loadAnatomyVolume: () => Promise.resolve(volume) }
})

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(cleanup)

const ready = async (selector: string) =>
  waitFor(
    () => expect(document.querySelector(selector)).toHaveAttribute('data-figure-state', 'ready'),
    { timeout: 20_000 },
  )

describe('the teaching figures are declared data and validate at import', () => {
  it('validates figures, aids and step placement, and places each figure on the step it illustrates', () => {
    expect(validateTeachingFigures()).toEqual([])
    expect(validateCbctReferences()).toEqual([])
    expect(validateImagingLearningActivities()).toEqual([])
    const placed = (ref: string) =>
      imagingLearningActivities('imaging-questions')
        .concat(
          ...(
            [
              'two-dimensional',
              'changing-anatomy',
              'cbct-acquisition',
              'fixed-suite',
              'mobile-suite',
            ] as const
          ).map((id) => imagingLearningActivities(id)),
        )
        .filter((activity) => activity.content.includes(ref))
        .map((activity) => activity.id)
    expect(placed('@two-axis-example')).toEqual(['two-dimensional:case'])
    expect(placed('@artifact-strip')).toEqual(['changing-anatomy:timeline'])
    expect(placed('@team-readiness')).toEqual(['cbct-acquisition:scouts'])
    expect(placed('@fixed-mobile-comparison')).toEqual([
      'fixed-suite:room',
      'mobile-suite:commission',
    ])
    expect([...IMAGING_FIGURE_REFS].sort()).toEqual(
      [
        '@artifact-strip',
        '@fixed-mobile-comparison',
        '@team-readiness',
        '@two-axis-example',
      ].sort(),
    )
    // Each figure follows the block it illustrates.
    const step = imagingLearningActivities('two-dimensional')[0]
    expect(step.content.indexOf('@two-axis-example')).toBe(
      step.content.indexOf('A two-axis fluoroscopy technique') + 1,
    )
  })

  it('names every simulated panel as simulated and every placeholder as having no image', () => {
    for (const declaration of teachingFigureDeclarations())
      for (const panel of declaration.panels) {
        if (panel.medium === 'simulated-on-model')
          expect(`${panel.title} ${panel.caption}`).toMatch(/simulated|drawn|drawing/i)
        if (panel.medium === 'placeholder') expect(panel.caption).toMatch(/^No image here/)
        expect(`${panel.title} ${panel.caption}`).not.toMatch(CLINICAL_ANGLE_LABEL)
      }
  })

  it('registers each new figure’s limit as a kept figure limitation, never consolidated away', () => {
    const selectors = WARNING_INVENTORY.filter(
      (surface) => surface.category !== 'general-provenance',
    )
    for (const selector of [
      '[data-case-figure] [data-model-label]',
      '[data-teaching-figure] [data-model-label]',
      '[data-fixed-mobile-comparison] [data-model-note]',
      '[data-team-readiness] [data-readiness-status]',
    ]) {
      const surface = selectors.find((entry) => entry.selector === selector)
      expect(surface).toBeDefined()
      expect(surface!.treatment).not.toBe('consolidated')
    }
  })
})

describe('OD4-06 · Section 6 compares three causes on the course’s CT', () => {
  it('shows the CT-derived set on the reading steps and keeps the check’s fixed Images A and B', async () => {
    render(<TeachingPanels sectionId="signal" />)
    expect(document.querySelector('[data-teaching-figure="signal:conspicuity-set"]')).not.toBeNull()
    expect(document.querySelector('[data-signal-comparison]')).toBeNull()
    cleanup()
    render(<TeachingPanels sectionId="signal" independent />)
    const check = document.querySelector('[data-signal-comparison]')!
    expect(check).toHaveTextContent('Image A')
    expect(check).toHaveTextContent('Image B')
    expect(check.querySelector('[data-draft-status]')).toHaveTextContent('draft illustrations')
    expect(document.querySelector('[data-teaching-figure]')).toBeNull()
    cleanup()
    render(<SignalComparison />)
    expect(document.querySelectorAll('[data-signal-comparison] button')).toHaveLength(0)
  })

  it('labels the model and each simulated effect, and prints the ray numbers it computed', async () => {
    render(<ConspicuityComparison />)
    await ready('[data-teaching-figure="signal:conspicuity-set"]')
    const figure = document.querySelector('[data-teaching-figure="signal:conspicuity-set"]')!
    expect(figure.querySelector('[data-model-label]')).toHaveTextContent(/^Teaching model:/)
    expect(figure.querySelector('[data-model-label]')).toHaveTextContent(/no panel is a dose level/)
    expect(figure.querySelector('[data-figure-panel="noise"]')).toHaveTextContent('simulated')
    expect(figure.querySelector('[data-figure-panel="scatter"]')).toHaveTextContent(
      /does not calculate scatter/,
    )
    expect(figure.querySelector('[data-ray-readout]')).toHaveTextContent(
      /C-arm obliquity is −20° \(detector toward the patient’s left\)\. Soft-tissue-like CT on the ray through the lesion: \d+ mm frontal, \d+ mm at −20°\./,
    )
    expect(figure.textContent).not.toMatch(/\b(LAO|RAO)\b/)
    expect(figure.querySelectorAll('[data-figure-canvas="drawn"]')).toHaveLength(4)
  }, 30_000)

  it('tells its −20° comparison apart from the later −35° demonstration, recommending neither', async () => {
    // PR #279 sanity review: not a contradiction, but two different changed views in one section.
    render(<ConspicuityComparison />)
    await ready('[data-teaching-figure="signal:conspicuity-set"]')
    const figure = document.querySelector('[data-teaching-figure="signal:conspicuity-set"]')!
    const [frontal, changed] = (
      figure.querySelector('[data-ray-readout]')!.textContent!.match(/\d+ mm/g) ?? []
    ).map((value) => Number.parseInt(value, 10))
    // The note is conditional on the shortening it describes; the synthetic chest here has it.
    expect(changed).toBeLessThan(frontal)
    const note = figure.querySelector('[data-later-example-note]')
    expect(note).toHaveTextContent(
      'This −20° comparison shortens the model’s soft-tissue path on the target ray; the later −35° example shows a different pattern, with the overlap redistributed along the ray.',
    )
    expect(SIGNAL_LATER_DEMONSTRATION_OBLIQUITY).toBe(-35)
    expect(note!.textContent).not.toMatch(/best|optimal|ideal|recommend|always|should|choose/i)
  }, 30_000)
})

describe('OD4-06 · Section 16 shows truncation as coverage and draws no motion or opacity', () => {
  it('has one model image and two text placeholders that say why', async () => {
    render(<ArtifactCauseStrip />)
    await ready('[data-teaching-figure="changing-anatomy:artifact-strip"]')
    const figure = document.querySelector(
      '[data-teaching-figure="changing-anatomy:artifact-strip"]',
    )!
    expect(figure.querySelectorAll('canvas')).toHaveLength(1)
    expect(figure.querySelector('[data-figure-panel="truncation"] canvas')).not.toBeNull()
    for (const id of ['motion', 'opacity']) {
      const panel = figure.querySelector(`[data-figure-panel="${id}"]`)!
      expect(panel).toHaveAttribute('data-panel-medium', 'placeholder')
      expect(panel.querySelector('canvas, svg, img')).toBeNull()
      expect(panel).toHaveTextContent(/No image here/)
    }
    expect(figure.querySelector('[data-truncation-readout]')).toHaveTextContent(
      /about half of it lies inside the volume/,
    )
  }, 30_000)
})

describe('OD4-08 · the two-axis example uses the model’s signed angles only', () => {
  it('labels signed values as C-arm obliquity and beam tilt, never with a console name', async () => {
    render(<TwoAxisWorkedExample />)
    await ready('[data-teaching-figure="two-dimensional:two-axis-example"]')
    const figure = document.querySelector(
      '[data-teaching-figure="two-dimensional:two-axis-example"]',
    )!
    // The only place the console names appear is the note that says they are not used.
    const convention = figure.querySelector('[data-angle-convention]')!
    expect(convention).toHaveTextContent(/not a console’s LAO\/RAO or cranial\/caudal labels/)
    expect(convention).toHaveTextContent(/held for owner review/)
    const rest = [...figure.childNodes]
      .filter((node) => node !== convention)
      .map((node) => node.textContent ?? '')
      .join(' ')
    expect(rest).not.toMatch(/\b(LAO|RAO|cranial|caudal)\b/i)
    // A signed value is never adjacent to a clinical direction word.
    expect(figure.textContent).not.toMatch(/[+−-]?\d+°\s*(LAO|RAO|cranial|caudal)/i)
    // Beam lines carry signed model values; the strip and tilt tables carry the same set.
    expect(
      [...figure.querySelectorAll('[data-beam-line]')].map((line) =>
        line.getAttribute('data-beam-line'),
      ),
    ).toEqual(['0', '-20', '20'])
    expect(
      [...figure.querySelectorAll('[data-target-ray]')].map((row) =>
        row.getAttribute('data-target-ray'),
      ),
    ).toEqual(['0', '-20', '-35', '20'])
    expect(figure.querySelectorAll('[data-tilt-row]')).toHaveLength(4)
    // Nothing names a lobe or segment, and the nodule is placed only as posterior left lung.
    expect(figure.textContent).toMatch(/posterior left lung/)
    expect(figure.textContent).not.toMatch(/\blobe\b(?! is named)|segment/i)
    expect(figure.textContent).not.toMatch(/always|universal|every lesion/i)
  }, 30_000)

  it('keeps the caption in step with the state it draws', async () => {
    render(<TwoAxisWorkedExample />)
    await ready('[data-teaching-figure="two-dimensional:two-axis-example"]')
    const figure = document.querySelector(
      '[data-teaching-figure="two-dimensional:two-axis-example"]',
    )!
    expect(figure).toHaveAttribute('data-chosen-obliquity', '-20')
    expect(figure.querySelector('[data-projection="after"] figcaption')).toHaveTextContent(
      'After: C-arm obliquity −20°, detector toward the patient’s left',
    )
    expect(figure.querySelector('[data-tool-view="-20"]')).toHaveTextContent('C-arm obliquity −20°')
    // Every number the reading paragraph prints is a number in the strip table.
    const strip = [...figure.querySelectorAll('[data-target-ray] td')].map(
      (cell) => cell.textContent,
    )
    const printed =
      figure.querySelector('[data-two-axis-reading]')!.textContent!.match(/\d+ mm/g) ?? []
    for (const value of printed) expect(strip.join(' ')).toContain(value)
  }, 30_000)

  it('draws each beam as the axial projection of the target ray from the tube, and says so (F1)', async () => {
    render(<TwoAxisWorkedExample />)
    await ready('[data-teaching-figure="two-dimensional:two-axis-example"]')
    const figure = document.querySelector(
      '[data-teaching-figure="two-dimensional:two-axis-example"]',
    )!
    for (const obliquity of TWO_AXIS_EXAMPLE.candidates) {
      // The expected line is computed from the suite's own source → lesion → detector ray.
      const expected = axialRayLine(obliquity, targetRayGeometry(obliquity, 0))
      const line = figure.querySelector(`[data-beam-line="${obliquity}"] line`)!
      const drawn = ['x1', 'y1', 'x2', 'y2'].map((name) => Number(line.getAttribute(name)))
      drawn.forEach((value, i) =>
        expect(value).toBeCloseTo([...expected.from, ...expected.to][i], 9),
      )
    }
    const caption = figure.querySelector('[data-figure-panel="axial"] figcaption')!
    expect(caption).toHaveTextContent(/the target ray whose path lengths the table gives/)
    expect(caption).toHaveTextContent(/from the X-ray tube’s focal spot/)
    expect(caption).toHaveTextContent(/drawn as its projection onto this axial image/)
    expect(caption).toHaveTextContent(/crosses this slice only at the lesion/)
    expect(caption).not.toHaveTextContent(/central ray/)
  }, 30_000)

  it('draws both tool views whole, at one scale and one tip position (F4)', async () => {
    render(<TwoAxisWorkedExample />)
    await ready('[data-teaching-figure="two-dimensional:two-axis-example"]')
    const views = [
      ...document.querySelectorAll('[data-figure-panel="tool-views"] [data-tool-view] svg'),
    ]
    expect(views).toHaveLength(2)
    expect(new Set(views.map((svg) => svg.getAttribute('data-tool-scale'))).size).toBe(1)
    expect(new Set(views.map((svg) => svg.querySelector('circle')!.getAttribute('cx'))).size).toBe(
      1,
    )
    for (const svg of views) {
      expect(svg.getAttribute('viewBox')).toBe(
        `0 0 ${TOOL_VIEW_FRAME.width} ${TOOL_VIEW_FRAME.height}`,
      )
      // The longest tool is fitted to the margin exactly, so allow floating-point rounding.
      const line = svg.querySelector('[data-tool-line]')!
      const { width, height, marginPx } = TOOL_VIEW_FRAME
      for (const [name, extent] of [
        ['x1', width],
        ['x2', width],
        ['y1', height],
        ['y2', height],
      ] as const) {
        const value = Number(line.getAttribute(name))
        expect(value).toBeGreaterThanOrEqual(marginPx - 1e-6)
        expect(value).toBeLessThanOrEqual(extent - marginPx + 1e-6)
      }
    }
    expect(document.querySelector('[data-figure-panel="tool-views"]')).toHaveTextContent(
      /Both views are drawn at the same scale, with the tool’s tip at the same place\./,
    )
  }, 30_000)
})

describe('OD4-09 · the fixed/mobile comparison and the equalised field', () => {
  it('compares workflow in words, with no number, device or ranking, and says the scenes no longer differ in field', () => {
    render(<FixedMobileComparison />)
    const table = document.querySelector('[data-fixed-mobile-comparison]')!
    expect(
      [...table.querySelectorAll('[data-comparison-row]')].map((row) =>
        row.getAttribute('data-comparison-row'),
      ),
    ).toEqual(FIXED_MOBILE_COMPARISON.map((row) => row.id))
    expect(table.querySelectorAll('[data-comparison-both]')).toHaveLength(2)
    const cells = [...table.querySelectorAll('tbody td')].map((cell) => cell.textContent).join(' ')
    expect(cells).not.toMatch(/\d/)
    expect(cells).not.toMatch(/better|superior|inferior|equivalent|always|never has/i)
    expect(table.querySelector('[data-model-note]')).toHaveTextContent(
      /draw the same detector field and the same field of view; they differ only in how they are mounted/,
    )
  })

  it('draws the fixed and mobile gantries with the same field of view', () => {
    expect(GANTRY_VARIANTS.mobile.panelMm).toBe(GANTRY_VARIANTS.fixed.panelMm)
    expect(fovCylinder('mobile')).toEqual(fovCylinder('fixed'))
  })
})

describe('OD4-10 · the team-readiness aid', () => {
  it('holds only the source-backed rows, says first what it is not, and copies the same lines', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<TeamReadinessAid />)
    const aid = document.querySelector('[data-team-readiness]')!
    expect(aid.querySelector('[data-readiness-status]')).toHaveTextContent(TEAM_READINESS_STATUS)
    expect(TEAM_READINESS_STATUS).toMatch(
      /Not an institutional protocol, an anesthesia protocol, a credentialing standard or a universal pre-procedure checklist/,
    )
    expect(
      [...aid.querySelectorAll('[data-readiness-row]')].map((row) =>
        row.getAttribute('data-readiness-row'),
      ),
    ).toEqual([
      'question',
      'tool',
      'protocol',
      'centring',
      'trial-rotation',
      'breath-hold',
      'announce',
      'oxygen',
      'shielding',
      'barrier',
      'clear',
    ])
    expect(
      [...aid.querySelectorAll('[data-readiness-role]')].map((role) =>
        role.getAttribute('data-readiness-role'),
      ),
    ).toEqual(['Bronchoscopist', 'Technologist', 'Anesthesia', 'Whole team'])
    // The two organizational suggestions the owner removed stay out.
    expect(aid.textContent).not.toMatch(REMOVED_ORGANIZATIONAL_SUGGESTIONS)
    expect(teamReadinessText()).not.toMatch(REMOVED_ORGANIZATIONAL_SUGGESTIONS)
    expect(
      TEAM_READINESS_ROWS.every((row) => !REMOVED_ORGANIZATIONAL_SUGGESTIONS.test(row.confirm)),
    ).toBe(true)
    // No settings or thresholds the course does not teach.
    expect(teamReadinessText()).not.toMatch(/\d+\s*(s|sec|seconds|cm H|%|mmHg)/i)
    fireEvent.click(aid.querySelector('[data-copy-readiness-aid]')!)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(teamReadinessText()))
    expect(teamReadinessText().split('\n')[1]).toBe(TEAM_READINESS_STATUS)
  })
})
