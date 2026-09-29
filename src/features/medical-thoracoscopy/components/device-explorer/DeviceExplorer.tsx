'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react'

import {
  ASSEMBLY_HOTSPOTS,
  ASSEMBLY_STEP_WORDS,
  CLAIM_KIND_ORDER,
  CLAIM_KINDS,
  EXPLORER_DEVICES,
  EXPLORER_GROUPS,
  EXPLORER_WORDS,
  explorerDevice,
  type HotspotSpec,
  catalogue,
  QUALITY_CLASS_WORDS,
} from '../../content/deviceExplorerCatalogue'
import {
  ASSEMBLY_SECONDS,
  ASSEMBLY_STEPS,
  assemblyGeometry,
  cutawaySuggestedAt,
  explodedParams,
  jawsClearOfChannel,
  kitAssemblyAnchors,
  kitJawOpeningDeg,
  paramsAt,
  STEP_STARTS,
  stepAt,
  type AssemblyGeometry,
} from '../../engine/deviceExplorer/assembly'
import { ASSEMBLY, explorerReducer, initialExplorerState, showsCutaway } from './explorerState'
import type { ExplorerViewportProps } from './ExplorerViewport'
import type { ExplorerAssetSource } from './sceneLink'
import { createSequenceClock, type SequenceClock } from './sequenceClock'
import styles from './device-explorer.module.css'

/**
 * The device explorer: a large viewport, the devices beside it, and ordinary controls for every
 * action the viewport offers, so everything can be done from the keyboard. The 3D view itself is
 * passed in, so the explorer can be tested without a GPU and later hosted by a lesson.
 */
export interface DeviceExplorerProps {
  readonly source: ExplorerAssetSource
  readonly Viewport: ComponentType<ExplorerViewportProps>
  /** The line above the title; defaults to the private-preview line. */
  readonly eyebrow?: string
  /** A disclosure shown under the title, for a page that needs one. */
  readonly notice?: string
  /** Controls beside the title, such as ending a review session. */
  readonly headerActions?: ReactNode
  /** The lines at the foot of the explorer. */
  readonly footer?: readonly string[]
}

const ASSEMBLY_PARTS = [
  { id: 'trocar-sleeve-flexible', role: 'Sleeve' },
  { id: 'operative-telescope', role: 'Telescope' },
  { id: 'double-spoon-forceps', role: 'Forceps' },
] as const

function useSequence(clock: SequenceClock) {
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get)
}

function stepValues(geometry: AssemblyGeometry) {
  return {
    sleeveSeatMm: geometry.sleeveSeatMm,
    channelLengthMm: catalogue.values.channelLengthMm.value,
    sheathLengthMm: catalogue.values.sheathLengthMm.value,
    sheathBeyondMm: geometry.sheathBeyondDistalFaceMm,
    jawOpeningDeg: geometry.jawOpeningDeg,
  }
}

function formatMm(value: number) {
  return `${Number(value.toFixed(1))} mm`
}

/** Where a step's result is: just inside its end, so the step still names it. */
function stepEnd(index: number): number {
  const step = Math.min(ASSEMBLY_STEPS.length - 1, Math.max(0, index))
  return Math.max(0, STEP_STARTS[step] + ASSEMBLY_STEPS[step].seconds - 0.001)
}

