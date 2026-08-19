'use client'

import { useEffect, useId, useRef } from 'react'

import { deriveEcmoCircuitPresentation } from '../../content/circuitPresentation'
import { ecmoSceneLabelName } from '../../content/circuitSceneAnchors'
import {
  ecmoCircuitSegment,
  ecmoSensorSite,
  resolveEcmoModeText,
} from '../../content/circuitSegments'
import {
  ecmoWalkStopSceneLabelIds,
  ecmoWalkStopSegmentIds,
  ecmoWalkStopTextEquivalent,
  type EcmoCircuitWalkStop,
  type EcmoCircuitWalkStopId,
  type EcmoWalkComparisonBeat,
} from '../../content/circuitWalk'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoCircuitMinimap } from './EcmoCircuitMinimap'
import { ChannelValue, ModelBoundary, TextEquivalent, styles } from './shared'

/**
 * The walk, one stop at a time.
 *
 * Two buttons rather than a rail. The activity already carries a phase navigation in the pane next
 * door, and a second row of six numbered controls beside it would have the learner reading two step
 * counters and working out which one the lesson meant. Back and Next belong to the card whose
 * content they move, and the position is a sentence rather than a widget.
 *
 * What the card deliberately does not own: the prediction, the bounded actions, and the phase. Those
 * live in the activity pane, where they already lived. The teaching pane explains; the activity pane
 * asks. Restating either here would put the same task on screen twice.
 *
 * Nothing here holds a number of its own. Every value is read from the live state through the same
 * `ChannelValue` the panels use, so an unavailable channel arrives with its reason attached rather
 * than as a blank.
 */

/** The console channel each sensor site reads, for the sites that have one. */
const CHANNEL_BY_SITE = {
  pVen: 'pVen',
  pInt: 'pInt',
  pArt: 'pArt',
  deltaP: 'deltaP',
  'svo2-venous-cell': 'venousLineSaturation',
} as const

type ReadableSiteId = keyof typeof CHANNEL_BY_SITE

function isReadableSite(siteId: string): siteId is ReadableSiteId {
  return siteId in CHANNEL_BY_SITE
}

export interface EcmoCircuitWalkProps {
  readonly stops: readonly EcmoCircuitWalkStop[]
  readonly activeStopId: EcmoCircuitWalkStopId
  readonly onStopChange: (id: EcmoCircuitWalkStopId) => void
  readonly state: EcmoSimulationState
  /**
   * How many stops the whole walk has, across both sections.
   *
   * Passed rather than counted here, because "stop three of six" is a fact about the walk and this
   * component only ever holds one section's worth of it.
   */
  readonly walkLength: number
  /**
   * Whether the learner has moved past the phase in which this section takes its prediction.
   *
   * One predicate, several consequences, because they all answer the same question: may this card
   * say a thing the pane next door is about to ask for? Before it, the card withholds the names of
   * the readings it is about — including in its own text equivalent and on its map — and withholds
   * any takeaway a stop declares as an answer. After it, the card is teaching rather than testing
   * and says everything.
   *
   * The flow-path section's own `act` instruction is to find these channels on the map, which is
   * exactly where this turns true.
   */
  readonly pastPrediction: boolean
  readonly onRunComparison?: (beat: EcmoWalkComparisonBeat) => void
  /** Which beat produced the state on screen, so the card can say which one is being read. */
  readonly activeComparisonId?: string | null
}

