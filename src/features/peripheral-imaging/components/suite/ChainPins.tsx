'use client'
import { Html } from '@react-three/drei'
import type { RefObject } from 'react'
import { CHAIN_STOPS } from '../../content/imagingChain'
import { chainStopAnchors, type SuiteFrame } from './suiteModel'
import { chainChoiceInputId, type ChainAnswer, type ChainStop, type SuiteCamera } from './types'
import styles from './suite-scene.module.css'

export function ChainPins({
  frame,
  portal,
  lit,
  answer,
  onCamera,
}: {
  frame: SuiteFrame
  portal: RefObject<HTMLDivElement>
  lit: ChainStop | null
  answer?: ChainAnswer
  onCamera: (camera: SuiteCamera) => void
}) {
  const anchors = chainStopAnchors(frame)
  const cameras: Record<ChainStop, SuiteCamera> = {
    source: 'beam',
    beam: 'side',
    patient: 'target',
    detector: 'beam',
    reconstruction: 'console',
    display: 'console',
  }
  return (
    <>
      {CHAIN_STOPS.map((stop) => {
        const choices = answer?.choices.filter((choice) => choice.stop === stop.id)
        return (
          <Html
            key={stop.id}
            portal={portal}
            position={anchors[stop.id]}
            center
            zIndexRange={[20, 10]}
          >
            <div className={styles.pinWrap}>
              {answer ? (
                choices?.length ? (
                  choices.map((choice) => (
                    <label
                      key={choice.id}
                      className={styles.pin}
                      htmlFor={chainChoiceInputId(answer.name, choice.id)}
                      data-chain-pin={stop.id}
                      aria-current={!answer && lit === stop.id ? 'step' : undefined}
                      data-selected={answer.selectedChoiceId === choice.id ? 'true' : undefined}
                      aria-disabled={answer.disabled}
                      title={choice.label}
                    >
                      {stop.title}
                    </label>
                  ))
                ) : (
                  <span className={styles.pin} data-chain-pin={stop.id}>
                    {stop.title}
                  </span>
                )
              ) : (
                <button
                  type="button"
                  className={styles.pin}
                  data-chain-pin={stop.id}
                  aria-current={lit === stop.id ? 'step' : undefined}
                  onClick={() => onCamera(cameras[stop.id])}
                >
                  {stop.title}
                </button>
              )}
            </div>
          </Html>
        )
      })}
    </>
  )
}
