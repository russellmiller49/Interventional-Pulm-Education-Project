import { useEffect, useRef } from 'react'
import {
  acousticLabelAt,
  type AcousticFrame,
  type AcousticVolume,
} from '@bronchoscopy-core/acoustic'

function ContactFrame({
  frame,
  volume,
  title,
}: {
  frame: AcousticFrame
  volume: AcousticVolume
  title: string
}) {
  const wall = useRef<HTMLCanvasElement>(null),
    ultrasound = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = wall.current?.getContext('2d'),
      scan = ultrasound.current?.getContext('2d')
    if (!ctx || !scan) return
    const width = 192,
      height = 112,
      span = 28
    const pixels = ctx.createImageData(width, height)
    const { originLps: origin, depthAxisLps: depth, lateralAxisLps: lateral } = frame.pose
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const a = ((x - width / 2) * span) / width,
          b = ((height / 2 - y) * span) / width
        const p = origin.map((v, i) => v + a * depth[i] + b * lateral[i])
        const label = volume.metadata.labels[acousticLabelAt(volume, p[0], p[1], p[2])]
        const gray = label?.kind === 'air' ? 20 : label?.kind === 'wall' ? 195 : 73
        pixels.data.set([gray, gray, gray, 255], (y * width + x) * 4)
      }
    ctx.putImageData(pixels, 0, 0)
    ctx.strokeStyle = '#65d8dd'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(96, 44)
    ctx.lineTo(96, 68)
    ctx.stroke()
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(98, 56)
    ctx.lineTo(127, 56)
    ctx.lineTo(122, 52)
    ctx.moveTo(127, 56)
    ctx.lineTo(122, 60)
    ctx.stroke()
    scan.putImageData(
      new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height),
      0,
      0,
    )
  }, [frame, volume])
  return (
    <figure>
      <figcaption>{title}</figcaption>
      <canvas
        ref={wall}
        width={192}
        height={112}
        aria-label={`${title} tip-to-wall model section: bright airway wall, dark air space, cyan transducer position and scan direction`}
      />
      <canvas
        ref={ultrasound}
        width={frame.width}
        height={frame.height}
        aria-label={`${title} actual grayscale ultrasound acquisition`}
      />
    </figure>
  )
}
export function ContactComparison({
  baseline,
  current,
  volume,
}: {
  baseline: AcousticFrame
  current: AcousticFrame
  volume: AcousticVolume
}) {
  return (
    <section
      className="linked-contact-comparison"
      aria-label="Initial and current contact comparison"
    >
      <h3>Tip and wall: initial / current</h3>
      <p className="guided-label">
        Close-ups sample the same model volume at each acquired transducer position. Cyan marks the
        calibrated transducer origin and scan direction; it is a locator, not a pressure or balloon
        measurement. The grayscale images below are the actual two acquisitions.
      </p>
      <div>
        <ContactFrame frame={baseline} volume={volume} title="Initial" />
        <ContactFrame frame={current} volume={volume} title="Current" />
      </div>
      <p className="guided-label">
        The optical view can show the wall while the transducer still faces air.
      </p>
    </section>
  )
}
