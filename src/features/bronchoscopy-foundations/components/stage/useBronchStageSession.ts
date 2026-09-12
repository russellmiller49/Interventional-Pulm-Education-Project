'use client'

import { useMemo, useReducer } from 'react'

import type { BronchStageLesson } from '../../content/stageLessons'
import { bronchStageReducer, emptyBronchStageSession } from '../../engine/stageSession'

/**
 * The one session a section runs on: the scope states, the commitments — one reducer, no clock.
 * Simulated time passes only on a `tick` command; a restart remounts the host with a new key and
 * this hook starts from nothing.
 */
export function useBronchStageSession(lesson: BronchStageLesson) {
  const reducer = useMemo(() => bronchStageReducer(lesson), [lesson])
  const [session, dispatch] = useReducer(reducer, undefined, emptyBronchStageSession)
  return { session, dispatch }
}
