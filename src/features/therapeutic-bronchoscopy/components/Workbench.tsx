'use client'
import { ScopeViewport } from './ScopeViewport'
import { INSTRUMENTS } from '../engine/instruments'
import {
  MORPHOLOGIES,
  PATHOLOGY_SITES,
  type MorphologyId,
  type PathologySiteId,
} from '@/lib/airway-anatomy/pathology/model'
import type { Simulator } from '../engine/useSimulator'
import styles from '../therapeutic.module.css'

export function Workbench({
  sim,
  guided = false,
  locked = false,
}: {
  sim: Simulator
  guided?: boolean
  locked?: boolean
}) {
  const s = sim.instrument,
    unavailable = !sim.ready || sim.busy || sim.normal || locked
  const doAction = sim.action
  const navigation = (
    <>
      <div className={styles.scopeControls} aria-label="Scope navigation">
        <button onClick={() => sim.move(1)} disabled={unavailable || s.extension > 0 || s.outside}>
          Advance scope
        </button>
        <button onClick={() => sim.move(-1)} disabled={unavailable || s.extension > 0 || s.outside}>
          Withdraw scope
        </button>
        <button aria-label="Steer left" disabled={unavailable} onClick={() => sim.move(0, -3)}>
          ←
        </button>
        <button aria-label="Steer up" disabled={unavailable} onClick={() => sim.move(0, 0, 3)}>
          ↑
        </button>
        <button aria-label="Steer down" disabled={unavailable} onClick={() => sim.move(0, 0, -3)}>
          ↓
        </button>
        <button aria-label="Steer right" disabled={unavailable} onClick={() => sim.move(0, 3)}>
          →
        </button>
        <button
          onClick={() => sim.approach()}
          disabled={unavailable || s.extension > 0 || s.outside}
        >
          Approach target
        </button>
        <button
          onClick={sim.toggleNormal}
          aria-pressed={sim.normal}
          disabled={!sim.ready || sim.busy || s.extension > 0 || s.outside}
        >
          {sim.normal ? 'Return to lesion' : 'Compare normal'}
        </button>
      </div>
      {sim.normal && (
        <p className={styles.note}>
          Normal reference at the same scope position. Return to the lesion to use instruments.
        </p>
      )}
      {sim.movement && <p className={styles.micro}>{sim.movement}</p>}
      <div className={styles.readouts} aria-label="Procedure observations">
        <div>
          <span>Residual modeled tissue</span>
          <strong data-testid="residual-tissue">
            {sim.settings.morphology === 'none' ? '—' : `${Math.round(sim.remaining * 100)}%`}
          </strong>
          <small>Mesh volume estimate; not lumen obstruction</small>
        </div>
        <div>
          <span>Retrieved specimens</span>
          <strong data-testid="specimen-count">{s.specimens.length}</strong>
          <small>{s.pending ? 'One specimen retained on instrument' : 'In-session record'}</small>
        </div>
        <div>
          <span>Visibility</span>
          <strong>
            {s.blood > 0.65 ? 'Obscured' : s.blood > 0.18 ? 'Blood in view' : 'Clear'}
          </strong>
          <small>{s.bleedingRate > 0 ? 'Bleeding source active' : 'No active source'}</small>
        </div>
      </div>
    </>
  )
  return (
    <div className={styles.workbench} data-guided={guided}>
      <div className={styles.scopeColumn}>
        <ScopeViewport sim={sim} />
        {!guided && navigation}
      </div>
      <div className={styles.controls}>
        {guided && navigation}
        {!guided && (
          <details className={styles.scenario} open>
            <summary>Scenario</summary>
            <label>
              Lesion
              <select
                aria-label="Lesion"
                value={sim.settings.morphology}
                disabled={sim.busy}
                onChange={(e) =>
                  sim.reset({ ...sim.settings, morphology: e.target.value as MorphologyId })
                }
              >
                {MORPHOLOGIES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select
                aria-label="Location"
                value={sim.settings.site}
                disabled={sim.busy}
                onChange={(e) =>
                  sim.reset({ ...sim.settings, site: e.target.value as PathologySiteId })
                }
              >
                {PATHOLOGY_SITES.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lesion size <output>{sim.settings.size.toFixed(2)}</output>
              <input
                type="range"
                min=".55"
                max="1.2"
                step=".05"
                value={sim.settings.size}
                disabled={sim.busy}
                onChange={(e) => sim.reset({ ...sim.settings, size: Number(e.target.value) })}
              />
            </label>
            <label>
              Wall position <output>{sim.settings.wallAngleDeg}°</output>
              <input
                type="range"
                min="0"
                max="330"
                step="30"
                value={sim.settings.wallAngleDeg}
                disabled={sim.busy}
                onChange={(e) =>
                  sim.reset({ ...sim.settings, wallAngleDeg: Number(e.target.value) })
                }
              />
            </label>
            <p className={styles.micro}>Scenario changes start a new procedure.</p>
          </details>
        )}
        <section aria-label="Instrument controls" className={styles.instrumentControls}>
          <h3>Instrument</h3>
          <div className={styles.toolTabs}>
            {INSTRUMENTS.map((tool) => (
              <button
                key={tool.id}
                aria-pressed={s.id === tool.id}
                disabled={unavailable || s.extension > 0 || s.outside || guided}
                onClick={() => doAction({ type: 'select', id: tool.id })}
              >
                {tool.name}
              </button>
            ))}
          </div>
          <p>{INSTRUMENTS.find((t) => t.id === s.id)!.description}</p>
          <label>
            Instrument extension <output>{s.extension.toFixed(1)} mm</output>
            <input
              aria-label="Instrument extension"
              type="range"
              min="0"
              max="36"
              step=".25"
              value={s.extension}
              disabled={unavailable || s.outside || !!s.pending || s.freezing || s.loopCaptured}
              onChange={(e) => doAction({ type: 'deploy', extension: Number(e.target.value) })}
            />
          </label>
          <div className={styles.actionRow}>
            <button
              disabled={unavailable || s.outside}
              onClick={() => doAction({ type: 'deploy', extension: s.extension + 1 })}
            >
              Advance tool 1 mm
            </button>
            <button
              disabled={unavailable || s.outside}
              onClick={() => doAction({ type: 'deploy', extension: Math.max(0, s.extension - 1) })}
            >
              Retract tool 1 mm
            </button>
          </div>
          {s.id !== 'cryoprobe' && (
            <>
              <label>
                Instrument rotation <output>{s.rotation}°</output>
                <input
                  aria-label="Instrument rotation"
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={s.rotation}
                  disabled={unavailable || s.outside}
                  onChange={(e) => doAction({ type: 'rotate', degrees: Number(e.target.value) })}
                />
              </label>
              <div className={styles.actionRow}>
                <button
                  onClick={() => doAction({ type: 'open' })}
                  disabled={unavailable || s.outside}
                >
                  {s.id === 'snare' ? 'Open loop' : 'Open jaws'}
                </button>
                <button
                  className={styles.primary}
                  onClick={() => doAction({ type: 'close' })}
                  disabled={unavailable || s.outside}
                >
                  {s.id === 'snare' ? 'Tighten loop' : 'Close jaws / biopsy'}
                </button>
              </div>
            </>
          )}
          {s.id === 'cryoprobe' && (
            <>
              <div className={styles.actionRow}>
                <button
                  className={styles.cryo}
                  onClick={() => doAction({ type: 'freeze' })}
                  disabled={unavailable || s.outside || s.freezing}
                >
                  Freeze at contact
                </button>
                <button
                  onClick={() => doAction({ type: 'thaw' })}
                  disabled={unavailable || s.outside || !!s.pending}
                >
                  Thaw / release
                </button>
              </div>
              <label>
                Visible adhesion{' '}
                <progress aria-label="Visible adhesion" max="1" value={s.adhesion} />
              </label>
              <button
                className={styles.primary}
                onClick={() => doAction({ type: 'extract' })}
                disabled={unavailable || s.outside}
              >
                Detach adhered tissue
              </button>
              <p className={styles.micro}>
                The ice animation is illustrative. It is not a clinical freeze-time prescription.
              </p>
            </>
          )}
          {s.id === 'snare' && (
            <div className={styles.energy}>
              <h4>Monopolar circuit</h4>
              <label>
                Inspired oxygen <output>{Math.round(s.oxygen * 100)}%</output>
                <input
                  aria-label="Inspired oxygen"
                  type="range"
                  min=".21"
                  max="1"
                  step=".01"
                  value={s.oxygen}
                  onChange={(e) => doAction({ type: 'oxygen', value: Number(e.target.value) })}
                  disabled={unavailable}
                />
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={s.returnElectrode}
                  disabled={unavailable}
                  onChange={(e) => doAction({ type: 'return-electrode', value: e.target.checked })}
                />
                Return electrode circuit confirmed
              </label>
              <button
                className={styles.cut}
                onClick={() => doAction({ type: 'energize' })}
                disabled={unavailable || s.outside}
              >
                Activate snare resection
              </button>
              <p className={styles.micro}>
                This prototype checks oxygen below 40%, the return circuit and stalk capture. These
                checks do not establish clinical fire safety.
              </p>
            </div>
          )}
          <div className={styles.retrieval}>
            <h4>Retrieval & visibility</h4>
            {!s.outside ? (
              <button onClick={() => doAction({ type: 'retrieve' })} disabled={unavailable}>
                {s.pending && s.id !== 'forceps'
                  ? 'Withdraw scope + tool en bloc'
                  : 'Retrieve instrument'}
              </button>
            ) : (
              <>
                {s.pending && (
                  <button
                    className={styles.primary}
                    onClick={() => doAction({ type: 'transfer' })}
                    disabled={unavailable}
                  >
                    Transfer specimen
                  </button>
                )}
                <button
                  onClick={() => doAction({ type: 'reenter' })}
                  disabled={unavailable || !!s.pending}
                >
                  Re-enter airway
                </button>
              </>
            )}
            <button
              className={s.suction ? styles.cryo : ''}
              aria-pressed={s.suction}
              onClick={() => doAction({ type: 'suction', value: !s.suction })}
              disabled={unavailable || s.outside}
            >
              {s.suction ? 'Release suction' : 'Apply suction'}
            </button>
          </div>
          <p className={styles.status} role={s.unsafe ? 'alert' : 'status'} data-unsafe={s.unsafe}>
            {s.status}
          </p>
        </section>
        {!guided && (
          <div className={styles.actionRow}>
            <button
              onClick={() => sim.action({ type: 'bleeding', amount: 0.4, rate: 0.016 })}
              disabled={unavailable}
            >
              Add airway bleeding
            </button>
            <button onClick={() => sim.reset()} disabled={sim.busy}>
              Reset procedure
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
