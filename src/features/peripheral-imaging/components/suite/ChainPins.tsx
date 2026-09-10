'use client'
import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useState, type ReactNode, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { Point3 } from '../../lib/physics'
import { CHAIN_STOPS } from '../../content/imagingChain'
import { chainStopAnchors, type SuiteFrame } from './suiteModel'
import { chainChoiceInputId, type ChainAnswer, type ChainStop, type SuiteCamera } from './types'
import styles from './suite-scene.module.css'

/** Overview labels flank the equipment; leaders retain their physical anchors. */
function OverviewPin({
  anchor,
  index,
  portal,
  children,
}: {
  anchor: Point3
  index: number
  portal: RefObject<HTMLDivElement>
  children: ReactNode
}) {
  const [position, setPosition] = useState<Point3>(anchor)
  useFrame(({ camera }) => {
    const point = new Vector3(...anchor).project(camera)
    point.x = index < 3 ? -0.6 : 0.6
    point.y = 0.64 - (index % 3) * 0.64
    point.unproject(camera)
    if (point.distanceToSquared(new Vector3(...position)) > 0.01)
      setPosition(point.toArray() as Point3)
  })
  return (
    <>
      <Line points={[anchor, position]} color="#698392" lineWidth={0.7} />
      <Html portal={portal} position={position} center zIndexRange={[20, 10]}>
        {children}
      </Html>
    </>
  )
}

export function ChainPins({
  frame,
  portal,
  lit,
  answer,
  onCamera,
  spread = false,
  monitorOffset,
}: {
  frame: SuiteFrame
  portal: RefObject<HTMLDivElement>
  lit: ChainStop | null
  answer?: ChainAnswer
  onCamera: (camera: SuiteCamera) => void
  spread?: boolean
  monitorOffset?: Point3
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
  return (
    <>
      {CHAIN_STOPS.map((stop, index) => {
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
        return spread ? (
          <OverviewPin key={stop.id} portal={portal} anchor={anchors[stop.id]} index={index}>
            {pin}
          </OverviewPin>
        ) : (
          <Html
            key={stop.id}
            portal={portal}
            position={anchors[stop.id]}
            center
            zIndexRange={[20, 10]}
          >
            {pin}
          </Html>
        )
      })}
    </>
  )
}
