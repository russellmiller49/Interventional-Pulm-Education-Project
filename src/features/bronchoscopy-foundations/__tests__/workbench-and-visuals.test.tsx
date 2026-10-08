import { readFileSync } from 'fs'
import { join } from 'path'

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { projectOptical } from '@/lib/bronchoscopy-core/frame'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'

import { scopeKeyboardHint } from '../components/scope/scopeKeyMap'
import {
  layoutOpticalLabels,
  patientDirectionTicks,
  projectScenePins,
} from '../components/scope/scopeSceneModel'
import { ScopeFallback } from '../components/scope/ScopeFallback'
import { TipCompass } from '../components/scope/TipCompass'
import { TubeCrossSection } from '../components/scope/TubeCrossSection'
import type { ScopeViewSpec } from '../components/scope/types'
import { BronchIdentifyControl } from '../components/stage/BronchIdentifyControl'
import { NormalAirwayTour, tourGroups } from '../components/stage/BronchCourseTeaching'
import { MediaFigure } from '../components/stage/MediaFigure'
import { MediaWorkspace } from '../components/stage/MediaWorkspace'
import { detailRegion, needsDetail, pointBounds } from '../components/stage/mediaDetail'
import { TEACHING_TREE } from '../content/airwayTree'
import { BRONCH_SECTIONS } from '../content/sections'
import { bronchStageLesson } from '../content/stageLessons'
import type { BronchIdentify } from '../content/types'
import {
  BENCH_CARD_CENTER,
  benchOrientationLines,
  benchTipOrientation,
} from '../engine/scope/benchOrientation'
import { goalHelp, pendingRequirement } from '../engine/scope/goalHelp'
import { annularArea, formatScopeMetric, tubeGeometry } from '../engine/scope/scopeMetrics'
import { OPTICAL_ASPECT } from '../engine/scope/scopeOstia'
import { ScopeDriver, teachingCase } from '../test-support/teachingCase'

/**
 * BF-PRE-REVIEW-03 — readable images and coherent scope workspaces (fellow walkthrough A18, A20,
 * A21, A22, A24, A25, A28, A29, A30, A33, A37, the visual part of A2, SUP-08, SUP-09, SUP-13).
 *
 * Each block pins one repaired mechanism against the model it draws from — the photograph's own
 * registered polygons, the engine's optical frame, the airway graph's ostium points, the tube's
 * two authored diameters — so the display cannot drift from the model. Preserved-contract guards
 * (nothing here dispatches, records or claims) are kept in their own block at the end.
 */

const PUBLIC = join(__dirname, '../../../../public')
const atlas = JSON.parse(
  readFileSync(join(PUBLIC, 'intro-bronchoscopy/scope-anatomy/scope-photo-atlas.json'), 'utf8'),
) as {
  images: {
    id: string
    width: number
    height: number
    annotations: { id: string; points: number[][] }[]
  }[]
}
const quizFrames = JSON.parse(
  readFileSync(join(PUBLIC, 'airway-lesson/airway-quiz-frames.json'), 'utf8'),
)
const ctFrames = JSON.parse(
  readFileSync(join(PUBLIC, 'airway-lesson/airway-survey-ct.json'), 'utf8'),
)

/** The dialog methods jsdom lacks, as the stage harness installs them (without mounting a host). */
function installDom() {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
}

function mockManifests() {
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const path = String(url)
    const body = path.includes('scope-photo-atlas')
      ? atlas
      : path.includes('airway-quiz-frames')
        ? quizFrames
        : path.includes('airway-survey-ct')
          ? ctFrames
          : null
    return { ok: body !== null, status: body ? 200 : 404, json: async () => body } as Response
  }) as typeof fetch
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  installDom()
  mockManifests()
})
afterEach(() => cleanup())

const preUse = BRONCH_SECTIONS.find((section) => section.id === 'pre-use-check')!
const identify = (preUse.act as { kind: 'identify'; identify: BronchIdentify }).identify

