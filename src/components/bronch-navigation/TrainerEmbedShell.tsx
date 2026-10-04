'use client'

import { simulatorPage } from '@/components/layout/simulator-page'
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
    <div className={simulatorPage.frame}>
      <iframe
        title="Bronch Navigation Trainer"
        src={embedSrc}
        allow="gamepad"
        className={`${simulatorPage.iframe} bg-slate-950`}
      />
    </div>
  )
}
