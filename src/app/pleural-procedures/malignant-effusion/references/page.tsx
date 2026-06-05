import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { MalignantEffusionNav } from '@/features/malignant-effusion/components/MalignantEffusionNav'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { malignantEffusionAssets } from '@/features/malignant-effusion/content/assets'
import { malignantEffusionLessons } from '@/features/malignant-effusion/content/lessons'

export const metadata: Metadata = {
  title: 'Malignant Pleural Effusion References',
  description:
    'Guideline, trial, and CC BY image sources for the malignant pleural effusion module.',
}

function referencedIds(): string[] {
  const ids = new Set<string>()
  for (const lesson of malignantEffusionLessons) {
    for (const statement of lesson.statements) {
      statement.referenceIds.forEach((id) => ids.add(id))
    }
  }
  return [...ids]
}

export default function MalignantEffusionReferencesPage() {
  const ids = referencedIds()
  const references = pleuralReferences.filter((reference) => ids.includes(reference.id))

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="References & attributions"
        description="The guideline and trial sources behind the pathway, plus the CC BY 4.0 image attributions."
      />
      <MalignantEffusionNav activeHref="/pleural-procedures/malignant-effusion/references" />

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
          <h2 className="text-lg font-semibold text-foreground">Image attributions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All images are licensed CC BY 4.0 and stored in the repository with attribution.
          </p>
          <ul className="mt-4 space-y-4 text-sm leading-6">
            {malignantEffusionAssets.map((asset) => (
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
      </section>
    </div>
  )
}