describe('A18, A20 — the instrument views are readable and each has its own text alternative', () => {
  it('gives the small outlines a detail cut from the same photograph, and only those', () => {
    const small = identify.rows.flatMap((row, index) => {
      const media = row.media
      if (media.kind !== 'scope-photo' || !media.highlight) return []
      const image = atlas.images.find((candidate) => candidate.id === media.imageId)!
      const annotation = image.annotations.find((a) => a.id === media.highlight)!
      const bounds = pointBounds(annotation.points.flat())!
      if (!needsDetail(bounds, image.width, image.height)) return []
      const region = detailRegion(bounds, image.width, image.height)
      // Inside the photograph, square, and holding the whole outline.
      expect(region.x).toBeGreaterThanOrEqual(0)
      expect(region.y).toBeGreaterThanOrEqual(0)
      expect(region.x + region.width).toBeLessThanOrEqual(image.width + 1e-9)
      expect(region.y + region.height).toBeLessThanOrEqual(image.height + 1e-9)
      expect(region.width).toBeCloseTo(region.height, 9)
      expect(region.x).toBeLessThanOrEqual(bounds.minX)
      expect(region.y).toBeLessThanOrEqual(bounds.minY)
      expect(region.x + region.width).toBeGreaterThanOrEqual(bounds.maxX)
      expect(region.y + region.height).toBeGreaterThanOrEqual(bounds.maxY)
      return [index + 1]
    })
    // Views 2, 3 and 6 on the whole scope, and the two close-ups whose outlined port is small.
    expect(small).toEqual([2, 3, 6, 7, 8])
  })

  it('renders a real Enlarge button and a registered detail for view 3', async () => {
    const row = identify.rows[2]
    const { container } = render(
      <MediaFigure
        media={row.media}
        compact
        alt={row.mediaDescription}
        enlargeLabel="Enlarge view 3 of 8"
        dialogTitle="View 3 of 8, enlarged"
      />,
    )
    await flush()
    const button = container.querySelector<HTMLButtonElement>('button[data-media-enlarge]')!
    expect(button.textContent).toBe('Enlarge')
    expect(button.getAttribute('aria-label')).toBe('Enlarge view 3 of 8')
    const outline = container.querySelector('[data-media-overlay] polygon')!.getAttribute('points')
    const detail = container.querySelector('svg[data-media-detail="card"]')!
    // The detail is the same file, and the same polygon in the same coordinates.
    expect(detail.querySelector('image')!.getAttribute('href')).toBe(
      '/intro-bronchoscopy/scope-anatomy/full-scope.png',
    )
    expect(detail.querySelector('polygon')!.getAttribute('points')).toBe(outline)
    const [x, y, w, h] = detail.getAttribute('viewBox')!.split(' ').map(Number)
    const bounds = pointBounds(outline!.split(' ').map(Number))!
    expect(x <= bounds.minX && y <= bounds.minY).toBe(true)
    expect(x + w >= bounds.maxX && y + h >= bounds.maxY).toBe(true)
    // The whole photograph marks where the detail was cut from.
    expect(container.querySelector('[data-media-detail-window]')).not.toBeNull()
  })

  it('opens and closes the enlarged view with focus back on its button', async () => {
    const row = identify.rows[2]
    const { container } = render(
      <MediaFigure media={row.media} alt={row.mediaDescription} dialogTitle="View 3 of 8" />,
    )
    await flush()
    const button = container.querySelector<HTMLButtonElement>('button[data-media-enlarge]')!
    const outline = container.querySelector('[data-media-overlay] polygon')!.getAttribute('points')
    button.focus()
    fireEvent.click(button)
    const dialog = container.querySelector('dialog[data-media-dialog]')!
    expect(dialog.hasAttribute('open')).toBe(true)
    expect(dialog.querySelector('h2')!.textContent).toBe('View 3 of 8')
    expect(
      dialog.querySelector('[data-media-frame-size="enlarged"] img')!.getAttribute('src'),
    ).toBe('/intro-bronchoscopy/scope-anatomy/full-scope.png')
    // The enlarged view is the same file with the same outline, and says it adds nothing.
    expect(
      dialog.querySelector('[data-media-frame-size="enlarged"] polygon')!.getAttribute('points'),
    ).toBe(outline)
    expect(dialog.textContent).toContain('Nothing is added to the image.')
    expect(dialog.querySelector('[data-media-dialog-description]')!.textContent).toBe(
      row.mediaDescription,
    )
    // Escape is the dialog's cancel event.
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog.hasAttribute('open')).toBe(false)
    expect(document.activeElement).toBe(button)
  })

  it('names every view on its own, never by the name the row asks for', async () => {
    const descriptions = identify.rows.map((row) => row.mediaDescription)
    expect(descriptions.every((text) => typeof text === 'string' && text.length > 40)).toBe(true)
    expect(new Set(descriptions).size).toBe(identify.rows.length)
    for (const row of identify.rows) {
      const keyed = row.choices.find((choice) => choice.id === row.answerId)!.label
      expect(row.mediaDescription!.toLowerCase()).not.toContain(keyed.toLowerCase())
    }
    const { container } = render(
      <BronchIdentifyControl identify={identify} draft={{}} committed={null} onChange={() => {}} />,
    )
    await flush()
    const alts = [...container.querySelectorAll('[data-identify-row] figure > div img')].map(
      (img) => img.getAttribute('alt'),
    )
    expect(alts).toEqual(descriptions)
    const labels = [...container.querySelectorAll('button[data-media-enlarge]')].map((button) =>
      button.getAttribute('aria-label'),
    )
    expect(labels).toEqual(identify.rows.map((_, index) => `Enlarge view ${index + 1} of 8`))
  })

  it('offers a text reference to every part the set names, in an order that gives nothing away', () => {
    const { container } = render(
      <BronchIdentifyControl identify={identify} draft={{}} committed={null} onChange={() => {}} />,
    )
    const reference = container.querySelector('details[data-part-reference]')!
    const names = [...reference.querySelectorAll('dt')].map((dt) => dt.textContent)
    const keyed = identify.rows.map(
      (row) => row.choices.find((choice) => choice.id === row.answerId)!.label,
    )
    expect(names).toEqual([...keyed].sort((a, b) => a.localeCompare(b)))
    expect(names).not.toEqual(keyed)
    expect(
      [...reference.querySelectorAll('dd')].every((dd) => (dd.textContent ?? '').length > 20),
    ).toBe(true)
  })

  it('keeps the chosen answer when the enlarged view opens and closes', async () => {
    const choices: Record<string, string> = {}
    const { container, rerender } = render(
      <BronchIdentifyControl
        identify={identify}
        draft={choices}
        committed={null}
        onChange={(row, choice) => {
          choices[row] = choice
        }}
      />,
    )
    await flush()
    const radio = container.querySelector<HTMLInputElement>(
      '[data-identify-row="biopsy-valve-adapter"] input[value="working-channel-port"]',
    )!
    fireEvent.click(radio)
    rerender(
      <BronchIdentifyControl
        identify={identify}
        draft={{ ...choices }}
        committed={null}
        onChange={() => {}}
      />,
    )
    const button = container.querySelector<HTMLButtonElement>(
      '[data-identify-row="biopsy-valve-adapter"] button[data-media-enlarge]',
    )!
    fireEvent.click(button)
    const dialog = container.querySelector('[data-identify-row="biopsy-valve-adapter"] dialog')!
    fireEvent.click(dialog.querySelector('[data-media-dialog-close]')!)
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-identify-row="biopsy-valve-adapter"] input[value="working-channel-port"]',
      )!.checked,
    ).toBe(true)
  })
})

