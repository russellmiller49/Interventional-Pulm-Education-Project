'use client'

import { useMemo, useReducer } from 'react'

import type { ImagingStageLesson } from '../../content/stageLessons'
import { emptyImagingStageSession, imagingStageReducer } from '../../engine/stageSession'

/**
 * The one session a section runs on: the lab's values and history, the commitments, and the
 * readout snapshots — one reducer, no clock. The labs are pure functions of their controls, so
 * nothing ticks; a restart remounts the host with a new key and this hook starts from nothing.
 */
export function useImagingStageSession(lesson: ImagingStageLesson) {
  const reducer = useMemo(() => imagingStageReducer(lesson), [lesson])
  const [session, dispatch] = useReducer(reducer, lesson, emptyImagingStageSession)
  return { session, dispatch }
}
