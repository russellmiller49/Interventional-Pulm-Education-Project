'use client'

import { bronchNavigationTrainerAppPath, buildEmbeddedAppSrc } from '@/lib/embedded-app-locale'

interface TrainerEmbedShellProps {
  locale: string
}

export function getTrainerEmbedSrc(locale: string) {
  return buildEmbeddedAppSrc(bronchNavigationTrainerAppPath, locale)
}

export function TrainerEmbedShell({ locale }: TrainerEmbedShellProps) {
  const embedSrc = getTrainerEmbedSrc(locale)

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm">
      <iframe
        title="Bronch Navigation Trainer"
        src={embedSrc}
        allow="gamepad"
        className="h-[calc(100vh-10rem)] min-h-[860px] w-full bg-slate-950"
      />
    </div>
  )
}