describe('A28, SUP-13 — captions and titles say what is actually there', () => {
  it('no caption calls a still annotated when nothing is marked on it', () => {
    for (const section of BRONCH_SECTIONS) {
      if (section.workspace.kind !== 'media') continue
      const unmarked = section.workspace.media.some(
        (media) => media.kind === 'endoscopic-still' && !media.outline,
      )
      if (unmarked) expect(`${section.id}: ${section.workspace.caption}`).not.toMatch(/annotated/i)
    }
  })

  it('titles the larynx check for the question it asks', () => {
    const check = bronchStageLesson('larynx-and-entry').steps.find(
      (step) => step.activity === 'independent-check' && step.id.endsWith('-check'),
    )!
    expect(check.title).not.toMatch(/identify the structures/i)
    expect(check.title).toBe('Decide when to cross the glottis')
  })

  it('says, when a still is enlarged, that the corner rectangle is part of the recorded frame', async () => {
    const { container } = render(
      <MediaFigure media={{ kind: 'endoscopic-still', structureId: 'larynx', outline: false }} />,
    )
    await flush()
    fireEvent.click(container.querySelector('button[data-media-enlarge]')!)
    expect(container.querySelector('dialog')!.textContent).toContain(
      'part of the recorded video frame, not a control',
    )
    expect(container.querySelector('img')!.getAttribute('alt')).toContain('nothing marked on it')
  })
})