export function EcmoCircuitWalk({
  stops,
  activeStopId,
  onStopChange,
  state,
  walkLength,
  pastPrediction,
  onRunComparison,
  activeComparisonId = null,
}: EcmoCircuitWalkProps) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const mountedStopRef = useRef<EcmoCircuitWalkStopId | null>(null)

  const index = stops.findIndex((stop) => stop.id === activeStopId)
  const stop = stops[index] ?? stops[0]
  const previous = index > 0 ? stops[index - 1] : null
  const next = index >= 0 && index < stops.length - 1 ? stops[index + 1] : null

  /*
   * Focus follows the stop, but not on arrival.
   *
   * Moving focus when the lesson first renders would take it off whatever the learner was doing to
   * get here. It moves only when the learner themselves changed stop, which is why the first render
   * records the stop instead of reacting to it.
   */
  useEffect(() => {
    if (mountedStopRef.current === null) {
      mountedStopRef.current = stop.id
      return
    }
    if (mountedStopRef.current === stop.id) return
    mountedStopRef.current = stop.id
    headingRef.current?.focus()
  }, [stop.id])

  const { supportMode } = state
  const title = resolveEcmoModeText(stop.title, supportMode)
  const places = ecmoWalkStopSegmentIds(stop)
  const sceneLabels = ecmoWalkStopSceneLabelIds(stop, supportMode)
  const readableSites = pastPrediction ? stop.sensorSiteIds.filter(isReadableSite) : []
  const takeawayVisible = pastPrediction || (stop.takeawayVisibility ?? 'always') === 'always'

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      data-circuit-walk
      data-walk-stop={stop.id}
      data-walk-stop-kind={stop.kind}
    >
      <p className={styles.heading}>
        Circuit walk · stop {stop.ordinal} of {walkLength}
      </p>
      <h3
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 text-base font-semibold outline-none"
      >
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6">{resolveEcmoModeText(stop.analogy, supportMode)}</p>

      <ul className="mt-3 grid gap-1" data-walk-checklist>
        {stop.checklist.map((item) => {
          const text = resolveEcmoModeText(item, supportMode)
          return (
            <li key={text} className="text-sm leading-6">
              {text}
            </li>
          )
        })}
      </ul>

      <EcmoCircuitMinimap
        supportMode={supportMode}
        presentation={deriveEcmoCircuitPresentation(state, {
          kind: 'foundation-walk-stop',
          stopId: stop.id,
          segmentIds: places,
          // The map marks where the learner is standing either way; it names the readings only
          // once naming them cannot answer anything. Ringing and labelling exactly the channel a
          // prediction asks a learner to place is a sharper pointer than the seven this map used to
          // flag in every phase, so narrowing without gating would have made it worse, not better.
          sensorSiteIds: pastPrediction ? stop.sensorSiteIds : [],
        })}
      />

      {/*
        The 3D correspondence, in words that are always on screen.

        The bedside scene hides its labels entirely on a compact viewport, and the learner can
        switch them off at any width, so the highlight there is reinforcement rather than the
        carrier. This line names the same objects the scene names, from the same strings, and it is
        visible rather than screen-reader-only because the people it helps most include anyone
        looking at a pane too narrow to show the scene at all.
      */}
      <p className="mt-3 text-xs leading-5 text-muted-foreground" data-walk-scene-labels>
        Highlighted in the bedside scene:{' '}
        {sceneLabels.map((id) => ecmoSceneLabelName(id, supportMode)).join(' · ')}.
      </p>

      {readableSites.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-4" data-walk-live-signals>
          {readableSites.map((siteId) => {
            const site = ecmoSensorSite(siteId)
            return (
              <ChannelValue
                key={siteId}
                label={site.deviceLabel}
                readout={state.circuit.readouts[CHANNEL_BY_SITE[siteId]]}
                unit={siteId === 'svo2-venous-cell' ? '%' : 'mmHg'}
                precision={siteId === 'svo2-venous-cell' ? 1 : 0}
              />
            )
          })}
        </div>
      ) : null}

      {pastPrediction && stop.sensorSiteIds.length > 0 ? (
        <p className="mt-2 text-xs leading-5" data-walk-reported-here>
          Reported here:{' '}
          {stop.sensorSiteIds
            .map((siteId) => {
              const site = ecmoSensorSite(siteId)
              return `${site.plainName} (${site.deviceLabel})`
            })
            .join(' · ')}
          .
        </p>
      ) : null}

      {stop.kind === 'comparative' && stop.comparison && onRunComparison ? (
        <div className="mt-4 grid gap-2" data-walk-comparison>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Load each state and read it before loading the next
          </p>
          {stop.comparison.map((beat) => (
            <button
              key={beat.id}
              type="button"
              className="rounded-xl border px-3 py-2 text-left text-sm"
              data-walk-beat={beat.id}
              aria-pressed={activeComparisonId === beat.id}
              onClick={() => onRunComparison(beat)}
            >
              <span className="font-semibold">{beat.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {beat.readThis}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {/*
        The takeaway is what the learner should be able to say having stood here, so it sits after
        everything they are standing here to look at — and out of the text equivalent, which
        describes what is on screen rather than what to conclude from it.
      */}
      {takeawayVisible ? (
        <p className="mt-4 text-sm font-medium leading-6" data-walk-takeaway>
          {resolveEcmoModeText(stop.takeaway, supportMode)}
        </p>
      ) : null}

      <TextEquivalent>
        {ecmoWalkStopTextEquivalent(stop, supportMode, { readingsVisible: pastPrediction })}
      </TextEquivalent>

      <ModelBoundary>{resolveEcmoModeText(stop.modelBoundary, supportMode)}</ModelBoundary>

      <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label="Circuit walk">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold disabled:opacity-50"
          data-walk-back
          disabled={!previous}
          onClick={() => previous && onStopChange(previous.id)}
        >
          Back
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold disabled:opacity-50"
          data-walk-next
          disabled={!next}
          onClick={() => next && onStopChange(next.id)}
        >
          Next
        </button>
        <span className="text-xs text-muted-foreground">
          {previous
            ? `Back: ${resolveEcmoModeText(previous.title, supportMode)}`
            : 'This is the first stop in this section.'}
        </span>
      </nav>

      {/*
        One live region, and it announces the stop only.

        The circuit clock ticks every modelled second, so piping readouts in here would produce a
        stream a screen-reader user has to sit through rather than a change they wanted to know
        about. The values are reachable on demand through the text equivalents that are already
        beside them.
      */}
      <p className="sr-only" role="status" data-walk-status>
        Stop {stop.ordinal} of {walkLength}. {title}. On the circuit:{' '}
        {places
          .map((segmentId) => resolveEcmoModeText(ecmoCircuitSegment(segmentId).label, supportMode))
          .join(', ')}
        .
      </p>
    </section>
  )
}
