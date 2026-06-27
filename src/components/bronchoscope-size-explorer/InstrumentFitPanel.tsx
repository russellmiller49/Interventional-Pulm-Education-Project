import { cn } from '@/lib/cn'
import type { BronchoscopyInstrument } from '@/lib/bronchoscope-size-explorer/types'
import { HandoffContent } from '@/i18n/handoff'

interface InstrumentFitPanelProps {
  instruments: BronchoscopyInstrument[]
  selectedInstrumentId: string
  onSelectInstrument: (instrumentId: string) => void
  customOuterDiameterMm: string
  customMinimumWorkingChannelMm: string
  onCustomOuterDiameterChange: (value: string) => void
  onCustomMinimumWorkingChannelChange: (value: string) => void
}

export function InstrumentFitPanel({
  instruments,
  selectedInstrumentId,
  onSelectInstrument,
  customOuterDiameterMm,
  customMinimumWorkingChannelMm,
  onCustomOuterDiameterChange,
  onCustomMinimumWorkingChannelChange,
}: InstrumentFitPanelProps) {
  const isCustomSelected = selectedInstrumentId === 'custom-instrument'

  return (
    <HandoffContent>
      {
        <section aria-labelledby="instrument-selector-heading" className="space-y-3">
          <div className="space-y-1">
            <h3 id="instrument-selector-heading" className="text-base font-semibold">
              Instrument or accessory
            </h3>
            <p className="text-sm text-muted-foreground">
              Compatibility uses minimum channel requirements when provided, otherwise instrument
              diameter plus clearance.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Instrument presets">
            {instruments.map((instrument) => {
              const isSelected = instrument.id === selectedInstrumentId

              return (
                <button
                  key={instrument.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectInstrument(instrument.id)}
                  className={cn(
                    'rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isSelected
                      ? 'border-secondary/70 bg-secondary/10 shadow-sm'
                      : 'border-border/70 bg-card/70 hover:border-secondary/50 hover:bg-muted/40',
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {instrument.displayName}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {getInstrumentSizingLabel(instrument)}
                  </span>
                </button>
              )
            })}
          </div>
          {isCustomSelected ? (
            <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-1">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Custom outer diameter (mm)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={customOuterDiameterMm}
                  onChange={(event) => onCustomOuterDiameterChange(event.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Custom instrument outer diameter in millimeters"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Required working channel (mm)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={customMinimumWorkingChannelMm}
                  onChange={(event) => onCustomMinimumWorkingChannelChange(event.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Custom minimum working channel in millimeters"
                />
              </label>
            </div>
          ) : null}
        </section>
      }
    </HandoffContent>
  )
}

function getInstrumentSizingLabel(instrument: BronchoscopyInstrument): string {
  const labels: string[] = []

  if (instrument.minimumWorkingChannelMm !== undefined) {
    labels.push(`Minimum channel ${instrument.minimumWorkingChannelMm.toFixed(1)} mm`)
  }

  if (instrument.outerDiameterMm !== undefined) {
    labels.push(`OD ${instrument.outerDiameterMm.toFixed(1)} mm`)
  }

  return labels.length ? labels.join(' · ') : 'Learner-entered sizing'
}
