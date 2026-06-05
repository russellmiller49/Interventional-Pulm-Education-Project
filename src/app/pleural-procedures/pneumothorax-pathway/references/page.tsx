import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { PneumothoraxNav } from '@/features/pneumothorax-pathway/components/PneumothoraxNav'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { pneumothoraxLessons } from '@/features/pneumothorax-pathway/content/lessons'

export const metadata: Metadata = {
  title: 'Pneumothorax References',
  description: 'Guideline sources behind the pneumothorax pathway teaching.',
}

function referencedIds(): string[] {
  const ids = new Set<string>()
  for (const lesson of pneumothoraxLessons) {
    for (const statement of lesson.statements) {
      statement.referenceIds.forEach((id) => ids.add(id))
    }
  }
  return [...ids]
}

export default function PneumothoraxReferencesPage() {
  const ids = referencedIds()
  const references = pleuralReferences.filter((reference) => ids.includes(reference.id))

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="References"
        description="The guideline sources behind the physiology-first pathway and framework comparison."
      />
      <PneumothoraxNav activeHref="/pleural-procedures/pneumothorax-pathway/references" />

      <section className="container max-w-4xl">
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
      </section>
    </div>
  )
}
