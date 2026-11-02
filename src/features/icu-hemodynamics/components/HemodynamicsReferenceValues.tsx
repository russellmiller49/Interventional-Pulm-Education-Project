import type { ReactNode } from 'react'

import {
  HEMODYNAMICS_NUMBERS,
  HEMODYNAMICS_OBSTRUCTIVE_PATTERNS,
  HEMODYNAMICS_SHOCK_PROFILES,
  HEMODYNAMICS_SHOCK_PROFILE_SOURCE,
  type HemodynamicsNumberId,
} from '../content/teachingNumbers'

/** The author named in each short citation, keyed by the register's source id. */
const HEMODYNAMICS_NUMBER_SOURCE_NAMES: Readonly<Record<string, string>> = {
  'pac-waveforms-part-1-2021': 'Bootsma, part 1',
  'pac-derived-part-2-2021': 'Bootsma, part 2',
  'pac-review-2014': 'Whitener',
  'emcrit-rhc-supplied-2026': 'EMCrit right heart catheterization',
  'TEXT-AHM-2021-CH6-PATD': 'Zitzmann, Advanced Hemodynamic Monitoring',
  'TEXT-AHM-2021-CH24-CS': 'Grigoryev, Advanced Hemodynamic Monitoring',
  'TEXT-ESICM-HM-2019-CH2-SHOCK': 'Pinsky, Hemodynamic Monitoring',
  'TEXT-RAGOSTA-3E-CO': 'Ragosta, Textbook of Clinical Hemodynamics',
  'TEXT-RAGOSTA-3E-CH10-PERICARDIAL': 'Ragosta, Textbook of Clinical Hemodynamics',
  'TEXT-RAGOSTA-3E-CH11-SHOCK': 'Taylor, Textbook of Clinical Hemodynamics',
  'TEXT-ESICM-HM-2019-CH24-FLUID': 'Monnet and Teboul, Hemodynamic Monitoring',
  'TEXT-ESICM-HM-2019-CH33-SEPSIS': 'Martin, Hemodynamic Monitoring',
  'TEXT-AHM-2021-CH17-DYNAMIC': 'Monnet and Teboul, Advanced Hemodynamic Monitoring',
  'TEXT-GIRAUD-ICU-2016-CH3': 'Giraud and Bendjelid, Hemodynamic Monitoring in the ICU',
  'LIT-MONNET-2015-PLR-RULES': 'Monnet and Teboul',
  'LIT-MONNET-2016-PLR-META': 'Monnet, Marik and Teboul',
}

function citation(sources: readonly { readonly sourceId: string; readonly year: number }[]) {
  return sources
    .map(
      (source) =>
        `${HEMODYNAMICS_NUMBER_SOURCE_NAMES[source.sourceId] ?? source.sourceId} ${source.year}`,
    )
    .join('; ')
}

const BOX_CLASS = 'mt-3 min-w-0 rounded-xl border px-3 py-2 text-xs leading-5'

/**
 * The numbers a fellow holds a live reading or a procedure step against, each with its source.
 *
 * It sits beside the values or steps it applies to. Every figure comes from the numbers register;
 * where two sources differ, the row's note says which gives which.
 */
export function HemodynamicsReferenceValues({
  title,
  ids,
  children,
}: {
  readonly title: string
  readonly ids: readonly HemodynamicsNumberId[]
  readonly children?: ReactNode
}) {
  return (
    <section className={BOX_CLASS} data-reference-values>
      <h4 className="text-xs font-semibold">{title}</h4>
      <dl className="mt-1 grid gap-1">
        {ids.map((id) => {
          const row = HEMODYNAMICS_NUMBERS.get(id)
          return (
            <div key={id} data-teaching-number={id}>
              <dt className="inline font-medium">{row.label}: </dt>
              <dd className="inline">
                <strong>{row.value}</strong>
                {row.note ? ` ${row.note}` : ''} <small>({citation(row.sources)})</small>
              </dd>
            </div>
          )
        })}
      </dl>
      {children}
    </section>
  )
}

const CELL_CLASS = 'border-t px-2 py-1 text-left align-top'

