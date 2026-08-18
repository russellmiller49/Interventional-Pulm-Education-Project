import { useId } from 'react'

import {
  ecmoCircuitMapTextEquivalent,
  ecmoMapImplicatedCaption,
  ecmoMapImplicatedSegmentIds,
  ecmoMapSensorSiteIds,
  type EcmoCircuitPresentation,
} from '../../content/circuitPresentation'
import {
  ecmoCircuitSegment,
  ecmoSensorSite,
  resolveEcmoModeText,
  type EcmoCircuitSegmentId,
  type EcmoSensorSiteId,
} from '../../content/circuitSegments'
import type { SupportMode } from '../../engine/types'
import { TextEquivalent, styles } from './shared'

/**
 * A small schematic of the circuit, in the teaching pane, always drawn the same way round.
 *
 * The module has a bedside scene and a full pressure-zone poster, and both live in the simulator
 * pane at a width the teaching pane never has — the poster alone insists on a thousand and forty
 * pixels. What was missing was a "you are here" a lesson could carry: the signals were named in
 * tables and the learner was asked to hold a map the interface never drew.
 *
 * So this is deliberately the smallest honest drawing of the whole circuit. It scales to its
 * container with no minimum width, adds no scroller, takes no tab stop, and animates nothing. It
 * shows no live value at all — the panels around it already report every number with its own
 * provenance, and a schematic that also printed numbers would be a second opinion about what the
 * console is saying.
 *
 * Nothing here is carried by colour. The blood path is solid and the gas path is dashed, direction
 * is carried by arrowheads, and an implicated segment is drawn thicker, overlaid with a broken
 * stroke, marked with a diamond, and named in words underneath. That is the same triple encoding
 * the drainage-judder cue uses in the large schematic, for the same reason: this diagram is read by
 * people who cannot tell two teals apart.
 *
 * Everything is `currentColor`. The Learn pane is dark and the foundation pane is light, and a
 * palette of its own would have been legible in exactly one of them.
 */

interface SegmentGeometry {
  /** The shape itself, stroked. Rect-shaped segments carry a rect instead of a path. */
  readonly d?: string
  readonly rect?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly circle?: { readonly cx: number; readonly cy: number; readonly r: number }
  readonly dashed?: boolean
  /** Where a diamond goes when this segment is implicated. */
  readonly marker: { readonly x: number; readonly y: number }
  /** Where the segment's own name is drawn, if it is drawn. */
  readonly label?: {
    readonly x: number
    readonly y: number
    readonly anchor: 'start' | 'middle' | 'end'
  }
  readonly arrow?: boolean
}

/*
 * A racetrack, because the blood path is a loop and drawing it as a strip would teach that blood
 * stops at the return cannula. The patient sits at the left and is both the start and the end.
 * Coordinates are hand-placed in a 320-by-140 space: at the narrowest supported teaching pane the
 * drawing renders about two hundred and forty pixels wide, which is legible for the short labels
 * and is why the full names live in the caption and the text equivalent rather than only here.
 */
const SEGMENT_GEOMETRY: Readonly<Record<EcmoCircuitSegmentId, SegmentGeometry>> = {
  patient: {
    rect: { x: 6, y: 58, w: 52, h: 68 },
    marker: { x: 32, y: 58 },
    label: { x: 32, y: 96, anchor: 'middle' },
  },
  drainage: {
    d: 'M58 72 L82 50 L124 50',
    marker: { x: 92, y: 50 },
    label: { x: 98, y: 40, anchor: 'middle' },
    arrow: true,
  },
  pump: {
    circle: { cx: 142, cy: 50, r: 13 },
    marker: { x: 142, y: 37 },
    label: { x: 142, y: 26, anchor: 'middle' },
  },
  'pre-membrane': { d: 'M155 50 L194 50', marker: { x: 174, y: 50 }, arrow: true },
  membrane: {
    rect: { x: 194, y: 32, w: 62, h: 36 },
    marker: { x: 225, y: 32 },
    label: { x: 225, y: 62, anchor: 'middle' },
  },
  'post-membrane': {
    d: 'M256 50 L298 50 L298 106 L248 106',
    marker: { x: 298, y: 78 },
    arrow: true,
  },
  return: {
    d: 'M248 106 L58 106',
    marker: { x: 153, y: 106 },
    label: { x: 153, y: 118, anchor: 'middle' },
    arrow: true,
  },
  'gas-supply': {
    rect: { x: 176, y: 2, w: 76, h: 15 },
    dashed: true,
    marker: { x: 214, y: 17 },
    label: { x: 214, y: 12, anchor: 'middle' },
  },
  'membrane-gas-side': {
    d: 'M198 40 L252 40',
    dashed: true,
    marker: { x: 225, y: 40 },
    label: { x: 215, y: 27, anchor: 'middle' },
  },
}

