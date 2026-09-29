import { pleuralZone } from '../../content/pleuralZones'
import styles from './space-pane.module.css'
import { LEDGER_WORDS, ledgerWords } from './spaceWords'
import { ledgerProblems, spaceControlId, type ZoneLedger as Ledger } from './types'

/**
 * The model's estimate for each survey region, in the survey order, in the survey section's words.
 * No number and no total: seeing every region is not an adequate examination, and the model cannot
 * tell a glimpse from a careful look (learning contract; owner decisions, T12). A ledger that breaks
 * the contract is refused rather than shown.
 */
export function ZoneLedger({
  ledger,
  inView,
}: {
  readonly ledger: Ledger
  readonly inView: readonly string[]
}) {
  const problems = ledgerProblems(ledger)
  if (problems.length > 0)
    throw new Error(`The zone ledger breaks the contract: ${problems.join(' ')}`)
  const headingId = spaceControlId('ledger-heading')
  return (
    <section className={styles.ledger} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.ledgerHeading}>
        {LEDGER_WORDS.heading}
      </h3>
      <p className={styles.ledgerCaption}>{LEDGER_WORDS.caption}</p>
      <table className={styles.ledgerTable}>
        <thead>
          <tr>
            <th scope="col">{LEDGER_WORDS.regionColumn}</th>
            <th scope="col">{LEDGER_WORDS.estimateColumn}</th>
          </tr>
        </thead>
        <tbody>
          {ledger.map((entry) => (
            <tr
              key={entry.zone}
              data-zone={entry.zone}
              data-seen={entry.seen}
              data-in-view={inView.includes(entry.zone)}
            >
              <th scope="row">{pleuralZone(entry.zone).name}</th>
              <td>{ledgerWords(entry)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
