import { z } from 'zod'
import type { LinkedFrameSource } from '@/lib/ebus-linked-contract'
import { isLinkedFrameSource } from '@/lib/ebus-linked-contract'

export type RecordTask =
  | 'station-window'
  | 'node-description'
  | 'plan'
  | 'adequacy'
  | 'allocation'
  | 'report'
export interface CaseStation {
  id: string
  indication: string
  category?: string
}
export interface CaseNode {
  id: string
  stationId: string
  label: string
  context: string
  visualization: 'not-examined' | 'not-visualized' | 'image-inadequate' | 'described'
  sampling: 'not-supplied' | 'sampled' | 'not-sampled'
  samplingReason?: string
  specimenIds: string[]
}
export interface CaseSpecimen {
  id: string
  nodeId: string
  stationId: string
  label: string
  requestedTests: { id: string; name: string; protocol: string | null }[]
}
export interface CaseResult {
  id: string
  specimenId: string
  phase: 'rose' | 'final' | 'ancillary'
  state: 'supplied' | 'pending' | 'not-available'
  text: string
}
export interface ExaminationCase {
  id: string
  version: number
  title: string
  sourceType: 'authored-case' | 'model-case'
  clinicalQuestion: string
  primaryLocation: string
  geometryVersion: string | null
  sources: string[]
  context: string
  limitation: string
  stations: CaseStation[]
  nodes: CaseNode[]
  specimens: CaseSpecimen[]
  results: CaseResult[]
  complications: string
  reportOptions: { id: string; text: string; supportedBy: string[] }[]
}
const identifier = z.string().min(1).max(160)
const text = z.string().max(1600)
const nodeRecord = z
  .object({
    identity: z.enum(['proposed', 'supported', 'uncertain']),
    visualization: z.enum(['not-examined', 'not-visualized', 'image-inadequate', 'described']),
    description: text,
    approach: text,
    uncertainty: text,
    sampling: z.enum(['unrecorded', 'sampled', 'not-sampled']),
    samplingReason: text,
    origin: z.literal('learner-declaration'),
  })
  .strict()
const acquisition = z
  .object({
    nodeId: identifier,
    source: z.custom<LinkedFrameSource>(isLinkedFrameSource),
    origin: z.literal('observed-model-action'),
    guidance: z.literal('historical-metadata-only'),
  })
  .strict()
const submission = z
  .object({
    at: identifier,
    answers: z.record(text),
    accepted: z.boolean(),
  })
  .strict()
export const examinationSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: identifier,
    caseVersion: z.number().int().positive(),
    geometryVersion: z.string().max(160).nullable(),
    plans: z.record(z.object({ planned: z.boolean(), indication: text }).strict()),
    nodes: z.record(nodeRecord),
    acquisitions: z.array(acquisition).max(10),
    allocations: z.record(z.enum(['protocol', 'clarify-laboratory', 'pending'])),
    decisions: z.record(text),
    reportStatementIds: z.array(identifier).max(30),
    firstSubmissions: z.record(submission),
    completedTasks: z.array(identifier).max(20),
    updatedAt: text,
  })
  .strict()