describe('A29 — the airway tour follows the tree and lets a group be compared', () => {
  it('groups the right-side stills by the airways before the segments and each lobe', () => {
    const right = TEACHING_TREE.filter(
      (node) => node.side === 'right' && node.lessonId !== null && node.label !== null,
    )
    expect(
      tourGroups(right).map((group) => [group.title, group.nodes.map((n) => n.label)]),
    ).toEqual([
      ['Airways before the segments', ['RMSB', 'RUL', 'BI', 'RML', 'RLL']],
      ['Right upper lobe segments', ['RB1', 'RB2', 'RB3']],
      ['Right middle lobe segments', ['RB4', 'RB5']],
      ['Right lower lobe segments', ['RB6', 'RB7', 'RB8', 'RB9', 'RB10']],
    ])
  })

  it('reaches RB1, RB6 and RB10 in one press each and compares a lobe side by side', async () => {
    const { container } = render(<NormalAirwayTour sectionId="right-side" />)
    await flush()
    for (const label of ['RB1', 'RB6', 'RB10']) {
      fireEvent.click(container.querySelector(`button[data-tour-airway="${label}"]`)!)
      await flush()
      expect(
        container
          .querySelector(`button[data-tour-airway="${label}"]`)!
          .getAttribute('aria-pressed'),
      ).toBe('true')
      expect(container.querySelector('figure')!.getAttribute('data-media-id')).toBe(
        label.toLowerCase(),
      )
      // Each still keeps its own registered outline.
      const poly = container.querySelector('[data-media-overlay] polygon')!.getAttribute('points')
      expect(poly).toBe(quizFrames.structures[label.toLowerCase()].poly.join(' '))
    }
    fireEvent.click(container.querySelector('button[data-tour-compare-toggle]')!)
    await flush()
    const ids = [...container.querySelectorAll('[data-tour-compare-grid] figure')].map((figure) =>
      figure.getAttribute('data-media-id'),
    )
    expect(ids).toEqual(['rb6', 'rb7', 'rb8', 'rb9', 'rb10'])
    expect(container.querySelector('[data-tour-frame]')!.textContent).toContain(
      'no orientation or camera-roll information',
    )
  })

  it('does not give the trachea a parent', async () => {
    const { container } = render(<NormalAirwayTour sectionId="branch-entry" />)
    await flush()
    expect(container.textContent).not.toContain('Parent: Trachea.')
    expect(container.textContent).toContain('Parent: none; the tree starts at the trachea.')
  })
})

const benchView: ScopeViewSpec = {
  sectionId: 'five-controls',
  mode: 'controls-isolated',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'bench' },
  controls: ['rotate', 'deflect', 'advance', 'withdraw'],
  assists: {},
  boundary: 'Authored model.',
  physicalControlLabels: true,
}

