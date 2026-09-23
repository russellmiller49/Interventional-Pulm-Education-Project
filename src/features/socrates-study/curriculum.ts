import { z } from 'zod'
import type { CatalogCase } from './projections'
import type { TrainingProgress } from './model'

const catalogCaseSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    diagnosticCategory: z.string(),
    subcategory: z.string(),
    sortOrder: z.number().int().nonnegative(),
    revision: z.number().int().positive(),
    position: z.number().int().positive(),
  })
  .strict()
export const curriculumCatalogSchema = z
  .array(
    z
      .object({
        id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        title: z.string(),
        purpose: z.string(),
        displayOrder: z.number().int().positive(),
        recommendedStart: z.boolean(),
        level: z.enum(['Core', 'Deep dive', 'Advanced']),
        plannedCount: z.number().int().positive(),
        cases: z.array(catalogCaseSchema),
      })
      .strict(),
  )
  .superRefine((modules, ctx) => {
    if (new Set(modules.map((m) => m.id)).size !== modules.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate module identity.' })
    for (const m of modules)
      if (
        m.cases.length > m.plannedCount ||
        new Set(m.cases.map((c) => c.id)).size !== m.cases.length ||
        new Set(m.cases.map((c) => c.position)).size !== m.cases.length ||
        m.cases.some((c) => c.position > m.plannedCount)
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid module membership.' })
  })
export type CurriculumModule = z.infer<typeof curriculumCatalogSchema>[number]

export function orderedModules(modules: CurriculumModule[]) {
  return [...modules].sort(
    (a, b) =>
      Number(b.recommendedStart) - Number(a.recommendedStart) ||
      a.displayOrder - b.displayOrder ||
      a.id.localeCompare(b.id),
  )
}
export function orderedModuleCases(module: CurriculumModule) {
  return [...module.cases].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}
export function moduleNavigation(modules: CurriculumModule[], moduleId: string, caseId: string) {
  const selectedModule = modules.find((m) => m.id === moduleId)
  if (!selectedModule) return null
  const cases = orderedModuleCases(selectedModule)
  const index = cases.findIndex((c) => c.id === caseId)
  if (index < 0) return null
  return {
    module: selectedModule,
    current: cases[index],
    previous: cases[index - 1] ?? null,
    next: cases[index + 1] ?? null,
  }
}
export function caseProgressLabel(entry: CatalogCase, progress: TrainingProgress[]) {
  const p = progress.find((p) => p.case_id === entry.id && p.case_revision === entry.revision)
  return p?.completed_at
    ? 'Completed'
    : p?.revealed_at
      ? 'Teaching revealed'
      : p?.opened_at
        ? 'Opened'
        : 'Not started'
}
export function trainingHref(locale: string, caseId: string, moduleId?: string) {
  return `/${locale}/socrates/training/${caseId}${moduleId ? '?module=' + encodeURIComponent(moduleId) : ''}`
}
