'use client'

const embeddedTrainerAppPath = '/bronch-navigation-trainer/app/index.html'

export function TrainerEmbedShell() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm">
      <iframe
        title="Bronch Navigation Trainer"
        src={embeddedTrainerAppPath}
        className="h-[calc(100vh-10rem)] min-h-[860px] w-full bg-slate-950"
      />
    </div>
  )
}
