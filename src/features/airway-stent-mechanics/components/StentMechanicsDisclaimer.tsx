import { AlertTriangle } from 'lucide-react'

export function StentMechanicsDisclaimer() {
  return (
    <div className="flex gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>
        This module is for professional education and comparative device-mechanics learning. Its 3D
        deformation, tissue overlays, and cross-sections are qualitative models—not finite-element
        analysis, patient-specific predictions, sizing rules, complication probabilities, procedural
        credentialing, or device recommendations. Actual selection, deployment, surveillance,
        exchange, and removal depend on patient goals, anatomy, pathology, disease trajectory, the
        exact device and instructions for use, local resources, and operator judgment.
      </p>
    </div>
  )
}
