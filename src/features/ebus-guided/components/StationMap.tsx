'use client'
import { useState } from 'react'

import {
  ACCESS_LABELS,
  MAP_STATIONS,
  SAMPLING_ORDER,
  nCategory,
  type MapStation,
  type NCategory,
  type PrimarySide,
  type StationAccess,
} from '../content/station-map'
import { StationFigure } from './StationFigure'
import styles from './station-map.module.css'

/**
 * The course's nodal map: one drawing, read three ways.
 *
 * - Stations: where each station sits against the airway and its landmark vessels.
 * - N category: what each station means for a primary on the right or the left, and the order
 *   the staging lesson gives for sampling them.
 * - Access: which stations the airway reaches, which the esophagus adds, and which neither does.
 *
 * Selecting a station shows the owner's record for it (borders, landmark vessels, the EBUS
 * window) and can open its CT, airway and ultrasound views. The drawing is a schematic laid out
 * like a coronal CT; it can be mirrored so the patient's right is on the right, as it is for the
 * operator at the head of the bed (the head stays at the top, so it is a mirror, not their view).
 */
export type StationMapView = 'stations' | 'n-category' | 'access'

/** The drawing is laid out about the trachea at x = 260; mirroring reflects across that line. */
const WIDTH = 520
/** What is shown: the drawing without its empty margins, so it reads at a narrow column's width. */
const FRAME = { x: 55, y: 0, width: 410, height: 380 }
const VIEWS: [StationMapView, string][] = [
  ['stations', 'Stations'],
  ['n-category', 'N category'],
  ['access', 'Access'],
]
const N_FILL: Record<NCategory | 'N2 or N3', string> = {
  N1: '#3f8f6b',
  N2: '#b98a3a',
  N3: '#b0565f',
  'N2 or N3': '#6f6a52',
}
const ACCESS_FILL: Record<StationAccess, string> = {
  ebus: '#2f7f86',
  both: '#5b6fb3',
  'eus-b': '#7a5aa6',
  neither: '#3a4a52',
}
const PLAIN_FILL = '#3f6b4f'
const BOUNDARY_ORDER = ['superior', 'inferior', 'medial', 'lateral', 'anterior', 'posterior']

