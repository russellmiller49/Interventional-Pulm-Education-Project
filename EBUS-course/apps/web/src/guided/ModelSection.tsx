import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { acousticLabelAt, type AcousticVolume } from '@bronchoscopy-core/acoustic'
import type { SimulatorProbePose } from '../features/simulator/pose'

export function ModelSection({
  volume,
  pose,
  selectedPoint,
  onViewed,
}: {
  volume: AcousticVolume
  pose: SimulatorProbePose
  selectedPoint: THREE.Vector3 | null
  onViewed: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [plane, setPlane] = useState<'axial' | 'coronal' | 'sagittal'>('axial')
  const [offset, setOffset] = useState(0)
  const point = selectedPoint ?? pose.position
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const size = 300,
      span = 150,
      pixels = ctx.createImageData(size, size)
    const origin = point.clone()
    const right = new THREE.Vector3(plane === 'sagittal' ? 0 : 1, 0, plane === 'sagittal' ? 1 : 0)
    const up = new THREE.Vector3(0, plane === 'axial' ? 0 : 1, plane === 'axial' ? 1 : 0)
    const normal = new THREE.Vector3().crossVectors(right, up)
    origin.addScaledVector(normal, offset)
    const palette = volume.metadata.labels.map((label) =>
      label.kind === 'air'
        ? [14, 29, 38]
        : label.kind === 'node'
          ? [194, 185, 99]
          : label.kind === 'blood'
            ? [133, 96, 119]
            : label.kind === 'wall'
              ? [201, 143, 101]
              : [41, 57, 68],
    )
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++) {
        const p = origin
          .clone()
          .addScaledVector(right, ((col - size / 2) * span) / size)
          .addScaledVector(up, ((size / 2 - row) * span) / size)
        const id = acousticLabelAt(volume, p.x, -p.z, p.y)
        const color = palette[id] ?? [0, 0, 0],
          index = (row * size + col) * 4
        pixels.data.set([...color, 255], index)
      }
    ctx.putImageData(pixels, 0, 0)
    const project = (p: THREE.Vector3) => {
      const d = p.clone().sub(origin)
      return [size / 2 + (d.dot(right) * size) / span, size / 2 - (d.dot(up) * size) / span]
    }
    const cross = project(point)
    ctx.strokeStyle = '#f6c96c'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cross[0] - 8, cross[1])
    ctx.lineTo(cross[0] + 8, cross[1])
    ctx.moveTo(cross[0], cross[1] - 8)
    ctx.lineTo(cross[0], cross[1] + 8)
    ctx.stroke()
    // Intersection direction of the actual longitudinal sector plane with this model section.
    const shaft = pose.tangent.clone().normalize(),
      fanNormal = new THREE.Vector3().crossVectors(shaft, pose.depthAxis).normalize()
    const direction = new THREE.Vector3().crossVectors(fanNormal, normal).normalize()
    // Project the scope plane intersection onto the current section (not merely its origin).
    const denominator = fanNormal.dot(right) ** 2 + fanNormal.dot(up) ** 2
    if (denominator > 1e-8) {
      const displacement = fanNormal.dot(pose.position.clone().sub(origin)) / denominator
      const intersection = origin
        .clone()
        .addScaledVector(right, displacement * fanNormal.dot(right))
        .addScaledVector(up, displacement * fanNormal.dot(up))
      const start = project(intersection.clone().addScaledVector(direction, -100)),
        end = project(intersection.clone().addScaledVector(direction, 100))
      ctx.strokeStyle = '#6bd9e0'
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(...(start as [number, number]))
      ctx.lineTo(...(end as [number, number]))
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.fillStyle = '#edf2f4'
    ctx.font = '12px system-ui'
    ctx.fillText(plane === 'sagittal' ? 'P' : 'R', 8, size / 2)
    ctx.fillText(plane === 'sagittal' ? 'A' : 'L', size - 18, size / 2)
    ctx.fillText(plane === 'axial' ? 'A' : 'S', size / 2, 15)
    ctx.fillText(plane === 'axial' ? 'P' : 'I', size / 2, size - 8)
    onViewed()
  }, [volume, pose, point, plane, offset, onViewed])
  return (
    <section className="linked-section" aria-label="Model section">
      <h3>Model section</h3>
      <p className="guided-label">
        Sections of the ultrasound anatomy label volume. This is not CT. Amber: selected position.
        Cyan: scan-plane intersection.
      </p>
      <div className="guided-tabs">
        {(['axial', 'coronal', 'sagittal'] as const).map((p) => (
          <button key={p} aria-pressed={plane === p} onClick={() => setPlane(p)}>
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <canvas
        ref={canvas}
        width={300}
        height={300}
        aria-label={`${plane} model section with selected position and ultrasound plane`}
      />
      <label>
        Section offset <output>{offset} mm</output>
        <input
          aria-label="Model section offset"
          type="range"
          min="-40"
          max="40"
          value={offset}
          onChange={(e) => setOffset(Number(e.target.value))}
        />
      </label>
      <button onClick={() => setOffset(0)}>Center on selected position</button>
    </section>
  )
}
