import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { PleuralUltrasoundNav } from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { publicPleuralUltrasoundAssets } from '@/features/pleural-ultrasound/content/assets'
import { pleuralUltrasoundLessons } from '@/features/pleural-ultrasound/content/lessons'
import { publicPleuralUltrasoundVideoAssets } from '@/features/pleural-ultrasound/content/videoAssets'

export const metadata: Metadata = {
  title: 'Pleural Ultrasound References',
  description:
    'Guideline sources and Creative Commons image/video attributions for the pleural ultrasound module.',
}

function referencedIds(): string[] {
  const ids = new Set<string>()
  for (const lesson of pleuralUltrasoundLessons) {
    for (const statement of lesson.statements) {
      statement.referenceIds.forEach((id) => ids.add(id))
    }
  }
  for (const asset of publicPleuralUltrasoundAssets) {
    asset.referenceIds?.forEach((id) => ids.add(id))
  }
  for (const asset of publicPleuralUltrasoundVideoAssets) {
    asset.referenceIds?.forEach((id) => ids.add(id))
  }
  return [...ids]
}

export default function PleuralUltrasoundReferencesPage() {
  const ids = referencedIds()
  const references = pleuralReferences.filter((reference) => ids.includes(reference.id))

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="References & attributions"
        description="The guideline sources behind the teaching and the Creative Commons attributions for the image and video labs."
      />
      <PleuralUltrasoundNav activeHref="/pleural-procedures/pleural-ultrasound/references" />

      <section className="container max-w-4xl space-y-6">
        <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Clinical references</h2>
          <ul className="mt-4 space-y-4 text-sm leading-6">
            {references.map((reference) => (
              <li key={reference.id} className="space-y-1">
                <p className="text-foreground">{reference.citation}</p>
                {reference.url ? (
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-700 underline decoration-sky-500/50 underline-offset-4 dark:text-sky-300"
                  >
                    {reference.url}
                  </a>
                ) : null}
                <p className="text-xs text-muted-foreground">{reference.useNote}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Teaching image attributions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All pattern-lab images are licensed CC BY 4.0 and stored in the repository with
            attribution.
          </p>
          <ul className="mt-4 space-y-4 text-sm leading-6">
            {publicPleuralUltrasoundAssets.map((asset) => (
              <li key={asset.id} className="space-y-1">
                <p className="text-foreground">{asset.attribution}</p>
                <p className="text-xs text-muted-foreground">
                  {asset.license}
                  {' · '}
                  <a
                    href={asset.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-sky-500/50 underline-offset-4"
                  >
                    Source
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Teaching video attributions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Dynamic-sign clips are selected from row-level Creative Commons metadata and stored in
            the repository as browser-playable MP4 files.
          </p>
          <ul className="mt-4 space-y-4 text-sm leading-6">
            {publicPleuralUltrasoundVideoAssets.map((asset) => (
              <li key={asset.id} className="space-y-1">
                <p className="text-foreground">{asset.attribution}</p>
                <p className="text-xs text-muted-foreground">
                  {asset.license}
                  {' · '}
                  <a
                    href={asset.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-sky-500/50 underline-offset-4"
                  >
                    Source clip
                  </a>
                  {' · '}
                  <a
                    href={asset.sourceMetadataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-sky-500/50 underline-offset-4"
                  >
                    Metadata
                  </a>
                  {asset.convertedToMp4 ? ' · Converted to MP4 for browser playback' : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