export type ExaminationDraft = z.infer<typeof examinationSchema>
export const examinationKey = (caseId: string) => 'ip-ebus-guided-examination:' + caseId
export const recordTaskKey = (task: RecordTask) => task + ':v1'
export function newExamination(caseData: ExaminationCase): ExaminationDraft {
  return {
    schemaVersion: 1,
    caseId: caseData.id,
    caseVersion: caseData.version,
    geometryVersion: caseData.geometryVersion,
    plans: {},
    nodes: {},
    acquisitions: [],
    allocations: {},
    decisions: {},
    reportStatementIds: [],
    firstSubmissions: {},
    completedTasks: [],
    updatedAt: '',
  }
}
export function compatibleExamination(
  caseData: ExaminationCase,
  value: unknown,
): value is ExaminationDraft {
  const parsed = examinationSchema.safeParse(value)
  if (!parsed.success) return false
  const draft = parsed.data
  return (
    draft.caseId === caseData.id &&
    draft.caseVersion === caseData.version &&
    draft.geometryVersion === caseData.geometryVersion &&
    Object.keys(draft.plans).every((id) =>
      caseData.stations.some((station) => station.id === id),
    ) &&
    Object.keys(draft.nodes).every((id) => caseData.nodes.some((node) => node.id === id)) &&
    draft.acquisitions.every(
      (item) =>
        caseData.sourceType === 'model-case' &&
        item.source.caseId === 'case-001' &&
        item.source.taskId.startsWith('station-seven:') &&
        item.source.modelRevision === caseData.geometryVersion &&
        caseData.nodes.some((node) => node.id === item.nodeId),
    ) &&
    Object.keys(draft.allocations).every((id) =>
      caseData.specimens.some((specimen) =>
        specimen.requestedTests.some((test) => id === specimen.id + ':' + test.id),
      ),
    ) &&
    draft.reportStatementIds.every((id) =>
      caseData.reportOptions.some((option) => option.id === id),
    )
  )
}
export type DraftLoad = {
  state: 'new' | 'compatible' | 'incompatible' | 'unavailable'
  draft: ExaminationDraft
}
export function loadExamination(caseData: ExaminationCase): DraftLoad {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(examinationKey(caseData.id))
  } catch {
    return { state: 'unavailable', draft: newExamination(caseData) }
  }
  if (!raw) return { state: 'new', draft: newExamination(caseData) }
  try {
    const parsed: unknown = JSON.parse(raw)
    return compatibleExamination(caseData, parsed)
      ? { state: 'compatible', draft: parsed }
      : { state: 'incompatible', draft: newExamination(caseData) }
  } catch {
    return { state: 'incompatible', draft: newExamination(caseData) }
  }
}
export function archiveIncompatibleExamination(caseData: ExaminationCase): boolean {
  try {
    const key = examinationKey(caseData.id),
      raw = window.localStorage.getItem(key)
    if (raw) window.localStorage.setItem(key + ':archive:' + Date.now(), raw)
    return true
  } catch {
    return false
  }
}
export function saveExamination(caseData: ExaminationCase, draft: ExaminationDraft): boolean {
  if (!compatibleExamination(caseData, draft)) return false
  try {
    window.localStorage.setItem(
      examinationKey(caseData.id),
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    )
    return true
  } catch {
    return false
  }
}
export function emptyNodeRecord(): z.infer<typeof nodeRecord> {
  return {
    identity: 'proposed',
    visualization: 'not-examined',
    description: '',
    approach: '',
    uncertainty: '',
    sampling: 'unrecorded',
    samplingReason: '',
    origin: 'learner-declaration',
  }
}
export function attachModelAcquisition(
  draft: ExaminationDraft,
  caseData: ExaminationCase,
  nodeId: string,
  source: LinkedFrameSource,
): ExaminationDraft {
  if (
    !isLinkedFrameSource(source) ||
    caseData.sourceType !== 'model-case' ||
    source.caseId !== 'case-001' ||
    !source.taskId.startsWith('station-seven:') ||
    source.modelRevision !== caseData.geometryVersion ||
    !caseData.nodes.some((node) => node.id === nodeId)
  )
    return draft
  const entry = {
    nodeId,
    source,
    origin: 'observed-model-action' as const,
    guidance: 'historical-metadata-only' as const,
  }
  return {
    ...draft,
    acquisitions: [
      ...draft.acquisitions.filter((item) => item.source.taskId !== source.taskId),
      entry,
    ].slice(-10),
  }
}
export function taskErrors(
  task: RecordTask,
  draft: ExaminationDraft,
  caseData: ExaminationCase,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!compatibleExamination(caseData, draft))
    return { case: 'This record does not match the current case and version.' }
  const expectDecision = (key: string, answer: string, message: string) => {
    if (draft.decisions[key] !== answer) errors[key] = message
  }
  if (task === 'station-window') {
    if (!draft.acquisitions.length)
      errors.image = 'Acquire the current model window before recording its evidence.'
    expectDecision(
      'station-basis',
      'landmarks',
      'Use the target compartment and the identified carina/main-bronchus landmarks, not a control angle or shape.',
    )
    expectDecision(
      'survey-extent',
      'window-only',
      'One modeled window does not establish a complete clinical station survey.',
    )
    const entry = draft.nodes[caseData.nodes[0].id]
    if (!entry || !['described', 'image-inadequate'].includes(entry.visualization))
      errors.visualization =
        'Record the supported visualization or explicitly record inadequate image evidence.'
  }
  if (task === 'node-description') {
    expectDecision(
      'description',
      'appearance-only',
      'Record the described appearance and retain the uncertainty about pathology.',
    )
    expectDecision(
      'measurement',
      'not-supplied',
      'This described vignette supplies no calibrated clinical measurement.',
    )
  }
  if (task === 'plan') {
    for (const station of caseData.stations) {
      if (!draft.plans[station.id]?.planned)
        errors['plan-' + station.id] =
          'Include this relevant station in the plan; planned assessment is distinct from completed sampling.'
      if (draft.decisions['category-' + station.id] !== station.category)
        errors['category-' + station.id] =
          'Reconsider the category relative to the supplied primary side. Station anatomy does not change.'
    }
    expectDecision('station-count', 'one', 'The two 4R nodes belong to one anatomical station.')
  }
  if (task === 'adequacy') {
    expectDecision(
      'rose-status',
      'provisional',
      'On-site malignant cells are provisional information; final pathology and assay suitability remain separate.',
    )
    expectDecision(
      'next-specimen',
      'reconcile-safety',
      'Reconcile the remaining studies with the laboratory and patient tolerance; a number alone cannot establish adequacy.',
    )
    expectDecision(
      'without-rose',
      'planned-handling',
      'Without ROSE, agree on acquisition, handling and follow-up rather than assuming adequacy.',
    )
  }
  if (task === 'allocation') {
    for (const specimen of caseData.specimens)
      for (const test of specimen.requestedTests) {
        const key = specimen.id + ':' + test.id
        if (draft.allocations[key] !== (test.protocol ? 'protocol' : 'clarify-laboratory'))
          errors[key] = test.protocol
            ? 'Use the supplied case protocol for this specimen and study.'
            : 'The medium or quantity is not supplied. Clarify it with the receiving laboratory.'
      }
    expectDecision(
      'specimen-identity',
      'separate',
      'Retain the separate station, node and specimen identities; do not pool them.',
    )
  }
  if (task === 'report') {
    for (const node of caseData.nodes) {
      const entry = draft.nodes[node.id]
      if (!entry || entry.visualization !== node.visualization)
        errors[node.id + '-visualization'] =
          'Use the supplied examination history. Missing visualization is not a normal finding.'
      if (!entry || entry.sampling !== node.sampling)
        errors[node.id + '-sampling'] =
          'Distinguish sampled from not sampled using the source entry.'
      if (node.sampling === 'not-sampled' && entry?.samplingReason !== node.samplingReason)
        errors[node.id + '-reason'] = 'Retain the supplied reason that sampling was not performed.'
    }
    expectDecision(
      'report-conclusion',
      'incomplete',
      'The nonrepresentative and unsampled targets remain unresolved. Do not call this a negative systematic examination.',
    )
    expectDecision(
      'follow-up',
      'responsible-team',
      'Name the responsible clinical team to reconcile final pathology, pending studies and unresolved targets.',
    )
    for (const option of caseData.reportOptions)
      if (!draft.reportStatementIds.includes(option.id))
        errors['report-' + option.id] =
          'Include this supported finding or limitation in the report.'
  }
  return errors
}
export function submitRecordTask(
  draft: ExaminationDraft,
  caseData: ExaminationCase,
  task: RecordTask,
) {
  const errors = taskErrors(task, draft, caseData),
    key = recordTaskKey(task)
  const accepted = Object.keys(errors).length === 0
  const answers = {
    ...draft.decisions,
    ...draft.allocations,
    ...Object.fromEntries(
      Object.entries(draft.nodes).map(([id, entry]) => ['node:' + id, JSON.stringify(entry)]),
    ),
    ...Object.fromEntries(
      Object.entries(draft.plans).map(([id, entry]) => ['plan:' + id, JSON.stringify(entry)]),
    ),
    report: JSON.stringify(draft.reportStatementIds),
  }
  const updated = {
    ...draft,
    firstSubmissions: {
      ...draft.firstSubmissions,
      [key]: draft.firstSubmissions[key] ?? { at: new Date().toISOString(), answers, accepted },
    },
    completedTasks: accepted ? [...new Set([...draft.completedTasks, key])] : draft.completedTasks,
  }
  return { draft: updated, errors, accepted }
}
export function reportStatements(caseData: ExaminationCase, draft: ExaminationDraft) {
  return caseData.reportOptions.filter((option) => draft.reportStatementIds.includes(option.id))
}
