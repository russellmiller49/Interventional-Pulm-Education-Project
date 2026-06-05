import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ThoracentesisNav } from '@/features/thoracentesis-planner/components/ThoracentesisNav'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { thoracentesisPlannerLessons } from '@/features/thoracentesis-planner/content/lessons'

export const metadata: Metadata = {
  title: 'Thoracentesis References',
  description: 'Guideline and manometry sources behind the thoracentesis module teaching.',
}

function referencedIds(): string[] {
  const ids = new Set<string>()
  for (const lesson of thoracentesisPlannerLessons) {
    for (const statement of lesson.statements) {
      statement.referenceIds.forEach((id) => ids.add(id))
    }
  }
  return [...ids]
}

export default function ThoracentesisReferencesPage() {
  const ids = referencedIds()
  const references = pleuralReferences.filter((reference) => ids.includes(reference.id))

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="References"
        description="The guideline and manometry sources behind the access-safety and drainage teaching."
      />
      <ThoracentesisNav activeHref="/pleural-procedures/thoracentesis-planner/references" />

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
