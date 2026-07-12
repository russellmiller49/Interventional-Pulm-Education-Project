import { CheckCircle2 } from 'lucide-react'

export function ClinicalDebrief({ takeaway }: { takeaway: string }) {
  return (
    <aside
      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5"
      aria-label="Clinical debrief"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
        Defensible plan
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{takeaway}</p>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Revisit the indication when anatomy, disease, symptoms, or the expected treatment horizon
        changes. Surveillance and removal planning are part of the initial prescription.
      </p>
    </aside>
  )
}
