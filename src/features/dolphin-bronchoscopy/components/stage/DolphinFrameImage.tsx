'use client'

import { dolphinFrameById } from '../../content/frameBank'
import styles from './dolphin-stage.module.css'

/**
 * A still from the frame bank. Before the learner commits, the image carries only its neutral
 * description, so the alt text never names the answer; after, the description that does.
 */
export function DolphinFrameImage({
  frameId,
  revealed,
}: {
  readonly frameId: string
  readonly revealed: boolean
}) {
  const frame = dolphinFrameById.get(frameId)
  if (!frame) return null
  return (
    <figure className={styles.frame} data-frame={frame.id}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static simulator renders */}
      <img
        src={frame.src}
        width={frame.width}
        height={frame.height}
        alt={revealed ? frame.postCommitAlt : frame.preCommitAlt}
        loading="lazy"
      />
    </figure>
  )
}
