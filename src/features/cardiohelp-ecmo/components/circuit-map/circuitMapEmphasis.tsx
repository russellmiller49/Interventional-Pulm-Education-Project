import {
  ecmoMapImplicatedCaption,
  ecmoMapImplicatedSegmentIds,
  ecmoMapSensorSiteIds,
  ecmoMapWalkStopCaption,
  ecmoMapWalkStopSegmentIds,
  type EcmoCircuitPresentation,
} from '../../content/circuitPresentation'
import {
  ecmoSensorSite,
  type EcmoCircuitSegmentId,
  type EcmoSensorSiteId,
} from '../../content/circuitSegments'
import type { SupportMode } from '../../engine/types'
import styles from '../cardiohelp-ecmo.module.css'
import { circuitMapGeometry } from './circuitMapGeometry'

/**
 * The map's "you are here", and its "the problem lives here".
 *
 * The pressure-zone map is the best drawing of the circuit this module has — animated flow, a
 * turning rotor, the gas path through the fibers — and until this layer existed a lesson could not
 * point at any part of it. The circuit walk lit the bedside scene, which hides its labels on a
 * narrow viewport, and drew its own small map in the teaching pane; an owner review found that map
 * crude beside the real one and the real one, behind its tab with nothing marked on it, "basically
 * hidden". So the pointing now happens on the drawing the learner is meant to be looking at.
 *
 * It reads the same presentation value the small map read, from the same derivation, so a walk stop
 * marks the same places here that it marked there and a drill's implicated segments appear at the
 * same instant its localization card reveals — never before commitment, because the derivation
 * consults the engine's own commitment flag rather than anything a caller says.
 *
 * Nothing here is carried by colour alone. An emphasised place gets a wide halo *and* a bright crisp
 * outline *and* a slow pulse, and it is named in words in an HTML caption above the drawing and in
 * the SVG's own description. The pulse is suppressed under reduced motion; the other three survive.
 */

type EmphasisShape =
  | { readonly kind: 'path'; readonly d: string }
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | {
      readonly kind: 'rect'
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
      readonly rx: number
    }

export interface CircuitMapEmphasisTarget {
  readonly id: EcmoCircuitSegmentId | EcmoSensorSiteId
  readonly role: 'segment' | 'sensor-site'
  readonly shapes: readonly EmphasisShape[]
}

interface SegmentMark {
  readonly shapes: readonly EmphasisShape[]
}

function segmentMark(segmentId: EcmoCircuitSegmentId, supportMode: SupportMode): SegmentMark {
  const g = circuitMapGeometry(supportMode)
  switch (segmentId) {
    case 'patient':
      // The torso, which is where both cannulas start and end.
      return {
        shapes: [{ kind: 'rect', x: 84, y: 118, width: 168, height: 378, rx: 48 }],
      }
    case 'drainage':
      return {
        shapes: [
          { kind: 'path', d: g.drainageCannula },
          { kind: 'path', d: g.drainageLimb },
        ],
      }
    case 'pump':
      return {
        shapes: [{ kind: 'circle', cx: g.pump.cx, cy: g.pump.cy, r: g.pump.r + 6 }],
      }
    case 'pre-membrane':
      // The limb halo runs through the access point, which sits on the limb; a second disc there
      // covered the end of "PUMP OUTFLOW" and added nothing.
      return {
        shapes: [{ kind: 'path', d: g.postPumpLimb }],
      }
    case 'membrane':
      // Inset into the body rather than drawn around it: a ring outside the body put its band over
      // "MEMBRANE OXYGENATOR" above, the fibre sub-label below and the first letters of both gas
      // labels to the right. The body is 125 wide; the ring sits four units inside it.
      return {
        shapes: [
          {
            kind: 'rect',
            x: g.oxygenator.x + 4,
            y: g.oxygenator.y + 4,
            width: g.oxygenator.width - 8,
            height: g.oxygenator.height - 8,
            rx: 20,
          },
        ],
      }
    case 'post-membrane':
      return {
        shapes: [{ kind: 'path', d: g.postMembraneRun }],
      }
    case 'return':
      return {
        shapes: [
          { kind: 'path', d: g.returnRun },
          { kind: 'path', d: g.returnCannula },
        ],
      }
    case 'gas-supply':
      // The sweep inlet at the foot of the membrane, and the label that names it.
      return {
        shapes: [
          { kind: 'circle', cx: 762, cy: 466, r: 18 },
          { kind: 'rect', x: 824, y: 443, width: 88, height: 24, rx: 8 },
        ],
      }
    case 'membrane-gas-side':
      return {
        shapes: [
          { kind: 'path', d: g.membraneGasPath },
          { kind: 'rect', x: 712, y: 306, width: 100, height: 158, rx: 8 },
        ],
      }
  }
}

/**
 * The sensor flags the drawing places, by site.
 *
 * Two sites the registry knows have no flag on this map — the drainage-line saturation is measured
 * inside the disposable and the post-membrane saturation is read on the console, not on the tubing
 * — so they get no halo and are not claimed as ringed. The walk card beside the map still names
 * every reading a stop reports.
 */