/** Where each flag sits, and which side of its line the name goes. */
const SITE_GEOMETRY: Readonly<
  Record<
    EcmoSensorSiteId,
    {
      readonly x: number
      readonly y: number
      readonly labelX: number
      readonly labelY: number
      readonly anchor: 'start' | 'middle' | 'end'
    }
  >
> = {
  /*
   * Names sit below their line and clear of the membrane block. The first arrangement put `pInt`
   * above the run, where the membrane's own outline ran through it, and stacked the two return-limb
   * names close enough to read as one label.
   */
  pVen: { x: 106, y: 50, labelX: 106, labelY: 63, anchor: 'middle' },
  'svo2-venous-cell': { x: 163, y: 50, labelX: 160, labelY: 63, anchor: 'middle' },
  pInt: { x: 186, y: 50, labelX: 184, labelY: 63, anchor: 'middle' },
  deltaP: { x: 225, y: 78, labelX: 225, labelY: 89, anchor: 'middle' },
  pArt: { x: 298, y: 64, labelX: 291, labelY: 67, anchor: 'end' },
  'post-oxygenator-saturation': { x: 298, y: 88, labelX: 291, labelY: 91, anchor: 'end' },
  'flow-bubble-sensor': { x: 274, y: 106, labelX: 274, labelY: 117, anchor: 'middle' },
}

/** The gas drop from the blender chip into the gas side of the membrane. */
const GAS_DROP_PATH = 'M240 17 L240 32'

/** The bracket that says the gradient spans the membrane rather than sitting at a point. */
const DELTA_P_BRACKET = 'M194 74 L194 78 L256 78 L256 74'

export interface EcmoCircuitMinimapProps {
  readonly supportMode: SupportMode
  readonly presentation: EcmoCircuitPresentation
}

