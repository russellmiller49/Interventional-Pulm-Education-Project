import { CAPSTONE_CONCLUSION, CAPSTONE_STATIONS } from '../content/capstone'
import { contentById } from '../content/curriculum'
import styles from './staging-record.module.css'

/*
 * The capstone's last page (2026-11-11): the examination the learner has just carried out, as the
 * record a report is written from. One line per station in the order it was sampled: its category
 * for this primary, whether the learner held an image of it, how their two checks went, and what
 * its sample showed on site. It reads the session; nothing on it is stored.
 */
export function StagingRecord({
  scanned,
  answers,
}: {
  /** Whether the learner held an image at this station's scan. */
  scanned: (unitId: string) => boolean
  /** Check id → the choice the learner committed to. */
  answers: Record<string, string>
}) {
  const report = contentById('staging-examination')!.transfer
  const reported = report.choices.find((choice) => choice.id === answers[report.id])
  return (
    <div className={styles.record} data-staging-record>
      <p className={styles.case}>
        Right upper lobe primary. Systematic nodal staging by EBUS, sampled from the highest N
        category to the lowest.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Station</th>
            <th scope="col">Category</th>
            <th scope="col">Your scan</th>
            <th scope="col">Your checks</th>
            <th scope="col">On-site result</th>
          </tr>
        </thead>
        <tbody>
          {CAPSTONE_STATIONS.map((entry, index) => {
            const unit = contentById(entry.unitId)!
            const checks = [unit.observation, unit.question]
            const answered = checks.filter((check) => answers[check.id])
            const correct = answered.filter(
              (check) => check.choices.find((choice) => choice.id === answers[check.id])?.correct,
            )
            return (
              <tr key={entry.unitId} data-station={entry.station}>
                <td>{index + 1}</td>
                <th scope="row">
                  {entry.station}
                  <span>{entry.name}</span>
                </th>
                <td>
                  <span className={styles.category} data-category={entry.category}>
                    {entry.category}
                  </span>
                </td>
                <td data-scan>{scanned(entry.unitId) ? 'Image held' : 'No image held'}</td>
                <td data-checks>
                  {answered.length
                    ? correct.length + ' of ' + checks.length + ' correct'
                    : 'Not answered'}
                </td>
                <td>{entry.finding}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className={styles.conclusion}>
        <strong>Conclusion.</strong> {CAPSTONE_CONCLUSION}
      </p>
      <p className={styles.yours} data-your-report>
        <strong>Your report statement.</strong>{' '}
        {reported ? reported.text + '.' : 'You moved on without choosing one.'}
        {reported && !reported.correct ? ' Compare it with the conclusion above.' : ''}
      </p>
    </div>
  )
}
