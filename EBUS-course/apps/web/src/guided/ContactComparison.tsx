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
    // Find each sampled region; leaders must end on that region, not an averaged point in a gap.
    const centroid = { air: [0, 0, 0], wall: [0, 0, 0], soft: [0, 0, 0] }
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const a = ((x - width / 2) * span) / width,
          b = ((height / 2 - y) * span) / width
        const p = origin.map((v, i) => v + a * depth[i] + b * lateral[i])
        const label = volume.metadata.labels[acousticLabelAt(volume, p[0], p[1], p[2])]
        const kind = label?.kind === 'air' ? 'air' : label?.kind === 'wall' ? 'wall' : 'soft'
        const gray = kind === 'air' ? 20 : kind === 'wall' ? 195 : 73
        pixels.data.set([gray, gray, gray, 255], (y * width + x) * 4)
        const c = centroid[kind]
        c[0] += x
        c[1] += y
        c[2] += 1
      }
    ctx.putImageData(pixels, 0, 0)
    ctx.font = 'bold 11px system-ui'
    ctx.textBaseline = 'middle'
    const layout: { kind: string; anchor: number[] | null; rect: number[] }[] = []
    const drawLabel = (text: string, x: number, y: number, color: string) => {
      const w = ctx.measureText(text).width + 8
      const lx = Math.max(2, Math.min(width - w - 2, x - w / 2)),
        ly = Math.max(8, Math.min(height - 8, y))
      ctx.fillStyle = 'rgba(8,28,34,0.82)'
      ctx.fillRect(lx, ly - 7, w, 14)
      ctx.fillStyle = color
      ctx.fillText(text, lx + 4, ly)
      return [lx, ly - 7, w, 14]
    }
    const anchors: Record<string, number[] | null> = { air: null, wall: null, soft: null }
    for (const [kind, text, labelY, gray] of [
      ['air', 'air (lumen)', 12, 20],
      ['wall', 'airway wall', 30, 195],
      ['soft', 'tissue beyond the wall', 82, 73],
    ] as const) {
      if (centroid[kind][2] <= 40) continue
      const cx = centroid[kind][0] / centroid[kind][2],
        cy = centroid[kind][1] / centroid[kind][2]
      let nearest = Infinity
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          if (pixels.data[(y * width + x) * 4] !== gray) continue
          const distance = (x - cx) ** 2 + (y - cy) ** 2
          if (distance < nearest) {
            nearest = distance
            anchors[kind] = [x, y]
          }
        }
      const anchor = anchors[kind]!
      ctx.strokeStyle = '#dfe9ee'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(anchor[0], anchor[1])
      ctx.lineTo(96, labelY)
      ctx.stroke()
      ctx.fillStyle = '#dfe9ee'
      ctx.fillRect(anchor[0] - 1, anchor[1] - 1, 2, 2)
      const rect = drawLabel(text, 96, labelY, '#dfe9ee')
      layout.push({ kind, anchor, rect })
    }
    wall.current!.dataset.contactLabels = JSON.stringify(anchors)
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
    layout.push({ kind: 'transducer', anchor: null, rect: drawLabel('transducer → scan direction', 96, 100, '#8fe9e6') })
    wall.current!.dataset.contactLabelLayout = JSON.stringify(layout)
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
        Close-ups sample the same model volume at each acquired transducer position. In each
        close-up the near-black band is air in the lumen, the bright band is the airway wall and
        the mid grey is tissue beyond it; the label leaders point to sampled model regions. Cyan
        marks the calibrated transducer origin and scan direction; it is a locator, not a pressure
        or balloon measurement. The grayscale images below are the actual two acquisitions.
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
