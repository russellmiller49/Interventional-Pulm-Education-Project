'use client'

import { useMemo, useReducer } from 'react'

import { passageToTarget } from '../../content/branchDrillSets'
import { drillReducer, initialDrillState } from '../../engine/branchDrill'

/** The drill's state over a list of targets. Nothing in it is stored, timed or counted. */
export function useBranchDrill(targets: readonly string[]) {
  const reducer = useMemo(() => drillReducer(passageToTarget), [])
  return useReducer(reducer, targets, initialDrillState)
}
