import { MCS_NUMBERS } from './teachingNumbers'
/**
 * The abbreviations a lesson uses, for the in-lesson glossary (F42).
 *
 * The module's glossary is `mcsFirstUseTerms` in `commonModel.ts`, and it stays the only one. These
 * rows are not a second set of definitions: each is the sentence the guided introductions already
 * use where the abbreviation is first met, repeated here so a learner who lands mid-section can
 * find it. `mcs-pre-review-04` tests hold the four that have an introduction sentence to that
 * sentence, so the two cannot drift apart.
 */

export interface McsGlossaryAbbreviation {
  readonly abbreviation: string
  readonly expansion: string
  /** The module's own sentence about it, unchanged. */
  readonly note: string
}

export const MCS_GLOSSARY_ABBREVIATIONS: readonly McsGlossaryAbbreviation[] = Object.freeze([
  {
    abbreviation: 'MAP',
    expansion: 'Mean arterial pressure',
    note: 'A pressure at a measurement site. Pressure does not measure flow.',
  },
  {
    abbreviation: 'RAP',
    expansion: 'Right atrial pressure',
    note: 'Neither is a direct volume measurement.',
  },
  {
    abbreviation: 'PAWP (PCWP, wedge)',
    expansion: 'Pulmonary artery wedge pressure',
    note: 'Used to assess left-sided filling pressure with the appropriate measurement conditions. Neither is a direct volume measurement.',
  },
  {
    abbreviation: 'SvO2',
    expansion: 'Mixed venous oxygen saturation',
    note: 'It reflects the balance between oxygen delivery and consumption, and is not a direct oxygen-delivery measurement.',
  },
  {
    abbreviation: 'PAPi',
    expansion: 'Pulmonary artery pulsatility index: pulmonary artery pulse pressure divided by RAP',
    note: 'It is a derived right-heart assessment variable, not a flow or a universal treatment target.',
  },
  {
    abbreviation: 'SVR',
    expansion: 'Systemic vascular resistance',
    note: 'A simulated patient condition here.',
  },
  {
    abbreviation: 'CPO',
    expansion: 'Cardiac power output',
    note: 'It is a pressure–flow product, distinct from pump electrical power and oxygen delivery.',
  },
  {
    abbreviation: 'PI',
    expansion: 'Pulsatility index',
    note: `How much the flow through the pump swings with each heartbeat: ${MCS_NUMBERS.value('lvad-pulsatility-index')}. It falls when the ventricle is underfilled or the speed is raised, and rises with afterload and as the ventricle recovers.`,
  },
  {
    abbreviation: 'P-level',
    expansion: 'Performance level of a microaxial pump',
    note: 'Performance level is a setting. CP and 5.5 use different device models; the same level is not an equivalent clinical dose.',
  },
])
