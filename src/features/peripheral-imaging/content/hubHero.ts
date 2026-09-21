import { CHAIN_STOPS, type ChainStopId } from './imagingChain'
import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * The hub's picture of the suite, and where each stop of the chain sits in it.
 *
 * The picture is a still of the suite's own `room` mode, rendered offline so the front door opens no
 * WebGL context: `public/peripheral-imaging/room-hero.png`, regenerated with
 * `npx tsx scripts/peripheral-imaging/render-room-hero.ts` from the fixture in
 * `scripts/peripheral-imaging/room-fixture.ts`, with its provenance in `room-hero.json`. The hub
 * therefore needs no live view spec of its own; a change to the picture is a change to that fixture.
 *
 * The caption walks the chain in registry order under the registry's own titles, so the front door
 * draws the spine once more rather than naming it a second way, and says where each stop is. No
 * stop number is printed here: `chainCaption` is the one place a number appears.
 */
export interface ImagingHubHero {
  readonly src: string
  /** The file's own pixel size; a test reads the PNG header and holds these to it. */
  readonly width: number
  readonly height: number
  readonly alt: string
  readonly lede: string
  /** Where to look in the picture for each stop, read after the stop's title. */
  readonly where: Readonly<Record<ChainStopId, string>>
  /**
   * Where each component is in the picture, as a percentage of its width and height.
   *
   * Report O5 (fellow walkthrough, PDF p.5): the picture named its components only in the caption,
   * so words had to be matched to shapes by position. These are not placed by eye. Each is the
   * suite's own anchor for that component (`chainStopAnchors`) projected through the camera the
   * still was rendered with (`cameraPose` on `ROOM_FIXTURE` at `ROOM_HERO`'s size), and
   * `hub-hero.test.ts` recomputes them, so a re-rendered picture that moves a component fails the
   * test rather than mislabelling the figure.
   */
  readonly anchors: Readonly<Record<ChainStopId, readonly [number, number]>>
  /** Which side of its anchor each on-figure label sits, chosen so no two labels collide. */
  readonly labelSide: Readonly<Record<ChainStopId, 'left' | 'right'>>
  readonly boundary: string
}

export const IMAGING_HUB_HERO: ImagingHubHero = {
  src: '/peripheral-imaging/room-hero.png',
  width: 2400,
  height: 1000,
  alt: 'A peripheral bronchoscopy suite: a patient on the procedure table under a C-arm, the beam drawn as a cone from the X-ray source beneath the table to the detector above, and a workstation with a monitor on a boom to the right.',
  lede: 'The suite every section is worked on, and where each component of image formation sits in it.',
  where: {
    source: 'the housing beneath the table',
    beam: 'the cone rising from it',
    patient: 'the figure on the table, the chest seen through the skin',
    detector: 'the panel above the patient',
    reconstruction: 'the workstation on the right',
    display: 'the monitor on the boom beside it',
  },
  anchors: {
    source: [50.2, 69.8],
    beam: [45.6, 56.3],
    patient: [40.0, 39.8],
    detector: [33.3, 20.1],
    reconstruction: [70.5, 48.4],
    display: [75.1, 39.3],
  },
  labelSide: {
    source: 'right',
    beam: 'right',
    patient: 'left',
    detector: 'left',
    reconstruction: 'left',
    display: 'right',
  },
  boundary:
    'A schematic room and C-arm around a CT-derived chest. The head, pillow and draped body are drawn for context. No device, dimension or clearance is represented.',
}

export function validateImagingHubHero(): readonly string[] {
  const errors: string[] = []
  const hero = IMAGING_HUB_HERO
  if (!hero.src.startsWith('/peripheral-imaging/')) {
    errors.push('The hub picture must be served from the module’s own asset folder.')
  }
  if (!(hero.width > 0 && hero.height > 0)) errors.push('The hub picture declares no size.')
  const located = Object.keys(hero.where).sort().join('|')
  const stops = CHAIN_STOPS.map((stop) => stop.id)
  if (located !== [...stops].sort().join('|')) {
    errors.push('The hub picture must say where every stop of the chain is, and only those.')
  }
  for (const id of stops) {
    errors.push(
      ...imagingLearnerCopyErrors(`The hub picture, where ${id} is`, hero.where[id] ?? '', {
        allowDigits: false,
      }),
    )
  }
  errors.push(
    ...imagingLearnerCopyErrors('The hub picture alt text', hero.alt, { allowDigits: false }),
  )
  errors.push(
    ...imagingLearnerCopyErrors('The hub picture lede', hero.lede, { allowDigits: false }),
  )
  errors.push(...imagingLearnerCopyErrors('The hub picture boundary', hero.boundary))
  return errors
}

const hubHeroErrors = validateImagingHubHero()
if (hubHeroErrors.length > 0) {
  throw new Error(`The hub picture is invalid:\n${hubHeroErrors.join('\n')}`)
}
