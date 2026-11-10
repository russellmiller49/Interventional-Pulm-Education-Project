import { betaModules, type BetaModule } from './catalog'

/*
 * Which hub modules are ready for outside reviewers, and what a reviewer should know first.
 *
 * This is presentation only. The stage decides which heading a module sits under on the hub page,
 * or, for `withheld`, that the hub does not list it. A withheld module keeps its catalog entry, so
 * its past feedback stays reviewable and its feedback wrapper still opens by address; admins reach
 * the module itself from Admin › Modules in development (`src/lib/non-public-modules.ts`). Kept out of
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
  /** Off the hub page by the owner's decision (2026-11-04); not offered to reviewers. */
  | { readonly stage: 'withheld'; readonly note?: undefined }

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
        'Its 22 sourced teaching numbers are not yet signed off by the author.',
        'The bleeding sequence is written from practice rather than a cited source, and the AQuIRE figures were checked against the abstract only.',
        'The labs need a desktop or tablet; below about 1,100 px wide they fall back to a reading layout.',
      ],
    },
  },
  'eus-b-simulator': {
    stage: 'preview',
    note: {
      audience:
        'Pulmonary and interventional pulmonology fellows and bronchoscopists who already perform airway EBUS-TBNA.',
      summary:
        'The EBUS scope passed down the esophagus on one CT case: find 19 views, seven lymph node stations (2L, 4L, 5, 6, 7, 8 and 9), four mediastinal vessels and chambers, and eight structures below the diaphragm, by exploring freely or on a find-the-target task.',
      lookFor: [
        'Whether each station view, 8 and 9 especially, shows the landmarks you would use to call it from the esophagus.',
        'Whether the transducer orientation and the image read the way your EUS-B images do.',
        'Whether the views below the diaphragm (liver, celiac trunk, left adrenal) belong in a module for bronchoscopists.',
      ],
      knownLimits: [
        'The ultrasound image and the controls that move the scope do not fit on one screen at common laptop and phone sizes; expect to scroll between them.',
        'It is one CT case, and the image is simulated from CT, not recorded ultrasound; the page lists the model’s other limits.',
        'There are no lessons, cases or scored questions yet: it is a free-exploration simulator.',
        'Its teaching notes are not yet signed off by the author.',
      ],
    },
  },
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
  'branch-tracing': {
    stage: 'preview',
    note: {
      audience: 'PCCM and interventional pulmonology fellows and practicing bronchoscopists.',
      summary:
        "Seven lessons on reaching a peripheral lesion by Mortimer and Saghaie's simplified branch tracing: plan the route on the CT from the lesion back to its segment, map the segment's ostium and each division to the lesion as nested arcs, then drive the scope with the map beside it, with coronal and sagittal views and backing out of a branch that leads away. The scope flies through the central airways; an optional three-fork check and two refresher lessons cover reading the CT against the scope.",
      estimate: {
        minutes: 61,
        basis:
          "7 lessons, by the module's own count; the optional orientation check, the two refreshers, the 13 practice lesions and the 3-lesion closing set are extra",
      },
      lookFor: [
        'The orientation check at the start, turning the CT to face the scope at three forks, and whether the orientation reads the way you hold the scope.',
        'Lessons 1 to 3, planning from the lesion: whether naming the segment, the ostium circle and the arcs read the way you plan a route to a peripheral lesion.',
        'Lesson 4, the drive: whether flying through the central airways and starting the choices where the segment’s bronchus leaves is where you want the work to begin, and whether backing out of a branch that leads away looks and feels like what you do at the scope.',
        'Whether the lesions in Practice are ones you would plan a navigation route to.',
      ],
      knownLimits: [
        'The CT slice used for the first fork is not yet confirmed by the author.',
        'Only lessons 1 and 2 ask for the openings to be marked on the CT; on whole routes the CT is read while planning, and each fork asks only for the branch.',
        "The model map does not yet draw the next generation inside the branches the route does not take, the method's tip for recognizing a branch that leads away.",
      ],
    },
  },
  'live-anatomy': { stage: 'withheld' },
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
  'dolphin-bronchoscopy': { stage: 'withheld' },
  devices: { stage: 'withheld' },
  'literature-atlas': { stage: 'withheld' },
  'cardiohelp-ecmo': {
    stage: 'preview',
    note: {
      audience: 'Fellows and ICU clinicians learning to run adult VV and peripheral VA ECMO.',
      summary:
        'Adult VV and peripheral VA ECMO on a simulated CARDIOHELP circuit: the console and its pressures first, then one problem at a time (a falling flow, the two pressures, the flow against the patient, CO₂, a stopped pump or lost power) and an integrated case on each track.',
      estimate: {
        minutes: 172,
        basis:
          "17 sections on the VV track, by the module's own count (180 minutes on the VA track); the seven practice cases on each track are extra",
      },
      lookFor: [
        'Reading a falling flow and the drainage and return pressures cause-first: is the order the one you teach?',
        'The VA track’s two circulations and differential hypoxemia: where the gas is drawn, and what is changed first.',
        'Whether any simulated response looks implausible to you.',
      ],
      knownLimits: [
        'Its 33 sourced teaching numbers are not yet signed off by the author.',
        'For a loaded left ventricle on VA, lower flow and an inotrope are simulated; volume removal and a vent are recorded as a plan, not simulated.',
      ],
    },
  },
  'baxter-crrt': {
    stage: 'preview',
    note: {
      audience:
        'Clinicians and trainees who know acute kidney injury and can read a basic acid–base and electrolyte picture; no earlier CRRT machine, circuit or prescription experience is assumed.',
      summary:
        'Continuous renal replacement therapy on a simulated PrisMax: eight lessons from indications and circuit anatomy through dose, alarms, citrate anticoagulation and fluid removal, then ten core cases and five cause-first safety drills.',
      estimate: {
        minutes: 107,
        basis:
          "8 lessons, by the module's own count; the cases, the five safety drills and the challenge case are extra",
      },
      lookFor: [
        'Lesson 2, reading the access, return, filter and effluent pressures by cause: is it taught the way you would teach it?',
        'Lesson 6, anticoagulation and citrate safety: are the monitoring and the first moves the ones you want a fellow to make?',
        'Whether the prescriptions and delivered doses in the cases look realistic.',
      ],
      knownLimits: [
        'Its 35 sourced teaching numbers are not yet signed off by the author.',
        'Several recorded disagreements between sources and the simulation are not yet settled by the author.',
        'The machine steps follow one PrisMax software version (2.xx).',
      ],
    },
  },
  'icu-hemodynamics': {
    stage: 'preview',
    note: {
      audience:
        'First-year fellows in the adult ICU; no earlier pulmonary-artery catheter experience is assumed.',
      summary:
        'Nine sections on the pulmonary-artery catheter, each on a live simulated patient: whether a number can be trusted, the waveform of each chamber, where the tip sits, the wedge, cardiac output and derived values, and a screen that does not fit the patient.',
      estimate: {
        minutes: 193,
        basis:
          "9 sections, by the module's own count, including the case that ends Sections 2 to 8",
      },
      lookFor: [
        'Waveforms and the wedge: whether the tracings, and the rules for a wedge you can trust, read the way you teach them.',
        'Thermodilution and derived values (Sections 7 and 8): the numbers and how they are worked out.',
        'Whether any simulated response looks implausible to you.',
      ],
      knownLimits: [
        'Its 25 sourced teaching numbers are not yet signed off by the author.',
        'Which fault the closing case and case HD-08 demonstrate is not yet settled by the author.',
      ],
    },
  },
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
  'mechanical-circulatory-support': {
    stage: 'preview',
    note: {
      audience:
        'Adult-ICU clinicians and trainees starting to look after patients on an IABP, an Impella or a durable LVAD; reading an arterial line and right-heart pressures is assumed.',
      summary:
        'IABP, Impella and durable LVAD support on one simulated circulation, in nine sections: why a normal pressure can mislead, balloon timing, inlet position and suction on an Impella, then speed, resistance and alarms on an LVAD.',
      estimate: {
        minutes: 114,
        basis:
          "9 sections, by the module's own count; the nine practice cases and three closing cases are extra",
      },
      lookFor: [
        'Balloon timing (Section 3): whether early and late inflation and deflation read the way you teach them.',
        'Impella position and suction (Sections 5 and 6), and the pulseless LVAD patient at the end of Section 8.',
        'Whether any simulated response looks implausible to you.',
      ],
      knownLimits: ['Its 19 sourced teaching numbers are not yet signed off by the author.'],
    },
  },
}

/** The modules the hub page lists: every catalog module that is not withheld. */
export const hubBetaModules: readonly BetaModule[] = betaModules.filter(
  (entry) => betaRollout[entry.id].stage !== 'withheld',
)
