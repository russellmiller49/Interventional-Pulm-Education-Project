import { chestDrainageLessons } from '@/features/chest-drainage/content/lessons'
import { chestDrainageReferences } from '@/features/chest-drainage/content/references'
import { malignantEffusionLessons } from '@/features/malignant-effusion/content/lessons'
import { pleuralAnalysisLessons } from '@/features/pleural-fluid-analysis/content/lessons'
import { pleuralInfectionLessons } from '@/features/pleural-infection/content/lessons'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import {
  getPleuralReusePolicyLabel,
  pleuralModuleSourceRegistry,
} from '@/features/pleural-procedures/content/sourceRegistry'
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

      <section className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Dataset and media source policy</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Source triage for pleural ultrasound media. Public modules should render only reviewed
          embeddable assets; audit-required, reference-only, and permission-required sources stay
          out of the learner-facing asset list until reviewed or explicitly permitted.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Policy</th>
                <th className="px-4 py-3">License</th>
                <th className="px-4 py-3">Use in module</th>
                <th className="px-4 py-3">Review note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {pleuralModuleSourceRegistry.map((source) => (
                <tr key={source.id}>
                  <td className="px-4 py-3">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground underline decoration-sky-500 underline-offset-4"
                    >
                      {source.name}
                    </a>
                    <div className="mt-1 text-xs text-muted-foreground">{source.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {getPleuralReusePolicyLabel(source.reusePolicy)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {source.licenseUrl ? (
                      <a
                        href={source.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-sky-500 underline-offset-4"
                      >
                        {source.license}
                      </a>
                    ) : (
                      source.license
                    )}
                  </td>
                  <td className="max-w-sm px-4 py-3 leading-6 text-muted-foreground">
                    {source.useScope}
                  </td>
                  <td className="max-w-md px-4 py-3 leading-6 text-muted-foreground">
                    {source.sourceNote}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
