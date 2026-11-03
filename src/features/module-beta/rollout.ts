import type { BetaModule } from './catalog'

/*
 * Which hub modules are ready for outside reviewers, and what a reviewer should know first.
 *
 * This is presentation only. Every module in the catalog stays listed and opens the same way
 * whatever its stage; the stage decides which heading it sits under on the hub page. Kept out of
 * `catalog.ts` because that file is bundled into the proxy and the testing frame.
 *
 * A module moves to `ready` when it clears the gate in `docs/gap-remediation/beta-finish-line.md`.
 * A `preview` module may already carry its reviewer note; that changes what its card says, not
 * its heading. Which modules have one, and why, is in
 * `docs/gap-remediation/beta-reviewer-readiness-2026-11-03.md`.
 */

export interface BetaTesterNote {
  /** Who the module is written for. */
  readonly audience: string
  /** One sentence on what the module teaches. */
  readonly summary: string
  /**
   * Time to go through it once, counted from the module's own sections, tasks and cases. Left out
   * where the structure gives no basis, as for a reference tool.
   */
  readonly estimate?: { readonly minutes: number; readonly basis: string }
  /** Where a reviewer's feedback helps most. */
  readonly lookFor: readonly string[]
  /** Anything known to be unchecked or unfinished that a reviewer should weigh. */
  readonly knownLimits: readonly string[]
}

export type BetaRolloutEntry =
  | { readonly stage: 'preview'; readonly note?: BetaTesterNote }
  | { readonly stage: 'ready'; readonly note: BetaTesterNote }

export type BetaRollout = Readonly<Record<BetaModule['id'], BetaRolloutEntry>>

