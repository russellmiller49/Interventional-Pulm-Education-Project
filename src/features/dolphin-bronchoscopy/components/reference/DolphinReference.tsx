'use client'

import { teachingNumberCitationLine } from '@/features/learning-module/numbers/teachingNumbers'
import { Link } from '@/i18n/navigation'

import { DOLPHIN_SOURCES, dolphinSourceLabel } from '../../data/sources'
import { DOLPHIN_BRANCH_MAP } from '../../content/branchMap'
import { DOLPHIN_DECISIONS } from '../../content/decisions'
import { DOLPHIN_REPORT_TEMPLATES } from '../../content/reportForm'
import { DOLPHIN_ANATOMY_HREF, DOLPHIN_SIMULATOR_HREF } from '../../content/routes'
import { DOLPHIN_NUMBERS } from '../../content/teachingNumbers'
import { DOLPHIN_TROUBLE_GRAMMAR } from '../../content/troubleGrammar'
import styles from '../stage/dolphin-stage.module.css'

/**
 * The reference shelf: the branch map, the record, the five decisions, the trouble grammar, every
 * number with its source, and the sources. Everything here is also taught in a section; this is the
 * page to come back to.
 */
export function DolphinReference() {
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Reference</p>
        <h1 className="text-3xl font-bold tracking-tight">
          The map, the record and the first moves
        </h1>
        <p>
          The same tables the sections teach from. Open the{' '}
          <Link href={DOLPHIN_SIMULATOR_HREF} className="underline">
            full synchronized bronchoscopy
          </Link>{' '}
          or the{' '}
          <Link href={DOLPHIN_ANATOMY_HREF} className="underline">
            3D dolphin
          </Link>{' '}
          beside it.
        </p>
      </header>

      <section aria-labelledby="ref-branch-map" className="grid gap-3" data-reference-branch-map>
        <h2 id="ref-branch-map" className="text-xl font-semibold">
          The branch map
        </h2>
        <p>
          Names follow the U.S. Navy Marine Mammal Program and National Marine Mammal Foundation
          guide. A number counts order from the carina; it says nothing about direction, which
          varies between animals. Directions and distances below are this module’s CT; variation is
          from the ten-animal mapping series (five of each sex, in preparation).
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Airway</th>
                <th scope="col">Leaves</th>
                <th scope="col">On this CT</th>
                <th scope="col">Across the ten dolphins</th>
              </tr>
            </thead>
            <tbody>
              {DOLPHIN_BRANCH_MAP.map((entry) => (
                <tr key={entry.id} data-branch={entry.abbr} data-present={entry.thisCt.present}>
                  <th scope="row">
                    {entry.abbr}
                    <br />
                    <small>{entry.guideName}</small>
                  </th>
                  <td>{entry.parent ?? '—'}</td>
                  <td>
                    {entry.thisCt.present
                      ? [
                          entry.thisCt.direction,
                          entry.thisCt.fromCarinaMm !== undefined
                            ? `${Math.round(entry.thisCt.fromCarinaMm)} mm from the carina`
                            : null,
                          entry.arisesWith ? `arises with ${entry.arisesWith}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Present'
                      : 'Not on this CT'}
                  </td>
                  <td>{entry.variation.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ref-record" className="grid gap-3" data-reference-record>
        <h2 id="ref-record" className="text-xl font-semibold">
          The record
        </h2>
        {Object.values(DOLPHIN_REPORT_TEMPLATES).map((template) => (
          <div key={template.id} className={styles.block}>
            <h3>{template.title}</h3>
            <p>{template.status}</p>
            <p>
              Sites: {template.sites.map((site) => site.abbr).join(', ')}. Lavage:{' '}
              {template.recordsInstilled
                ? 'volume instilled and returned'
                : 'fluid volume returned'}{' '}
              ({template.balReturnEntries} entries). Every site gets a line, including “not
              reached”.
            </p>
          </div>
        ))}
      </section>

      <section aria-labelledby="ref-decisions" className="grid gap-3" data-reference-decisions>
        <h2 id="ref-decisions" className="text-xl font-semibold">
          The five decisions
        </h2>
        <ol className="grid gap-2 pl-5">
          {DOLPHIN_DECISIONS.map((decision) => (
            <li key={decision.id}>
              <strong>{decision.title}.</strong> {decision.question}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="ref-trouble" className="grid gap-3" data-reference-trouble>
        <h2 id="ref-trouble" className="text-xl font-semibold">
          When something changes: earliest sign and first moves
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Where</th>
                <th scope="col">What changes</th>
                <th scope="col">Earliest sign</th>
                <th scope="col">First moves, in order</th>
              </tr>
            </thead>
            <tbody>
              {DOLPHIN_TROUBLE_GRAMMAR.map((row) => (
                <tr key={row.id} data-trouble-row={row.id}>
                  <td>{row.step}</td>
                  <td>{row.change}</td>
                  <td>{row.earliestSign}</td>
                  <td>
                    <ol className="pl-4">
                      {row.firstMoves.map((move) => (
                        <li key={move}>{move}</li>
                      ))}
                    </ol>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ref-numbers" className="grid gap-3" data-reference-numbers>
        <h2 id="ref-numbers" className="text-xl font-semibold">
          Numbers and where they come from
        </h2>
        <p>
          Where sources differ, both are given. Drugs without a published dose here — oral
          premedication, furosemide, albuterol — are given per the NMMP protocol.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Value</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {DOLPHIN_NUMBERS.rows.map((row) => (
                <tr key={row.id} data-number={row.id}>
                  <td>
                    {row.label}
                    {row.appliesTo ? (
                      <>
                        <br />
                        <small>{row.appliesTo}</small>
                      </>
                    ) : null}
                  </td>
                  <td>{row.value}</td>
                  <td>
                    {teachingNumberCitationLine(row, dolphinSourceLabel)}
                    {row.note ? (
                      <>
                        <br />
                        <small>{row.note}</small>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ref-sources" className="grid gap-3" data-reference-sources>
        <h2 id="ref-sources" className="text-xl font-semibold">
          Sources
        </h2>
        <ul className="grid list-disc gap-2 pl-5">
          {DOLPHIN_SOURCES.map((source) => (
            <li key={source.id}>{source.citation}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