export type HemodynamicsShockProfileId = (typeof HEMODYNAMICS_SHOCK_PROFILES)[number]['id']
export type HemodynamicsObstructiveCauseId =
  (typeof HEMODYNAMICS_OBSTRUCTIVE_PATTERNS)[number]['id']

/**
 * The four shock profiles as the pulmonary-artery catheter shows them, with the first move for
 * each, the cardiogenic-shock criterion and the usual vasoactive dose ranges.
 *
 * `highlight` marks the row a Practice case belongs to, and `highlightCause` the obstructive
 * pattern it shows.
 */
export function HemodynamicsShockProfiles({
  highlight,
  highlightCause,
  doses = true,
}: {
  readonly highlight?: HemodynamicsShockProfileId | null
  readonly highlightCause?: HemodynamicsObstructiveCauseId | null
  readonly doses?: boolean
}) {
  return (
    <section className={BOX_CLASS} data-shock-profiles>
      <h4 className="text-xs font-semibold">Shock profiles</h4>
      <div className="overflow-x-auto">
        <table className="mt-1 w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={CELL_CLASS}>
                Profile
              </th>
              <th scope="col" className={CELL_CLASS}>
                Cardiac output
              </th>
              <th scope="col" className={CELL_CLASS}>
                Filling pressures
              </th>
              <th scope="col" className={CELL_CLASS}>
                SVR
              </th>
              <th scope="col" className={CELL_CLASS}>
                SvO₂
              </th>
              <th scope="col" className={CELL_CLASS}>
                First move
              </th>
            </tr>
          </thead>
          <tbody>
            {HEMODYNAMICS_SHOCK_PROFILES.map((profile) => (
              <tr
                key={profile.id}
                data-shock-profile={profile.id}
                data-current={profile.id === highlight ? 'true' : undefined}
                className={profile.id === highlight ? 'font-semibold' : undefined}
              >
                <th scope="row" className={CELL_CLASS}>
                  {profile.label}
                  {profile.id === highlight ? ' (this case)' : ''}
                </th>
                <td className={CELL_CLASS}>{profile.cardiacOutput}</td>
                <td className={CELL_CLASS}>{profile.fillingPressures}</td>
                <td className={CELL_CLASS}>{profile.systemicVascularResistance}</td>
                <td className={CELL_CLASS}>{profile.mixedVenousSaturation}</td>
                <td className={CELL_CLASS}>{profile.firstMove}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1">
        <small>
          ({citation([HEMODYNAMICS_SHOCK_PROFILE_SOURCE])};{' '}
          {HEMODYNAMICS_SHOCK_PROFILE_SOURCE.locator})
        </small>
      </p>
      <div className="mt-2" data-obstructive-patterns>
        <h5 className="text-xs font-semibold">Obstructive shock, one side at a time</h5>
        <p>A high RAP does not mean the left ventricle is full.</p>
        <ul className="mt-1 grid gap-1">
          {HEMODYNAMICS_OBSTRUCTIVE_PATTERNS.map((pattern) => (
            <li
              key={pattern.id}
              data-obstructive-pattern={pattern.id}
              data-current={pattern.id === highlightCause ? 'true' : undefined}
              className={pattern.id === highlightCause ? 'font-semibold' : undefined}
            >
              <strong>
                {pattern.label}
                {pattern.id === highlightCause ? ' (this case)' : ''}:
              </strong>{' '}
              {pattern.reading} {pattern.why} <small>({citation(pattern.sources)})</small>
            </li>
          ))}
        </ul>
      </div>
      {doses ? (
        <>
          <HemodynamicsReferenceValues
            title="Cardiogenic shock and fluid responsiveness"
            ids={['cardiogenic-shock-ci', 'cardiac-index-range', 'fluid-responsiveness']}
          />
          <HemodynamicsReferenceValues
            title="Passive leg raise"
            ids={['plr-position', 'plr-response', 'plr-timing', 'cco-response-time']}
          />
          <HemodynamicsReferenceValues
            title="Vasoactive drugs: usual dose ranges"
            ids={[
              'norepinephrine-dose',
              'vasopressin-dose',
              'epinephrine-dose',
              'dobutamine-dose',
              'milrinone-dose',
            ]}
          />
        </>
      ) : null}
    </section>
  )
}
