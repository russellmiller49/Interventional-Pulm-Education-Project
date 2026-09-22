import { useState } from 'react'
import {
  MODEL_GEOMETRY,
  needleGeometry,
  phantomPlaneReference,
  phantomSections,
  routeDefinition,
  routeSupported,
  type ContactMode,
  type ModelState,
  type ModelAction,
} from '../../../../../../src/lib/ebus-model-contract'
/*
 * Condition-specific captions for the contact schematic (EBUS-PRE-REVIEW-03, L5-3). Each names
 * the modelled origin of the dark band in the state the learner has selected — the same
 * geometry the schematic already draws — and says nothing about mechanism or interpretation of
 * any recorded image. The 3D viewport's concealed part names are untouched.
 */
const CONTACT_CAPTIONS: Record<ContactMode, string> = {
  gap: 'Air gap: the transducer face is separated from the wall by the modelled air gap, so the drawn path ends at the interface and no tissue echoes are drawn beyond it.',
  direct: 'Direct contact: the transducer face touches the wall and the drawn path continues into tissue.',
  balloon: 'Fluid-balloon contact: the fluid-filled balloon bridges the transducer and the wall, and the drawn path continues into tissue.',
  bubble: 'Balloon with a bubble: a focal air interface sits at the balloon–wall contact (labelled on the image); the dark band begins at that interface, at the top of the field.',
  shadow: 'Contact with a reflector: a bright modelled focus lies within tissue (labelled on the image); the dark band begins behind that focus, not at the transducer.',
}
export function ModelImage({
  state: s,
  reveal,
  locked,
  dispatch,
}: {
  state: ModelState
  reveal: boolean
  locked: boolean
  dispatch: (a: ModelAction) => void
}) {
  const [hover, setHover] = useState('')
  /*
   * The model's own reference for the plane on screen (EBUS-PRE-REVIEW-02, L9-2 / L10-1). It can
   * be opened at any time, including before an attempt: this is an analytic phantom, the numbers
   * are derivable from its geometry, and nothing here is scored, timed or recorded.
   */
  const [reference, setReference] = useState(false)
  if (s.package === 'routes') {
    const r = routeDefinition(s)
    return (
      <section className="model-image">
        <h2>Route orientation</h2>
        <p>
          <strong>
            {s.route === 'airway' ? 'Airway approach · EBUS' : 'Esophageal approach · EUS-B'}
          </strong>
        </p>
        <p>
          {routeSupported(s)
            ? `Viewing the fixed ${s.station === '8' ? 'authored lower paraesophageal example' : `station ${s.station} example`}.`
            : 'No supported orientation preset for this selection.'}
        </p>
        <p>
          {s.route === 'esophagus'
            ? 'Locate the esophagus behind the airway and compare the aorta and adjacent vessels.'
            : 'Locate the trachea and main bronchi, then compare the target with the adjacent esophagus and vessels.'}
        </p>
        <p>{r?.source}</p>
        <p className="model-caption">
          In the 3D view an arrow runs from the selected orientation locator to the fixed target;
          it shows viewing direction only and does not establish a clear needle path. Station 9 is
          not modeled; hilar/interlobar regions still require an appropriate examination.
        </p>
      </section>
    )
  }
  const name = (label: string) =>
    reveal ? { onPointerEnter: () => setHover(label), onPointerLeave: () => setHover('') } : {}
  if (s.package === 'measurement') {
    const sections = phantomSections(s.shape, s.offset),
      [a, b] = s.calipers
    const model = phantomPlaneReference(s)
    const placed = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : null
    const showReference = reference || reveal
    return (
      <section className="model-image">
        <h2>Phantom section · {s.frozen ? 'Frozen' : 'Live plane'}</h2>
        <svg
          className="phantom-section"
          viewBox="-30 0 60 46"
          role="img"
          aria-label="Geometric phantom section; use the caliper controls or tap the frozen image to place the selected endpoint"
          onPointerDown={(e) => {
            if (locked || !s.frozen) return
            const box = e.currentTarget.getBoundingClientRect()
            dispatch({
              type: 'caliper',
              value: [
                ((e.clientX - box.left) / box.width) * 60 - 30,
                ((e.clientY - box.top) / box.height) * 46,
              ],
            })
          }}
        >
          <rect x="-30" width="60" height="46" fill="#101722" />
          {sections.map((p, i) => (
            <ellipse
              key={i}
              cx={p.x}
              cy={p.y}
              rx={p.rx}
              ry={p.ry}
              fill="#909eaf"
              {...name('Phantom surface')}
            />
          ))}
          {a && b && (
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#f5d464" strokeWidth=".3" />
          )}
          {[a, b].map(
            (p, i) =>
              p && (
                <g key={i} stroke="#f5d464" strokeWidth=".3">
                  <path d={`M${p[0] - 1} ${p[1]}h2 M${p[0]} ${p[1] - 1}v2`} />
                  <text x={p[0] + 1.3} y={p[1] - 1} fill="#ffe895" stroke="none" fontSize="2">
                    {i + 1}
                  </text>
                </g>
              ),
          )}
          {/* A scale bar and axis ticks in the section's own units. The viewBox is the phantom
              coordinate system itself — x -30..30, y 0..46 in authored millimetres — so ten units
              here are ten phantom millimetres, with nothing measured off the picture. */}
          <g className="phantom-scale" stroke="#9fb4c6" strokeWidth=".2" fill="#c3d5e4">
            <path d="M-27.5 44h10 M-27.5 43.3v1.4 M-17.5 43.3v1.4" />
            <text x="-27.5" y="42.6" stroke="none" fontSize="2">
              10 phantom mm
            </text>
            <path d="M-29.6 10h1.4 M-29.6 20h1.4 M-29.6 30h1.4 M-29.6 40h1.4" />
            {[10, 20, 30, 40].map((depth) => (
              <text key={depth} x="-27.8" y={depth + 0.6} stroke="none" fontSize="1.7">
                {depth}
              </text>
            ))}
            <path d="M-20 1.6v-1.2 M-10 1.6v-1.2 M0 2v-1.6 M10 1.6v-1.2 M20 1.6v-1.2" />
            <text x="0.6" y="3.4" stroke="none" fontSize="1.7">
              0
            </text>
          </g>
          {showReference && model.idealCalipers && (
            <g stroke="#42d6ba" strokeDasharray="1 1" strokeWidth=".25" data-model-reference>
              <path
                d={
                  'M' +
                  model.idealCalipers[0][0] +
                  ' ' +
                  model.idealCalipers[0][1] +
                  'L' +
                  model.idealCalipers[1][0] +
                  ' ' +
                  model.idealCalipers[1][1]
                }
              />
              {model.idealCalipers.map((point, index) => (
                <path key={index} d={`M${point[0] - 1.4} ${point[1]}h2.8`} />
              ))}
            </g>
          )}
        </svg>
        {reveal && hover && <p role="tooltip">{hover}</p>}
        <button
          type="button"
          className="model-reference-toggle"
          aria-pressed={reference}
          onClick={() => setReference((open) => !open)}
        >
          {reference ? 'Hide the model reference' : 'Show the model reference'}
        </button>
        {showReference && (
          <p className="model-caption" data-model-reference-readout>
            {model.objects === 1 ? (
              <>
                Model reference for this exact plane: {s.axis} axis{' '}
                <strong>{model.axisMm!.toFixed(1)} phantom mm</strong> (short{' '}
                {model.shortAxisMm!.toFixed(1)}, long {model.longAxisMm!.toFixed(1)}). The dashed
                line shows where that axis lies.{' '}
                {placed === null
                  ? 'Place both calipers to compare your own.'
                  : `Your calipers are ${placed.toFixed(1)} phantom mm apart, ${Math.abs(placed - model.axisMm!).toFixed(1)} mm from the model axis.`}{' '}
                This is a comparison with an authored shape, not a score, a pass mark or a
                statement about reading a patient image.
              </>
            ) : (
              <>
                This plane cuts {model.objects} separate objects, so it has no single short or long
                axis. The sections here are{' '}
                {model.sections
                  .map((section) => `${(section.ry * 2).toFixed(1)} x ${(section.rx * 2).toFixed(1)} phantom mm`)
                  .join(' and ')}
                . Sweep to a plane through one object to compare a single axis.
              </>
            )}
          </p>
        )}
        <p className="model-caption">
          Analytic section of the same 3D shape. Tap a frozen image for calipers, or use the numeric
          endpoint controls. Distances are authored phantom millimetres in the coordinate system
          drawn on the section: horizontal 0 at the midline, vertical measured down from the top of
          the modelled field. They are not calibrated clinical millimetres and do not transfer to a
          recorded or patient image.
        </p>
      </section>
    )
  }
  if (s.package === 'needle') {
    const imageState = s.held ? { ...s, ...s.held } : s
    const g = needleGeometry(imageState)
    const d = g.axis,
      tip = g.tip
    // Clip the shaft against a finite imaging slab; the true distal endpoint is separately tested.
    const start = MODEL_GEOMETRY.needle.retractedTip.map(
      (v, i) => v - d[i] * 30 + d[i] * (imageState.extension + imageState.sheath),
    )
    const sampled = Array.from({ length: 301 }, (_, i) =>
      start.map((v, j) => v + ((tip[j] - v) * i) / 300),
    ).filter(
      (p) =>
        p[1] >= 2 &&
        Math.abs(Math.sin((imageState.plane * Math.PI) / 180) * (p[0] - g.outlet[0])) <=
          MODEL_GEOMETRY.needle.sliceHalfThickness,
    )
    const line = sampled.map((p) => `${p[0]},${p[1]}`).join(' ')
    return (
      <section className="model-image">
        <h2>Ultrasound schematic · {s.live ? 'Live' : 'Frozen reference'}</h2>
        <svg
          viewBox="-30 -2 65 45"
          role="img"
          aria-label="Authored needle and imaging-plane intersection schematic"
        >
          <rect x="-30" y="-2" width="65" height="45" fill="#101722" />
          <path d="M-24 8H30" stroke="#879099" strokeWidth="2" {...name('Airway wall')} />
          {imageState.contact && (
            <>
              <ellipse cx="6" cy="23" rx="10" ry="8" fill="#667381" {...name('Example node')} />
              <ellipse
                cx="25"
                cy="15"
                rx="4"
                ry="4"
                fill="#253749"
                stroke="#82909e"
                strokeWidth=".4"
                {...name('Adjacent vessel')}
              />
              {sampled.length > 1 && imageState.extension > 1 && (
                <polyline
                  points={line}
                  stroke="#eef4ff"
                  fill="none"
                  strokeWidth=".6"
                  {...name('Needle intersection with the imaging plane')}
                />
              )}{' '}
              {g.tipVisible && (
                <circle
                  cx={tip[0]}
                  cy={tip[1]}
                  r=".65"
                  fill="white"
                  {...name('Needle tip in the imaging plane')}
                />
              )}
            </>
          )}
          {reveal && imageState.extension > 1 && (
            <text x="-26" y="40" fill="#91efd5" fontSize="2">
              {g.tipVisible
                ? 'The distal tip intersects this plane.'
                : 'The true distal tip is outside this plane.'}
            </text>
          )}
        </svg>
        {reveal && hover && <p role="tooltip">{hover}</p>}
        <p className="model-caption">
          Geometric intersection, not clinical ultrasound. A visible line may be a shaft segment.
          {!s.live ? ' Frozen reference: it cannot establish current tip guidance.' : ''}
        </p>
      </section>
    )
  }
  const coupled = s.mode !== 'gap',
    brightness = 0.35 + s.gain / 155
  return (
    <section className="model-image">
      <h2>Authored echo schematic</h2>
      <svg
        viewBox="-30 0 60 45"
        role="img"
        aria-label="Qualitative echo schematic paired with the contact cutaway"
      >
        <defs>
          <pattern id="contact-echoes" width="2.4" height="2.8" patternUnits="userSpaceOnUse">
            <circle cx=".7" cy=".8" r=".18" fill="#c9d4dc" />
            <circle cx="1.9" cy="2.1" r=".11" fill="#d4dde6" />
          </pattern>
        </defs>
        <rect x="-30" width="60" height="45" fill="#101722" />
        <path
          d="M-22 8H22"
          stroke="#a9b5c2"
          strokeWidth="1.5"
          opacity={brightness}
          {...name('Contact interface')}
        />
        {coupled && (
          <g opacity={brightness}>
            <rect x="-22" y="10" width="44" height="32" fill="url(#contact-echoes)" />
            <ellipse cx="0" cy="23" rx="10" ry="8" fill="#4d5966" {...name('Example node')} />
            <path d="M10 8H17" stroke="#e0e4e9" strokeWidth="2" {...name('Cartilage reflector')} />
            <path
              d="M10 10L8 42H21L17 10Z"
              fill="#0b111b"
              opacity=".88"
              {...name('Shadow behind cartilage')}
            />
          </g>
        )}
        {s.mode === 'bubble' && (
          <g {...name('Interruption deep to a focal air interface')}>
            <path d="M-3 8H3" stroke="white" strokeWidth="2" />
            <path d="M-3 10L-9 43H9L3 10Z" fill="#0b111b" />
          </g>
        )}
        {s.mode === 'shadow' && (
          <g {...name('Shadow behind a calcified focus')}>
            <ellipse cx="0" cy="20" rx="2" ry="1" fill="#eef4f5" />
            <path d="M-2 21L-5 43H5L2 21Z" fill="#0b111b" />
          </g>
        )}
        {/* Labels at the modelled origin of the dark band for the selected condition (L5-3).
            Text sits inside the 60-unit viewBox: left-anchored labels start at x = -28.5 and
            right-anchored ones at x = 8.4, at a size that keeps every string within the field. */}
        <g
          className="contact-origin-labels"
          fill="#9ef0e2"
          stroke="none"
          fontSize="1.7"
          data-contact-origin={s.mode}
        >
          {s.mode === 'gap' && (
            <>
              <path d="M-6 8L-10 4.6" stroke="#9ef0e2" strokeWidth=".2" />
              <text x="-28.5" y="4.2">air gap at the transducer face</text>
            </>
          )}
          {s.mode === 'bubble' && (
            <>
              <path d="M3.4 8L9 4.6" stroke="#9ef0e2" strokeWidth=".2" />
              <text x="9.4" y="4.2">focal air interface (bubble)</text>
              <path d="M-9 30L-13 30" stroke="#9ef0e2" strokeWidth=".2" />
              <text x="-28.5" y="30.6">shadow starts at the interface</text>
            </>
          )}
          {s.mode === 'shadow' && (
            <>
              <path d="M2.2 19.6L8 16" stroke="#9ef0e2" strokeWidth=".2" />
              <text x="8.4" y="15.7">modelled reflector</text>
              <path d="M-4.5 34L-8.5 34" stroke="#9ef0e2" strokeWidth=".2" />
              <text x="-28.5" y="34.6">dark band begins behind it</text>
            </>
          )}
          {(s.mode === 'direct' || s.mode === 'balloon') && (
            <>
              <path d="M-6 8L-10 4.6" stroke="#9ef0e2" strokeWidth=".2" />
              <text x="-28.5" y="4.2">
                {s.mode === 'direct' ? 'direct transducer–wall contact' : 'fluid-balloon contact'}
              </text>
            </>
          )}
        </g>
      </svg>
      {reveal && hover && <p role="tooltip">{hover}</p>}
      <p className="model-caption" data-contact-caption={s.mode}>
        {CONTACT_CAPTIONS[s.mode]}
      </p>
      <p className="model-caption">
        Qualitative authored echoes. Brightness is illustrative. Gain cannot restore the absent
        window in the air-gap condition.
      </p>
    </section>
  )
}
