import { chestDrainageLessons } from '@/features/chest-drainage/content/lessons'
import { chestDrainageReferences } from '@/features/chest-drainage/content/references'
import { malignantEffusionLessons } from '@/features/malignant-effusion/content/lessons'
import { pleuralAnalysisLessons } from '@/features/pleural-fluid-analysis/content/lessons'
import { pleuralInfectionLessons } from '@/features/pleural-infection/content/lessons'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { pleuralUltrasoundLessons } from '@/features/pleural-ultrasound/content/lessons'
import { pneumothoraxLessons } from '@/features/pneumothorax-pathway/content/lessons'
import { thoracentesisPlannerLessons } from '@/features/thoracentesis-planner/content/lessons'

const lessonGroups = [
  { module: 'Chest Drainage', lessons: chestDrainageLessons },
  { module: 'Pleural Fluid Analysis', lessons: pleuralAnalysisLessons },
  { module: 'Pleural Ultrasound', lessons: pleuralUltrasoundLessons },
  { module: 'Thoracentesis Planner', lessons: thoracentesisPlannerLessons },
  { module: 'Pneumothorax Pathway', lessons: pneumothoraxLessons },
  { module: 'Pleural Infection', lessons: pleuralInfectionLessons },
  { module: 'Malignant Effusion', lessons: malignantEffusionLessons },
] as const

export function PleuralClinicalReviewTable() {
  const statements = lessonGroups.flatMap((group) =>
    group.lessons.flatMap((lesson) =>
      lesson.statements.map((statement) => ({
        module: group.module,
        lesson: lesson.title,
        ...statement,
      })),
    ),
  )
  const references = [...pleuralReferences, ...chestDrainageReferences]

  return (
    <div className="container space-y-8">
      <section className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/80 px-5 py-4">
          <h2 className="text-xl font-semibold text-foreground">Pleural clinical review packet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Auditable clinical statements across the pleural course, with source IDs and review
            metadata.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Lesson</th>
                <th className="px-4 py-3">Statement</th>
                <th className="px-4 py-3">Sources</th>
                <th className="px-4 py-3">Last reviewed</th>
                <th className="px-4 py-3">Reviewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {statements.map((statement) => (
                <tr key={`${statement.module}-${statement.id}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{statement.module}</td>
                  <td className="px-4 py-3 text-muted-foreground">{statement.lesson}</td>
                  <td className="max-w-xl px-4 py-3 leading-6 text-muted-foreground">
                    {statement.statement}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {statement.referenceIds.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{statement.lastReviewed}</td>
                  <td className="px-4 py-3 text-muted-foreground">{statement.reviewer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">References</h2>
        <div className="mt-5 grid gap-4">
          {references.map((reference) => (
            <article
              key={`${reference.id}-${reference.citation}`}
              className="rounded-lg border border-border/80 bg-background p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {reference.sourceType}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{reference.id}</span>
              </div>
              <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                {reference.url ? (
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-sky-500 underline-offset-4"
                  >
                    {reference.citation}
                  </a>
                ) : (
                  reference.citation
                )}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{reference.useNote}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
