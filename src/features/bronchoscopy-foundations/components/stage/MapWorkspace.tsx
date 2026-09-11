'use client'

import type { AirwayLabel, AirwayMapGeometry, TreeAnswer } from '../../components/scope/types'
import { LocationCaptionStrip } from '../../components/scope/LocationCaptionStrip'
import { TreeMap } from '../../components/scope/TreeMap'
import styles from './bronch-stage.module.css'

/** The Simulator panel when a section reads from the airway map alone: lit airways, no scope. */
export function MapWorkspace({
  map,
  lit,
  caption,
  locationCaption,
  treeAnswer,
}: {
  readonly map: AirwayMapGeometry | null
  readonly lit: readonly AirwayLabel[]
  readonly caption: string
  readonly locationCaption: string
  readonly treeAnswer?: TreeAnswer
}) {
  return (
    <div className={styles.workspace} data-map-workspace>
      <p className={styles.caption} data-workspace-caption>
        {caption}
      </p>
      <LocationCaptionStrip caption={locationCaption} current={null} />
      <TreeMap map={map} lit={lit} current={null} tipLps={null} treeAnswer={treeAnswer} />
    </div>
  )
}
