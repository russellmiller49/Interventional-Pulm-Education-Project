'use client'
import dynamic from 'next/dynamic'
import { useId } from 'react'
import type { LabId } from '../types'
import {
  beamDirection,
  centeredForTeaching,
  clamp,
  kapGyCm2,
  kapMicroGyM2,
  LESION_CENTER,
  projectToDetector,
  toolTipForDepth,
  temporalMetrics,
  windowRelationship,
  type Point3,
} from '../lib/physics'
import { Slider, Toggle, Readout, LabNote } from './LabControls'
import { DTSImage, MPR, Projection } from './Diagrams'
import styles from '../imaging.module.css'
import { controlElementId } from './suite/types'

const Scene3D = dynamic(() => import('./Scene3D'), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneFallback}>
      Loading the CT-derived 3D model… The controls remain available.
    </div>
  ),
})
const SamplingScene3D = dynamic(
  () => import('./Scene3D').then((module) => module.SamplingScene3D),
  {
    ssr: false,
    loading: () => <div className={styles.sceneFallback}>Loading the sampling model…</div>,
  },
)
export { Scene3D }
type Values = Record<string, string | number | boolean>
interface LabProps {
  lab: LabId
  lessonId: string
  values: Values
  onChange: (values: Values) => void
}
export function ImagingLab({ lab, lessonId, values, onChange }: LabProps) {
  const uid = useId()
  const num = (key: string, fallback: number, min: number, max: number) =>
    typeof values[key] === 'number' && Number.isFinite(values[key])
      ? clamp(values[key] as number, min, max)
      : fallback
  const flag = (key: string, fallback = false) =>
    typeof values[key] === 'boolean' ? Boolean(values[key]) : fallback
  const set = (patch: Values) => onChange({ ...values, ...patch })
  const boundary = (
    <div className={styles.simBadge}>
      Authored teaching model · values are not equipment settings or patient measurements
    </div>
  )

  if (lab === 'geometry') {
    const orbit = num('orbit', 0, -75, 75),
      tilt = num('tilt', 0, -25, 25),
      depth = num('depth', 22, -30, 30)
    const target = projectToDetector(LESION_CENTER, orbit, tilt),
      tip = projectToDetector(toolTipForDepth(depth), orbit, tilt)
    const separation = Math.hypot(target[0] - tip[0], target[1] - tip[1])
    const direction = beamDirection(orbit, tilt)
    return (
      <div className={styles.lab}>
        {boundary}
        <Scene3D orbit={orbit} tilt={tilt} depth={depth} />
        <div className={styles.labSplit}>
          <div>
            <h3>CT-derived fluoroscopy view</h3>
            <Projection orbit={orbit} tilt={tilt} depth={depth} />
            <p className={styles.small}>
              The CT supplies the anatomical background. The dotted contour marks an authored
              target; the white cross marks the tool tip. Both use the same source–detector
              geometry.
            </p>
          </div>
          <div className={styles.controls}>
            <Slider
              id={controlElementId('orbit')}
              label="C-arm obliquity"
              value={orbit}
              min={-75}
              max={75}
              unit="°"
              onChange={(orbit) => set({ orbit })}
            />
            <Slider
              id={controlElementId('tilt')}
              label="Cranial / caudal tilt"
              value={tilt}
              min={-25}
              max={25}
              unit="°"
              onChange={(tilt) => set({ tilt })}
            />
            <Slider
              id={controlElementId('depth')}
              label="Tool depth offset"
              value={depth}
              min={-30}
              max={30}
              unit=" mm"
              onChange={(depth) => set({ depth })}
            />
            <div className={styles.readoutGrid}>
              <Readout label="Projected tool–lesion separation">{separation.toFixed(1)} mm</Readout>
              <Readout label="True depth offset along the X-ray path">{depth} mm</Readout>
            </div>
            <p className={styles.result}>
              Changing the view{' '}
              {separation < 0.1
                ? 'compresses the depth offset into overlap'
                : 'reveals a projected separation'}
              . It does not reposition the instrument.
            </p>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => set({ orbit: 0, tilt: 0, depth: 22 })}
            >
              Reset geometry
            </button>
          </div>
        </div>
        <LabNote>
          The original FluoroView volume renderer sums through a quantized CT to create a DRR; this
          is not acquired fluoroscopy. Target and tool are authored overlays. The tool moves along
          the initial source–target ray, so frontal overlap can hide depth. Model axes are patient
          left (x), anterior (y), superior (z); central beam direction is (
          {direction.map((n) => n.toFixed(2)).join(', ')}). Verify real console orientation
          conventions.
        </LabNote>
      </div>
    )
  }
  if (lab === 'field') {
    const field = num('field', 100, 45, 100),
      zoom = num('zoom', 1, 1, 2),
      crop = flag('crop')
    const area = crop ? 100 : (field * field) / 100
    return (
      <div className={styles.lab}>
        {boundary}
        <div className={styles.labSplit}>
          <div>
            <Projection orbit={25} tilt={0} depth={12} field={field} crop={crop} zoom={zoom} />
            <p className={styles.small}>
              {crop
                ? 'Dashed border: displayed crop. The original full beam was acquired.'
                : 'Solid amber border: physical shutter field before the next exposure.'}
            </p>
          </div>
          <div className={styles.controls}>
            <Slider
              id={controlElementId('field')}
              label="Field side length"
              value={field}
              min={45}
              max={100}
              step={5}
              unit="%"
              onChange={(field) => set({ field })}
            />
            <Toggle
              id={controlElementId('crop')}
              label="Use display crop instead of physical shutters"
              checked={crop}
              onChange={(crop) => set({ crop })}
            />
            <Slider
              id={controlElementId('zoom')}
              label="Stored-image display zoom"
              value={zoom}
              min={1}
              max={2}
              step={0.1}
              unit="×"
              onChange={(zoom) => set({ zoom })}
            />
            <div className={styles.readoutGrid}>
              <Readout label="Irradiated area vs full field">{area.toFixed(0)}%</Readout>
              <Readout label="Extra exposure from display zoom">None</Readout>
            </div>
            <p className={styles.result}>
              {crop
                ? 'The displayed border changed; the beam area did not.'
                : 'Physical restriction reduces the irradiated area. Actual kerma can change with exposure regulation.'}
            </p>
            <p className={styles.small}>
              Watch the distal tool and surrounding anatomy as you narrow or enlarge the view. A
              clipped instrument excursion is inadequate even when the image looks cleaner.
            </p>
          </div>
        </div>
        <LabNote>
          The area ratio assumes a square field with both side lengths scaled equally. Scatter,
          automatic exposure response, detector readout, and clinical image quality are not
          calculated. The background is a CT-derived DRR, with an authored target and instrument.
        </LabNote>
      </div>
    )
  }
  if (lab === 'temporal') {
    const restoredRate = num('rate', 7.5, 3.75, 15)
    const rate = [3.75, 7.5, 15].includes(restoredRate) ? restoredRate : 7.5,
      width = num('width', 5, 5, 20),
      speed = num('speed', 20, 0, 40)
    const metrics = temporalMetrics(rate, width, 20, speed)
    const travelScale = Math.min(9, 345 / Math.max(1, 5 * metrics.interFrameTravel))
    return (
      <div className={styles.lab}>
        {boundary}
        <div className={styles.labSplit}>
          <div>
            <svg
              viewBox="0 0 440 285"
              className={styles.projection}
              role="img"
              aria-label={
                'Time diagram. ' +
                rate +
                ' exposures per second, each ' +
                width +
                ' milliseconds. Object travel between frames is ' +
                metrics.interFrameTravel.toFixed(2) +
                ' millimeters.'
              }
            >
              <rect width="440" height="285" fill="#102936" />
              <text x="24" y="32" fill="#dce7eb" fontSize="13">
                One second of measurements
              </text>
              <line x1="25" y1="90" x2="415" y2="90" stroke="#7b929f" />
              {Array.from({ length: Math.ceil(rate) }, (_, i) => (
                <rect
                  key={i}
                  x={25 + (i / rate) * 390}
                  y="63"
                  width={Math.max(2, (width / 1000) * 390)}
                  height="54"
                  rx="1"
                  fill="#71d5c1"
                />
              ))}
              <text x="24" y="143" fill="#c4d7de" fontSize="11">
                Bars: actual X-ray pulses · spaces: no new measurement
              </text>
              <text x="24" y="187" fill="#e6b574" fontSize="13">
                Moving tool positions
              </text>
              {Array.from({ length: 6 }, (_, i) => (
                <g key={i}>
                  <line
                    x1={35 + i * metrics.interFrameTravel * travelScale}
                    x2={
                      35 +
                      i * metrics.interFrameTravel * travelScale +
                      metrics.inFrameBlur * travelScale +
                      2
                    }
                    y1="219"
                    y2="219"
                    stroke="#e7b777"
                    strokeWidth="12"
                  />
                  <text
                    x={34 + i * metrics.interFrameTravel * travelScale}
                    y="244"
                    fill="#bcced6"
                    fontSize="10"
                  >
                    {speed > 0 ? i + 1 : ''}
                  </text>
                </g>
              ))}
              <text x="24" y="269" fill="#bacdd5" fontSize="10">
                Position marks illustrate measured frames, not continuous tracking.
              </text>
            </svg>
          </div>
          <div className={styles.controls}>
            <label className={styles.selectLabel} htmlFor={uid}>
              Acquisition pulse rate
              <select
                id={controlElementId('rate')}
                value={rate}
                onChange={(e) => set({ rate: Number(e.target.value) })}
              >
                {[3.75, 7.5, 15].map((value) => (
                  <option key={value} value={value}>
                    {value} pulses/s
                  </option>
                ))}
              </select>
            </label>
            <Slider
              id={controlElementId('width')}
              label="Pulse width"
              value={width}
              min={5}
              max={20}
              step={5}
              unit=" ms"
              onChange={(width) => set({ width })}
            />
            <Slider
              id={controlElementId('speed')}
              label="Authored object speed"
              value={speed}
              min={0}
              max={40}
              step={5}
              unit=" mm/s"
              onChange={(speed) => set({ speed })}
            />
            <div className={styles.readoutGrid}>
              <Readout label="Tube load at fixed 20 mA">
                {metrics.masPerSecond.toFixed(2)} mAs/s
              </Readout>
              <Readout label="Motion blur during one pulse">
                {metrics.inFrameBlur.toFixed(2)} mm
              </Readout>
              <Readout label="Travel between frames">
                {metrics.interFrameTravel.toFixed(2)} mm
              </Readout>
              <Readout label="Time between acquired frames">
                {metrics.intervalMs.toFixed(0)} ms
              </Readout>
            </div>
          </div>
        </div>
        <LabNote>
          Authored rate, pulse width, current and speed values illustrate arithmetic, not
          recommended presets. Tube load is not patient dose; voltage, filtration, geometry,
          attenuation and controller behavior are held outside this model. Monitor refresh and
          processing lag are not simulated.
        </LabNote>
      </div>
    )
  }
  if (lab === 'dts') {
    const sweep = num('sweep', 30, 20, 60),
      plane = num('plane', 0, -30, 30)
    return (
      <div className={styles.lab}>
        {boundary}
        <h3>Refocus a limited-angle dataset</h3>
        <div className={styles.labSplit}>
          <div>
            <DTSImage sweep={sweep} plane={plane} />
          </div>
          <div className={styles.controls}>
            <Slider
              id={controlElementId('sweep')}
              label="Authored DTS arc"
              value={sweep}
              min={20}
              max={60}
              step={10}
              unit="°"
              onChange={(sweep) => set({ sweep })}
            />
            <Slider
              id={controlElementId('plane')}
              label="Reconstruction depth plane"
              value={plane}
              min={-30}
              max={30}
              unit=" mm"
              onChange={(plane) => set({ plane })}
            />
            <div className={styles.buttonRow}>
              {[
                ['Tool plane', -18],
                ['Lesion plane', 0],
                ['Deeper plane', 25],
              ].map(([label, depth]) => (
                <button type="button" key={label} onClick={() => set({ plane: Number(depth) })}>
                  {label}
                </button>
              ))}
            </div>
            <p className={styles.result}>
              Structures at the chosen plane reinforce. Other depths spread out as the shifted views
              combine. A wider arc changes that spreading; it does not make a limited-angle dataset
              complete.
            </p>
            <Readout label="Illustration samples">13 CT-derived views</Readout>
          </div>
        </div>
        <LabNote>
          These are parallel projections of the original FluoroView CT with an added target at 0 mm
          and an instrument at −18 mm. A horizontal Gaussian high-pass suppresses slowly varying
          background, then the browser combines 13 views by shift-and-add at the selected depth. The
          fixed display window helps compare planes. Limited-angle blur remains; this is not a
          clinical DTS reconstruction, a vendor algorithm or a dose comparison. Motion, prior-CT
          registration and iterative reconstruction are not simulated.
        </LabNote>
      </div>
    )
  }
  if (lab === 'acquisition') {
    const kind =
      values.kind === 'fixed' || values.kind === 'mobile'
        ? values.kind
        : lessonId === 'fixed-suite'
          ? 'fixed'
          : 'mobile'
    const x = num('offsetX', 18, -30, 30),
      depth = num('offsetDepth', 18, -30, 30)
    const checks = ['target', 'clearance', 'state', 'protection']
    const orbit = num('acquisitionOrbit', 0, -100, 100)
    const center = centeredForTeaching(x, depth)
    const ready = center && checks.every((key) => flag(key))
    const captured = flag('captured')
    const move = (patch: Values) =>
      set({
        ...patch,
        target: false,
        clearance: false,
        state: false,
        protection: false,
        captured: false,
      })
    return (
      <div className={styles.lab}>
        {boundary}
        <div className={styles.buttonRow} aria-label="Suite workflow">
          {(['fixed', 'mobile'] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              aria-pressed={kind === mode}
              onClick={() => move({ kind: mode })}
            >
              {mode === 'fixed' ? 'Fixed CBCT suite' : 'Mobile CBCT suite'}
            </button>
          ))}
        </div>
        <p className={styles.result}>
          {kind === 'fixed'
            ? 'Fixed suite: plan around the installed gantry, table travel, ceiling shields and anesthesia access. Keep the robotic base, if used, outside the supported CBCT spin path.'
            : 'Mobile suite: confirm floor space, power, table compatibility and wheel/base clearance. Park and secure the unit, route lines, then inspect its supported CBCT spin path.'}
        </p>
        <Scene3D kind={kind} orbit={orbit} centerTarget offsetX={x} offsetDepth={depth} />
        <Slider
          id={controlElementId('acquisitionOrbit')}
          label="Authored rotation for the collision check"
          value={orbit}
          min={-100}
          max={100}
          step={10}
          unit="°"
          onChange={(acquisitionOrbit) => move({ acquisitionOrbit })}
        />
        <div className={styles.labSplit}>
          <div>
            <h3>Target centering</h3>
            <div className={styles.scoutPair}>
              <figure>
                <Projection
                  orbit={0}
                  tilt={0}
                  depth={0}
                  crosshair
                  offset={[-LESION_CENTER[0] + x, -LESION_CENTER[1] + depth, -LESION_CENTER[2]]}
                />
                <figcaption>Frontal · horizontal centering</figcaption>
              </figure>
              <figure>
                <Projection
                  orbit={90}
                  tilt={0}
                  depth={0}
                  crosshair
                  offset={[-LESION_CENTER[0] + x, -LESION_CENTER[1] + depth, -LESION_CENTER[2]]}
                />
                <figcaption>Lateral · depth centering</figcaption>
              </figure>
            </div>
            <Slider
              id={controlElementId('offsetX')}
              label="Target horizontal offset"
              value={x}
              min={-30}
              max={30}
              unit=" mm"
              onChange={(offsetX) => move({ offsetX })}
            />
            <Slider
              id={controlElementId('offsetDepth')}
              label="Target depth offset"
              value={depth}
              min={-30}
              max={30}
              unit=" mm"
              onChange={(offsetDepth) => move({ offsetDepth })}
            />
            <button
              className={styles.secondary}
              type="button"
              onClick={() => move({ offsetX: 0, offsetDepth: 0 })}
            >
              Center the teaching target
            </button>
          </div>
          <div className={styles.controls}>
            <h3>Readiness for this setup</h3>
            <p className={styles.small}>
              Reconfirm after changing the target position or support. These are self-attested
              teaching checks; the model does not detect real collisions or physiological readiness.
            </p>
            <Toggle
              id={controlElementId('target')}
              label="Target, tool and required anatomy covered"
              checked={flag('target')}
              onChange={(target) => set({ target, captured: false })}
            />
            <Toggle
              id={controlElementId('clearance')}
              label="Full CBCT spin path and lines checked"
              checked={flag('clearance')}
              onChange={(clearance) => set({ clearance, captured: false })}
            />
            <Toggle
              id={controlElementId('state')}
              label="Instrument state and anesthesia plan agreed"
              checked={flag('state')}
              onChange={(state) => set({ state, captured: false })}
            />
            <Toggle
              id={controlElementId('protection')}
              label="Protection, monitoring and patient access confirmed"
              checked={flag('protection')}
              onChange={(protection) => set({ protection, captured: false })}
            />
            <p className={styles.result}>
              {!center
                ? 'The teaching target remains off center in at least one dimension.'
                : !ready
                  ? 'Target centered. Complete the remaining readiness checks.'
                  : 'Teaching setup ready for a simulated acquisition.'}
            </p>
            <button
              type="button"
              className={styles.primary}
              disabled={!ready}
              onClick={() => set({ captured: true })}
            >
              Capture teaching state
            </button>
            {captured && ready && (
              <div role="status" className={styles.feedback}>
                <strong>Teaching state captured.</strong>
                <p>
                  Now review coverage, motion, target identity and the actual sampling component. A
                  completed acquisition alone does not establish adequate confirmation.
                </p>
              </div>
            )}
          </div>
        </div>
        <LabNote>
          Scouts are CT-derived projections in the same geometry as the target-centering controls.
          The original FluoroView C-arm is a generic, single-axis motion reference; selecting a
          workflow does not turn it into an equipment-specific fixed or mobile clearance model. The
          ±8 mm centering tolerance is authored for this exercise. No collision detection, clinical
          volume reconstruction or breath-hold tolerance is calculated. Follow the installed
          system’s supported acquisition method.
        </LabNote>
      </div>
    )
  }
  if (lab === 'mpr') {
    const x = num('tipX', 14, -5, 28),
      y = num('tipY', 14, -20, 20),
      z = num('tipZ', 0, -15, 15),
      tip: Point3 = [x, y, z]
    const axial = num('axial', 0, -20, 20),
      coronal = num('coronal', 0, -20, 20),
      sagittal = num('sagittal', 0, -20, 20),
      slab = flag('slab'),
      revealed = flag('revealed')
    const relationship = windowRelationship(tip)
    const adjust = (patch: Values) => set({ ...patch, revealed: false })
    return (
      <div className={styles.lab}>
        {boundary}
        <SamplingScene3D tip={tip} />
        <div className={styles.mprGrid} style={{ marginTop: 20 }}>
          {(['Axial', 'Coronal', 'Sagittal'] as const).map((plane, i) => (
            <MPR
              key={plane}
              plane={plane}
              position={[axial, coronal, sagittal][i]}
              tip={tip}
              slab={slab}
            />
          ))}
        </div>
        <p className={styles.small}>
          Amber: spherical target. White: needle shaft/tip. Thick teal segment: fictional side
          window. Each thin section projects the geometry within an authored 1.5 mm thickness; the
          teaching slab combines all depths. Positions are relative to target center.
        </p>
        <div className={styles.labSplit}>
          <div className={styles.controls}>
            <h3>Move the fictional tool</h3>
            <Slider
              id={controlElementId('tipX')}
              label="Tip along needle axis"
              value={x}
              min={-5}
              max={28}
              unit=" mm"
              onChange={(tipX) => adjust({ tipX })}
            />
            <Slider
              id={controlElementId('tipY')}
              label="Anterior / posterior offset"
              value={y}
              min={-20}
              max={20}
              unit=" mm"
              onChange={(tipY) => adjust({ tipY })}
            />
            <Slider
              id={controlElementId('tipZ')}
              label="Superior / inferior offset"
              value={z}
              min={-15}
              max={15}
              unit=" mm"
              onChange={(tipZ) => adjust({ tipZ })}
            />
            <div className={styles.buttonRow}>
              <button type="button" onClick={() => adjust({ tipX: 14, tipY: 14, tipZ: 0 })}>
                Example A
              </button>
              <button type="button" onClick={() => adjust({ tipX: 14, tipY: 0, tipZ: 0 })}>
                Example B
              </button>
              <button type="button" onClick={() => adjust({ tipX: 24, tipY: 0, tipZ: 0 })}>
                Example C
              </button>
            </div>
          </div>
          <div className={styles.controls}>
            <h3>Inspect the volume</h3>
            <Toggle
              id={controlElementId('slab')}
              label="Combine depths into a teaching slab"
              checked={slab}
              onChange={(slab) => set({ slab })}
            />
            <div className={styles.buttonRow}>
              <button
                type="button"
                onClick={() => set({ axial: 0, coronal: 0, sagittal: 0, slab: false })}
              >
                Slices through target center
              </button>
              <button
                type="button"
                onClick={() =>
                  set({ axial: z, coronal: y, sagittal: clamp(x - 10, -20, 20), slab: false })
                }
              >
                Slices through sampling window
              </button>
            </div>
            {!slab && (
              <>
                <Slider
                  id={controlElementId('axial')}
                  label="Axial slice (superior / inferior)"
                  value={axial}
                  min={-20}
                  max={20}
                  unit=" mm"
                  onChange={(axial) => set({ axial })}
                />
                <Slider
                  id={controlElementId('coronal')}
                  label="Coronal slice (anterior / posterior)"
                  value={coronal}
                  min={-20}
                  max={20}
                  unit=" mm"
                  onChange={(coronal) => set({ coronal })}
                />
                <Slider
                  id={controlElementId('sagittal')}
                  label="Sagittal slice (left / right)"
                  value={sagittal}
                  min={-20}
                  max={20}
                  unit=" mm"
                  onChange={(sagittal) => set({ sagittal })}
                />
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => set({ revealed: !revealed })}
        >
          {revealed ? 'Hide geometric explanation' : 'Reveal geometric explanation'}
        </button>
        {revealed && (
          <div className={styles.feedback} role="status">
            <strong>{relationship.label}.</strong>
            <p>
              The tip is {relationship.tipInside ? 'inside' : 'outside'} the sphere. The window and
              tip are different geometrical objects; changing slab thickness does not change their
              physical relationship.
            </p>
          </div>
        )}
        <LabNote>
          CT-derived lung context is combined with analytic sections of an authored 18 mm sphere and
          fictional 8 mm side window, positioned 6–14 mm behind the tip. The teal cylinder has a 1.3
          mm diameter; the white dot in 3D is a tip marker. The CT background uses nearest-voxel
          sampling; the slab uses a 102 mm maximum intensity projection. The added target and tool
          retain analytic section geometry. This is not a clinical CBCT reconstruction or a
          specification for a real needle. The model omits vessels, pleura, tool deformation, metal
          artifact and tissue acquisition. Geometric intersection does not establish safe or
          diagnostic sampling.
        </LabNote>
      </div>
    )
  }
  if (lab === 'registration') {
    const shift = num('shift', 0, -30, 30),
      previous = num('previous', 0, -30, 30),
      overlay = flag('overlay', true),
      showCurrent = flag('showCurrent', true)
    return (
      <div className={styles.lab}>
        {boundary}
        <div className={styles.labSplit}>
          <div>
            <Projection
              orbit={0}
              tilt={0}
              depth={0}
              registration={{ current: shift, stored: previous, showCurrent, showStored: overlay }}
            />
            <p className={styles.figureCaption}>
              The CT and teaching target move together; the instrument stays fixed. The stored
              contour retains its earlier position.
            </p>
          </div>
          <div className={styles.controls}>
            <Slider
              id={controlElementId('shift')}
              label="Authored anatomical displacement"
              value={shift}
              min={-30}
              max={30}
              unit=" mm"
              onChange={(shift) => set({ shift })}
            />
            <Toggle
              id={controlElementId('overlay')}
              label="Show stored augmented contour"
              checked={overlay}
              onChange={(overlay) => set({ overlay })}
            />
            <Toggle
              id={controlElementId('showCurrent')}
              label="Show current target ground truth"
              checked={showCurrent}
              onChange={(showCurrent) => set({ showCurrent })}
            />
            <button
              type="button"
              className={styles.secondary}
              onClick={() => set({ previous: shift, overlay: true })}
            >
              Capture a new teaching contour
            </button>
            <div className={styles.readoutGrid}>
              <Readout label="Stored contour state">{previous} mm</Readout>
              <Readout label="Current anatomy state">{shift} mm</Readout>
            </div>
            <p className={styles.result}>
              {shift === previous
                ? 'The stored contour matches the current authored state.'
                : 'The anatomy changed. The old contour still represents its acquisition state.'}{' '}
              The fixed tool did not follow the target.
            </p>
          </div>
        </div>
        <LabNote>
          The CT is translated rigidly by the learner, not deformed by a model of ventilation,
          recruitment or the response to a clinical intervention. Ground truth is visible only for
          teaching; an occult lesion on real fluoroscopy does not acquire a live boundary merely
          because an overlay is shown.
        </LabNote>
      </div>
    )
  }
  if (lab === 'safety') {
    const distance = num('distance', 1.6, 1.3, 3),
      shield = flag('shield'),
      orbit = num('orbit', 0, -90, 90)
    return (
      <div className={styles.lab}>
        {boundary}
        <Scene3D safety staffDistance={distance} shield={shield} orbit={orbit} />
        <div className={styles.labSplit}>
          <div className={styles.controls}>
            <Slider
              id={controlElementId('distance')}
              label="Illustrative distance from patient center"
              value={distance}
              min={1.3}
              max={3}
              step={0.1}
              unit=" m"
              onChange={(distance) => set({ distance })}
            />
            <Slider
              id={controlElementId('orbit')}
              label="C-arm orientation"
              value={orbit}
              min={-90}
              max={90}
              step={15}
              unit="°"
              onChange={(orbit) => set({ orbit })}
            />
            <Toggle
              id={controlElementId('shield')}
              label="Place the schematic barrier between patient and staff"
              checked={shield}
              onChange={(shield) => set({ shield })}
            />
          </div>
          <div>
            <Readout label="Unshielded point-source illustration vs 1 m">
              {(1 / (distance * distance)).toFixed(2)}×
            </Readout>
            <p className={styles.result}>
              {shield
                ? 'A barrier is shown between the patient and staff. Its real protection must be verified for height, coverage, scatter geometry and shielding performance.'
                : 'Staff are unshielded in the model. Distance alone does not establish an acceptable staff position.'}
            </p>
            <p className={styles.small}>
              Room spacing is compressed for viewing. The numerical illustration depends only on the
              selected distance; it does not assign a shield attenuation factor or simulate the
              changing scatter field as the C-arm moves.
            </p>
          </div>
        </div>
        <LabNote>
          The patient is an extended, nonuniform scatter source. The ideal 1/r² trend at fixed
          output is not a staff-dose calculator, room survey or safe-distance rule. The barrier has
          no validated material or protection rating. Follow the radiation safety officer’s verified
          positions and shielding plan.
        </LabNote>
      </div>
    )
  }
  const kerma = num('kerma', 10, 1, 20),
    area = num('area', 400, 50, 500),
    kap = kapGyCm2(kerma, area)
  return (
    <div className={styles.lab}>
      {boundary}
      <div className={styles.labSplit}>
        <div className={styles.controls}>
          <h3>One uniform authored exposure</h3>
          <Slider
            id={controlElementId('kerma')}
            label="Air kerma at the chosen plane"
            value={kerma}
            min={1}
            max={20}
            unit=" mGy"
            onChange={(kerma) => set({ kerma })}
          />
          <Slider
            id={controlElementId('area')}
            label="Beam area at the same plane"
            value={area}
            min={50}
            max={500}
            step={25}
            unit=" cm²"
            onChange={(area) => set({ area })}
          />
          <div className={styles.buttonRow}>
            <button type="button" onClick={() => set({ kerma: 10, area: 400 })}>
              Initial field
            </button>
            <button type="button" onClick={() => set({ kerma: 12, area: 100 })}>
              Smaller field, greater kerma
            </button>
          </div>
          <p className={styles.small}>
            KAP = air kerma in Gy × field area in cm². The assumed beam is uniform; this is not a
            reference-point-to-skin conversion.
          </p>
        </div>
        <div>
          <div className={styles.readoutGrid}>
            <Readout label="Calculated KAP">{kap.toFixed(2)} Gy·cm²</Readout>
            <Readout label="Equivalent unit expression">
              {kapMicroGyM2(kap).toFixed(0)} µGy·m²
            </Readout>
            <Readout label="Peak skin dose">Not calculated</Readout>
            <Readout label="Effective dose">Not calculated</Readout>
          </div>
          <p className={styles.result}>
            Changing the beam area changes the product independently of the local kerma. Equal
            products can represent different spatial exposure patterns.
          </p>
        </div>
      </div>
      <div className={styles.worked}>
        <h3>Record every component once</h3>
        <p>
          Authored example: fluoroscopy KAP 8 Gy·cm² + rotational KAP 4 Gy·cm² = whole-procedure KAP
          12 Gy·cm². A report’s existing total must not be added again to its component values.
        </p>
      </div>
      <LabNote>
        All exposure values are invented for arithmetic. No controller, patient attenuation, skin
        backscatter, organ dose or clinical action threshold is modeled. Keep different dose
        quantities and acquisition totals distinct.
      </LabNote>
    </div>
  )
}
