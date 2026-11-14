'use client'

import { useEffect, useState } from 'react'

import { Link } from '@/i18n/navigation'

import { dolphinFrameDrillById } from '../../content/frameDrills'
import { DOLPHIN_PRACTICE_HREF } from '../../content/routes'
import { recordDolphinLocation } from '../../engine/selfPacedProgress'
import { FrameIdentify } from '../stage/acts/FrameIdentify'
import styles from '../stage/dolphin-stage.module.css'

/** A frame drill: each still with its question, answered in any order. Nothing is counted or kept. */
export function DolphinFrameDrill({ drillId }: { readonly drillId: string }) {
  const drill = dolphinFrameDrillById.get(drillId)
  const [picks, setPicks] = useState<Record<string, string>>({})
  useEffect(() => {
    recordDolphinLocation({ kind: 'frame-drill', id: drillId })
  }, [drillId])
  if (!drill) return null
  return (
    <article className={styles.steps} data-frame-drill={drillId}>
      <p className={styles.kicker}>Frame drill</p>
      <h1 className="text-2xl font-bold">{drill.title}</h1>
      <p>{drill.description}</p>
      <FrameIdentify
        identify={{
          id: drill.id,
          prompt: 'Answer each view in any order.',
          rows: drill.items,
          sourceIds: ['dolphin-001-ct'],
        }}
        picks={picks}
        onPick={(rowId, choiceId) => setPicks((current) => ({ ...current, [rowId]: choiceId }))}
      />
      <div className={styles.actions}>
        <Link className={styles.button} href={DOLPHIN_PRACTICE_HREF}>
          All practice
        </Link>
      </div>
    </article>
  )
}
