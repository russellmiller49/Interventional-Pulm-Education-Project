'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

import { DOLPHIN_ANATOMY_PRESETS } from '../../content/anatomyPresets'
import type { AnatomyPresetId } from '../../content/types'
import styles from '../stage/dolphin-stage.module.css'

const DolphinScene = dynamic(
  () => import('@/features/dolphin-anatomy/components/DolphinScene').then((m) => m.DolphinScene),
  {
    ssr: false,
    loading: () => <div className={styles.paneLoading}>Loading the 3D dolphin…</div>,
  },
)

/**
 * The whole-body 3D dolphin with a section's preset: which structures, from which side. A pick is
 * handed to the section's act. Orbit stays free; the preset's view is re-issued when `serial`
 * changes (a new step, a Reset).
 */
export function DolphinAnatomyPane({
  preset,
  serial,
  selectedId,
  caption,
  onPick,
}: {
  readonly preset: AnatomyPresetId
  readonly serial: number
  readonly selectedId: string | null
  readonly caption: string
  readonly onPick: (structureId: string) => void
}) {
  const spec = DOLPHIN_ANATOMY_PRESETS[preset]
  const visible = useMemo(
    () => Object.fromEntries(spec.structures.map((id) => [id, true] as const)),
    [spec.structures],
  )
  const view = useMemo(() => ({ name: spec.view, serial }), [spec.view, serial])
  return (
    <figure className={styles.simulatorFigure} data-dolphin-anatomy-pane={preset}>
      <div className={styles.anatomyCanvas} data-landmark="3D dolphin">
        <DolphinScene
          visible={visible}
          surfaceOpacity={spec.surfaceOpacity}
          selectedId={selectedId}
          view={view}
          onPick={onPick}
        />
      </div>
      <figcaption className={styles.paneCaption}>{caption}</figcaption>
    </figure>
  )
}
