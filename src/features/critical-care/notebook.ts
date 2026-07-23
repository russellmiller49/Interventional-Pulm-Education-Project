import { z } from 'zod'

export const CRITICAL_CARE_NOTEBOOK_STORAGE_KEY = 'critical-care-notebook-v1'

export const criticalCareNotebookItemKinds = ['reference', 'asset'] as const
export type CriticalCareNotebookItemKind = (typeof criticalCareNotebookItemKinds)[number]

const notebookItemSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/),
    kind: z.enum(criticalCareNotebookItemKinds),
    savedAt: z.string().datetime({ offset: true }),
  })
  .strict()

export const criticalCareNotebookSchema = z
  .object({
    version: z.literal(1),
    items: z.array(notebookItemSchema).max(256),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((notebook, context) => {
    const keys = notebook.items.map((item) => `${item.kind}:${item.id}`)
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Notebook items must be unique.',
      })
    }
  })

export type CriticalCareNotebook = z.infer<typeof criticalCareNotebookSchema>
export type CriticalCareNotebookItem = z.infer<typeof notebookItemSchema>

export interface NotebookStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type CriticalCareNotebookItemKeySet = ReadonlySet<string>

export function criticalCareNotebookItemKey(item: {
  readonly id: string
  readonly kind: CriticalCareNotebookItemKind
}): string {
  return `${item.kind}:${item.id}`
}

export function createEmptyCriticalCareNotebook(
  now = new Date().toISOString(),
): CriticalCareNotebook {
  return { version: 1, items: [], updatedAt: now }
}

export function parseCriticalCareNotebook(
  value: unknown,
  knownItemKeys: CriticalCareNotebookItemKeySet,
): CriticalCareNotebook | null {
  const parsed = criticalCareNotebookSchema.safeParse(value)
  if (!parsed.success) return null
  return {
    ...parsed.data,
    items: parsed.data.items.filter((item) => knownItemKeys.has(criticalCareNotebookItemKey(item))),
  }
}

export function readCriticalCareNotebook(
  storage: NotebookStorageLike | null,
  knownItemKeys: CriticalCareNotebookItemKeySet,
): CriticalCareNotebook {
  if (!storage) return createEmptyCriticalCareNotebook()
  try {
    const serialized = storage.getItem(CRITICAL_CARE_NOTEBOOK_STORAGE_KEY)
    if (!serialized) return createEmptyCriticalCareNotebook()
    return (
      parseCriticalCareNotebook(JSON.parse(serialized) as unknown, knownItemKeys) ??
      createEmptyCriticalCareNotebook()
    )
  } catch {
    return createEmptyCriticalCareNotebook()
  }
}

export function writeCriticalCareNotebook(
  storage: NotebookStorageLike | null,
  notebook: CriticalCareNotebook,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(
      CRITICAL_CARE_NOTEBOOK_STORAGE_KEY,
      JSON.stringify(criticalCareNotebookSchema.parse(notebook)),
    )
    return true
  } catch {
    return false
  }
}

export function toggleCriticalCareNotebookItem(
  notebook: CriticalCareNotebook,
  item: { readonly id: string; readonly kind: CriticalCareNotebookItemKind },
  knownItemKeys: CriticalCareNotebookItemKeySet,
  now = new Date().toISOString(),
): CriticalCareNotebook {
  if (!knownItemKeys.has(criticalCareNotebookItemKey(item))) return notebook
  const exists = notebook.items.some((saved) => saved.id === item.id && saved.kind === item.kind)
  return criticalCareNotebookSchema.parse({
    version: 1,
    items: exists
      ? notebook.items.filter((saved) => saved.id !== item.id || saved.kind !== item.kind)
      : [...notebook.items, { ...item, savedAt: now }],
    updatedAt: now,
  })
}

export function isCriticalCareNotebookItemSaved(
  notebook: CriticalCareNotebook,
  item: { readonly id: string; readonly kind: CriticalCareNotebookItemKind },
): boolean {
  return notebook.items.some((saved) => saved.id === item.id && saved.kind === item.kind)
}
