'use client'
import { useEffect, useMemo } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { LESION_CENTER, type Point3 } from '../../lib/physics'
import { add, scale, type SuiteFrame } from './suiteModel'
import type { SuiteCamera } from './types'

export function CameraRig({
  view,
  frame,
  enabled,
}: {
  view: SuiteCamera
  frame: SuiteFrame
  enabled: boolean
}) {
  const { camera, invalidate } = useThree()
  const config = useMemo(() => {
    const f = frame.geometry.field
    const target: Point3 =
      view === 'target' ? LESION_CENTER : view === 'console' ? [f * 0.85, 0, f * 0.4] : frame.iso
    const positions: Record<SuiteCamera, Point3> = {
      suite: [f * 1.8, f * 0.4, f * 1.5],
      room: [f * 2.5, f * 1.8, f * 2.5],
      anterior: [0, f * 2.5, 0.01],
      side: [f * 2.8, 0, 0.01],
      head: [0, 0.01, f * 2.8],
      target: add(LESION_CENTER, [f * 0.45, f * 0.4, f * 0.3]),
      console: [f * 1.4, f * 0.5, f * 1.1],
      beam: add(frame.source, scale(frame.normal, -f * 0.55)),
    }
    return {
      target,
      position: positions[view],
      up: (view === 'beam'
        ? frame.v
        : ['suite', 'room', 'console', 'head'].includes(view)
          ? [0, 1, 0]
          : [0, 0, 1]) as Point3,
    }
  }, [view, frame])
  useEffect(() => {
    camera.position.set(...config.position)
    camera.up.set(...config.up)
    camera.lookAt(...config.target)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, config])
  return (
    <OrbitControls
      target={config.target}
      enabled={enabled}
      enablePan={false}
      enableDamping={false}
      minDistance={frame.geometry.field * 0.15}
      maxDistance={frame.geometry.sid * 4}
    />
  )
}