/** Play, step and scrub: the controls that sit directly under the viewport. */
function Transport({
  clock,
  geometry,
  onPlay,
  onScrub,
}: {
  clock: SequenceClock
  geometry: AssemblyGeometry
  onPlay: () => void
  onScrub: () => void
}) {
  const moment = useSequence(clock)
  const { index, k } = stepAt(moment.seconds)
  const words = ASSEMBLY_STEP_WORDS[ASSEMBLY_STEPS[index].id]
  const values = useMemo(() => stepValues(geometry), [geometry])
  const atEnd = moment.seconds >= ASSEMBLY_SECONDS - 0.002
  const stepLabel = `Step ${index + 1} of ${ASSEMBLY_STEPS.length}: ${words.title}`
  const go = (seconds: number) => {
    onScrub()
    clock.pause()
    clock.jump(seconds)
  }
  return (
    <section className={styles.transport} aria-label="Assembly sequence">
      <div className={styles.transportRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            if (moment.playing) clock.pause()
            else onPlay()
          }}
        >
          {moment.playing ? 'Pause' : atEnd ? 'Play from the start' : 'Play'}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => go(index === 0 ? 0 : stepEnd(index - 1))}
          disabled={moment.seconds <= 0}
        >
          Previous step
        </button>
        <div className={styles.scrubber}>
          <input
            type="range"
            min={0}
            max={ASSEMBLY_SECONDS}
            step={0.01}
            value={moment.seconds}
            aria-label="Assembly progress"
            aria-valuetext={stepLabel}
            onChange={(event) => {
              onScrub()
              clock.pause()
              clock.scrub(Number(event.target.value))
            }}
          />
          <div className={styles.ticks} aria-hidden="true">
            {STEP_STARTS.slice(1).map((start) => (
              <span key={start} style={{ left: `${(start / ASSEMBLY_SECONDS) * 100}%` }} />
            ))}
          </div>
        </div>
        <button
          type="button"
          className={styles.button}
          onClick={() => go(stepEnd(k >= 0.99 ? index + 1 : index))}
          disabled={atEnd}
        >
          Next step
        </button>
      </div>
      <p className={styles.stepNow} aria-live="polite">
        <strong>{stepLabel}.</strong> {words.caption(values)}
      </p>
    </section>
  )
}

