import { EXAMINATION_CASE } from '../content/examination-cases'
import styles from './course.module.css'

const PHASES = [
  ['rose', 'ROSE'],
  ['final', 'Final pathology'],
  ['ancillary', 'Ancillary studies'],
] as const

/**
 * The running case's specimens, drawn from the case itself (EBUS-PRE-REVIEW-04, L22-6).
 *
 * The generic "specimen → smears / ROSE → cell block → ancillary" boxes are replaced by what the
 * written case the record tasks use actually supplies: each specimen, its station and node, the
 * studies requested for it and each supplied result by phase. Where the case supplies nothing for
 * a phase the figure says exactly that. No diagnosis, stage, destination or management step is
 * inferred; the record tasks that follow show the same supplied history.
 */
export function CaseSpecimens() {
  const caseData = EXAMINATION_CASE
  return (
    <section className={styles.figure} data-case-specimens aria-labelledby="ebus-case-specimens">
      <h2 id="ebus-case-specimens">Running case: the supplied specimens</h2>
      <p className={styles.muted}>
        {caseData.title}. Every entry is supplied case history from the written case the record
        tasks use; none of it is a result of yours.
      </p>
      <div className={styles.caseSpecimens}>
        {caseData.specimens.map((specimen) => {
          const node = caseData.nodes.find((entry) => entry.id === specimen.nodeId)
          return (
            <section
              key={specimen.id}
              className={styles.recordCard}
              data-case-specimen={specimen.id}
            >
              <h3>{specimen.label}</h3>
              <dl>
                <dt>Station and node</dt>
                <dd>{node?.label ?? 'Station ' + specimen.stationId}</dd>
                <dt>Requested studies</dt>
                <dd>{specimen.requestedTests.map((test) => test.name).join('; ')}</dd>
                {PHASES.map(([phase, name]) => {
                  const result = caseData.results.find(
                    (entry) => entry.specimenId === specimen.id && entry.phase === phase,
                  )
                  return [
                    <dt key={phase + '-t'}>{name}</dt>,
                    <dd key={phase + '-d'}>
                      {result ? result.text : 'No entry for this specimen in the case.'}
                    </dd>,
                  ]
                })}
              </dl>
            </section>
          )
        })}
      </div>
    </section>
  )
}
