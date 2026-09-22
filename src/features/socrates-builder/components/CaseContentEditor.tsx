'use client'
import type { SocratesSlideDocument } from '../types'
import {
  emptyCaseContent,
  emptyAuthorContent,
  testingReadinessIssues,
  type CaseContent,
  type AuthorContent,
} from '../case-content'
import styles from './socrates-builder.module.css'

export function CaseContentEditor({
  document,
  onChange,
  privateEnabled,
}: {
  document: SocratesSlideDocument
  onChange: (document: SocratesSlideDocument) => void
  privateEnabled: boolean
}) {
  const content = document.caseContent ?? emptyCaseContent()
  const author = document.authorContent ?? emptyAuthorContent()
  const changeCase = (patch: Partial<CaseContent>) =>
    onChange({
      ...document,
      schemaVersion: 2,
      authorContent: author,
      caseContent: { ...content, ...patch },
    })
  const changeAuthor = (patch: Partial<AuthorContent>) =>
    onChange({
      ...document,
      schemaVersion: 2,
      caseContent: content,
      authorContent: { ...author, ...patch },
    })
  const readiness = author.readiness
  const issues = testingReadinessIssues(content, author)
  function field(
    label: string,
    value: string,
    onChangeValue: (value: string) => void,
    multiline = true,
  ) {
    return (
      <label className={styles.caseField}>
        {label}
        {multiline ? (
          <textarea value={value} rows={3} onChange={(e) => onChangeValue(e.target.value)} />
        ) : (
          <input value={value} onChange={(e) => onChangeValue(e.target.value)} />
        )}
      </label>
    )
  }
  return (
    <>
      <section className={styles.formSection} aria-label="Case content">
        <h2>Case content</h2>
        <p className={styles.fieldHint}>
          Applies to the whole case, independently of teaching regions. Use de-identified text only.
        </p>
        {field(
          'Diagnostic category',
          content.diagnosticCategory,
          (diagnosticCategory) => changeCase({ diagnosticCategory }),
          false,
        )}
        {field(
          'Subcategory',
          content.subcategory,
          (subcategory) => changeCase({ subcategory }),
          false,
        )}
        <label className={styles.caseField}>
          Sort order
          <input
            type="number"
            min="0"
            value={content.sortOrder}
            onChange={(e) => changeCase({ sortOrder: Number(e.target.value) })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={content.trainingEligible}
            onChange={(e) => changeCase({ trainingEligible: e.target.checked })}
          />{' '}
          Training eligible
        </label>
        {field('Case vignette', content.vignette, (vignette) => changeCase({ vignette }))}
        {(
          [
            'lowMagnificationObservations',
            'highMagnificationObservations',
            'keyLearningPoints',
          ] as const
        ).map((key, i) => (
          <div key={key}>
            {field(
              [
                'Low-magnification observations (one per line)',
                'High-magnification observations (one per line)',
                'Key learning points (one per line)',
              ][i],
              content[key].join('\n'),
              (value) => changeCase({ [key]: value ? value.split('\n') : [] }),
            )}
          </div>
        ))}
        {(['adequacy', 'cancer'] as const).map((key) => (
          <fieldset key={key}>
            <legend>{key === 'adequacy' ? 'Adequacy' : 'Cancer'} interpretation</legend>
            {field(
              `${key === 'adequacy' ? 'Adequacy' : 'Cancer'} designation`,
              content[key].designation,
              (designation) => changeCase({ [key]: { ...content[key], designation } }),
              false,
            )}
            {field(
              `${key === 'adequacy' ? 'Adequacy' : 'Cancer'} reasoning`,
              content[key].reasoning,
              (reasoning) => changeCase({ [key]: { ...content[key], reasoning } }),
            )}
          </fieldset>
        ))}
        <label>
          <input
            type="checkbox"
            checked={Boolean(content.preliminaryDiagnosis)}
            onChange={(e) =>
              changeCase({
                preliminaryDiagnosis: e.target.checked ? { designation: '', reasoning: '' } : null,
              })
            }
          />{' '}
          Include preliminary diagnosis
        </label>
        {content.preliminaryDiagnosis && (
          <>
            {field(
              'Preliminary diagnosis',
              content.preliminaryDiagnosis.designation,
              (designation) =>
                changeCase({
                  preliminaryDiagnosis: { ...content.preliminaryDiagnosis!, designation },
                }),
              false,
            )}
            {field(
              'Preliminary diagnosis reasoning',
              content.preliminaryDiagnosis.reasoning,
              (reasoning) =>
                changeCase({
                  preliminaryDiagnosis: { ...content.preliminaryDiagnosis!, reasoning },
                }),
            )}
          </>
        )}
        <h3>Annotation / color key</h3>
        <p className={styles.fieldHint}>
          Enter the provider’s reviewed key. No categories or colors are assigned by this
          application.
        </p>
        {content.annotationLegend.entries.map((entry, index) => (
          <fieldset key={index}>
            <legend>Key entry {index + 1}</legend>
            {(['label', 'color', 'explanation'] as const).map((key) => (
              <div key={key}>
                {field(
                  `Key ${index + 1} ${key}`,
                  entry[key],
                  (value) =>
                    changeCase({
                      annotationLegend: {
                        reviewed: false,
                        entries: content.annotationLegend.entries.map((e, i) =>
                          i === index ? { ...e, [key]: value } : e,
                        ),
                      },
                    }),
                  key === 'explanation',
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                changeCase({
                  annotationLegend: {
                    reviewed: false,
                    entries: content.annotationLegend.entries.filter((_, i) => i !== index),
                  },
                })
              }
            >
              Remove key entry {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() =>
            changeCase({
              annotationLegend: {
                reviewed: false,
                entries: [
                  ...content.annotationLegend.entries,
                  { label: 'Pending label', color: '#808080', explanation: '' },
                ],
              },
            })
          }
        >
          Add key entry
        </button>
        <label>
          <input
            type="checkbox"
            checked={content.annotationLegend.reviewed}
            disabled={!content.annotationLegend.entries.length}
            onChange={(e) =>
              changeCase({
                annotationLegend: { ...content.annotationLegend, reviewed: e.target.checked },
              })
            }
          />{' '}
          Annotation key reviewed
        </label>
      </section>
      {privateEnabled && (
        <section className={styles.formSection} aria-label="Internal and study readiness">
          <h2>Internal / study readiness</h2>
          <p>Private authoring fields. Do not enter patient identifiers.</p>
          {field(
            'Internal highlight notes',
            author.internalHighlightNotes,
            (internalHighlightNotes) => changeAuthor({ internalHighlightNotes }),
          )}
          {field('Source / provenance notes', author.provenanceNotes, (provenanceNotes) =>
            changeAuthor({ provenanceNotes }),
          )}
          {(['contentReview', 'imaging', 'secondaryRose'] as const).map((key, i) => (
            <label className={styles.caseField} key={key}>
              {['Content review status', 'Imaging / WSI readiness', 'Secondary ROSE review'][i]}
              <select
                value={readiness[key]}
                onChange={(e) =>
                  changeAuthor({ readiness: { ...readiness, [key]: e.target.value } })
                }
              >
                <option value="incomplete">Incomplete</option>
                <option value="ready">Ready</option>
                <option value="hold">Hold</option>
                {key === 'secondaryRose' && <option value="not-applicable">Not applicable</option>}
              </select>
            </label>
          ))}
          {(['deidentificationVerified', 'identifiersVerified', 'technicalHold'] as const).map(
            (key, i) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={readiness[key]}
                  onChange={(e) =>
                    changeAuthor({ readiness: { ...readiness, [key]: e.target.checked } })
                  }
                />{' '}
                {
                  [
                    'De-identification verified (text and images)',
                    'Image and case label matching verified',
                    'Technical hold',
                  ][i]
                }
              </label>
            ),
          )}
          {field('Protected hold reason / readiness note', readiness.holdReason, (holdReason) =>
            changeAuthor({ readiness: { ...readiness, holdReason } }),
          )}
          <label>
            <input
              type="checkbox"
              checked={content.testingEligible}
              onChange={(e) => changeCase({ testingEligible: e.target.checked })}
            />{' '}
            Testing eligible
          </label>
          <div role="status">
            <strong>{issues.length ? 'Testing blocked' : 'Ready for study activation'}</strong>
            {issues.length > 0 && (
              <ul>
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
          <p className={styles.fieldHint}>
            Eligibility does not activate a case. A study administrator must select a reviewed,
            saved revision for a study round.
          </p>
        </section>
      )}
    </>
  )
}
