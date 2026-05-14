import { AlertTriangle } from 'lucide-react'

export function EducationalDisclaimer() {
  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/25 dark:text-amber-100">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold">Educational use only</p>
          <p className="leading-6">
            This module is for education and device-size comparison only. Actual airway reach and
            instrument compatibility depend on patient anatomy, airway caliber, device model,
            accessory compatibility, manufacturer instructions, procedural conditions, and operator
            judgment.
          </p>
        </div>
      </div>
    </div>
  )
}
