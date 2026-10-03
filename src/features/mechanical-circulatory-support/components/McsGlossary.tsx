'use client'

import { mcsFirstUseTerms } from '../content/commonModel'
import { MCS_DEVICE_NAMING } from '../content/deviceNaming'
import { MCS_GLOSSARY_ABBREVIATIONS } from '../content/glossaryAbbreviations'

/**
 * The module's words, in the form a lesson, a case and the hub can all show (F16, F42).
 *
 * The glossary is `mcsFirstUseTerms` — the one the hub has always carried under "Words this module
 * uses" — and this renders that same registry. It adds the two things a learner in the middle of a
 * section also needs to look up: the abbreviations, in the module's own sentences, and the naming
 * crosswalk that says which device names are the same thing and which never are.
 *
 * Plain markup with no module stylesheet, so it reads the same inside the dark lesson stage, the
 * light case pages and a dialog, and so tests can render it without a CSS shim.
 */
export function McsNamingCrosswalk() {
  return (
    <section aria-labelledby="mcs-naming-crosswalk-heading" data-mcs-naming-crosswalk>
      <h3 id="mcs-naming-crosswalk-heading">Device names: which words mean the same thing</h3>
      <p>
        The short name is what buttons and tables use. The mechanism is what the device does. The
        last two columns say which product the cited sources describe and what this simulation
        actually is — they are not always the same.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table data-naming-table>
          <caption style={{ textAlign: 'left' }}>
            Naming crosswalk for the devices in this module
          </caption>
          <thead>
            <tr>
              <th scope="col">Short name</th>
              <th scope="col">Mechanism</th>
              <th scope="col">Also called here</th>
              <th scope="col">Product in the sources</th>
              <th scope="col">What this model is</th>
              <th scope="col">Not the same as</th>
            </tr>
          </thead>
          <tbody>
            {MCS_DEVICE_NAMING.map((row) => (
              <tr key={row.id} data-naming-row={row.id}>
                <th scope="row">{row.shortLabel}</th>
                <td>{row.mechanism}</td>
                <td>{row.alsoCalled.join(' · ')}</td>
                <td>{row.productIdentity}</td>
                <td>{row.modelIdentity}</td>
                <td>
                  {row.notTheSameAs}
                  {row.openItem ? (
                    <>
                      {' '}
                      <em data-naming-open-item>Unresolved: {row.openItem}</em>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function McsGlossary() {
  return (
    <div data-mcs-glossary>
      <section aria-labelledby="mcs-glossary-terms-heading" data-glossary-terms>
        <h3 id="mcs-glossary-terms-heading">Words this module uses</h3>
        <dl>
          {mcsFirstUseTerms.map((term) => (
            <div key={term.id} data-term-id={term.id}>
              <dt>
                <strong>{term.term}</strong>
              </dt>
              <dd>
                {term.definition} <em>Misleads when:</em> {term.howItMisleads}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="mcs-glossary-abbreviations-heading" data-glossary-abbreviations>
        <h3 id="mcs-glossary-abbreviations-heading">Abbreviations</h3>
        <dl>
          {MCS_GLOSSARY_ABBREVIATIONS.map((entry) => (
            <div key={entry.abbreviation} data-abbreviation={entry.abbreviation}>
              <dt>
                <strong>{entry.abbreviation}</strong> — {entry.expansion}
              </dt>
              <dd>{entry.note}</dd>
            </div>
          ))}
        </dl>
      </section>
      <McsNamingCrosswalk />
    </div>
  )
}