describe('A21, A22, SUP-08 — the bench says where the tip points at every angle', () => {
  function at(rotation: number, deflection: number) {
    const driver = new ScopeDriver(benchView, null)
    driver.send({ type: 'set-rotation', deg: rotation })
    driver.send({ type: 'set-deflection', deg: deflection })
    return driver.state
  }

  it.each([0, 15, 30, 60, -60, 90, 120, -120])(
    'reads deflection %i° off the engine frame, in the lever’s plane',
    (deflection) => {
      const state = at(0, deflection)
      const orientation = benchTipOrientation(state)!
      const forward = scopeOpticalFrame(state.pose!).forward
      const angle = (Math.acos(forward[2]) * 180) / Math.PI
      expect(orientation.angleDeg).toBeCloseTo(angle, 9)
      expect(orientation.angleDeg).toBeCloseTo(Math.abs(deflection), 6)
      if (deflection === 0) expect(orientation.toward).toBeNull()
      else {
        // U (positive) toward the card's top, D toward its bottom: the model's own convention.
        expect(orientation.toward!.x).toBeCloseTo(0, 6)
        expect(orientation.toward!.y).toBeCloseTo(Math.sign(deflection), 6)
      }
      expect(orientation.bendUp.x).toBeCloseTo(0, 6)
      expect(orientation.bendUp.y).toBeCloseTo(1, 6)
    },
  )

  it('tells +60° from −60° although the scope view is dark at both', () => {
    const up = benchTipOrientation(at(0, 60))!
    const down = benchTipOrientation(at(0, -60))!
    expect(up.cardInView).toBe(false)
    expect(down.cardInView).toBe(false)
    expect(up.toward!.y).toBeCloseTo(-down.toward!.y, 9)
    expect(benchTipOrientation(at(0, 15))!.cardInView).toBe(true)
    expect(benchTipOrientation(at(0, 0))!.cardInView).toBe(true)
    // The card-in-view reading is the same projection the renderer draws with.
    const frame = scopeOpticalFrame(at(0, 60).pose!)
    const projected = projectOptical(BENCH_CARD_CENTER, frame, OPTICAL_ASPECT)
    expect(projected === null || Math.hypot(projected.x * OPTICAL_ASPECT, projected.y) >= 1).toBe(
      true,
    )
  })

  it.each([
    [0, 0, 1],
    [90, 1, 0],
    [180, 0, -1],
    [-90, -1, 0],
  ])(
    'keeps a fixed 30° bend visible end-on with the control section turned %i°',
    (rotation, x, y) => {
      const orientation = benchTipOrientation(at(rotation, 30))!
      expect(orientation.angleDeg).toBeCloseTo(30, 6)
      // The operator's clockwise turn carries U clockwise, seen end-on from behind the tip.
      expect(orientation.bendUp.x).toBeCloseTo(x, 6)
      expect(orientation.bendUp.y).toBeCloseTo(y, 6)
      expect(orientation.toward!.x).toBeCloseTo(x, 6)
      expect(orientation.toward!.y).toBeCloseTo(y, 6)
    },
  )

  it('states the picture’s turn in the direction the transform actually turns it', () => {
    // A point at the card's top: at 90° clockwise it must appear at the image's left.
    const top = [0, 18, 65] as const
    const frame = scopeOpticalFrame(at(90, 0).pose!)
    const projected = projectOptical([...top], frame, OPTICAL_ASPECT)!
    expect(projected.x).toBeLessThan(-0.1)
    expect(Math.abs(projected.y)).toBeLessThan(0.05)
    const lines = benchOrientationLines(benchTipOrientation(at(90, 0))!, 90)
    expect(lines[2]).toContain('turned 90° clockwise')
    expect(lines[2]).toContain('the scope view turns 90° counterclockwise')
    const back = benchOrientationLines(benchTipOrientation(at(-90, 0))!, -90)
    expect(back[2]).toContain('the scope view turns 90° clockwise')
  })

  it('draws the compass from the same reading, with words for it', () => {
    const { container } = render(<TipCompass state={at(90, 30)} />)
    const figure = container.querySelector('[data-tip-compass]')!
    expect(figure.getAttribute('data-tip-angle')).toBe('30.0')
    expect(figure.getAttribute('data-bend-up')).toBe('1.000,0.000')
    expect(figure.getAttribute('data-card-in-view')).toBe('true')
    const caption = figure.querySelector('figcaption')!.textContent!
    expect(caption).toContain('Tip: 30° from straight ahead, toward the card’s right.')
    expect(caption).toContain('Bending plane: U toward the card’s right, D opposite.')
    // Five-controls' own leak patterns stay clear of the compass's words.
    const deny = BRONCH_SECTIONS.find((s) => s.id === 'five-controls')!.precommitDenyPatterns
    for (const pattern of deny) expect(caption).not.toMatch(pattern)
    expect(
      [...container.querySelectorAll('[data-compass-ring]')].map((ring) =>
        ring.getAttribute('data-compass-ring'),
      ),
    ).toEqual(['30', '60', '90', '120'])
  })
})

const walkView: ScopeViewSpec = {
  sectionId: 'branch-entry',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label: 'TR', at: 'distal' },
  controls: ['advance', 'withdraw', 'rotate', 'deflect'],
  assists: { 'align-to-branch': true },
  boundary: 'Authored model.',
}

