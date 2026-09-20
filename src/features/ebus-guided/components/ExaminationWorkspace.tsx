'use client'
import { useEffect, useState } from 'react'
import type { LinkedFrameSource } from '@/lib/ebus-linked-contract'
import {
  archiveIncompatibleExamination,
  attachModelAcquisition,
  emptyNodeRecord,
  loadExamination,
  newExamination,
  reportStatements,
  saveExamination,
  submitRecordTask,
  type ExaminationCase,
  type ExaminationDraft,
  type RecordTask,
} from '../engine/examination'
import { RECORD_DECISIONS } from '../content/record-tasks'
import styles from './course.module.css'
import { SourceList } from './SourceList'

export function ExaminationWorkspace({
  caseData,
  task,
  source,
  readOnly = false,
  onComplete,
}: {
  caseData: ExaminationCase
  task: RecordTask
  source?: LinkedFrameSource
  readOnly?: boolean
  onComplete: () => void
}) {
  const [draft, setDraft] = useState(() => newExamination(caseData))
  const [loadState, setLoadState] = useState('loading')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [accepted, setAccepted] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  /*
   * Which fields the learner has actually put a value in, this session (L26-3).
   *
   * Form intent, not record content: it is never written to the draft, never saved and never
   * read back, so nothing about what is stored or how it is validated depends on it. A field
   * restored from a stored draft counts as entered, because somebody entered it.
   */
  const [entered, setEntered] = useState<Record<string, boolean>>({})
  const markEntered = (field: string) => setEntered((value) => ({ ...value, [field]: true }))
  /** Node records that came back from a stored draft, so every field in them was entered once. */
  const [restored, setRestored] = useState<readonly string[]>([])
  useEffect(() => {
    const loaded = loadExamination(caseData)
    // Browser-local draft hydration is intentionally separate from live acquisition state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loaded.draft)
    setLoadState(loaded.state)
    setRestored(Object.keys(loaded.draft.nodes))
  }, [caseData])
  const update = (next: ExaminationDraft) => {
    if (readOnly || loadState === 'incompatible') return
    setDraft(next)
    setAccepted(false)
    setSaveFailed(!saveExamination(caseData, next))
  }
  const decision = (id: string, value: string) =>
    update({ ...draft, decisions: { ...draft.decisions, [id]: value } })
  const fieldError = (id: string) =>
    errors[id] ? (
      <p id={'record-error-' + id} role="alert" className={styles.recordError}>
        {errors[id]}
      </p>
    ) : null
  const suppliedHistory = ['adequacy', 'allocation', 'report'].includes(task)
  function check() {
    if (readOnly || loadState === 'incompatible') return
    let current = draft
    if (task === 'station-window') {
      if (!source) {
        setErrors({
          image:
            'The current acquisition is unavailable. Historical metadata cannot restore live evidence; reacquire the window.',
        })
        return
      }
      current = attachModelAcquisition(current, caseData, caseData.nodes[0].id, source)
    }
    if (task === 'node-description' && current.decisions.description === 'appearance-only')
      current = {
        ...current,
        nodes: {
          ...current.nodes,
          [caseData.nodes[0].id]: {
            ...emptyNodeRecord(),
            identity: 'supported',
            visualization: 'described',
            description: 'Oval, homogeneous appearance supplied by the written vignette',
            uncertainty: 'No calibrated size, Doppler assessment, sampling or pathology supplied',
          },
        },
      }
    const checked = submitRecordTask(current, caseData, task)
    setDraft(checked.draft)
    setErrors(checked.errors)
    setAccepted(checked.accepted)
    setSaveFailed(!saveExamination(caseData, checked.draft))
    if (checked.accepted) onComplete()
  }
  return (
    <section className={styles.examination} aria-label="Case-specific examination record">
      <header>
        <p className={styles.eyebrow}>
          {caseData.sourceType === 'model-case'
            ? 'Model case · Observed acquisition'
            : 'Authored written case · Supplied facts'}
        </p>
        <h3>{caseData.title}</h3>
        <p>{caseData.context}</p>
        <p>
          <strong>Clinical request.</strong> {caseData.clinicalQuestion}
        </p>
      </header>
      <p className={styles.muted}>{caseData.limitation}</p>
      {loadState === 'compatible' && (
        <p role="status" className={styles.muted}>
          Compatible case draft restored. Acquisition references are historical metadata; active
          model tasks restart and require a new acquisition.
        </p>
      )}
      {loadState === 'incompatible' && (
        <div className={styles.notice} role="alert">
          <p>
            The saved draft belongs to a different content or geometry version. It has not been
            attached to this case.
          </p>
          <button
            className={styles.secondary}
            onClick={() => {
              if (!archiveIncompatibleExamination(caseData)) {
                setSaveFailed(true)
                return
              }
              setLoadState('new')
              setDraft(newExamination(caseData))
            }}
          >
            Start a record for this version
          </button>
        </div>
      )}
      {(saveFailed || loadState === 'unavailable') && (
        <p className={styles.notice} role="status">
          This browser cannot save the examination record. Keep this page open to retain the current
          work.
        </p>
      )}
      <fieldset
        disabled={readOnly || accepted || loadState === 'loading' || loadState === 'incompatible'}
      >
        <legend>{readOnly ? 'Read-only record review' : 'Your educational record'}</legend>
        {task === 'plan' && (
          <>
            <p>
              {caseData.primaryLocation}. Plan the relevant coverage and assign categories relative
              to that side. These selections do not mark a station examined or sampled.
            </p>
            <div className={styles.nodalMap} aria-label="Case nodal map">
              {caseData.stations.map((station) => (
                <section key={station.id} className={styles.recordCard}>
                  <h4>Station {station.id}</h4>
                  <p>
                    {caseData.nodes
                      .filter((node) => node.stationId === station.id)
                      .map((node) => node.label)
                      .join('; ')}
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!draft.plans[station.id]?.planned}
                      onChange={(event) =>
                        update({
                          ...draft,
                          plans: {
                            ...draft.plans,
                            [station.id]: {
                              planned: event.target.checked,
                              indication: 'Relevant target in the supplied imaging request',
                            },
                          },
                        })
                      }
                    />
                    Plan assessment of {station.id}
                  </label>
                  {fieldError('plan-' + station.id)}
                  <label>
                    N category for {station.id} if malignant
                    <select
                      aria-label={'N category for ' + station.id + ' if malignant'}
                      value={draft.decisions['category-' + station.id] ?? ''}
                      onChange={(event) => decision('category-' + station.id, event.target.value)}
                    >
                      <option value="">Choose category</option>
                      {['N1', 'N2', 'N3'].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  {fieldError('category-' + station.id)}
                  <p className={styles.muted}>
                    Performed assessment: not supplied at this planning stage.
                  </p>
                </section>
              ))}
            </div>
          </>
        )}
        {task === 'station-window' && (
          <>
            <p>
              Station 7 · Model target A ·{' '}
              {source ? 'Current model acquisition available' : 'No current acquisition available'}
            </p>
            <label>
              Visualization supported by this image
              <select
                aria-label="Visualization supported by this image"
                value={draft.nodes['model-7-a']?.visualization ?? ''}
                onChange={(event) =>
                  update({
                    ...draft,
                    nodes: {
                      ...draft.nodes,
                      'model-7-a': {
                        ...emptyNodeRecord(),
                        ...draft.nodes['model-7-a'],
                        visualization: event.target.value as 'described' | 'image-inadequate',
                        identity: 'supported',
                        approach: source?.scope.approach ?? '',
                        description:
                          event.target.value === 'described'
                            ? 'Modeled target section with checked airway landmarks'
                            : '',
                        uncertainty: 'No complete clinical station survey or specimen result',
                      },
                    },
                  })
                }
              >
                <option value="">Choose visualization</option>
                <option value="described">Modeled section available for description</option>
                <option value="image-inadequate">
                  Inadequate image evidence for the intended description
                </option>
              </select>
            </label>
            {fieldError('visualization')}
            {fieldError('image')}
            <p className={styles.muted}>
              No needle action, specimen or pathology is supplied for this model task.
            </p>
          </>
        )}
        {suppliedHistory && (
          <p className={styles.notice}>
            The examination and specimen entries below are supplied case history. They were not
            performed by visiting earlier lessons or by operating a model.
          </p>
        )}
        {['adequacy', 'allocation'].includes(task) && (
          <div className={styles.specimenInventory}>
            {caseData.specimens.map((specimen) => (
              <section key={specimen.id} className={styles.recordCard}>
                <h4>{specimen.label}</h4>
                <p className={styles.muted}>
                  Case {caseData.id} · Node {specimen.nodeId} · Station {specimen.stationId}
                </p>
                {caseData.results
                  .filter((result) => result.specimenId === specimen.id)
                  .map((result) => (
                    <p key={result.id}>
                      <strong>
                        {result.phase === 'rose'
                          ? 'ROSE'
                          : result.phase === 'final'
                            ? 'Final pathology'
                            : 'Ancillary studies'}{' '}
                        · {result.state}.
                      </strong>{' '}
                      {result.text}
                    </p>
                  ))}
                {task === 'allocation' &&
                  specimen.requestedTests.map((test) => (
                    <div key={test.id}>
                      <p>
                        <strong>Requested study:</strong> {test.name}
                      </p>
                      <p>
                        {test.protocol ??
                          'The receiving laboratory has not supplied medium or quantity requirements for this study.'}
                      </p>
                      <label>
                        Handling plan: {specimen.label} — {test.name}
                        <select
                          aria-label={'Handling plan: ' + specimen.label + ' — ' + test.name}
                          value={draft.allocations[specimen.id + ':' + test.id] ?? ''}
                          onChange={(event) =>
                            update({
                              ...draft,
                              allocations: {
                                ...draft.allocations,
                                [specimen.id + ':' + test.id]: event.target.value as
                                  | 'protocol'
                                  | 'clarify-laboratory'
                                  | 'pending',
                              },
                            })
                          }
                        >
                          <option value="">Choose handling plan</option>
                          <option value="protocol">Use the supplied laboratory protocol</option>
                          <option value="clarify-laboratory">
                            Clarify requirements with the laboratory
                          </option>
                          <option value="pending">Leave requirements unresolved</option>
                        </select>
                      </label>
                      {fieldError(specimen.id + ':' + test.id)}
                    </div>
                  ))}
              </section>
            ))}
          </div>
        )}
        {task === 'report' && (
          <>
            <p>{caseData.complications}</p>
            {caseData.nodes.map((node) => {
              const stored = draft.nodes[node.id]
              const entry = stored ?? emptyNodeRecord()
              /*
               * Whether each of this node's two entries has actually been entered (L26-3).
               *
               * The empty record's "Not examined" and "Not recorded" are declarations about a
               * real patient, and they were what an untouched select showed, so a learner could
               * submit an examination history nobody had entered. A field nobody has filled in
               * is not a field recorded as unexamined, and the two now look different: it opens
               * on "Choose…" until something is chosen. A stored draft — including a legacy one
               * that really does say "Not examined" — counts as entered and is shown and saved
               * exactly as it was. Nothing is written by rendering, no value is overwritten, and
               * the check still requires the supplied history, so an unfilled field fails it as
               * it did before.
               */
              const blank = (field: 'visualization' | 'sampling') =>
                !restored.includes(node.id) && !entered[node.id + ':' + field]
              return (
                <section
                  key={node.id}
                  id={'record-source-' + node.id}
                  className={styles.recordCard}
                >
                  <h4>{node.label}</h4>
                  <div className={styles.recordPair}>
                    <div>
                      <p>{node.context}</p>
                      {caseData.results
                        .filter((result) => node.specimenIds.includes(result.specimenId))
                        .map((result) => (
                          <p id={'record-source-' + result.id} key={result.id}>
                            <strong>
                              {result.phase} · {result.state}.
                            </strong>{' '}
                            {result.text}
                          </p>
                        ))}
                    </div>
                    <div>
                      <label>
                        {node.label}: visualization
                        <select
                          aria-label={node.label + ': visualization'}
                          value={blank('visualization') ? '' : entry.visualization}
                          onChange={(event) => {
                            if (!event.target.value) return
                            markEntered(node.id + ':visualization')
                            update({
                              ...draft,
                              nodes: {
                                ...draft.nodes,
                                [node.id]: {
                                  ...entry,
                                  visualization: event.target.value as typeof entry.visualization,
                                },
                              },
                            })
                          }}
                        >
                          {blank('visualization') ? (
                            <option value="">Choose the supplied visualization</option>
                          ) : null}
                          {[
                            ['not-examined', 'Not examined'],
                            ['not-visualized', 'Not visualized'],
                            ['image-inadequate', 'Image inadequate'],
                            ['described', 'Visualized with supplied description'],
                          ].map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {fieldError(node.id + '-visualization')}
                      <label>
                        {node.label}: sampling
                        <select
                          aria-label={node.label + ': sampling'}
                          value={blank('sampling') ? '' : entry.sampling}
                          onChange={(event) => {
                            if (!event.target.value) return
                            markEntered(node.id + ':sampling')
                            update({
                              ...draft,
                              nodes: {
                                ...draft.nodes,
                                [node.id]: {
                                  ...entry,
                                  sampling: event.target.value as typeof entry.sampling,
                                },
                              },
                            })
                          }}
                        >
                          {blank('sampling') ? (
                            <option value="">Choose the supplied history</option>
                          ) : null}
                          <option value="unrecorded">Not recorded</option>
                          <option value="sampled">Sampled — supplied history</option>
                          <option value="not-sampled">Not sampled — supplied history</option>
                        </select>
                      </label>
                      {/*
                       * The stated reason appears only under "Not sampled", which the walkthrough
                       * found through an error message rather than through the form (L26-3). It
                       * stays conditional, because a reason not to sample has no meaning under
                       * the other answers, but the form now says it is there before it appears.
                       */}
                      {entry.sampling !== 'not-sampled' && (
                        <p className={styles.muted}>
                          Choosing “Not sampled — supplied history” adds one more field here: the
                          stated reason sampling was not performed.
                        </p>
                      )}
                      {fieldError(node.id + '-sampling')}
                      {entry.sampling === 'not-sampled' && (
                        <>
                          <label>
                            {node.label}: reason not sampled
                            <select
                              aria-label={node.label + ': reason not sampled'}
                              value={entry.samplingReason}
                              onChange={(event) =>
                                update({
                                  ...draft,
                                  nodes: {
                                    ...draft.nodes,
                                    [node.id]: { ...entry, samplingReason: event.target.value },
                                  },
                                })
                              }
                            >
                              <option value="">Choose stated reason</option>
                              <option>No acceptable stable window</option>
                              <option>Procedure stopped before assessment</option>
                              <option>Normal station assumed</option>
                            </select>
                          </label>
                          {fieldError(node.id + '-reason')}
                        </>
                      )}
                    </div>
                  </div>
                </section>
              )
            })}
          </>
        )}
        {RECORD_DECISIONS[task].map((item) => (
          <div key={item.id}>
            <label>
              {item.label}
              <select
                aria-label={item.label}
                aria-invalid={!!errors[item.id]}
                aria-describedby={errors[item.id] ? 'record-error-' + item.id : undefined}
                value={draft.decisions[item.id] ?? ''}
                onChange={(event) => decision(item.id, event.target.value)}
              >
                <option value="">Choose a response</option>
                {item.choices.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {fieldError(item.id)}
          </div>
        ))}
        {task === 'report' && (
          <section>
            <h4>Supported report statements</h4>
            <p>Select the findings and limitations you have reconciled with the source entries.</p>
            {caseData.reportOptions.map((option) => (
              <div key={option.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.reportStatementIds.includes(option.id)}
                    onChange={(event) =>
                      update({
                        ...draft,
                        reportStatementIds: event.target.checked
                          ? [...draft.reportStatementIds, option.id]
                          : draft.reportStatementIds.filter((id) => id !== option.id),
                      })
                    }
                  />
                  {option.text}
                </label>
                {fieldError('report-' + option.id)}
              </div>
            ))}
          </section>
        )}
      </fieldset>
      {fieldError('case')}
      {!readOnly && (
        <button
          className={styles.secondary}
          disabled={accepted || loadState === 'loading' || loadState === 'incompatible'}
          onClick={check}
        >
          Check and save record
        </button>
      )}
      {accepted && (
        <p role="status">
          Record task checked. Supplied facts, your declarations and model observations remain
          distinct. Continue with the lesson.
        </p>
      )}
      {task === 'report' && accepted && (
        <section className={styles.reportPreview} aria-label="Educational report preview">
          <h3>Educational report · Supplied case history</h3>
          <p>{caseData.clinicalQuestion}</p>
          {reportStatements(caseData, draft).map((statement) => (
            <p key={statement.id}>{statement.text}</p>
          ))}
          <p>{caseData.limitation}</p>
        </section>
      )}
      <SourceList ids={caseData.sources} />
      <details>
        <summary>Record identity and source limits</summary>
        <p>
          Case {caseData.id} · Content version {caseData.version} ·{' '}
          {caseData.geometryVersion
            ? 'Geometry ' + caseData.geometryVersion
            : 'No geometry correspondence'}
        </p>
        <p>
          Plans and form entries are learner declarations. Specimen and result entries are supplied
          history. Stored acquisition metadata never restores a live frame.
        </p>
        {draft.acquisitions.map((entry) => (
          <p key={entry.source.taskId}>
            Observed model action: {entry.source.taskId} · {entry.source.frameId} ·{' '}
            {entry.source.scope.approach} · historical metadata only.
          </p>
        ))}
      </details>
    </section>
  )
}
