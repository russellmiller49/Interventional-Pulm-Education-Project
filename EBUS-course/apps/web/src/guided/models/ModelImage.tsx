import { useState } from 'react'
import {
  MODEL_GEOMETRY,
  needleGeometry,
  phantomSections,
  routeDefinition,
  routeSupported,
  type ModelState,
  type ModelAction,
} from '../../../../../../src/lib/ebus-model-contract'
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
          Arrows show viewing direction. They do not establish a clear needle path. Station 9 is not
          modeled; hilar/interlobar regions still require an appropriate examination.
        </p>
      </section>
    )
  }
  const name = (label: string) =>
    reveal ? { onPointerEnter: () => setHover(label), onPointerLeave: () => setHover('') } : {}
  if (s.package === 'measurement') {
    const sections = phantomSections(s.shape, s.offset),
      [a, b] = s.calipers
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
          {reveal && s.shape === 'ellipsoid' && s.offset === 0 && (
            <g stroke="#42d6ba" strokeDasharray="1 1" strokeWidth=".25">
              <path d="M0 14v16" />
              <text x="0" y="41" textAnchor="middle" fill="#92f8dd" stroke="none" fontSize="2">
                Authored short axis: 16 mm
              </text>
            </g>
          )}
        </svg>
        {reveal && hover && <p role="tooltip">{hover}</p>}
        <p className="model-caption">
          Analytic section of the same 3D shape. Tap a frozen image for calipers, or use the numeric
          endpoint controls. Phantom units only.
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
      </svg>
      {reveal && hover && <p role="tooltip">{hover}</p>}
      <p className="model-caption">
        Qualitative authored echoes. Brightness is illustrative. Gain cannot restore the absent
        window in the air-gap condition.
      </p>
    </section>
  )
}