/** The ten steps, each a button that shows that step's result. */
function StepList({ clock, onScrub }: { clock: SequenceClock; onScrub: () => void }) {
  const moment = useSequence(clock)
  const { index } = stepAt(moment.seconds)
  return (
    <section className={styles.card} aria-labelledby="explorer-steps-title">
      <h2 id="explorer-steps-title" className={styles.cardTitle}>
        Assembly steps
      </h2>
      <ol className={styles.steps}>
        {ASSEMBLY_STEPS.map((step, position) => (
          <li key={step.id}>
            <button
              type="button"
              className={styles.stepButton}
              aria-current={position === index ? 'step' : undefined}
              data-done={position < index || undefined}
              onClick={() => {
                onScrub()
                clock.pause()
                clock.jump(stepEnd(position))
              }}
            >
              <span className={styles.stepNumber}>{position + 1}</span>{' '}
              {ASSEMBLY_STEP_WORDS[step.id].title}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function JawControl({
  clock,
  geometry,
  assembly,
  exploded,
  measured,
  jaw,
  openDeg,
  onJaw,
}: {
  clock: SequenceClock
  geometry: AssemblyGeometry
  assembly: boolean
  exploded: boolean
  measured: boolean
  jaw: number
  openDeg: number
  onJaw: (value: number) => void
}) {
  const moment = useSequence(clock)
  const clear =
    !assembly ||
    jawsClearOfChannel(
      exploded ? explodedParams(geometry) : paramsAt(moment.seconds, geometry),
      geometry,
    )
  const enabled = measured && clear
  const note = !measured
    ? 'The opening of these jaws has not been measured, so they stay closed.'
    : !clear
      ? 'The jaws open once they are past the channel exit.'
      : null
  return (
    <fieldset
      className={styles.jawControl}
      disabled={!enabled}
      aria-describedby="explorer-jaw-note"
    >
      <legend className={styles.jawLegend}>Jaws</legend>
      <button type="button" className={styles.button} onClick={() => onJaw(1)}>
        Open
      </button>
      <button type="button" className={styles.button} onClick={() => onJaw(0)}>
        Close
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={jaw}
        aria-label="Jaw opening"
        aria-valuetext={`${Math.round(jaw * openDeg)}° of ${openDeg}°`}
        onChange={(event) => onJaw(Number(event.target.value))}
      />
      <span className={styles.jawValue}>
        {Math.round(jaw * openDeg)}° / {openDeg}°
      </span>
      <span id="explorer-jaw-note" className={styles.fieldNote}>
        {note ?? ''}
      </span>
    </fieldset>
  )
}

function ClassChip({ id }: { id: string }) {
  const entry = explorerDevice(id)
  return (
    <span className={styles.classChip} data-class={entry.qualityClass}>
      Class {entry.qualityClass}
    </span>
  )
}

function DeviceCard({ id }: { id: string }) {
  const device = explorerDevice(id)
  const words = QUALITY_CLASS_WORDS[device.qualityClass]
  return (
    <section className={styles.card} aria-labelledby="explorer-device-title">
      <h2 id="explorer-device-title" className={styles.cardTitle}>
        {device.title}
      </h2>
      <p className={styles.status}>{device.status}</p>
      <dl className={styles.facts}>
        {device.productNumber && (
          <>
            <dt>Product number</dt>
            <dd>{device.productNumber}</dd>
          </>
        )}
        <dt>Configuration</dt>
        <dd>{device.configuration}</dd>
        <dt>Quality</dt>
        <dd>
          <ClassChip id={id} /> {words.title}. {words.description}
        </dd>
      </dl>
      {device.presentationNote && <p className={styles.note}>{device.presentationNote}</p>}
    </section>
  )
}

function AssemblyCard({ geometry }: { geometry: AssemblyGeometry }) {
  return (
    <section className={styles.card} aria-labelledby="explorer-device-title">
      <h2 id="explorer-device-title" className={styles.cardTitle}>
        {EXPLORER_WORDS.assembly.title}
      </h2>
      <p className={styles.status}>{EXPLORER_WORDS.assembly.subtitle}</p>
      <ul className={styles.partList}>
        {ASSEMBLY_PARTS.map((part) => (
          <li key={part.id}>
            <span>
              {part.role}: {explorerDevice(part.id).title}
              {explorerDevice(part.id).productNumber && (
                <span className={styles.muted}> · {explorerDevice(part.id).productNumber}</span>
              )}
            </span>
            <ClassChip id={part.id} />
          </li>
        ))}
      </ul>
      <p className={styles.note}>{EXPLORER_WORDS.assembly.together}</p>
      <dl className={styles.facts}>
        <dt>Sleeve on the telescope</dt>
        <dd>
          Coaxial; its distal end {formatMm(geometry.sleeveSeatMm)} from the distal face, where it
          sat in a reference image.{' '}
          <span className={styles.kindTag} data-kind="derived">
            {CLAIM_KINDS.derived.title}
          </span>
        </dd>
        <dt>Forceps in the working channel</dt>
        <dd>
          The front of the handle on the channel entry; the sheath end then stands{' '}
          {formatMm(geometry.sheathBeyondDistalFaceMm)} beyond the distal face.{' '}
          <span className={styles.kindTag} data-kind="derived">
            {CLAIM_KINDS.derived.title}
          </span>
        </dd>
      </dl>
    </section>
  )
}

function HotspotDetail({ spec }: { spec: HotspotSpec }) {
  const rows = spec.evidence
  return (
    <section className={styles.detail} aria-labelledby="explorer-hotspot-title" aria-live="polite">
      <h3 id="explorer-hotspot-title" className={styles.detailTitle}>
        {spec.title}
      </h3>
      <p className={styles.detailText}>{spec.description}</p>
      <ul className={styles.evidence}>
        {rows.map((row, index) => (
          <li key={index} className={styles.evidenceRow} data-kind={row.kind}>
            <span className={styles.kindTag} data-kind={row.kind}>
              {CLAIM_KINDS[row.kind].title}
            </span>
            <span className={styles.evidenceLabel}>
              {row.label}
              {row.value && <strong>: {row.value}</strong>}
            </span>
            {row.detail && <span className={styles.evidenceDetail}>{row.detail}</span>}
            {row.basis && <span className={styles.evidenceBasis}>{row.basis}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ClaimLegend() {
  return (
    <details className={styles.legend}>
      <summary>What the labels mean</summary>
      <dl>
        {CLAIM_KIND_ORDER.map((kind) => (
          <div key={kind}>
            <dt>
              <span className={styles.kindTag} data-kind={kind}>
                {CLAIM_KINDS[kind].title}
              </span>
            </dt>
            <dd>{CLAIM_KINDS[kind].description}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

export function DeviceExplorer({
  source,
  Viewport,
  eyebrow,
  notice,
  headerActions,
  footer = EXPLORER_WORDS.footer,
}: DeviceExplorerProps) {
  const [state, dispatch] = useReducer(explorerReducer, initialExplorerState)
  const clock = useMemo(() => createSequenceClock(ASSEMBLY_SECONDS), [])
  const geometry = useMemo(
    () => assemblyGeometry(kitAssemblyAnchors(), source.sleeveSeatMm, kitJawOpeningDeg()),
    [source.sleeveSeatMm],
  )
  const assembly = state.selection === ASSEMBLY

  // The sequence switches the cutaway on and off as the playhead crosses its steps; in between,
  // the viewer's own choice stands.
  const selection = useRef(state.selection)
  useLayoutEffect(() => {
    selection.current = state.selection
  }, [state.selection])
  useEffect(() => {
    let suggested = cutawaySuggestedAt(clock.get().seconds)
    return clock.subscribe(() => {
      const now = cutawaySuggestedAt(clock.get().seconds)
      if (now === suggested) return
      suggested = now
      if (selection.current === ASSEMBLY) dispatch({ type: 'cutaway', on: now })
    })
  }, [clock])

  const onSelectHotspot = useCallback((key: string) => dispatch({ type: 'hotspot', key }), [])
  const onUserCamera = useCallback(() => dispatch({ type: 'follow', on: false }), [])
  const exploded = useRef(state.exploded)
  useLayoutEffect(() => {
    exploded.current = state.exploded
  }, [state.exploded])
  const onScrub = useCallback(() => {
    if (exploded.current) dispatch({ type: 'explode', on: false })
  }, [])

  const device = assembly ? null : explorerDevice(state.selection)
  const hotspots: { key: string; spec: HotspotSpec }[] = assembly
    ? ASSEMBLY_HOTSPOTS.map(({ part, spot }) => ({ key: `${part}:${spot.id}`, spec: spot }))
    : (device?.hotspots ?? []).map((spot) => ({ key: spot.id, spec: spot }))
  const chosen = hotspots.find((hotspot) => hotspot.key === state.hotspot) ?? null
  const cutawayAvailable = assembly || Boolean(device?.pair)
  const jawDevice = assembly ? explorerDevice('double-spoon-forceps') : device
  const jawOpenDeg = assembly
    ? geometry.jawOpeningDeg
    : device?.jaws === 'measured'
      ? kitJawOpeningDeg()
      : 0
  const cutawayShown = showsCutaway(state)
  const viewportLabel = assembly
    ? `Three-dimensional view of the ${EXPLORER_WORDS.assembly.subtitle.toLowerCase()}.`
    : `Three-dimensional view of the ${device?.title.toLowerCase()}.`

  return (
    <section className={styles.explorer} aria-labelledby="explorer-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{eyebrow ?? `Private preview · ${source.name}`}</p>
          <h1 id="explorer-title" className={styles.title}>
            {EXPLORER_WORDS.title}
          </h1>
          <p className={styles.subtitle}>{EXPLORER_WORDS.subtitle}</p>
          {notice && <p className={styles.notice}>{notice}</p>}
        </div>
        {headerActions && <div className={styles.headerActions}>{headerActions}</div>}
      </header>

      <div className={styles.workspace}>
        <nav className={styles.selector} aria-label="Devices">
          <button
            type="button"
            className={styles.deviceButton}
            aria-pressed={assembly}
            onClick={() => dispatch({ type: 'select', id: ASSEMBLY })}
          >
            <span className={styles.deviceName}>{EXPLORER_WORDS.assembly.title}</span>
            <span className={styles.deviceMeta}>Sleeve, telescope and forceps</span>
          </button>
          {EXPLORER_GROUPS.map((group) => (
            <div key={group} role="group" aria-labelledby={`explorer-group-${group}`}>
              <h2 id={`explorer-group-${group}`} className={styles.groupTitle}>
                {group}
              </h2>
              {EXPLORER_DEVICES.filter((entry) => entry.group === group).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  data-device={entry.id}
                  className={styles.deviceButton}
                  aria-pressed={state.selection === entry.id}
                  onClick={() => dispatch({ type: 'select', id: entry.id })}
                >
                  <span className={styles.deviceName}>
                    {entry.title}
                    <ClassChip id={entry.id} />
                  </span>
                  <span className={styles.deviceMeta}>{entry.productNumber ?? 'Illustrative'}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.stage}>
          <div className={styles.viewport} role="img" aria-label={viewportLabel}>
            <Viewport
              source={source}
              geometry={geometry}
              clock={clock}
              state={state}
              onSelectHotspot={onSelectHotspot}
              onUserCamera={onUserCamera}
            />
            <div className={styles.badges} aria-hidden="true">
              {cutawayShown && <span className={styles.badge}>Internal paths illustrative</span>}
              {device?.frame === 'tower' && (
                <span className={styles.badge}>Illustrative blockout</span>
              )}
            </div>
          </div>

          {assembly && (
            <Transport
              clock={clock}
              geometry={geometry}
              onPlay={() => {
                dispatch({ type: 'explode', on: false })
                dispatch({ type: 'follow', on: true })
                clock.play()
              }}
              onScrub={onScrub}
            />
          )}

          <div className={styles.toolbar} role="group" aria-label="View">
            <button
              type="button"
              className={styles.button}
              onClick={() => dispatch({ type: 'resetCamera' })}
            >
              Reset camera
            </button>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={state.labels}
                onChange={(event) => dispatch({ type: 'labels', on: event.target.checked })}
              />
              <span>Labels</span>
            </label>
            {cutawayAvailable && (
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={cutawayShown}
                  onChange={(event) => dispatch({ type: 'cutaway', on: event.target.checked })}
                />
                <span>Cutaway</span>
              </label>
            )}
            {assembly && (
              <div className={styles.segmented} role="group" aria-label="Layout">
                <button
                  type="button"
                  aria-pressed={state.exploded}
                  onClick={() => {
                    clock.pause()
                    dispatch({ type: 'explode', on: true })
                  }}
                >
                  Exploded view
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clock.pause()
                    dispatch({ type: 'explode', on: false })
                    if (clock.get().seconds < ASSEMBLY_SECONDS) clock.jump(ASSEMBLY_SECONDS)
                  }}
                >
                  Assemble
                </button>
              </div>
            )}
            {assembly && (
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={state.follow}
                  onChange={(event) => dispatch({ type: 'follow', on: event.target.checked })}
                />
                <span>Camera follows the sequence</span>
              </label>
            )}
            {jawDevice?.jaws && (
              <JawControl
                clock={clock}
                geometry={geometry}
                assembly={assembly}
                exploded={state.exploded}
                measured={jawDevice.jaws === 'measured'}
                jaw={state.jaw}
                openDeg={jawOpenDeg}
                onJaw={(value) => dispatch({ type: 'jaw', value })}
              />
            )}
          </div>
        </div>

        <aside className={styles.details} aria-label="Details">
          {assembly && <StepList clock={clock} onScrub={onScrub} />}
          {assembly ? <AssemblyCard geometry={geometry} /> : <DeviceCard id={state.selection} />}
          <section className={styles.card} aria-labelledby="explorer-hotspots-title">
            <h2 id="explorer-hotspots-title" className={styles.cardTitle}>
              Hotspots
            </h2>
            <div className={styles.hotspotList}>
              {hotspots.map((hotspot) => (
                <button
                  key={hotspot.key}
                  type="button"
                  className={styles.hotspotButton}
                  aria-pressed={state.hotspot === hotspot.key}
                  onClick={() =>
                    dispatch({
                      type: 'hotspot',
                      key: state.hotspot === hotspot.key ? null : hotspot.key,
                    })
                  }
                >
                  {hotspot.spec.title}
                </button>
              ))}
            </div>
            {chosen ? (
              <HotspotDetail spec={chosen.spec} />
            ) : (
              <p className={styles.muted}>Choose a hotspot, here or on the model.</p>
            )}
            <ClaimLegend />
          </section>
        </aside>
      </div>

      <footer className={styles.footer}>
        {footer.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </footer>
    </section>
  )
}
