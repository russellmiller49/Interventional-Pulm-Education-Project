import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { type WebGLRenderer } from 'three'
import { DetectorImage } from '../../src/features/peripheral-imaging/components/suite/DetectorImage'
import { Monitor } from '../../src/features/peripheral-imaging/components/suite/Monitor'
import { ProjectionOverlays } from '../../src/features/peripheral-imaging/components/suite/ProjectionOverlays'
import {
  type DrrTextureSource,
  referenceDetectorFrame,
} from '../../src/features/peripheral-imaging/components/suite/drrTextureSource'
import {
  DETECTOR_FIELD,
  LESION_CENTER,
  projectToDetector,
  type Point3,
} from '../../src/features/peripheral-imaging/lib/physics'
import './drr-spike.css'

function Quad({
  source,
  orbit,
  tilt,
}: {
  source: DrrTextureSource | null
  orbit: number
  tilt: number
}) {
  const { camera, invalidate, size } = useThree()
  const ref = useMemo(() => referenceDetectorFrame(orbit, tilt), [orbit, tilt])
  const frame = useMemo(
    () => ({
      center: ref.detectorCenterLps as Point3,
      u: ref.detectorUAxisLps as Point3,
      v: ref.detectorVAxisLps as Point3,
      field: DETECTOR_FIELD,
    }),
    [ref],
  )
  useEffect(() => {
    camera.position.set(...ref.sourceLps)
    camera.up.set(...ref.detectorVAxisLps)
    camera.lookAt(...ref.detectorCenterLps)
    // Three cameras are mutable scene objects; this is the R3F effect boundary.
    // eslint-disable-next-line react-hooks/immutability
    if ('zoom' in camera) camera.zoom = size.width / DETECTOR_FIELD
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, ref, size])
  return <DetectorImage frame={frame} source={source} />
}
function Spike() {
  const [orbit, setOrbit] = useState(30),
    [tilt, setTilt] = useState(15)
  const [source, setSource] = useState<DrrTextureSource | null>(null)
  const [gl, setGl] = useState<WebGLRenderer | null>(null)
  const [metrics, setMetrics] = useState<unknown>(null)
  const [hidden, setHidden] = useState(false)
  const pose = useMemo(() => ({ orbit, tilt }), [orbit, tilt])
  const point = projectToDetector(LESION_CENTER, orbit, tilt)
  async function benchmark() {
    if (!source || !gl || source.state !== 'ready') return
    const samples = []
    for (let i = 0; i < 30; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      source.render(pose, false)
      samples.push(source.measureUpload(gl))
    }
    const ordered = samples.map((sample) => sample.completedMs).sort((a, b) => a - b)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    const pixels = (canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('webgl2')!
      const bytes = new Uint8Array(canvas.width * canvas.height * 4)
      context.readPixels(
        0,
        0,
        canvas.width,
        canvas.height,
        context.RGBA,
        context.UNSIGNED_BYTE,
        bytes,
      )
      return (u: number, v: number) =>
        bytes[
          (Math.min(canvas.height - 1, Math.floor(v * canvas.height)) * canvas.width +
            Math.min(canvas.width - 1, Math.floor(u * canvas.width))) *
            4
        ]
    }
    const detector = pixels(gl.domElement),
      monitor = pixels(source.canvas)
    const error = (mirrorX: boolean, mirrorY: boolean) => {
      let sum = 0
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) {
          const u = (x + 0.5) / 128,
            v = (y + 0.5) / 128
          sum += Math.abs(detector(u, v) - monitor(mirrorX ? 1 - u : u, mirrorY ? 1 - v : v))
        }
      return sum / (128 * 128)
    }
    setMetrics({
      width: source.canvas.width,
      height: source.canvas.height,
      rect: [
        source.canvas.getBoundingClientRect().width,
        source.canvas.getBoundingClientRect().height,
      ],
      samples: samples.length,
      medianMs: ordered[15],
      p95Ms: ordered[28],
      queueMedianMs: samples.map((s) => s.queuedMs).sort((a, b) => a - b)[15],
      targetPixel512: [
        256 + (point[0] / DETECTOR_FIELD) * 512,
        256 - (point[1] / DETECTOR_FIELD) * 512,
      ],
      grayError: {
        aligned: error(false, false),
        flippedX: error(true, false),
        flippedY: error(false, true),
      },
      note: 'Upload only; prior DRR and destination GPU work drained. Includes cross-context synchronization.',
    })
  }
  return (
    <main>
      <p className="eyebrow">PERIPHERAL IMAGING · RENDERING SPIKE</p>
      <h1>One live DRR. Two aligned displays.</h1>
      <p>
        The left panel is a textured detector quad viewed from the source. The right is its original
        WebGL canvas with the existing SVG projection coordinates.
      </p>
      <div className="controls">
        <label>
          Obliquity{' '}
          <input
            type="range"
            min="-75"
            max="75"
            value={orbit}
            onChange={(e) => setOrbit(+e.target.value)}
          />{' '}
          {orbit}°
        </label>
        <label>
          Tilt{' '}
          <input
            type="range"
            min="-25"
            max="25"
            value={tilt}
            onChange={(e) => setTilt(+e.target.value)}
          />{' '}
          {tilt}°
        </label>
        <button onClick={() => void benchmark()}>Measure texture upload</button>
        <button onClick={() => setHidden(!hidden)}>Toggle zero-rect monitor</button>
      </div>
      <div className="panels">
        <section>
          <h2>Detector quad · source view</h2>
          <div className="quad">
            <Canvas
              orthographic
              frameloop="demand"
              dpr={1}
              camera={{ near: 1, far: 3000 }}
              gl={{ antialias: false, preserveDrawingBuffer: true }}
              onCreated={({ gl }) => {
                setGl(gl)
                gl.domElement.dataset.threeState = 'ready'
              }}
            >
              <Quad source={source} orbit={orbit} tilt={tilt} />
            </Canvas>
            <ProjectionOverlays orbit={orbit} tilt={tilt} depth={22} />
          </div>
        </section>
        <section>
          <h2>Monitor · original SVG overlay</h2>
          <Monitor pose={pose} depth={22} onSource={setSource} hidden={hidden} />
          {hidden && (
            <p>
              The monitor has no layout rectangle. The detector must keep rendering at the explicit
              image size.
            </p>
          )}
        </section>
      </div>
      <p className="boundary">
        Authored cone geometry shared with the DRR and readouts. The CT supplies anatomy; the target
        and tool are authored.
      </p>
      <pre data-spike-metrics>
        {metrics
          ? JSON.stringify(metrics, null, 2)
          : 'Use “Measure texture upload” to record 30 completed transfers.'}
      </pre>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<Spike />)