describe('A24 — labels point at their own openings, and each view says its frame', () => {
  it('pushes crowded captions apart without covering another opening’s point', () => {
    const pins = projectScenePins(new ScopeDriver(walkView).state)
    expect(pins.map((pin) => pin.label).sort()).toEqual(['LMSB', 'RMSB'])
    for (const width of [300, 420, 560, 820]) {
      const height = width / OPTICAL_ASPECT
      const placed = layoutOpticalLabels(pins, width, height, true)
      const px = placed.map((pin) => ({
        anchor: { x: (pin.leftPct * width) / 100, y: (pin.topPct * height) / 100 },
        label: { x: (pin.labelLeftPct * width) / 100, y: (pin.labelTopPct * height) / 100 },
        half: Math.max(16, pin.label.length * 4 + 8),
      }))
      for (const [i, a] of px.entries()) {
        // Attachment points are the model's projection, untouched.
        expect(placed[i].leftPct).toBe(pins[i].leftPct)
        expect(placed[i].topPct).toBe(pins[i].topPct)
        for (const [j, b] of px.entries()) {
          if (i === j) continue
          // No caption over another opening's point.
          expect(
            Math.abs(a.label.x - b.anchor.x) >= a.half + 12 ||
              Math.abs(a.label.y - b.anchor.y) >= 25,
          ).toBe(true)
          // Captions clear of each other.
          if (i < j)
            expect(
              Math.abs(a.label.x - b.label.x) >= a.half + b.half + 10 ||
                Math.abs(a.label.y - b.label.y) >= 36,
            ).toBe(true)
        }
      }
    }
  })

  it('turns the patient-direction ticks with the image, by the model’s own frame', () => {
    const angle = (rotation: number, id: string) => {
      const driver = new ScopeDriver(walkView)
      driver.send({ type: 'set-rotation', deg: rotation })
      const tick = patientDirectionTicks(driver.state).find((t) => t.id === id)!
      return (Math.atan2(tick.y, tick.x) * 180) / Math.PI
    }
    const turn = (a: number, b: number) => ((((b - a + 180) % 360) + 360) % 360) - 180
    // A clockwise turn of the control section turns the picture, and its ticks, counterclockwise.
    for (const id of ['A', 'L']) {
      expect(turn(angle(0, id), angle(90, id))).toBeCloseTo(90, 4)
      expect(turn(angle(0, id), angle(-90, id))).toBeCloseTo(-90, 4)
      expect(Math.abs(turn(angle(0, id), angle(180, id)))).toBeCloseTo(180, 4)
    }
    // No ticks on the bench, where there is no patient.
    expect(patientDirectionTicks(new ScopeDriver(benchView, null).state)).toEqual([])
  })
})

