'use client'

import {
  MORPHOLOGIES,
  PATHOLOGY_SITES,
  morphologyFor,
  type PathologySettings,
  type BleedingLevel,
} from '@/lib/airway-anatomy/pathology/model'

interface Props {
  settings: PathologySettings
  onChange: (next: PathologySettings) => void
  comparing: boolean
  onCompare: () => void
  paused: boolean
  onPause: () => void
  onRestart: () => void
  onApproach: () => void
  ready: boolean
  error: string
  onRetry: () => void
  projectionMm: number
  obscured: boolean
}
const fieldClass =
  'mt-1 block w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300'
const buttonClass =
  'rounded-md border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-40'

export function PathologyPanel({
  settings,
  onChange,
  comparing,
  onCompare,
  paused,
  onPause,
  onRestart,
  onApproach,
  ready,
  error,
  onRetry,
  projectionMm,
  obscured,
}: Props) {
  const abnormal = settings.morphology !== 'none' || settings.bleeding !== 'off'
  return (
    <section
      aria-labelledby="abnormalities-heading"
      className="rounded-lg border border-rose-300/25 bg-slate-900/70 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="abnormalities-heading" className="text-base font-semibold text-white">
          Airway abnormalities
        </h3>
        <span className="rounded-full bg-rose-300/10 px-2 py-1 text-[11px] font-semibold text-rose-200">
          Phase 1 · visual simulation
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        Select a finding, then inspect its wall attachment and the remaining lumen in Virtual
        bronchoscopy.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-300">
          Finding
          <select
            aria-label="Finding"
            className={fieldClass}
            value={settings.morphology}
            onChange={(e) =>
              onChange({
                ...settings,
                morphology: e.target.value as PathologySettings['morphology'],
              })
            }
          >
            {MORPHOLOGIES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">
          Location
          <select
            aria-label="Location"
            className={fieldClass}
            value={settings.site}
            onChange={(e) =>
              onChange({ ...settings, site: e.target.value as PathologySettings['site'] })
            }
          >
            {PATHOLOGY_SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-300">
        {morphologyFor(settings.morphology).description}
      </p>
      {settings.morphology !== 'none' && (
        <label className="mt-3 block text-xs text-slate-300">
          <span className="flex justify-between gap-2">
            <span>Lesion size</span>
            <span>{settings.size < 0.8 ? 'Small' : settings.size > 1.05 ? 'Large' : 'Medium'}</span>
          </span>
          <input
            aria-label="Lesion size"
            type="range"
            min="0.55"
            max="1.2"
            step="0.05"
            value={settings.size}
            onChange={(e) => onChange({ ...settings, size: Number(e.target.value) })}
            className="mt-2 w-full accent-rose-300"
          />
          {ready && (
            <span className="text-slate-400">
              Projection from wall: {projectionMm.toFixed(1)} mm · authored dimension
            </span>
          )}
        </label>
      )}
      <label className="mt-3 block text-xs text-slate-300">
        <span className="flex justify-between">
          <span>Position around airway wall</span>
          <span>{settings.wallAngleDeg}°</span>
        </span>
        <input
          aria-label="Position around airway wall"
          type="range"
          min="0"
          max="330"
          step="30"
          value={settings.wallAngleDeg}
          onChange={(e) => onChange({ ...settings, wallAngleDeg: Number(e.target.value) })}
          className="mt-2 w-full accent-rose-300"
        />
      </label>
      <fieldset className="mt-3">
        <legend className="mb-2 text-xs font-semibold text-slate-300">Bleeding appearance</legend>
        <div className="flex gap-2">
          {(['off', 'oozing', 'brisk'] as BleedingLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={settings.bleeding === level}
              onClick={() => onChange({ ...settings, bleeding: level })}
              className={`${buttonClass} flex-1 ${settings.bleeding === level ? 'border-rose-300 bg-rose-300/15 text-rose-100' : ''}`}
            >
              {level === 'off' ? 'Off' : level === 'oozing' ? 'Oozing' : 'Brisk'}
            </button>
          ))}
        </div>
      </fieldset>
      {settings.bleeding !== 'off' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={onPause}
            disabled={comparing || !ready}
            aria-pressed={paused}
          >
            {paused ? 'Resume bleeding animation' : 'Pause bleeding animation'}
          </button>
          <button type="button" className={buttonClass} onClick={onRestart}>
            Restart bleeding animation
          </button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          onClick={onApproach}
          disabled={!ready && !comparing}
        >
          Approach selected site
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={onCompare}
          disabled={!abnormal || (!ready && !comparing)}
          aria-pressed={comparing}
        >
          {comparing ? 'Restore abnormalities' : 'Compare with normal'}
        </button>
      </div>
      <div role="status" className="mt-3 text-xs leading-relaxed text-cyan-100">
        {error ? (
          <span className="text-amber-200">
            {error}{' '}
            <button type="button" onClick={onRetry} className="underline">
              Retry model
            </button>
          </span>
        ) : comparing ? (
          'Normal comparison · insertion depth held. Rotate the view, then restore abnormalities.'
        ) : !ready ? (
          'Preparing airway abnormalities…'
        ) : obscured ? (
          'Blood is obscuring the view. Withdraw to inspect the proximal airway.'
        ) : paused && settings.bleeding !== 'off' ? (
          'Bleeding animation paused. Existing blood remains visible.'
        ) : (
          'W/S: insert or withdraw · arrows: steer · Q/E: rotate'
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Changing the finding, size, location, or wall position returns the scope to an approach
        view. These are synthetic appearances; histology and clinical bleeding severity are not
        determined here.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Educational simulation only. No biopsy, hemostasis, blood-loss estimate, or physiologic
        response is modeled. The CT shows the original anatomy without these added findings.
        Settings reset on reload.
      </p>
    </section>
  )
}
