'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

import {
  ecmoCircuitMapTextEquivalent,
  ecmoMapImplicatedCaption,
  ecmoMapImplicatedSegmentIds,
  ecmoMapSensorSiteIds,
  ecmoMapWalkStopCaption,
  ecmoMapWalkStopSegmentIds,
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
import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect'
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
 * container, adds no scroller, takes no tab stop, and animates nothing. It shows no live value at
 * all — the panels around it already report every number with its own provenance, and a schematic
 * that also printed numbers would be a second opinion about what the console is saying.
 *
 * Nothing here is carried by colour. The blood path is solid and the gas path is dashed, direction
 * is carried by arrowheads, and an implicated segment is drawn thicker, ticked, marked with a
 * diamond, and named in words underneath. That is the same triple encoding the drainage-judder cue
 * uses in the large schematic, for the same reason: this diagram is read by people who cannot tell
 * two teals apart. Everything is `currentColor`, because the Learn pane is dark and the foundation
 * pane is light and a palette of its own would be legible in exactly one of them.
 *
 * ## Two layouts, one circuit
 *
 * The first version had a single landscape drawing that simply scaled. Measured in a browser, its
 * labels rendered at 5.7 CSS pixels at the 280px pane floor and 10.4px at 480px — the caption and
 * the text equivalent were carrying the lesson while the picture, which is the point, was not
 * readable. A viewBox scales type along with everything else, so there is no font size that fixes
 * a landscape drawing in a narrow column.
 *
 * The fix is a second *geometry*, not a second drawing: the compact layout folds the same circuit
 * into a portrait spine with the labels beside it, so the same type is roughly twice as large on
 * screen. Both layouts read the same segment registry, the same sensor sites, the same presentation
 * state and the same text-equivalent builder — only the coordinates differ. Anything else and the
 * two would eventually disagree about the circuit.
 */

export type EcmoCircuitMinimapLayoutId = 'regular' | 'compact'

/**
 * Below this drawing width the landscape geometry cannot hold twelve-pixel type.
 *
 * Derived rather than chosen. The landscape viewBox is 320 units wide and its smallest label is
 * 8.8 units, so it reaches 12 CSS pixels only once the drawing is about 436px across. The portrait
 * geometry is 168 units wide and capped at 288px, so it holds 12 to 15px everywhere it is used —
 * including the 246px a drawing gets inside the teaching pane's 280px floor.
 *
 * This is compared against the *drawing* width, not the panel's. Comparing against `clientWidth`
 * silently added the panel's 32px of padding to every measurement, which chose the landscape
 * geometry for a 400px drawing and rendered its labels at 10.9px — under the floor this constant
 * exists to hold.
 */
export const ECMO_MINIMAP_COMPACT_BELOW_PX = 436

export function ecmoMinimapLayoutForWidth(availableWidth: number): EcmoCircuitMinimapLayoutId {
  return availableWidth > 0 && availableWidth < ECMO_MINIMAP_COMPACT_BELOW_PX
    ? 'compact'
    : 'regular'
}

interface SegmentGeometry {
  readonly d?: string
  readonly rect?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly circle?: { readonly cx: number; readonly cy: number; readonly r: number }
  readonly dashed?: boolean
  /** Where a diamond goes when this segment is implicated. */
  readonly marker: { readonly x: number; readonly y: number }
  readonly label?: {
    readonly x: number
    readonly y: number
    readonly anchor: 'start' | 'middle' | 'end'
  }
  readonly arrow?: boolean
}

interface SiteGeometry {
  readonly x: number
  readonly y: number
  readonly labelX: number
  readonly labelY: number
  readonly anchor: 'start' | 'middle' | 'end'
  /** The gradient is a bracket rather than a point, so it carries no dot. */
  readonly noDot?: boolean
}

interface MinimapLayout {
  readonly id: EcmoCircuitMinimapLayoutId
  readonly viewBox: { readonly w: number; readonly h: number }
  /** Caps how large the drawing grows, so compact type stays around twelve pixels. */
  readonly widthClass: string
  readonly segmentFontSize: number
  readonly siteFontSize: number
  readonly segments: Readonly<Record<EcmoCircuitSegmentId, SegmentGeometry>>
  readonly sites: Readonly<Record<EcmoSensorSiteId, SiteGeometry>>
  /** The blender feeding the membrane's gas side. */
  readonly gasDrop: string
  /** The bracket that says the gradient spans the membrane rather than sitting at a point. */
  readonly deltaPBracket: string
}

/*
 * Landscape. A racetrack, because the blood path is a loop and drawing it as a strip would teach
 * that blood stops at the return cannula. The patient sits at the left and is both start and end.
 */
const REGULAR: MinimapLayout = {
  id: 'regular',
  viewBox: { w: 320, h: 140 },
  widthClass: 'max-w-[30rem]',
  // Sized so the smallest label clears twelve screen pixels at the narrowest width this layout is
  // ever chosen for; below that the compact geometry takes over.
  segmentFontSize: 9.5,
  siteFontSize: 8.8,
  segments: {
    patient: {
      rect: { x: 6, y: 58, w: 52, h: 68 },
      marker: { x: 32, y: 58 },
      label: { x: 32, y: 96, anchor: 'middle' },
    },
    drainage: {
      d: 'M58 72 L82 50 L124 50',
      marker: { x: 92, y: 50 },
      label: { x: 98, y: 39, anchor: 'middle' },
      arrow: true,
    },
    pump: {
      circle: { cx: 142, cy: 50, r: 13 },
      marker: { x: 142, y: 37 },
      label: { x: 142, y: 25, anchor: 'middle' },
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
      label: { x: 153, y: 119, anchor: 'middle' },
      arrow: true,
    },
    'gas-supply': {
      rect: { x: 176, y: 6, w: 76, h: 15 },
      dashed: true,
      marker: { x: 252, y: 13 },
      label: { x: 214, y: 17, anchor: 'middle' },
    },
    'membrane-gas-side': {
      d: 'M198 40 L252 40',
      dashed: true,
      marker: { x: 225, y: 40 },
      label: { x: 259, y: 43, anchor: 'start' },
    },
  },
  sites: {
    pVen: { x: 106, y: 50, labelX: 106, labelY: 64, anchor: 'middle' },
    'svo2-venous-cell': { x: 163, y: 50, labelX: 159, labelY: 64, anchor: 'middle' },
    pInt: { x: 186, y: 50, labelX: 186, labelY: 78, anchor: 'middle' },
    deltaP: { x: 225, y: 78, labelX: 225, labelY: 90, anchor: 'middle', noDot: true },
    pArt: { x: 298, y: 64, labelX: 290, labelY: 67, anchor: 'end' },
    'post-oxygenator-saturation': { x: 298, y: 88, labelX: 290, labelY: 91, anchor: 'end' },
    'flow-bubble-sensor': { x: 274, y: 106, labelX: 272, labelY: 119, anchor: 'middle' },
  },
  gasDrop: 'M240 21 L240 32',
  deltaPBracket: 'M194 74 L194 78 L256 78 L256 74',
}

/*
 * Portrait. The same loop folded into a vertical spine with every name beside it, and the return
 * running back up the left margin. Twice the type for the same pixels, and the reading order —
 * patient at the top, back to the patient at the bottom — matches the order the walk teaches.
 */
const COMPACT: MinimapLayout = {
  id: 'compact',
  viewBox: { w: 168, h: 220 },
  widthClass: 'max-w-[18rem]',
  segmentFontSize: 9,
  siteFontSize: 8.5,
  segments: {
    patient: {
      rect: { x: 16, y: 4, w: 88, h: 22 },
      marker: { x: 60, y: 4 },
      label: { x: 60, y: 18, anchor: 'middle' },
    },
    drainage: {
      d: 'M44 26 L44 60',
      marker: { x: 44, y: 34 },
      label: { x: 56, y: 36, anchor: 'start' },
      arrow: true,
    },
    pump: {
      circle: { cx: 44, cy: 72, r: 11 },
      marker: { x: 44, y: 61 },
      label: { x: 58, y: 75, anchor: 'start' },
    },
    'pre-membrane': { d: 'M44 83 L44 116', marker: { x: 44, y: 100 }, arrow: true },
    membrane: {
      rect: { x: 24, y: 116, w: 60, h: 40 },
      marker: { x: 24, y: 136 },
      label: { x: 54, y: 151, anchor: 'middle' },
    },
    'post-membrane': { d: 'M44 156 L44 196', marker: { x: 44, y: 158 }, arrow: true },
    return: {
      d: 'M44 196 L12 196 L12 15 L16 15',
      marker: { x: 12, y: 105 },
      label: { x: 24, y: 208, anchor: 'start' },
      arrow: true,
    },
    'gas-supply': {
      rect: { x: 96, y: 116, w: 64, h: 18 },
      dashed: true,
      marker: { x: 128, y: 134 },
      label: { x: 128, y: 128, anchor: 'middle' },
    },
    'membrane-gas-side': {
      d: 'M30 124 L78 124',
      dashed: true,
      marker: { x: 54, y: 124 },
      label: { x: 54, y: 136, anchor: 'middle' },
    },
  },
  sites: {
    pVen: { x: 44, y: 50, labelX: 56, labelY: 53, anchor: 'start' },
    pInt: { x: 44, y: 92, labelX: 56, labelY: 95, anchor: 'start' },
    'svo2-venous-cell': { x: 44, y: 106, labelX: 56, labelY: 109, anchor: 'start' },
    deltaP: { x: 92, y: 136, labelX: 96, labelY: 148, anchor: 'start', noDot: true },
    pArt: { x: 44, y: 164, labelX: 56, labelY: 167, anchor: 'start' },
    'post-oxygenator-saturation': { x: 44, y: 176, labelX: 56, labelY: 179, anchor: 'start' },
    'flow-bubble-sensor': { x: 44, y: 188, labelX: 56, labelY: 191, anchor: 'start' },
  },
  // The blender sits against the membrane rather than above it: there is no room overhead, and
  // adjacency is the true relationship anyway.
  gasDrop: 'M96 125 L84 125',
  deltaPBracket: 'M88 116 L92 116 L92 156 L88 156',
}

export interface EcmoCircuitMinimapProps {
  readonly supportMode: SupportMode
  readonly presentation: EcmoCircuitPresentation
  /**
   * Force a layout instead of measuring for one.
   *
   * The measurement below needs a live browser, so the offline render harness and the component
   * tests name the layout they want to look at. Nothing in the app passes it.
   */
  readonly layout?: EcmoCircuitMinimapLayoutId
  /**
   * How the map is boxed.
   *
   * `card` is the standalone presentation R2 shipped: its own rounded border and padding, sized
   * for sitting directly in a pane. `flush` is for a host that already provides the card — the
   * circuit walk embeds this map inside its own bordered stop card, and the doubled chrome cost
   * the drawing 34px of width. At the workspace's 280px pane floor that squeezed the compact
   * geometry to a 212px drawing and its type to 11.4px, under the 12px floor the compact layout
   * exists to hold; R2's floor guarantee was authored against the un-nested 246px. Flush restores
   * exactly that content width, with the same geometry and the same type.
   */
  readonly frame?: 'card' | 'flush'
}

export function EcmoCircuitMinimap({
  supportMode,
  presentation,
  layout: forcedLayout,
  frame = 'card',
}: EcmoCircuitMinimapProps) {
  const headingId = useId()
  const titleId = useId()
  const arrowId = useId()

  const sectionRef = useRef<HTMLElement>(null)
  const [measuredLayout, setMeasuredLayout] = useState<EcmoCircuitMinimapLayoutId | null>(null)

  const measure = useCallback(() => {
    const section = sectionRef.current
    if (!section) return
    /*
     * The content box, which is the width the drawing itself gets. `clientWidth` is content plus
     * padding, and using it put every measurement 32px over — enough to pick the landscape geometry
     * for a drawing too narrow to carry it.
     */
    const style = getComputedStyle(section)
    const available =
      section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    if (!(available > 0)) return
    setMeasuredLayout((current) => {
      const next = ecmoMinimapLayoutForWidth(available)
      return current === next ? current : next
    })
  }, [])

  useIsomorphicLayoutEffect(() => {
    if (forcedLayout) return undefined
    measure()
    /*
     * `ResizableTeachingWorkspace` sizes its panes from its own deferred pass, so the width read
     * before the first paint is a width the pane will not keep. The same settle passes the console's
     * fit surface uses apply here, and the observer below is the steady-state mechanism.
     */
    const timers = [window.setTimeout(measure, 0), window.setTimeout(measure, 48)]
    const frame =
      typeof requestAnimationFrame === 'undefined' ? null : requestAnimationFrame(measure)
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [forcedLayout, measure])

  useEffect(() => {
    const section = sectionRef.current
    // jsdom has no ResizeObserver; the tests name the layout they are looking at instead.
    if (forcedLayout || !section || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => measure())
    observer.observe(section)
    return () => observer.disconnect()
  }, [forcedLayout, measure])

  const layout = forcedLayout ?? measuredLayout ?? 'regular'
  const geometry = layout === 'compact' ? COMPACT : REGULAR

  const implicated = new Set(ecmoMapImplicatedSegmentIds(presentation))
  const anyImplicated = implicated.size > 0
  /*
   * The walk's marking, kept in its own set.
   *
   * Two vocabularies, never mixed: a stop says "you are here", a row says "the problem lives here".
   * They cannot co-occur — the presentation is one kind or the other — so the drawing can treat
   * them separately without ever having to decide which wins.
   */
  const atStop = new Set(ecmoMapWalkStopSegmentIds(presentation))
  const anyAtStop = atStop.size > 0
  const siteIds = ecmoMapSensorSiteIds(presentation)
  const caption =
    ecmoMapWalkStopCaption(presentation, supportMode) ??
    ecmoMapImplicatedCaption(presentation, supportMode)
  const mapTitle = [
    `${supportMode === 'va' ? 'Venoarterial' : 'Venovenous'} circuit map. `,
    'The blood path is drawn solid and the sweep-gas path dashed',
    anyImplicated ? ', with the implicated part of the circuit marked.' : '',
    anyAtStop ? ', with the part of the circuit this stop is standing at marked.' : '',
    !anyImplicated && !anyAtStop ? '.' : '',
    ' The description below carries the same information in words.',
  ].join('')

  const segment = (id: EcmoCircuitSegmentId) => {
    const shape = geometry.segments[id]
    const isImplicated = implicated.has(id)
    const isAtStop = atStop.has(id)
    const record = ecmoCircuitSegment(id)
    const shared = {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: isImplicated || isAtStop ? 4.5 : 2,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      strokeDasharray: shape.dashed ? '5 3' : undefined,
      markerEnd: shape.arrow ? `url(#${arrowId})` : undefined,
    }

    return (
      <g
        key={id}
        data-map-segment={id}
        // Left binary on purpose. The drills' leak test asserts the absence of the implicated
        // attribute, and a third value here would turn that from a question about presence into a
        // question about which value — so the walk's marking gets an attribute of its own.
        data-segment-state={isImplicated ? 'implicated' : 'neutral'}
        data-circuit-implicated={isImplicated ? 'true' : undefined}
        data-walk-stop-segment={isAtStop ? 'true' : undefined}
        // A redundant cue, never the carrier: weight, the ticks, the marker and the caption all
        // say the same thing without it.
        opacity={(anyImplicated && !isImplicated) || (anyAtStop && !isAtStop) ? 0.55 : 1}
      >
        {shape.d ? <path d={shape.d} {...shared} /> : null}
        {shape.rect ? (
          <rect
            x={shape.rect.x}
            y={shape.rect.y}
            width={shape.rect.w}
            height={shape.rect.h}
            rx={6}
            {...shared}
            markerEnd={undefined}
          />
        ) : null}
        {shape.circle ? (
          <circle
            cx={shape.circle.cx}
            cy={shape.circle.cy}
            r={shape.circle.r}
            {...shared}
            markerEnd={undefined}
          />
        ) : null}
        {isImplicated ? (
          <>
            {/*
              Ticks along the line, not a dashed line over it. A thin dashed stroke in
              `currentColor` laid over a thicker stroke of the same colour is invisible by
              construction; this overlay is wider than the stroke it sits on and mostly gap, so what
              shows is a row of short bars standing proud of the line — a texture that survives
              being printed in one ink, which is the whole point of having it.
            */}
            {shape.d ? (
              <path
                d={shape.d}
                fill="none"
                stroke="currentColor"
                strokeWidth={9}
                strokeDasharray="1.5 8"
                strokeLinecap="butt"
                data-implicated-texture
              />
            ) : null}
            {shape.rect ? (
              <rect
                x={shape.rect.x - 3}
                y={shape.rect.y - 3}
                width={shape.rect.w + 6}
                height={shape.rect.h + 6}
                rx={8}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="2 3"
                data-implicated-texture
              />
            ) : null}
            <path
              d={`M${shape.marker.x} ${shape.marker.y - 5} L${shape.marker.x + 5} ${shape.marker.y} L${shape.marker.x} ${shape.marker.y + 5} L${shape.marker.x - 5} ${shape.marker.y} Z`}
              fill="currentColor"
              data-implicated-marker
            />
          </>
        ) : null}
        {isAtStop ? (
          /*
            A ring, where an implicated segment gets a filled diamond.
            Different shape rather than different colour or a second weight, so the two marks are
            told apart by someone reading this printed in one ink — and so a learner who has met the
            diamond in a drill does not read "you are here" as an accusation. Both geometries share
            the marker anchor the diamond already uses, so the compact map needed no new coordinates.
          */
          <g data-walk-stop-marker>
            <circle
              cx={shape.marker.x}
              cy={shape.marker.y}
              r={6}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            />
            <circle cx={shape.marker.x} cy={shape.marker.y} r={1.8} fill="currentColor" />
          </g>
        ) : null}
        {shape.label ? (
          <text
            x={shape.label.x}
            y={shape.label.y}
            textAnchor={shape.label.anchor}
            fontSize={geometry.segmentFontSize}
            fontWeight={isImplicated || isAtStop ? 700 : 500}
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
      ref={sectionRef}
      className={frame === 'flush' ? 'min-w-0' : styles.section}
      aria-labelledby={headingId}
      data-circuit-minimap
      data-map-frame={frame}
      data-map-layout={layout}
      data-support-mode={supportMode}
      data-presentation={presentation.kind}
      data-scaffold-emphasis={presentation.kind === 'scaffold' ? presentation.emphasis : undefined}
      data-implicated-row={presentation.kind === 'implicated' ? presentation.rowId : undefined}
      data-walk-stop={presentation.kind === 'walk-stop' ? presentation.stopId : undefined}
    >
      <h3 id={headingId} className={styles.heading}>
        The circuit, and where each reading is taken
      </h3>

      <svg
        className={`mt-3 h-auto w-full ${geometry.widthClass}`}
        viewBox={`0 0 ${geometry.viewBox.w} ${geometry.viewBox.h}`}
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

        <g data-map-path="gas">
          {segment('gas-supply')}
          <path
            d={geometry.gasDrop}
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
            d={geometry.deltaPBracket}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            aria-hidden="true"
          />
        ) : null}

        <g data-map-sites>
          {siteIds.map((siteId) => {
            const site = ecmoSensorSite(siteId)
            const spot = geometry.sites[siteId]
            return (
              <g key={siteId} data-map-sensor-site={siteId}>
                {spot.noDot ? null : (
                  <circle
                    cx={spot.x}
                    cy={spot.y}
                    r={3.4}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                  />
                )}
                <text
                  x={spot.labelX}
                  y={spot.labelY}
                  textAnchor={spot.anchor}
                  fontSize={geometry.siteFontSize}
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
        <p
          className="mt-2 text-xs font-semibold leading-5"
          data-implicated-caption={presentation.kind === 'implicated' ? true : undefined}
          data-walk-stop-caption={presentation.kind === 'walk-stop' ? true : undefined}
        >
          {caption}
        </p>
      ) : null}

      <TextEquivalent>{ecmoCircuitMapTextEquivalent(supportMode, presentation)}</TextEquivalent>
    </section>
  )
}