export function StationMap({
  view: initialView = 'stations',
  station: initialStation,
  inDialog = false,
}: {
  view?: StationMapView
  station?: string
  /** Inside the course's dialog, which already carries the map's title and is widened to fit it. */
  inDialog?: boolean
}) {
  const [view, setView] = useState<StationMapView>(initialView)
  const [selectedId, setSelectedId] = useState<string | null>(initialStation ?? null)
  const [primary, setPrimary] = useState<PrimarySide>('right')
  const [fromHead, setFromHead] = useState(false)
  const [order, setOrder] = useState(false)
  const [views, setViews] = useState(false)
  const selected = MAP_STATIONS.find((station) => station.id === selectedId) ?? null
  /** Mirror the drawing for the view from the head of the bed. */
  const mx = (x: number) => (fromHead ? WIDTH - x : x)
  const path = (points: [number, number][]) =>
    points.map(([x, y], index) => (index ? 'L' : 'M') + mx(x) + ' ' + y).join(' ')
  const select = (id: string) => {
    setSelectedId((current) => (current === id ? null : id))
    setViews(false)
  }
  const fill = (station: MapStation) =>
    view === 'n-category'
      ? N_FILL[nCategory(station, primary)]
      : view === 'access'
        ? ACCESS_FILL[station.access]
        : station.record
          ? PLAIN_FILL
          : ACCESS_FILL.neither
  const orderOf = (station: MapStation) => {
    const category = nCategory(station, primary)
    return category === 'N2 or N3' ? 0 : SAMPLING_ORDER.indexOf(category) + 1
  }
  const side = primary === 'right' ? 'right' : 'left'
  const borders: Record<string, string | undefined> = selected?.record?.boundaryDefinition ?? {}

  return (
    <section
      className={inDialog ? styles.map + ' ' + styles.inDialog : styles.map}
      data-station-map
      data-view={view}
      aria-label="Nodal station map"
    >
      {inDialog ? null : <h2>Nodal station map</h2>}
      <p className={styles.caption} data-station-map-caption>
        A schematic drawn for this course, not to scale and not a patient image.{' '}
        {fromHead
          ? 'Mirrored so the patient’s right is on the right, as it is for you at the head of the bed.'
          : 'Drawn like a coronal CT: the patient’s right is on the left.'}{' '}
        Select a station for its borders and landmarks.
      </p>
      <div className={styles.controls}>
        <div className={styles.group} role="group" aria-label="What the map shows">
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => {
                setView(key)
                setOrder(false)
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'n-category' && (
          <div className={styles.group} role="group" aria-label="Side of the primary tumor">
            <span className={styles.groupLabel}>Primary in the</span>
            {(['right', 'left'] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={primary === key}
                onClick={() => setPrimary(key)}
              >
                {key === 'right' ? 'Right lung' : 'Left lung'}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={order}
              data-sampling-order-toggle
              onClick={() => setOrder((value) => !value)}
            >
              {order ? 'Hide the sampling order' : 'Show the sampling order'}
            </button>
          </div>
        )}
        <button
          type="button"
          aria-pressed={fromHead}
          data-station-map-flip
          onClick={() => setFromHead((value) => !value)}
        >
          {fromHead ? 'Draw it like a coronal CT' : 'Put the patient’s right on the right'}
        </button>
      </div>
      <div className={styles.layout}>
        <div className={styles.drawing}>
          <svg
            viewBox={`${FRAME.x} ${FRAME.y} ${FRAME.width} ${FRAME.height}`}
            role="img"
            aria-label="Trachea and bronchi with the nodal stations placed around them"
            data-orientation={fromHead ? 'from-head' : 'coronal-ct'}
          >
            <rect
              x={FRAME.x}
              y={FRAME.y}
              width={FRAME.width}
              height={FRAME.height}
              rx="16"
              fill="#0a2028"
            />
            {/* Landmark vessels, drawn faintly: each one is a border in the station records. */}
            <g fill="none" stroke="#7f9fb0" strokeWidth="9" strokeLinecap="round" opacity=".42">
              <path d={`M${mx(352)} 44 Q${mx(300)} 58 ${mx(228)} 76`} data-landmark="innominate" />
              <path
                d={`M${mx(312)} 134 Q${mx(310)} 88 ${mx(346)} 86 Q${mx(384)} 86 ${mx(384)} 132`}
                data-landmark="aortic-arch"
              />
              <path d={`M${mx(206)} 132 Q${mx(238)} 136 ${mx(234)} 156`} data-landmark="azygos" />
              <path
                d={`M${mx(298)} 158 L${mx(346)} 160`}
                strokeWidth="16"
                data-landmark="left-pa"
              />
            </g>
            {/* The airway: right main bronchus shorter and steeper, with its upper-lobe takeoff. */}
            <g fill="none" stroke="#947986" strokeLinecap="round" strokeLinejoin="round">
              <path
                d={path([
                  [260, 18],
                  [260, 150],
                ])}
                strokeWidth="26"
              />
              <path
                d={path([
                  [260, 150],
                  [196, 206],
                ])}
                strokeWidth="22"
              />
              <path
                d={path([
                  [212, 190],
                  [142, 168],
                ])}
                strokeWidth="13"
              />
              <path
                d={path([
                  [196, 206],
                  [170, 268],
                ])}
                strokeWidth="18"
              />
              <path
                d={path([
                  [170, 268],
                  [118, 300],
                ])}
                strokeWidth="12"
              />
              <path
                d={path([
                  [170, 268],
                  [178, 338],
                ])}
                strokeWidth="14"
              />
              <path
                d={path([
                  [260, 150],
                  [352, 222],
                ])}
                strokeWidth="20"
              />
              <path
                d={path([
                  [352, 222],
                  [420, 196],
                ])}
                strokeWidth="13"
              />
              <path
                d={path([
                  [352, 222],
                  [378, 312],
                ])}
                strokeWidth="14"
              />
            </g>
            {/* The left pulmonary artery lies under two stations, so its name sits clear of them. */}
            <line
              x1={mx(414)}
              y1="167"
              x2={mx(350)}
              y2="160"
              stroke="#7f9fb0"
              strokeWidth="1"
              opacity=".8"
            />
            <g fill="#a3bec9" fontSize="14">
              <text x={mx(392)} y="64" textAnchor="middle">
                Innominate vein
              </text>
              <text x={mx(428)} y="142" textAnchor="middle">
                Aortic arch
              </text>
              <text x={mx(128)} y="126" textAnchor="middle">
                Azygos vein
              </text>
              <text x={mx(438)} y="172" textAnchor="middle" fontSize="13">
                Left PA
              </text>
              <text x={mx(260)} y="14" textAnchor="middle">
                Trachea
              </text>
            </g>
            <g fill="#eaf6f3" fontSize="17" fontWeight="700">
              <text x={mx(74)} y="32" textAnchor="middle" data-side-marker="right">
                R
              </text>
              <text x={mx(446)} y="32" textAnchor="middle" data-side-marker="left">
                L
              </text>
            </g>
            {MAP_STATIONS.map((station) => {
              const on = station.id === selectedId
              const category = nCategory(station, primary)
              const wide = station.id.length > 2
              return (
                <g
                  key={station.id}
                  className={styles.node}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={'Station ' + station.id + ', ' + station.name}
                  data-station={station.id}
                  data-n={category}
                  data-access={station.access}
                  data-scanned={station.record ? 'true' : 'false'}
                  onClick={() => select(station.id)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    select(station.id)
                  }}
                >
                  <ellipse
                    cx={mx(station.x)}
                    cy={station.y}
                    rx={wide ? 27 : 23}
                    ry="17"
                    fill={fill(station)}
                    stroke={on ? '#ffff93' : '#c7e4e5'}
                    strokeWidth={on ? 3 : 1.2}
                    strokeDasharray={station.record ? undefined : '4 3'}
                  />
                  <text
                    x={mx(station.x)}
                    y={station.y + 5}
                    textAnchor="middle"
                    fill="#f4fbfa"
                    fontSize="16"
                    fontWeight="700"
                  >
                    {station.id}
                  </text>
                  {view === 'n-category' && order && orderOf(station) > 0 && (
                    <g className={styles.orderBadge} data-order={orderOf(station)}>
                      <circle
                        cx={mx(station.x) + (wide ? 27 : 23)}
                        cy={station.y - 16}
                        r="10"
                        fill="#ffff93"
                      />
                      <text
                        x={mx(station.x) + (wide ? 27 : 23)}
                        y={station.y - 12}
                        textAnchor="middle"
                        fill="#0a2028"
                        fontSize="11"
                        fontWeight="700"
                      >
                        {orderOf(station)}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
          <div className={styles.legend} data-station-map-legend>
            {view === 'n-category' ? (
              <>
                {(['N1', 'N2', 'N3'] as const).map((category) => (
                  <span key={category}>
                    <i className={styles.swatch} style={{ background: N_FILL[category] }} />
                    {category}
                  </span>
                ))}
                <span>
                  <i className={styles.swatch} style={{ background: N_FILL['N2 or N3'] }} />
                  N2 or N3, by the node’s side
                </span>
              </>
            ) : view === 'access' ? (
              (Object.keys(ACCESS_LABELS) as StationAccess[]).map((access) => (
                <span key={access}>
                  <i className={styles.swatch} style={{ background: ACCESS_FILL[access] }} />
                  {ACCESS_LABELS[access]}
                </span>
              ))
            ) : (
              <>
                <span>
                  <i className={styles.swatch} style={{ background: PLAIN_FILL }} />
                  Scanned in this course
                </span>
                <span>
                  <i className={styles.swatch} style={{ background: ACCESS_FILL.neither }} />
                  Named, not scanned (dashed)
                </span>
              </>
            )}
          </div>
          {view === 'n-category' && order && (
            <p className={styles.order} data-sampling-order>
              For a {side} lung primary, sample in the numbered order: N3 stations first, then N2,
              then N1, with the primary tumor later when appropriate. That reduces the risk of
              carrying tumor from a lower-stage target into a higher-stage site.
            </p>
          )}
        </div>
        <div className={styles.panel} data-station-panel={selected?.id ?? ''} aria-live="polite">
          {selected ? (
            <>
              <h3>
                Station {selected.id} · {selected.name}
              </h3>
              <div className={styles.facts}>
                <span className={styles.fact} data-fact="n">
                  {nCategory(selected, primary)} for a {side} lung primary
                </span>
                <span className={styles.fact} data-fact="access">
                  {ACCESS_LABELS[selected.access]}
                </span>
              </div>
              {selected.record ? (
                <>
                  <p>{selected.record.description}</p>
                  <dl data-station-borders>
                    {BOUNDARY_ORDER.filter((key) => borders[key]).map((key) => (
                      <div key={key} style={{ display: 'contents' }}>
                        <dt>{key.charAt(0).toUpperCase() + key.slice(1)}</dt>
                        <dd>{borders[key]}</dd>
                      </div>
                    ))}
                    <div style={{ display: 'contents' }}>
                      <dt>Landmark vessels</dt>
                      <dd>{selected.record.landmarkVessels.join(', ')}</dd>
                    </div>
                    <div style={{ display: 'contents' }}>
                      <dt>EBUS window</dt>
                      <dd>{selected.record.bestEbusWindow}</dd>
                    </div>
                  </dl>
                  {selected.record.commonConfusionPair && (
                    <p>
                      Commonly confused with{' '}
                      {selected.record.commonConfusionPair.split('/').map((id, index) => (
                        <span key={id}>
                          {index ? ' or ' : ''}
                          <button type="button" onClick={() => select(id)}>
                            {id}
                          </button>
                        </span>
                      ))}
                      .
                    </p>
                  )}
                  {/* Every scanned station has its CT, airway and ultrasound images (tested). */}
                  {
                    <button
                      type="button"
                      aria-expanded={views}
                      data-station-views-toggle
                      onClick={() => setViews((value) => !value)}
                    >
                      {views
                        ? 'Hide the CT, airway and ultrasound views'
                        : 'Compare its CT, airway and ultrasound views'}
                    </button>
                  }
                </>
              ) : (
                <p data-station-context>{selected.context}</p>
              )}
            </>
          ) : (
            <p className={styles.caption}>
              No station selected. Select one on the drawing or from the list below it.
            </p>
          )}
        </div>
      </div>
      <div className={styles.stationList} role="group" aria-label="Stations">
        {MAP_STATIONS.map((station) => (
          <button
            key={station.id}
            type="button"
            aria-pressed={station.id === selectedId}
            onClick={() => select(station.id)}
          >
            {station.id}
          </button>
        ))}
      </div>
      {views && selected?.record && <StationFigure key={selected.id} station={selected.id} />}
    </section>
  )
}