function sensorSiteMark(siteId: EcmoSensorSiteId): SegmentMark | null {
  const flag = (x: number, y: number, width: number, height: number, rx: number): SegmentMark => ({
    shapes: [{ kind: 'rect', x, y, width, height, rx }],
  })
  // Each ring is the drawn flag plus three units. The flags already sit close to the labels
  // beneath them ("GAS EXHAUST" under pArt, "PRE-OXYGENATOR ACCESS" under pInt), so a ring cannot
  // be generous without covering a word; the Δp ring stops above the membrane label's cap line.
  switch (siteId) {
    case 'pVen':
      return flag(303, 298, 74, 46, 12)
    case 'pInt':
      return flag(547, 272, 74, 46, 12)
    case 'pArt':
      return flag(847, 272, 74, 46, 12)
    case 'deltaP':
      return flag(574, 210, 320, 46, 11)
    case 'flow-bubble-sensor':
      return flag(908, 287, 110, 54, 14)
    case 'svo2-venous-cell':
    case 'post-oxygenator-saturation':
      return null
  }
}

/**
 * What to emphasise for a presentation.
 *
 * Segments come from either the walk stop or the implicated row — never both, because the
 * presentation kinds are disjoint. Sensor sites come only when the drawing is actually placing its
 * flags: a map that is withholding the channel placements has nothing to ring, and ringing the
 * space where a flag would be would place it.
 */
export function circuitMapEmphasisTargets(
  presentation: EcmoCircuitPresentation | null | undefined,
  supportMode: SupportMode,
  options: { readonly sensorFlagsDrawn: boolean },
): readonly CircuitMapEmphasisTarget[] {
  if (!presentation || presentation.kind === 'neutral' || presentation.kind === 'scaffold') {
    // A scaffold annotates the whole instrument, which is what the drawing already does.
    return []
  }
  const segmentIds = [
    ...ecmoMapWalkStopSegmentIds(presentation),
    ...ecmoMapImplicatedSegmentIds(presentation),
  ]
  const targets: CircuitMapEmphasisTarget[] = segmentIds.map((id) => ({
    id,
    role: 'segment',
    ...segmentMark(id, supportMode),
  }))
  if (options.sensorFlagsDrawn) {
    for (const siteId of ecmoMapSensorSiteIds(presentation)) {
      const mark = sensorSiteMark(siteId)
      if (mark) targets.push({ id: siteId, role: 'sensor-site', ...mark })
    }
  }
  return targets
}

/**
 * The words that go with the marking, shared by the caption and the description.
 *
 * Where the drawing is standing or what it implicates, and — when the drawing is placing its flags
 * — which readings it has ringed, named the way the console names them. The second sentence is
 * gated exactly as the rings are: a map that withholds its placements says nothing about them.
 */
export function circuitMapEmphasisCaption(
  presentation: EcmoCircuitPresentation | null | undefined,
  supportMode: SupportMode,
  options: { readonly sensorFlagsDrawn: boolean } = { sensorFlagsDrawn: true },
): string | null {
  if (!presentation) return null
  const place =
    ecmoMapWalkStopCaption(presentation, supportMode) ??
    ecmoMapImplicatedCaption(presentation, supportMode)
  if (!place) return null
  if (!options.sensorFlagsDrawn) return place
  const ringed = ecmoMapSensorSiteIds(presentation)
    .filter((siteId) => sensorSiteMark(siteId) !== null)
    .map((siteId) => {
      const site = ecmoSensorSite(siteId)
      return `${site.plainName} (${site.deviceLabel})`
    })
  if (ringed.length === 0) return place
  return `${place} Ringed on the map: ${ringed.join(', ')}.`
}

/**
 * A limb's halo is wide, because a limb is a line and the halo is what makes it a band. An outline
 * around a body — the pump, the membrane, a flag — is already a shape, and a wide band on it covers
 * the labels beside it; those carry `data-map-halo="outline"` and the stylesheet draws them thinner.
 */
function EmphasisShapeNode({ shape, className }: { shape: EmphasisShape; className: string }) {
  switch (shape.kind) {
    case 'path':
      return <path d={shape.d} className={className} />
    case 'circle':
      return (
        <circle
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          className={className}
          data-map-halo="outline"
        />
      )
    case 'rect':
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          className={className}
          data-map-halo="outline"
        />
      )
  }
}

/**
 * Rendered inside the map's SVG, after everything else, so it sits on top.
 *
 * Each target is drawn twice: a wide translucent halo underneath and a crisp outline on top. The
 * halo is what a learner sees from across the pane; the outline is what survives a monitor with the
 * contrast turned down. `aria-hidden`, because the SVG is one image whose description already
 * carries the caption — a second announcement of the same sentence would be noise.
 */
export function CircuitMapEmphasisLayer({
  targets,
}: {
  readonly targets: readonly CircuitMapEmphasisTarget[]
}) {
  if (targets.length === 0) return null
  return (
    <g data-map-emphasis aria-hidden="true">
      {targets.map((target) => (
        <g
          key={`${target.role}:${target.id}`}
          data-map-emphasis-target={target.id}
          data-map-emphasis-role={target.role}
        >
          {target.shapes.map((shape, index) => (
            <EmphasisShapeNode
              key={`halo-${index}`}
              shape={shape}
              className={styles.mapEmphasisHalo}
            />
          ))}
          {target.shapes.map((shape, index) => (
            <EmphasisShapeNode
              key={`edge-${index}`}
              shape={shape}
              className={styles.mapEmphasisEdge}
            />
          ))}
        </g>
      ))}
    </g>
  )
}
