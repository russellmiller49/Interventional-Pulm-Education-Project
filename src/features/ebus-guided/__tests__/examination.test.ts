import { DESCRIPTION_CASE, EXAMINATION_CASE, MODEL_WINDOW_CASE } from '../content/examination-cases'
import {
  attachModelAcquisition,
  compatibleExamination,
  emptyNodeRecord,
  examinationKey,
  loadExamination,
  newExamination,
  reportStatements,
  saveExamination,
  submitRecordTask,
  taskErrors,
} from '../engine/examination'
import { acquired } from '../testing/linked-fixture'

beforeEach(() => localStorage.clear())
it('starts without inferred normal nodes, samples, results, plans or completed tasks', () => {
  const draft = newExamination(EXAMINATION_CASE)
  expect(draft.nodes).toEqual({})
  expect(draft.plans).toEqual({})
  expect(draft.completedTasks).toEqual([])
  expect(reportStatements(EXAMINATION_CASE, draft)).toEqual([])
  expect(taskErrors('report', draft, EXAMINATION_CASE)).not.toEqual({})
})
it('keeps two nodes within one station and specimens/results linked to the supplied identities', () => {
  expect(EXAMINATION_CASE.nodes.filter((node) => node.stationId === '4R')).toHaveLength(2)
  expect(EXAMINATION_CASE.stations.filter((station) => station.id === '4R')).toHaveLength(1)
  for (const specimen of EXAMINATION_CASE.specimens) {
    const node = EXAMINATION_CASE.nodes.find((entry) => entry.id === specimen.nodeId)!
    expect(node.stationId).toBe(specimen.stationId)
    expect(node.specimenIds).toContain(specimen.id)
  }
  expect(new Set(EXAMINATION_CASE.results.map((entry) => entry.id)).size).toBe(
    EXAMINATION_CASE.results.length,
  )
  expect(EXAMINATION_CASE.results.some((entry) => entry.phase === 'rose')).toBe(true)
  expect(
    EXAMINATION_CASE.results.some(
      (entry) => entry.phase === 'ancillary' && entry.state === 'pending',
    ),
  ).toBe(true)
})
it('does not mix model imaging with the written patient case or another model geometry', () => {
  const source = acquired('station-seven').linked!.source!
  const draft = newExamination(EXAMINATION_CASE)
  expect(attachModelAcquisition(draft, EXAMINATION_CASE, '4r-a', source)).toBe(draft)
  const modelDraft = attachModelAcquisition(
    newExamination(MODEL_WINDOW_CASE),
    MODEL_WINDOW_CASE,
    'model-7-a',
    source,
  )
  expect(modelDraft.acquisitions).toHaveLength(1)
  expect(modelDraft.acquisitions[0].guidance).toBe('historical-metadata-only')
  expect(compatibleExamination(EXAMINATION_CASE, modelDraft)).toBe(false)
  expect(
    compatibleExamination({ ...MODEL_WINDOW_CASE, geometryVersion: 'changed' }, modelDraft),
  ).toBe(false)
})
it('restores only compatible drafts and explicitly distinguishes changed versions', () => {
  const draft = newExamination(EXAMINATION_CASE)
  draft.decisions['station-count'] = 'one'
  expect(saveExamination(EXAMINATION_CASE, draft)).toBe(true)
  expect(loadExamination(EXAMINATION_CASE).draft.decisions['station-count']).toBe('one')
  expect(loadExamination({ ...EXAMINATION_CASE, version: 2 }).state).toBe('incompatible')
  expect(localStorage.getItem(examinationKey(EXAMINATION_CASE.id))).toContain('station-count')
  expect(loadExamination(DESCRIPTION_CASE).state).toBe('new')
})
it('records no first submission, requires a corrected interpretation before acceptance, and leaves an earlier session’s entry alone', () => {
  const initial = newExamination(DESCRIPTION_CASE)
  initial.decisions = { description: 'benign', measurement: 'not-supplied' }
  const wrong = submitRecordTask(initial, DESCRIPTION_CASE, 'node-description')
  expect(wrong.accepted).toBe(false)
  expect(wrong.draft.completedTasks).toEqual([])
  expect(wrong.draft.firstSubmissions).toEqual({})
  const correct = submitRecordTask(
    { ...wrong.draft, decisions: { description: 'appearance-only', measurement: 'not-supplied' } },
    DESCRIPTION_CASE,
    'node-description',
  )
  expect(correct.accepted).toBe(true)
  expect(correct.draft.completedTasks).toEqual(['node-description:v1'])
  expect(correct.draft.firstSubmissions).toEqual({})
  const earlier = {
    ...initial,
    firstSubmissions: {
      'node-description:v1': { at: 'earlier', answers: { description: 'benign' }, accepted: false },
    },
  }
  expect(
    submitRecordTask(earlier, DESCRIPTION_CASE, 'node-description').draft.firstSubmissions,
  ).toEqual(earlier.firstSubmissions)
})
it('accepts inadequate imaging and not-sampled reasons without inventing a negative survey', () => {
  const draft = newExamination(EXAMINATION_CASE)
  for (const node of EXAMINATION_CASE.nodes)
    draft.nodes[node.id] = {
      ...emptyNodeRecord(),
      visualization: node.visualization,
      sampling: node.sampling === 'not-supplied' ? 'unrecorded' : node.sampling,
      samplingReason: node.samplingReason ?? '',
    }
  draft.decisions = { 'report-conclusion': 'incomplete', 'follow-up': 'responsible-team' }
  draft.reportStatementIds = EXAMINATION_CASE.reportOptions.map((entry) => entry.id)
  expect(taskErrors('report', draft, EXAMINATION_CASE)).toEqual({})
  draft.nodes['4l-a'].sampling = 'sampled'
  expect(taskErrors('report', draft, EXAMINATION_CASE)['4l-a-sampling']).toBeTruthy()
})
it('requires laboratory clarification when handling requirements are not supplied', () => {
  const draft = newExamination(EXAMINATION_CASE)
  draft.decisions['specimen-identity'] = 'separate'
  for (const specimen of EXAMINATION_CASE.specimens)
    for (const test of specimen.requestedTests)
      draft.allocations[specimen.id + ':' + test.id] = test.protocol
        ? 'protocol'
        : 'clarify-laboratory'
  expect(taskErrors('allocation', draft, EXAMINATION_CASE)).toEqual({})
  draft.allocations['s-4r-b:biomarkers'] = 'protocol'
  expect(taskErrors('allocation', draft, EXAMINATION_CASE)['s-4r-b:biomarkers']).toBeTruthy()
})
