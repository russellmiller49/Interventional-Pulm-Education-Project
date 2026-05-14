'use client'

import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { airwayGenerations, bronchoscopes, instruments } from '@/data/bronchoscope-size-explorer'
import {
  classifyFitResult,
  estimateReachGeneration,
  getEstimatedReachLabel,
  getMaxReachableGeneration,
} from '@/lib/bronchoscope-size-explorer/calculations'
import type { BronchoscopyInstrument } from '@/lib/bronchoscope-size-explorer/types'

import { AirwayReachMap } from './AirwayReachMap'
import { CompatibilityResult } from './CompatibilityResult'
import { EducationalDisclaimer } from './EducationalDisclaimer'
import { InstrumentFitPanel } from './InstrumentFitPanel'
import { ScopeComparisonTable } from './ScopeComparisonTable'
import { ScopeCrossSection } from './ScopeCrossSection'
import { ScopeSelector } from './ScopeSelector'
import { SourceNotes } from './SourceNotes'

export function BronchoscopeSizeExplorer() {
  const [selectedScopeId, setSelectedScopeId] = useState(bronchoscopes[0]?.id ?? '')
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(instruments[0]?.id ?? '')
  const [customOuterDiameterMm, setCustomOuterDiameterMm] = useState('1.5')
  const [customMinimumWorkingChannelMm, setCustomMinimumWorkingChannelMm] = useState('')

  const selectedScope =
    bronchoscopes.find((scope) => scope.id === selectedScopeId) ?? bronchoscopes[0]
  const baseInstrument =
    instruments.find((instrument) => instrument.id === selectedInstrumentId) ?? instruments[0]

  const selectedInstrument = useMemo<BronchoscopyInstrument>(() => {
    if (baseInstrument.id !== 'custom-instrument') {
      return baseInstrument
    }

    return {
      ...baseInstrument,
      outerDiameterMm: parseOptionalPositiveNumber(customOuterDiameterMm),
      minimumWorkingChannelMm: parseOptionalPositiveNumber(customMinimumWorkingChannelMm),
    }
  }, [baseInstrument, customMinimumWorkingChannelMm, customOuterDiameterMm])

  const reachResults = useMemo(
    () => estimateReachGeneration(selectedScope.outerDiameterMm, airwayGenerations),
    [selectedScope.outerDiameterMm],
  )
  const maxReachableGeneration = getMaxReachableGeneration(reachResults)
  const reachLabel = getEstimatedReachLabel(maxReachableGeneration)
  const airwayDiameterForVisual =
    reachResults.find((result) => result.generation === maxReachableGeneration)
      ?.approximateDiameterMm ??
    Math.max(selectedScope.outerDiameterMm + 0.3, selectedScope.outerDiameterMm)
  const fitResult = useMemo(
    () => classifyFitResult(selectedScope, selectedInstrument),
    [selectedInstrument, selectedScope],
  )

  return (
    <div className="space-y-10">
      <section className="container space-y-6">
        <div className="space-y-3">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Intro bronchoscopy module
          </Badge>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Bronchoscope Size, Reach & Tool Fit Explorer
            </h2>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              Compare scope diameter, working channel size, estimated airway reach, and instrument
              compatibility across representative bronchoscope and robotic bronchoscopy presets.
            </p>
          </div>
        </div>
        <EducationalDisclaimer />
      </section>

      <section className="container grid gap-6 xl:grid-cols-[0.85fr_1.05fr_0.9fr]">
        <div className="space-y-6">
          <ScopeSelector
            scopes={bronchoscopes}
            selectedScopeId={selectedScope.id}
            onSelectScope={setSelectedScopeId}
          />
        </div>

        <div className="space-y-6">
          <ScopeCrossSection
            scope={selectedScope}
            instrument={selectedInstrument}
            fitResult={fitResult}
            airwayDiameterMm={airwayDiameterForVisual}
          />
          <CompatibilityResult
            scope={selectedScope}
            instrument={selectedInstrument}
            result={fitResult}
          />
        </div>

        <div className="space-y-6">
          <InstrumentFitPanel
            instruments={instruments}
            selectedInstrumentId={selectedInstrument.id}
            onSelectInstrument={setSelectedInstrumentId}
            customOuterDiameterMm={customOuterDiameterMm}
            customMinimumWorkingChannelMm={customMinimumWorkingChannelMm}
            onCustomOuterDiameterChange={setCustomOuterDiameterMm}
            onCustomMinimumWorkingChannelChange={setCustomMinimumWorkingChannelMm}
          />
          <AirwayReachMap
            scope={selectedScope}
            reachResults={reachResults}
            reachLabel={reachLabel}
          />
        </div>
      </section>

      <section className="container space-y-8">
        <ScopeComparisonTable scopes={bronchoscopes} airwayModel={airwayGenerations} />
        <SourceNotes scopes={bronchoscopes} instruments={instruments} />
      </section>
    </div>
  )
}

function parseOptionalPositiveNumber(value: string): number | undefined {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}
