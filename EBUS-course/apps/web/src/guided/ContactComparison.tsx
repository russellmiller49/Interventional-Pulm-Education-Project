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
    // Centroids of the sampled label kinds, so the on-image labels sit on what they name (L4-3).
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
    const drawLabel = (text: string, x: number, y: number, color: string) => {
      const w = ctx.measureText(text).width + 8
      const lx = Math.max(2, Math.min(width - w - 2, x - w / 2)),
        ly = Math.max(8, Math.min(height - 8, y))
      ctx.fillStyle = 'rgba(8,28,34,0.82)'
      ctx.fillRect(lx, ly - 7, w, 14)
      ctx.fillStyle = color
      ctx.fillText(text, lx + 4, ly)
    }
    const at = (k: 'air' | 'wall' | 'soft') => [centroid[k][0] / centroid[k][2], centroid[k][1] / centroid[k][2]]
    const [airX, airY] = at('air'), [wallX, wallY] = at('wall')
    let [softX, softY] = at('soft')
    // Keep the tissue label clear of the cyan transducer mark drawn at x 96, y 44–68.
    if (Math.abs(softX - 96) < 46 && Math.abs(softY - 56) < 30) softX = softX < 96 ? 46 : 146
    if (centroid.air[2] > 40) drawLabel('air (lumen)', airX, airY, '#dfe9ee')
    if (centroid.wall[2] > 40) drawLabel('airway wall', wallX, wallY, '#102026')
    if (centroid.soft[2] > 40) drawLabel('tissue beyond the wall', softX, softY, '#dfe9ee')
    wall.current!.dataset.contactLabels = JSON.stringify({
      air: centroid.air[2] > 40 ? [Math.round(airX), Math.round(airY)] : null,
      wall: centroid.wall[2] > 40 ? [Math.round(wallX), Math.round(wallY)] : null,
      soft: centroid.soft[2] > 40 ? [Math.round(softX), Math.round(softY)] : null,
    })
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
    drawLabel('transducer → scan direction', 96, 100, '#8fe9e6')
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
        the mid grey is tissue beyond it; the labels are placed on the sampled model labels. Cyan
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
