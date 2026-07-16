import { AlertTriangle } from 'lucide-react'

export function TracheostomyDisclaimer() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>
        This module is for adult professional education and simulation. It does not replace local
        emergency algorithms, institutional credentialing, device instructions for use, or bedside
        judgment. Pediatric airways, laryngectomy, emergency cricothyrotomy, and a fresh versus
        mature tracheostomy require distinct pathways. If caring for a patient, follow the local
        tracheostomy emergency protocol and summon expert airway help early.
      </p>
    </div>
  )
}
