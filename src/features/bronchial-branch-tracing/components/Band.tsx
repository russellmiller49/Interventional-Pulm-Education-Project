import { CircleAlert, CircleCheck, CircleDot } from 'lucide-react'
import styles from './nav-bench.module.css'

export type BandTone = 'in' | 'near' | 'miss'

const ICONS = { in: CircleCheck, near: CircleDot, miss: CircleAlert } as const

/**
 * What a check found, in one line under the task card. The tone is carried by an icon as well as
 * the stripe's colour, so it does not rest on colour alone.
 */
export function Band({
  tone,
  headline,
  detail,
}: {
  tone: BandTone
  headline: string
  detail: string
}) {
  const Icon = ICONS[tone]
  return (
    <p className={styles.band} data-verdict-tone={tone} role="status">
      <Icon className={styles.bandIcon} size={16} aria-hidden data-band-icon={tone} />
      <span>
        <strong>{headline}</strong> {detail}
      </span>
    </p>
  )
}
