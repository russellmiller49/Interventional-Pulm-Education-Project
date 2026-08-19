'use client'

import { useState } from 'react'

import {
  ecmoCircuitWalkStops,
  ecmoCircuitWalkStopsForSection,
  type EcmoCircuitWalkStop,
  type EcmoCircuitWalkStopId,
  type EcmoWalkComparisonBeat,
} from '../../content/circuitWalk'
import type { EcmoInteractiveFoundationSectionId } from '../../content/foundationLessonRuntime'

/**
 * Where the walk's position lives, and who is allowed to move it.
 *
 * Controlled when the activity supplies `activeStopId`, because the activity is the only thing that
 * can light the bedside scene and load a comparison state; uncontrolled otherwise, so the panel
 * still works standing on its own in a test or in the offline render harness. The hybrid is worth
 * the few lines: the alternative was either a panel that cannot be rendered without a host, or a
 * host that cannot see where the learner is.
 *
 * Nothing here is persisted. The stop is not progress: visiting one is not completion, credit, or
 * mastery, and the only thing this activity ever writes is the section-traversal marker the
 * transfer commitment already carries.
 */
export interface EcmoWalkPanelProps {
  /** Supplied by the activity, which owns the position when the scene has to follow it. */
  readonly activeStopId?: EcmoCircuitWalkStopId
  readonly onStopChange?: (stop: EcmoCircuitWalkStop) => void
  readonly onRunComparison?: (beat: EcmoWalkComparisonBeat) => void
  readonly activeComparisonId?: string | null
  /**
   * Whether the learner has moved past the phase in which the section takes its prediction.
   *
   * Defaults to true, because most callers — a test reading finished copy, the offline harness —
   * are not asking a learner to predict anything. The activity passes the real predicate.
   */
  readonly pastPrediction?: boolean
}

export interface EcmoCircuitWalkNavigation {
  readonly stops: readonly EcmoCircuitWalkStop[]
  readonly activeStopId: EcmoCircuitWalkStopId
  readonly onStopChange: (id: EcmoCircuitWalkStopId) => void
  readonly walkLength: number
  readonly pastPrediction: boolean
  readonly onRunComparison?: (beat: EcmoWalkComparisonBeat) => void
  readonly activeComparisonId?: string | null
}

export function useEcmoCircuitWalkNavigation(
  sectionId: EcmoInteractiveFoundationSectionId,
  walk: EcmoWalkPanelProps | undefined,
): EcmoCircuitWalkNavigation {
  const stops = ecmoCircuitWalkStopsForSection(sectionId)
  const firstStopId = stops[0].id
  const [uncontrolledStopId, setUncontrolledStopId] = useState<EcmoCircuitWalkStopId>(firstStopId)

  const controlledStopId = walk?.activeStopId
  const activeStopId =
    controlledStopId && stops.some((stop) => stop.id === controlledStopId)
      ? controlledStopId
      : uncontrolledStopId

  // No `useCallback`: this project compiles with the React Compiler, which memoizes this for us and
  // rejects a hand-written dependency list it cannot prove matches.
  const notify = walk?.onStopChange
  const onStopChange = (id: EcmoCircuitWalkStopId) => {
    setUncontrolledStopId(id)
    const moved = ecmoCircuitWalkStops.find((stop) => stop.id === id)
    if (moved) notify?.(moved)
  }

  return {
    stops,
    activeStopId,
    onStopChange,
    // The whole walk, not this section's share of it, so "stop five of six" tells a learner
    // arriving at the second section that they are near the end rather than starting again.
    walkLength: ecmoCircuitWalkStops.length,
    pastPrediction: walk?.pastPrediction ?? true,
    onRunComparison: walk?.onRunComparison,
    activeComparisonId: walk?.activeComparisonId ?? null,
  }
}
