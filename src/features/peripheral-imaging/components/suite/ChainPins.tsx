'use client'
import type { RefObject } from 'react'
import type { Point3 } from '../../lib/physics'
import { CHAIN_STOPS } from '../../content/imagingChain'
import { chainStopAnchors, type SuiteFrame } from './suiteModel'
import { chainChoiceInputId, type ChainAnswer, type ChainStop, type SuiteCamera } from './types'
import { SceneLabels, type SceneLabel } from './SceneLabels'
import styles from './suite-scene.module.css'

export function ChainPins({
  frame,
  portal,
  lit,
  answer,
  onCamera,
  monitorOffset,
  objectLabels = [],
}: {
  frame: SuiteFrame
  portal: RefObject<HTMLDivElement>
  lit: ChainStop | null
  answer?: ChainAnswer
  onCamera: (camera: SuiteCamera) => void
  monitorOffset?: Point3
  /** The scene's object labels, laid out in the same pass so a pin never prints over one. */
  objectLabels?: readonly SceneLabel[]
}) {
  const anchors = chainStopAnchors(frame, monitorOffset)
  const shortTitles: Record<ChainStop, string> = {
    source: 'Source',
    beam: 'Beam',
    patient: 'Patient',
    detector: 'Detector',
    reconstruction: 'Reconstruction',
    display: 'Display',
  }
  const cameras: Record<ChainStop, SuiteCamera> = {
    source: 'beam',
    beam: 'side',
    patient: 'target',
    detector: 'beam',
    reconstruction: 'console',
    display: 'console',
  }
  const pins: SceneLabel[] = CHAIN_STOPS.map((stop) => {
    const choices = answer?.choices.filter((choice) => choice.stop === stop.id)
    const title = (
      <>
        <span className={styles.pinTitle}>{stop.title}</span>
        <span className={styles.compactPinTitle} aria-hidden="true">
          {shortTitles[stop.id]}
        </span>
      </>
    )
    const pin = (
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
                {title}
              </label>
            ))
          ) : (
            <span className={styles.pin} data-chain-pin={stop.id}>
              {title}
            </span>
          )
        ) : (
          <button
            type="button"
            className={styles.pin}
            data-chain-pin={stop.id}
            aria-current={lit === stop.id ? 'step' : undefined}
            aria-label={stop.title}
            onClick={() => onCamera(cameras[stop.id])}
          >
            {title}
          </button>
        )}
      </div>
    )
    return {
      id: `pin-${stop.id}`,
      anchor: anchors[stop.id],
      placement: 'side' as const,
      gap: 28,
      estimate: [110, 28],
      node: pin,
    }
  })
  return <SceneLabels portal={portal} labels={[...pins, ...objectLabels]} />
}
