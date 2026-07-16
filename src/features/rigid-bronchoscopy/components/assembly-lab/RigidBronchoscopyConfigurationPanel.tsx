'use client'

import { AlertTriangle, Check, Route } from 'lucide-react'

import {
  RespiratoryPhaseIndicator,
  type DisplayRespiratoryPhase,
} from './RespiratoryPhaseIndicator'
import { RigidBronchoscopyCrossSection } from './RigidBronchoscopyCrossSection'
import {
  RigidBronchoscopyPortMap,
  type DisplayPortDefinition,
  type DisplayPortId,
} from './RigidBronchoscopyPortMap'

import { cn } from '@/lib/cn'

export interface InstrumentRouteChoice {
  compatible: boolean
  description: string
  id: string
  label: string
}

export interface RigidConfigurationChoice {
  description: string
  disabled?: boolean
  id: string
  label: string
  selected: boolean
}

export interface RigidConfigurationChoiceGroup {
  choices: readonly RigidConfigurationChoice[]
  id: string
  label: string
  onSelect: (choiceId: string) => void
}

export interface RigidConfigurationPanelCopy {
  activeInterface: string
  airwayLabel: string
  commonScaleLabel: string
  crossSectionEyebrow: string
  crossSectionSafetyNote: string
  distinctInterfacesLabel: string
  portLayoutVariationNote: string
  portMapEyebrow: string
  residualAreaLabel: string
  respiratoryCycle: string
  routeTypeLabel: string
}

export function RigidBronchoscopyConfigurationPanel({
  activePhase,
  activePort,
  airwayDiameterMm,
  configurationChoiceGroups = [],
  copy,
  instrumentDiameterMm,
  instrumentLabel,
  onSelectRoute,
  phaseLabels,
  portMapTitle,
  ports,
  routeChoices = [],
  selectedRouteId,
  showRespiratoryCycle = false,
  telescopeDiameterMm = 5.5,
  telescopeLabel,
  title,
  tubeInnerDiameterMm,
  tubeLabel,
  tubeOuterDiameterMm,
  visiblePhases = [],
}: {
  activePhase?: DisplayRespiratoryPhase
  activePort?: DisplayPortId
  airwayDiameterMm: number
  configurationChoiceGroups?: readonly RigidConfigurationChoiceGroup[]
  copy: RigidConfigurationPanelCopy
  instrumentDiameterMm?: number
  instrumentLabel?: string
  onSelectRoute?: (routeId: string) => void
  phaseLabels: Record<DisplayRespiratoryPhase, string>
  portMapTitle: string
  ports: readonly DisplayPortDefinition[]
  routeChoices?: readonly InstrumentRouteChoice[]
  selectedRouteId?: string
  showRespiratoryCycle?: boolean
  telescopeDiameterMm?: number
  telescopeLabel: string
  title: string
  tubeInnerDiameterMm: number
  tubeLabel: string
  tubeOuterDiameterMm: number
  visiblePhases?: readonly DisplayRespiratoryPhase[]
}) {
  return (
    <div className="space-y-4">
      <RigidBronchoscopyPortMap
        activeLabel={copy.activeInterface}
        activePort={activePort}
        distinctInterfacesLabel={copy.distinctInterfacesLabel}
        eyebrow={copy.portMapEyebrow}
        ports={ports}
        title={portMapTitle}
      />
      <p className="rounded-xl border border-cyan-300/20 bg-cyan-400/8 px-3 py-2 text-[11px] leading-4 text-cyan-50">
        {copy.portLayoutVariationNote}
      </p>

      {configurationChoiceGroups.length ? (
        <div className="grid gap-3">
          {configurationChoiceGroups.map((group) => (
            <fieldset
              key={group.id}
              className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4"
            >
              <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                {group.label}
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {group.choices.map((choice) => (
                  <button
                    type="button"
                    key={choice.id}
                    aria-pressed={choice.selected}
                    disabled={choice.disabled}
                    onClick={() => group.onSelect(choice.id)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-55',
                      choice.selected
                        ? 'border-cyan-300/60 bg-cyan-400/12 text-white'
                        : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500',
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      {choice.selected ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                      ) : (
                        <Route className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
                      )}
                      {choice.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                      {choice.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}

      {routeChoices.length ? (
        <fieldset className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {copy.routeTypeLabel}
          </legend>
          <div className="mt-2 grid gap-2">
            {routeChoices.map((routeChoice) => {
              const selected = routeChoice.id === selectedRouteId
              return (
                <button
                  type="button"
                  key={routeChoice.id}
                  aria-pressed={selected}
                  disabled={!routeChoice.compatible}
                  onClick={() => onSelectRoute?.(routeChoice.id)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-55',
                    selected
                      ? 'border-pink-300/55 bg-pink-400/10 text-white'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500',
                  )}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    {routeChoice.compatible ? (
                      selected ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                      ) : (
                        <Route className="h-3.5 w-3.5 text-pink-200" aria-hidden />
                      )
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                    )}
                    {routeChoice.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                    {routeChoice.description}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {showRespiratoryCycle && visiblePhases.length ? (
        <RespiratoryPhaseIndicator
          activePhase={activePhase}
          labels={phaseLabels}
          title={copy.respiratoryCycle}
          visiblePhases={visiblePhases}
        />
      ) : null}

      <RigidBronchoscopyCrossSection
        airwayDiameterMm={airwayDiameterMm}
        airwayLabel={copy.airwayLabel}
        commonScaleLabel={copy.commonScaleLabel}
        eyebrow={copy.crossSectionEyebrow}
        instrumentDiameterMm={instrumentDiameterMm}
        instrumentLabel={instrumentLabel}
        residualAreaLabel={copy.residualAreaLabel}
        safetyNote={copy.crossSectionSafetyNote}
        telescopeDiameterMm={telescopeDiameterMm}
        telescopeLabel={telescopeLabel}
        title={title}
        tubeInnerDiameterMm={tubeInnerDiameterMm}
        tubeLabel={tubeLabel}
        tubeOuterDiameterMm={tubeOuterDiameterMm}
      />
    </div>
  )
}