describe('A30 — "Show me where" follows the goal the learner is on', () => {
  const guided: ScopeViewSpec = {
    ...walkView,
    assists: { 'aim-guard': true, 'centerline-lock': true },
  }
  const scopeCase = teachingCase()

  it('moves past a sequence’s events that already happened', () => {
    const driver = new ScopeDriver({
      ...guided,
      start: { kind: 'airway', label: 'TR', at: 'proximal' },
    })
    const enterRight = {
      type: 'event-sequence' as const,
      events: ['reached-carina' as const, 'entered:RMSB' as const],
    }
    expect(pendingRequirement(enterRight, driver.state)).toEqual({
      kind: 'event',
      event: 'reached-carina',
    })
    for (let i = 0; i < 80 && !driver.state.events.includes('reached-carina'); i++)
      driver.send({ type: 'advance', mm: 3 })
    expect(driver.state.events).toContain('reached-carina')
    // The old mapping read only the first clause and kept pointing at Advance.
    expect(pendingRequirement(enterRight, driver.state)).toEqual({
      kind: 'event',
      event: 'entered:RMSB',
    })
    expect(goalHelp(enterRight, driver.state, guided, scopeCase)!.target).toBe('RMSB')
  })

  it('says Advance exactly when an advance from here enters the opening', () => {
    const seen = new Set<string>()
    for (const target of ['RMSB', 'LMSB'] as const)
      for (const deflection of [-60, -30, 0, 25, 50, 75])
        for (let rotation = -180; rotation < 180; rotation += 30) {
          const driver = new ScopeDriver(guided, scopeCase)
          driver.send({ type: 'set-rotation', deg: rotation })
          driver.send({ type: 'set-deflection', deg: deflection })
          const before = JSON.stringify(driver.state)
          const help = goalHelp(
            { type: 'location', airway: target },
            driver.state,
            guided,
            scopeCase,
          )!
          // Asking never changes the learner's state.
          expect(JSON.stringify(driver.state)).toBe(before)
          seen.add(help.control!)
          for (let i = 0; i < 25 && driver.state.location.label === 'TR'; i++)
            driver.send({ type: 'advance', mm: driver.state.inputs.stepMm })
          expect(`${target} ${rotation}/${deflection}: ${help.control}`).toBe(
            `${target} ${rotation}/${deflection}: ${
              driver.state.location.label === target
                ? 'advance'
                : help.control === 'advance'
                  ? 'not advance'
                  : help.control
            }`,
          )
        }
    expect([...seen].sort()).toEqual(['advance', 'deflect', 'rotate'])
  })

  it('brings the tip into either main bronchus when its advice is followed', () => {
    for (const target of ['RMSB', 'LMSB'] as const) {
      const driver = new ScopeDriver(guided, scopeCase)
      const used = new Set<string>()
      for (let step = 0; step < 120 && driver.state.location.label !== target; step++) {
        const help = goalHelp(
          { type: 'location', airway: target },
          driver.state,
          guided,
          scopeCase,
        )!
        used.add(help.control!)
        if (help.control === 'advance') driver.send({ type: 'advance', mm: 3 })
        else if (help.control === 'rotate')
          driver.send({
            type: 'rotate',
            deg: help.sentence.startsWith('Rotate counterclockwise') ? -5 : 5,
          })
        else if (help.control === 'deflect')
          driver.send({
            type: 'deflect',
            deg: help.sentence.startsWith('Deflect toward D') ? -5 : 5,
          })
        else throw new Error(`unexpected help ${help.control}`)
      }
      expect(driver.state.location.label).toBe(target)
      expect(used.has('advance')).toBe(true)
    }
  })

  it('draws reference names only on request, and never while the engine withholds names', () => {
    const view: ScopeViewSpec = {
      ...guided,
      controls: ['advance', 'withdraw', 'rotate', 'deflect'],
    }
    const state = new ScopeDriver(view, scopeCase).state
    const props = (on: boolean, script: typeof state.script = state.script) => ({
      view,
      state: { ...state, script },
      map: null,
      onCommand: () => {},
      onReset: () => {},
      controlsEnabled: true,
      goals: [],
      caption: 'Trachea',
      referenceLabels: { on, used: on, onToggle: () => {} },
    })
    const names = () =>
      [...document.querySelectorAll('[data-reference-label]')].map((pin) => pin.textContent)
    const { rerender } = render(<ScopeFallback {...props(false)} />)
    expect(names()).toEqual([])
    rerender(<ScopeFallback {...props(true)} />)
    expect(names().sort()).toEqual(['LMSB', 'RMSB'])
    rerender(<ScopeFallback {...props(true, { id: 'unfamiliar-clear', phase: 'unidentified' })} />)
    expect(names()).toEqual([])
  })

  it('says to withdraw when the opening is behind the tip', () => {
    const driver = new ScopeDriver({ ...guided, start: { kind: 'airway', label: 'BI', at: 'mid' } })
    const seeUpperLobe = {
      type: 'event-sequence' as const,
      events: ['withdrew-to:RMSB' as const, 'ostium-visualized:RUL' as const],
    }
    expect(goalHelp(seeUpperLobe, driver.state, guided, scopeCase)!.control).toBe('withdraw')
    expect(
      goalHelp({ type: 'location', airway: 'LMSB' }, driver.state, guided, scopeCase)!.control,
    ).toBe('withdraw')
  })

  it('makes the keys it already answers to discoverable, for this step’s controls only', () => {
    const hint = scopeKeyboardHint(['advance', 'withdraw', 'rotate', 'deflect', 'reset'])!
    expect(hint).toContain('W advances')
    expect(hint).toContain('S withdraws')
    expect(hint).toContain('A and D rotate')
    expect(hint).toContain('the up and down arrows deflect')
    expect(hint).toContain('Hold a movement key to keep moving.')
    expect(hint).not.toContain('Space')
    expect(scopeKeyboardHint(['suction'])).toBe(
      'Keyboard, once the scope view is selected (click it or Tab to it): Space turns suction on or off.',
    )
    expect(scopeKeyboardHint(['reset'])).toBeNull()
  })
})

