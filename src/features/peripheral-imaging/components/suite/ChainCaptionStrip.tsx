'use client'

import { CHAIN_STOPS, type ChainStopId } from '../../content/imagingChain'
import styles from './suite-fallback.module.css'
import { SUITE_DOM } from './types'

/**
 * The chain as a DOM strip: six numbered stops, the lit one marked `aria-current="step"`.
 *
 * This is the indicator the fallback pane and the test double show; Codex's 3D pins carry the
 * same `data-chain-pin` names so the flow tests read one contract. It never answers anything —
 * answers go through `ChainAnswerFieldset`.
 */
export function ChainCaptionStrip({
  lit,
  caption,
}: {
  readonly lit: ChainStopId | null
  readonly caption: string
}) {
  return (
    <div>
      <p className={styles.caption} data-chain-caption>
        {caption}
      </p>
      <ol
        className={styles.chainStrip}
        aria-label="The imaging chain"
        {...{ [SUITE_DOM.chainMap]: '' }}
      >
        {CHAIN_STOPS.map((stop) => (
          <li
            key={stop.id}
            aria-current={stop.id === lit ? 'step' : undefined}
            {...{ [SUITE_DOM.chainPin]: stop.id }}
          >
            <span aria-hidden="true">{stop.number}</span>
            <span>{stop.title}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
