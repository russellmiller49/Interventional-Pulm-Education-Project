import { AlertTriangle } from 'lucide-react'

import { pleuralEducationDisclaimer } from '../content/disclaimer'

export function EducationalDisclaimer() {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>{pleuralEducationDisclaimer}</p>
    </div>
  )
}