export const betaRollout: BetaRollout = {
  'ebus-guided': {
    stage: 'preview',
    note: {
      audience: 'Early pulmonary fellows learning EBUS-TBNA.',
      summary:
        'A systematic approach to EBUS-TBNA: get the image, find the station, plan the sample, and read what the result can and cannot tell you.',
      estimate: {
        minutes: 227,
        basis: "26 lessons (202 minutes by the course's own count) and about 25 minutes of cases",
      },
      lookFor: [
        'Whether the landmarks used to call each station are the ones you teach at the bedside.',
        'The bleeding and desaturation first moves: their order and the numbers attached to them.',
        'The find-the-structure task: whether it asks for the structures you would expect a fellow to identify, and whether the hint after a wrong pick helps.',
      ],
      knownLimits: [
        'Its 13 sourced teaching numbers are not yet signed off by the author.',
        'The bleeding sequence is written from practice rather than a cited source, and the AQuIRE figures were checked against the abstract only.',
        'Lesson 16 describes node features in words; the ultrasound stills that would show them are not yet cleared for use.',
        'The labs need a desktop or tablet; below about 1,100 px wide they fall back to a reading layout.',
      ],
    },
  },
  'eus-b-simulator': { stage: 'preview' },
  'synchronized-anatomy': {
    stage: 'preview',
    note: {
      audience: 'Fellows learning segmental airway anatomy and its CT correlation.',
      summary:
        'One scope-tip position drives the virtual bronchoscopy, a transparent 3D airway tree and axial, coronal and sagittal CT, so each branch choice ties a segmental name to the CT.',
      lookFor: [
        'Whether the scope view, the 3D tree and the CT agree at each branch point, and whether the orientation reads the way you hold the scope.',
        'Bronch Quest: after a wrong turn, whether the debrief names the fork and the landmark you would use to recover.',
      ],
      knownLimits: [
        'The VR view has not been confirmed in a headset since the Quest 3 black-screen fix.',
        'After a wrong turn, some forks have no CT cue yet: RB1 against RB2 and RB3, RB6, RB7 against the basal trunk, and LB6.',
        'The Scope Tracker toggle is for a physical scope controller; leave it off.',
      ],
    },
  },
  'branch-tracing': { stage: 'preview' },
  'live-anatomy': { stage: 'preview' },
  'peripheral-imaging': {
    stage: 'preview',
    note: {
      audience:
        'Pulmonary and interventional pulmonology fellows, bronchoscopists, and the radiologic technologists and imaging team who support them.',
      summary:
        'Imaging for peripheral bronchoscopy in one order: decide whether the lesion can be seen before the first frame, then fluoroscopy, tomosynthesis, cone-beam CT, confirmation and dose.',
      estimate: { minutes: 207, basis: "19 sections, by the module's own count" },
      lookFor: [
        'Section 4, setting up before the first image: routine recruitment with anesthesia, and positioning the lesion side up.',
        'The angle rules and the Section 19 wedge run-through, taken from the AABIP imaging session.',
        'Whether the simulated check images in Sections 4 and 16 look like what your suite produces.',
      ],
      knownLimits: [
        'Its 14 sourced teaching numbers are not yet signed off by the author.',
        'The CONFIRM, VESPA and radial EBUS yield figures were checked against abstracts only, and the nodule-visibility figure comes from percutaneous, not bronchoscopic, biopsy.',
        'Radial EBUS views are taught in text and a table, without images.',
      ],
    },
  },
  'bronchoscopy-foundations': {
    stage: 'preview',
    note: {
      audience:
        'Trainees preparing for supervised flexible bronchoscopy; general clinical knowledge is assumed, scope experience is not.',
      summary:
        'One adult flexible bronchoscopy in fifteen short sections: plan it, prepare the scope and the patient, drive to the carina, survey both lungs, sample, and respond when something goes wrong.',
      estimate: {
        minutes: 152,
        basis: "15 sections, by the module's own count; the eight integrated cases are extra",
      },
      lookFor: [
        'Sedation and topical anesthesia in Section 3: the lidocaine ceiling and the monitoring it teaches.',
        "The orientation rule and the landmark clock table at the head of the bed (RUL 3, RML 12, LUL 9 o'clock).",
        'Sections 13 and 15, the deteriorating and the ventilated patient: are the first moves the ones you want a fellow to make?',
      ],
      knownLimits: [
        '62 of its 75 teaching numbers, the lidocaine ceiling among them, are not yet signed off by the author.',
        'The orientation rule and the clock table are derived for the bedside views; no published source states them.',
        'An unreachable segment is taught and asked about but not practised in the simulator.',
      ],
    },
  },
  'dolphin-bronchoscopy': { stage: 'preview' },
  devices: { stage: 'preview' },
  'literature-atlas': { stage: 'preview' },
  'cardiohelp-ecmo': { stage: 'preview' },
  'baxter-crrt': { stage: 'preview' },
  'icu-hemodynamics': { stage: 'preview' },
  'mechanical-ventilation': {
    stage: 'preview',
    note: {
      audience: 'Fellows learning to set and troubleshoot the ventilator in the ICU.',
      summary:
        'Fourteen short sections on a running ventilator: one breath from start to finish, the five main settings, then one mechanism at a time on a live patient: predict, change, watch, explain.',
      estimate: {
        minutes: 102,
        basis: "14 sections, by the module's own count; the 15 cases in Practice are extra",
      },
      lookFor: [
        'Driving pressure: whether plateau minus total PEEP, and the evidence behind the reference value, are taught the way you would teach them.',
        'Whether any simulated response looks implausible to you; one case reaches an intrinsic PEEP near 34 cmH₂O.',
      ],
      knownLimits: [
        'Its 20 sourced teaching numbers are not yet signed off by the author.',
        'The console has no live driving-pressure readout; it is worked out from the plateau and total PEEP.',
        'The text does not yet separate the pressure-control setting (ΔPcontrol) from driving pressure (ΔP).',
        'The chest-wall contribution to driving pressure (obesity, raised abdominal pressure) is not taught.',
      ],
    },
  },
  'mechanical-circulatory-support': { stage: 'preview' },
}
