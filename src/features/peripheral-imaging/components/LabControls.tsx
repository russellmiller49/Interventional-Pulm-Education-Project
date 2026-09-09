'use client'
import { useId, type ReactNode } from 'react'
import styles from '../imaging.module.css'

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  id: givenId,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  /** The suite contract's element id for this control, so a step can point at it. */
  id?: string
}) {
  const generatedId = useId()
  const id = givenId ?? generatedId
  return (
    <div className={styles.control}>
      <div className={styles.controlHeader}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} aria-hidden="true">
          {value}
          {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={String(value) + unit}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className={styles.rangeEnds} aria-hidden="true">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  )
}
export function Toggle({
  label,
  checked,
  onChange,
  id,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  /** The suite contract's element id for this control, so a step can point at it. */
  id?: string
}) {
  return (
    <label className={styles.toggle}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
export function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.readout}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}
export function LabNote({ children }: { children: ReactNode }) {
  return (
    <p className={styles.labNote}>
      <strong>Model boundary.</strong> {children}
    </p>
  )
}
