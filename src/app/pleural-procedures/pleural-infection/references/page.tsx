import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { PleuralInfectionNav } from '@/features/pleural-infection/components/PleuralInfectionNav'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { pleuralInfectionLessons } from '@/features/pleural-infection/content/lessons'

export const metadata: Metadata = {
  title: 'Pleural Infection References',
  description: 'Guideline and trial sources behind the pleural infection module teaching.',
}

function referencedIds(): string[] {
  const ids = new Set<string>()
  for (const lesson of pleuralInfectionLessons) {
    for (const statement of lesson.statements) {
      statement.referenceIds.forEach((id) => ids.add(id))
    }
  }
  return [...ids]
}

export default function PleuralInfectionReferencesPage() {
  const ids = referencedIds()
  const references = pleuralReferences.filter((reference) => ids.includes(reference.id))

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="References"
        description="The guideline and trial sources behind the staging, intrapleural-therapy, and irrigation teaching."
      />
      <PleuralInfectionNav activeHref="/pleural-procedures/pleural-infection/references" />

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