export function EcmoCircuitMinimap({ supportMode, presentation }: EcmoCircuitMinimapProps) {
  const headingId = useId()
  const titleId = useId()
  const arrowId = useId()

  const implicated = new Set(ecmoMapImplicatedSegmentIds(presentation))
  const anyImplicated = implicated.size > 0
  const siteIds = ecmoMapSensorSiteIds(presentation)
  const caption = ecmoMapImplicatedCaption(presentation, supportMode)
  const mapTitle = [
    `${supportMode === 'va' ? 'Venoarterial' : 'Venovenous'} circuit map.`,
    'The blood path is drawn solid and the sweep-gas path dashed',
    anyImplicated ? ', with the implicated part of the circuit marked.' : '.',
    ' The description below carries the same information in words.',
  ].join('')

  const segment = (id: EcmoCircuitSegmentId) => {
    const geometry = SEGMENT_GEOMETRY[id]
    const isImplicated = implicated.has(id)
    const record = ecmoCircuitSegment(id)
    const strokeWidth = isImplicated ? 4.5 : 2
    const dashArray = geometry.dashed ? '5 3' : undefined
    const shared = {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      strokeDasharray: dashArray,
      markerEnd: geometry.arrow ? `url(#${arrowId})` : undefined,
    }

    return (
      <g
        key={id}
        data-map-segment={id}
        data-segment-state={isImplicated ? 'implicated' : 'neutral'}
        data-circuit-implicated={isImplicated ? 'true' : undefined}
        // A redundant cue, never the carrier: weight, the broken overlay, the diamond and the
        // caption all say the same thing without it.
        opacity={anyImplicated && !isImplicated ? 0.55 : 1}
      >
        {geometry.d ? <path d={geometry.d} {...shared} /> : null}
        {geometry.rect ? (
          <rect
            x={geometry.rect.x}
            y={geometry.rect.y}
            width={geometry.rect.w}
            height={geometry.rect.h}
            rx={6}
            {...shared}
            markerEnd={undefined}
          />
        ) : null}
        {geometry.circle ? (
          <circle
            cx={geometry.circle.cx}
            cy={geometry.circle.cy}
            r={geometry.circle.r}
            {...shared}
            markerEnd={undefined}
          />
        ) : null}
        {isImplicated ? (
          <>
            {/*
              Ticks along the line, not a dashed line over it.

              The first attempt overlaid a thin dashed stroke in `currentColor` on a thicker stroke
              of the same colour, which is invisible by construction — one colour over itself. This
              overlay is *wider* than the stroke it sits on and mostly gap, so what shows is a row
              of short bars standing proud of the line: a texture that survives being printed in
              one ink, which is the whole point of having it.
            */}
            {geometry.d ? (
              <path
                d={geometry.d}
                fill="none"
                stroke="currentColor"
                strokeWidth={9}
                strokeDasharray="1.5 8"
                strokeLinecap="butt"
                data-implicated-texture
              />
            ) : null}
            {geometry.rect ? (
              <rect
                x={geometry.rect.x - 3}
                y={geometry.rect.y - 3}
                width={geometry.rect.w + 6}
                height={geometry.rect.h + 6}
                rx={8}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="2 3"
                data-implicated-texture
              />
            ) : null}
            <path
              d={`M${geometry.marker.x} ${geometry.marker.y - 6} L${geometry.marker.x + 6} ${geometry.marker.y} L${geometry.marker.x} ${geometry.marker.y + 6} L${geometry.marker.x - 6} ${geometry.marker.y} Z`}
              fill="currentColor"
              data-implicated-marker
            />
          </>
        ) : null}
        {geometry.label ? (
          <text
            x={geometry.label.x}
            y={geometry.label.y}
            textAnchor={geometry.label.anchor}
            fontSize={8.5}
            fontWeight={isImplicated ? 700 : 500}
            fill="currentColor"
            stroke="none"
          >
            {resolveEcmoModeText(record.mapLabel, supportMode)}
          </text>
        ) : null}
      </g>
    )
  }

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      data-circuit-minimap
      data-support-mode={supportMode}
      data-presentation={presentation.kind}
      data-scaffold-emphasis={presentation.kind === 'scaffold' ? presentation.emphasis : undefined}
      data-implicated-row={presentation.kind === 'implicated' ? presentation.rowId : undefined}
    >
      <h3 id={headingId} className={styles.heading}>
        The circuit, and where each reading is taken
      </h3>

      <svg
        className="mt-3 h-auto w-full max-w-[30rem]"
        viewBox="0 0 320 140"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={titleId}
      >
        {/*
          One string, deliberately: React renders a `<title>` whose children are an array as a
          warning and a joined mess, because a title element can only hold text.
        */}
        <title id={titleId}>{mapTitle}</title>
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 1 L9 5 L0 9 Z" fill="currentColor" />
          </marker>
        </defs>

        {/* Drawn back to front: the gas drop and the gradient bracket sit under their labels. */}
        <g data-map-path="gas">
          {segment('gas-supply')}
          <path
            d={GAS_DROP_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeDasharray="5 3"
            markerEnd={`url(#${arrowId})`}
            aria-hidden="true"
          />
          {segment('membrane-gas-side')}
        </g>

        <g data-map-path="blood">
          {segment('patient')}
          {segment('drainage')}
          {segment('pump')}
          {segment('pre-membrane')}
          {segment('membrane')}
          {segment('post-membrane')}
          {segment('return')}
        </g>

        {siteIds.includes('deltaP') ? (
          <path
            d={DELTA_P_BRACKET}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            aria-hidden="true"
          />
        ) : null}

        <g data-map-sites>
          {siteIds.map((siteId) => {
            const geometry = SITE_GEOMETRY[siteId]
            const site = ecmoSensorSite(siteId)
            return (
              <g key={siteId} data-map-sensor-site={siteId}>
                {siteId === 'deltaP' ? null : (
                  <circle
                    cx={geometry.x}
                    cy={geometry.y}
                    r={3.4}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                  />
                )}
                <text
                  x={geometry.labelX}
                  y={geometry.labelY}
                  textAnchor={geometry.anchor}
                  fontSize={7.5}
                  fill="currentColor"
                  stroke="none"
                >
                  {site.mapLabel}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {caption ? (
        <p className="mt-2 text-xs font-semibold leading-5" data-implicated-caption>
          {caption}
        </p>
      ) : null}

      <TextEquivalent>{ecmoCircuitMapTextEquivalent(supportMode, presentation)}</TextEquivalent>
    </section>
  )
}
