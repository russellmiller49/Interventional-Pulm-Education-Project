'use client'

import { RotateCcw } from 'lucide-react'
import { useId, useMemo } from 'react'

import {
  getStentExplorerControlValueLabel,
  normalizeStentExplorerControlState,
  resetStentExplorerControlState,
  setStentExplorerControlValue,
} from '../../explorer/controlState'
import type {
  StentExplorerArchitectureId,
  StentExplorerControl,
  StentExplorerControlState,
  StentExplorerStation,
} from '../../explorer/types'

interface StentStationControlsProps {
  architectureId: StentExplorerArchitectureId
  station: StentExplorerStation
  value: StentExplorerControlState
  onChange: (nextValue: StentExplorerControlState) => void
  onReset?: () => void
  disabled?: boolean
  className?: string
}

const CONTROL_BOUNDARY =
  'Qualitative visualization only. These controls do not calculate patient-specific force, airflow, sizing, complication risk, or outcome.'

export function StentStationControls({
  architectureId,
  station,
  value,
  onChange,
  onReset,
  disabled = false,
  className = '',
}: StentStationControlsProps) {
  const instanceId = useId().replace(/:/g, '')
  const normalizedValue = useMemo(
    () => normalizeStentExplorerControlState(station, value, architectureId),
    [architectureId, station, value],
  )
  const defaultValue = useMemo(
    () => resetStentExplorerControlState(station, architectureId),
    [architectureId, station],
  )
  const visibleControls = useMemo(
    () =>
      station.controls.filter(
        (control) => !control.architectureIds || control.architectureIds.includes(architectureId),
      ),
    [architectureId, station.controls],
  )
  const isAtDefaults = station.controls.every(
    (control) => normalizedValue[control.id] === defaultValue[control.id],
  )

  const updateControl = (controlId: string, nextValue: unknown) => {
    onChange(
      setStentExplorerControlValue(station, normalizedValue, controlId, nextValue, architectureId),
    )
  }

  const resetControls = () => {
    onChange(resetStentExplorerControlState(station, architectureId))
    onReset?.()
  }

  return (
    <section
      aria-labelledby={`${instanceId}-heading`}
      className={`rounded-[1.35rem] border border-white/10 bg-slate-950/65 p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Explore the mechanics
          </p>
          <h3 id={`${instanceId}-heading`} className="mt-1 text-base font-semibold text-white">
            Mechanics controls
          </h3>
        </div>
        <button
          type="button"
          onClick={resetControls}
          disabled={disabled || isAtDefaults}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-300/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          Reset controls
        </button>
      </div>

      <p id={`${instanceId}-boundary`} className="mt-2 text-xs leading-5 text-slate-400">
        {CONTROL_BOUNDARY}
      </p>

      <fieldset
        disabled={disabled}
        aria-describedby={`${instanceId}-boundary`}
        className="mt-4 grid gap-3"
      >
        <legend className="sr-only">Qualitative controls for {station.title}</legend>
        {visibleControls.map((control) => (
          <ControlField
            key={control.id}
            architectureId={architectureId}
            control={control}
            instanceId={instanceId}
            value={normalizedValue[control.id]}
            onChange={(nextValue) => updateControl(control.id, nextValue)}
          />
        ))}
      </fieldset>
    </section>
  )
}

interface ControlFieldProps {
  architectureId: StentExplorerArchitectureId
  control: StentExplorerControl
  instanceId: string
  value: StentExplorerControlState[string]
  onChange: (value: unknown) => void
}

function ControlField({ architectureId, control, instanceId, value, onChange }: ControlFieldProps) {
  const inputId = `${instanceId}-${control.id}`
  const descriptionId = `${inputId}-description`
  const valueId = `${inputId}-value`
  const valueLabel = getStentExplorerControlValueLabel(control, value)

  if (control.kind === 'range') {
    const numericValue = typeof value === 'number' ? value : control.defaultValue

    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <div className="flex items-start justify-between gap-4">
          <label htmlFor={inputId} className="text-sm font-semibold text-slate-100">
            {control.label}
          </label>
          <output
            id={valueId}
            htmlFor={inputId}
            className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-right text-[0.68rem] font-semibold text-cyan-100"
          >
            {valueLabel}
          </output>
        </div>
        <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-400">
          {control.description}
        </p>
        <input
          id={inputId}
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={numericValue}
          aria-describedby={`${descriptionId} ${valueId}`}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          className="mt-3 h-2 w-full cursor-pointer accent-cyan-400"
        />
        <div
          aria-hidden="true"
          className="mt-1 flex justify-between gap-4 text-[0.65rem] text-slate-500"
        >
          <span>{control.minLabel}</span>
          <span className="text-right">{control.maxLabel}</span>
        </div>
      </div>
    )
  }

  if (control.kind === 'toggle') {
    const isChecked = typeof value === 'boolean' ? value : control.defaultValue

    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            id={inputId}
            type="checkbox"
            checked={isChecked}
            aria-describedby={descriptionId}
            onChange={(event) => onChange(event.currentTarget.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">
              {control.label}
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[0.68rem] text-cyan-100">
                {valueLabel}
              </span>
            </span>
            <span id={descriptionId} className="mt-1 block text-xs leading-5 text-slate-400">
              {control.description}
            </span>
          </span>
        </label>
      </div>
    )
  }

  const availableOptions = control.options.filter(
    (option) => !option.architectureIds || option.architectureIds.includes(architectureId),
  )
  const selectedOption =
    availableOptions.find((option) => option.id === value) ?? availableOptions[0]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <label htmlFor={inputId} className="text-sm font-semibold text-slate-100">
        {control.label}
      </label>
      <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-400">
        {control.description}
      </p>
      <select
        id={inputId}
        value={selectedOption?.id ?? control.defaultValue}
        aria-describedby={`${descriptionId} ${valueId}`}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-3 min-h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
      >
        {availableOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <p id={valueId} className="mt-2 text-xs leading-5 text-cyan-100">
        {selectedOption?.description ?? control.options[0].description}
      </p>
    </div>
  )
}