describe('A33 — the scope in the tube, one calculation for numbers and circles', () => {
  it('draws the authored pairings to scale from the readouts’ own geometry', () => {
    for (const [id, od] of [
      [8, 6],
      [7.5, 6.2],
    ]) {
      const inputs = { tube: { kind: 'ett' as const, idMm: id }, scopeOdMm: od }
      const geometry = tubeGeometry(inputs)!
      expect(geometry.fraction).toBeCloseTo(annularArea(inputs)!.fraction, 12)
      expect(geometry.mm2).toBeCloseTo((Math.PI / 4) * (id * id - od * od), 9)
      const { container } = render(<TubeCrossSection inputs={inputs} />)
      const figure = container.querySelector('[data-tube-cross-section]')!
      expect(
        Number(container.querySelector('[data-cross-section-tube-radius]')!.getAttribute('r')),
      ).toBe(id / 2)
      expect(
        Number(container.querySelector('[data-cross-section-scope-radius]')!.getAttribute('r')),
      ).toBe(od / 2)
      const readoutState = { inputs } as Parameters<typeof formatScopeMetric>[1]
      const share = formatScopeMetric('annularAreaFraction', readoutState)
      const area = formatScopeMetric('annularAreaMm2', readoutState)
      expect(figure.textContent).toContain(`${Math.round(geometry.mm2)} mm²`)
      expect(share).toContain(geometry.fraction.toFixed(2))
      expect(figure.textContent).toContain(`${geometry.fraction.toFixed(2)} of the tube’s lumen`)
      expect(area).toBe(`${Math.round(geometry.mm2)} mm² between scope and tube`)
      expect(figure.textContent).toContain('not a ventilation, airway-fit or device recommendation')
      cleanup()
    }
    // The course's worked numbers: a little under half, 22 mm²; about a third, 14 mm².
    expect(Math.round(tubeGeometry({ tube: { kind: 'ett', idMm: 8 }, scopeOdMm: 6 })!.mm2)).toBe(22)
    expect(
      Math.round(tubeGeometry({ tube: { kind: 'ett', idMm: 7.5 }, scopeOdMm: 6.2 })!.mm2),
    ).toBe(14)
  })

  it('draws no open area for an impossible pairing and says why', () => {
    const inputs = { tube: { kind: 'ett' as const, idMm: 6 }, scopeOdMm: 6.5 }
    expect(tubeGeometry(inputs)).toMatchObject({ fits: false, fraction: 0, mm2: 0 })
    const { container } = render(<TubeCrossSection inputs={inputs} />)
    expect(container.textContent).toContain('no open area to draw')
    expect(container.textContent).not.toContain('Shaded: open area')
    expect(tubeGeometry({ tube: null, scopeOdMm: 6 })).toBeNull()
  })
})

describe('A25 — the S7 CT and still are compared side by side, for what they are', () => {
  it('lays the two out as a comparison, each with its frame, and states what is not shown', async () => {
    const section = BRONCH_SECTIONS.find((s) => s.id === 'reference-frames')!
    if (section.workspace.kind !== 'media') throw new Error('media workspace expected')
    const { container } = render(
      <MediaWorkspace
        media={section.workspace.media}
        caption={section.workspace.caption}
        mediaNotes={section.workspace.mediaNotes}
        comparisonNote={section.workspace.comparisonNote}
      />,
    )
    await flush()
    expect(container.querySelector('[data-media-compare="true"]')).not.toBeNull()
    const notes = [...container.querySelectorAll('[data-media-frame]')].map((p) => p.textContent)
    expect(notes).toHaveLength(2)
    expect(notes[0]).toContain('as if viewed from the patient’s feet')
    expect(notes[1]).toContain('orientation and camera roll were not recorded')
    const comparison = container.querySelector('[data-media-comparison]')!.textContent!
    expect(comparison).toContain('not a registered pair')
    expect(comparison).toContain('this panel shows one axial slice')
    // Only the section's own two files: no other case's CT and no added levels.
    expect(
      [...container.querySelectorAll('figure')].map((f) => f.getAttribute('data-media-id')),
    ).toEqual(['rmb', 'rmb'])
  })
})
