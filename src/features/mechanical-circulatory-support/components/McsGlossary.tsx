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
        The short name is what buttons and tables use, and the mechanism in brackets is what the
        device does. Each entry also says which product the cited sources describe and what this
        simulation actually is — they are not always the same.
      </p>
      {/*
       * One block per device rather than a six-column table: the same six facts, readable at a
       * phone width and at 200% text without scrolling sideways inside a dialog.
       */}
      <div data-naming-table>
        {MCS_DEVICE_NAMING.map((row) => (
          <div key={row.id} data-naming-row={row.id}>
            <h4>
              {row.shortLabel} <span>({row.mechanism})</span>
            </h4>
            <dl>
              <div>
                <dt>Also called here</dt>
                <dd>{row.alsoCalled.join(' · ')}</dd>
              </div>
              <div>
                <dt>Product in the sources</dt>
                <dd>{row.productIdentity}</dd>
              </div>
              <div>
                <dt>What this model is</dt>
                <dd>{row.modelIdentity}</dd>
              </div>
              <div>
                <dt>Not the same as</dt>
                <dd>{row.notTheSameAs}</dd>
              </div>
              {row.openItem ? (
                <div data-naming-open-item>
                  <dt>Unresolved</dt>
                  <dd>{row.openItem}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ))}
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
