'use client'

import { useCallback, useMemo } from 'react'

import { Link } from '@/i18n/navigation'
import type { AirwayScopeLocation } from '@/lib/airway-anatomy/scope-location'

import { dolphinDrillSetById } from '../../content/branchDrillSets'
import { DOLPHIN_PRACTICE_HREF } from '../../content/routes'
import { currentDrillTarget } from '../../engine/branchDrill'
import { BranchDrillOverlay } from '../simulator/BranchDrillOverlay'
import { DolphinScopePane } from '../simulator/DolphinScopePane'
import { useBranchDrill } from '../simulator/useBranchDrill'
import styles from '../stage/dolphin-stage.module.css'

/**
 * A branch drill set on its own: labels and the location pill off, the 3D tree on for "Show me
 * where". Each new target starts the scope again at the set's start.
 */
export function DolphinBranchDrill({ setId }: { readonly setId: string }) {
  const set = dolphinDrillSetById.get(setId)
  const [state, dispatch] = useBranchDrill(set?.targets ?? [])
  const onLocation = useCallback(
    (location: AirwayScopeLocation) =>
      dispatch({ type: 'LOCATION', abbr: location.abbr, pathAbbrs: location.pathAbbrs }),
    [dispatch],
  )
  const workspace = useMemo(
    () =>
      set
        ? ({
            kind: 'scope',
            start: set.start,
            labels: 'hidden',
            showLocation: false,
            tree: true,
            caption: 'Labels and the location are off. Count from the carina.',
          } as const)
        : null,
    [set],
  )
  if (!set || !workspace) return null
  const target = currentDrillTarget(state)
  return (
    <article className={styles.steps} data-branch-drill={setId}>
      <p className={styles.kicker}>Branch drill</p>
      <h1 className="text-2xl font-bold">{set.title}</h1>
      <p>{set.description}</p>
      <BranchDrillOverlay state={state} dispatch={dispatch} />
      <DolphinScopePane
        workspace={workspace}
        startKey={`${setId}:${state.index}`}
        onLocation={onLocation}
        target={target ? { abbr: target, showBeacon: state.showBeacon } : null}
      />
      <div className={styles.actions}>
        <Link className={styles.button} href={DOLPHIN_PRACTICE_HREF}>
          All practice
        </Link>
      </div>
    </article>
  )
}
