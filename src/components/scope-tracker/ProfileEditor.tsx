'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  createScopeTrackerProfile,
  loadScopeTrackerProfiles,
  normalizeScopeTrackerProfile,
  saveScopeTrackerProfiles,
  useScopeInput,
  useScopeInputStore,
} from '@/lib/scope-input'
import type { ScopeTrackerProfile, ScopeTrackerProfilesState } from '@/lib/scope-input'

import { SectionCard } from './SectionCard'

const numberInputClass =
  'w-24 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums text-foreground'

interface FieldRowProps {
  label: string
  hint?: string
  children: React.ReactNode
}

function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-40">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

function NumberField({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <input
      type="number"
      className={numberInputClass}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        const parsed = Number.parseFloat(event.target.value)
        if (Number.isFinite(parsed)) onChange(parsed)
      }}
    />
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-[hsl(var(--primary))]"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

export function ProfileEditor() {
  const store = useScopeInputStore()
  const { frame, deviceId } = useScopeInput()
  const [state, setState] = useState<ScopeTrackerProfilesState>(() => ({
    profiles: [normalizeScopeTrackerProfile()],
    activeId: 'default',
  }))
  const [draft, setDraft] = useState<ScopeTrackerProfile>(() => normalizeScopeTrackerProfile())
  const [dirty, setDirty] = useState(false)
  const hydrated = useRef(false)

  useEffect(() => {
    const loaded = loadScopeTrackerProfiles()
    setState(loaded)
    const active = loaded.profiles.find((profile) => profile.id === loaded.activeId)
    if (active) setDraft(active)
    hydrated.current = true
  }, [])

  // Live-apply the draft so edits are felt immediately (persisted only on Save).
  useEffect(() => {
    if (hydrated.current) store.setProfile(draft)
  }, [draft, store])

  const updateDraft = useCallback(
    (updater: (draft: ScopeTrackerProfile) => ScopeTrackerProfile) => {
      setDraft((current) => normalizeScopeTrackerProfile(updater(current)))
      setDirty(true)
    },
    [],
  )

  const selectProfile = (profileId: string) => {
    const nextState = { ...state, activeId: profileId }
    setState(nextState)
    saveScopeTrackerProfiles(nextState)
    const active = nextState.profiles.find((profile) => profile.id === profileId)
    if (active) {
      setDraft(active)
      setDirty(false)
    }
  }

  const saveDraft = () => {
    const profiles = state.profiles.map((profile) => (profile.id === draft.id ? draft : profile))
    const nextState = { profiles, activeId: draft.id }
    setState(nextState)
    saveScopeTrackerProfiles(nextState)
    setDirty(false)
  }

  const revertDraft = () => {
    const active = state.profiles.find((profile) => profile.id === state.activeId)
    if (active) setDraft(active)
    setDirty(false)
  }

  const createProfile = () => {
    const profile = createScopeTrackerProfile(`Profile ${state.profiles.length + 1}`)
    const nextState = { profiles: [...state.profiles, profile], activeId: profile.id }
    setState(nextState)
    saveScopeTrackerProfiles(nextState)
    setDraft(profile)
    setDirty(false)
  }

  const deleteProfile = () => {
    if (state.profiles.length <= 1) return
    const profiles = state.profiles.filter((profile) => profile.id !== draft.id)
    const nextState = { profiles, activeId: profiles[0].id }
    setState(nextState)
    saveScopeTrackerProfiles(nextState)
    setDraft(profiles[0])
    setDirty(false)
  }

  const captureNeutral = () => {
    const rawFlexion = frame?.raw.axes[0]
    if (typeof rawFlexion === 'number') {
      updateDraft((current) => ({
        ...current,
        flexion: { ...current.flexion, trim: rawFlexion },
      }))
    }
  }

  return (
    <SectionCard
      title="Calibration profile"
      description="Per-user shaping stored in this browser and shared live with both simulators. Device-level calibration (optical matrix, lever endpoints) lives in the tracker firmware."
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          value={state.activeId}
          onChange={(event) => selectProfile(event.target.value)}
        >
          {state.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="w-40 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          value={draft.name}
          onChange={(event) =>
            updateDraft((current) => ({ ...current, name: event.target.value || current.name }))
          }
          aria-label="Profile name"
        />
        <Button size="sm" variant="outline" onClick={createProfile}>
          New
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={deleteProfile}
          disabled={state.profiles.length <= 1}
        >
          Delete
        </Button>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <FieldRow
          label="Pinned device"
          hint={
            draft.device.gamepadId
              ? draft.device.gamepadId
              : 'Auto-detect by product string / vendor id'
          }
        >
          <Button
            size="sm"
            variant="outline"
            disabled={!deviceId}
            onClick={() =>
              updateDraft((current) => ({ ...current, device: { gamepadId: deviceId } }))
            }
          >
            Pin connected device
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!draft.device.gamepadId}
            onClick={() => updateDraft((current) => ({ ...current, device: { gamepadId: null } }))}
          >
            Clear
          </Button>
        </FieldRow>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Flexion (lever)
        </h3>
        <FieldRow
          label="Capture neutral"
          hint="Let go of the lever, then capture to zero the trim."
        >
          <Button size="sm" variant="outline" disabled={!frame} onClick={captureNeutral}>
            Capture
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            trim {draft.flexion.trim.toFixed(3)}
          </span>
        </FieldRow>
        <FieldRow label="Invert" hint="Flex the tip up — if the bar moves down, invert.">
          <Toggle
            checked={draft.flexion.invert}
            onChange={(invert) =>
              updateDraft((current) => ({ ...current, flexion: { ...current.flexion, invert } }))
            }
          />
        </FieldRow>
        <FieldRow label="Deadzone" hint="Normalized units treated as neutral.">
          <NumberField
            value={draft.flexion.deadzone}
            min={0}
            max={0.4}
            step={0.01}
            onChange={(deadzone) =>
              updateDraft((current) => ({ ...current, flexion: { ...current.flexion, deadzone } }))
            }
          />
        </FieldRow>
        <FieldRow label="Expo" hint="0 = linear, 1 = finest control near neutral.">
          <NumberField
            value={draft.flexion.expo}
            min={0}
            max={1}
            step={0.05}
            onChange={(expo) =>
              updateDraft((current) => ({ ...current, flexion: { ...current.flexion, expo } }))
            }
          />
        </FieldRow>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Depth & roll
        </h3>
        <FieldRow label="Depth gain" hint="Physical mm → simulated mm multiplier.">
          <NumberField
            value={draft.depth.gain}
            min={0.1}
            max={10}
            step={0.05}
            onChange={(gain) =>
              updateDraft((current) => ({ ...current, depth: { ...current.depth, gain } }))
            }
          />
        </FieldRow>
        <FieldRow label="Depth invert" hint="If inserting the scope retracts the sim.">
          <Toggle
            checked={draft.depth.invert}
            onChange={(invert) =>
              updateDraft((current) => ({ ...current, depth: { ...current.depth, invert } }))
            }
          />
        </FieldRow>
        <FieldRow label="Depth noise gate" hint="mm of jitter to ignore at rest.">
          <NumberField
            value={draft.depth.noiseGateMm}
            min={0}
            max={5}
            step={0.05}
            onChange={(noiseGateMm) =>
              updateDraft((current) => ({ ...current, depth: { ...current.depth, noiseGateMm } }))
            }
          />
        </FieldRow>
        <FieldRow label="Roll gain">
          <NumberField
            value={draft.roll.gain}
            min={0.1}
            max={10}
            step={0.05}
            onChange={(gain) =>
              updateDraft((current) => ({ ...current, roll: { ...current.roll, gain } }))
            }
          />
        </FieldRow>
        <FieldRow label="Roll invert" hint="If rolling clockwise turns the sim the wrong way.">
          <Toggle
            checked={draft.roll.invert}
            onChange={(invert) =>
              updateDraft((current) => ({ ...current, roll: { ...current.roll, invert } }))
            }
          />
        </FieldRow>
        <FieldRow label="Swap A/B buttons">
          <Toggle
            checked={draft.buttons.swapAB}
            onChange={(swapAB) => updateDraft((current) => ({ ...current, buttons: { swapAB } }))}
          />
        </FieldRow>
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 pt-4">
        <Button size="sm" onClick={saveDraft} disabled={!dirty}>
          Save profile
        </Button>
        <Button size="sm" variant="ghost" onClick={revertDraft} disabled={!dirty}>
          Revert
        </Button>
        {dirty ? (
          <span className="text-xs text-amber-700 dark:text-amber-300">Unsaved changes</span>
        ) : (
          <span className="text-xs text-muted-foreground">Saved</span>
        )}
      </div>
    </SectionCard>
  )
}
