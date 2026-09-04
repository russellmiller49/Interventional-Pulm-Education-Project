import type { SupportMode } from '../engine/types'

/**
 * Didactic Learn sections (WP10 §5.1).
 *
 * Every previously existing ECMO Learn lesson wraps a failure-mode drill on a live circuit, so the
 * module taught nine ways a circuit can go wrong before it taught what a membrane lung does or what
 * a normal patient–circuit state looks like. These sections are the missing physiology: they carry
 * prose rather than a simulator walkthrough, and they precede the console tour.
 *
 * A section's title, rail label, minutes and summary are the pathway row's of the same id, held
 * equal by `learn-precommit-leak.test.ts`: every one of them names what the learner sees rather
 * than the mechanism the section's own prediction asks for, and the summary of a section may not
 * answer that section's prediction stem.
 *
 * Authoring only. No engine state, alarm behavior, or scoring rule belongs here.
 */
export interface EcmoFoundationSection {
  readonly id: string
  /** `undefined` when the section is shared by both tracks. */
  readonly supportMode?: SupportMode
  readonly title: string
  readonly shortTitle: string
  readonly summary: string
  readonly minutes: number
  readonly paragraphs: readonly string[]
  readonly bullets?: readonly string[]
  /** Rendered as an explicitly unreconciled disagreement rather than as a threshold. */
  readonly heldDisagreementId?: string
  readonly sourceIds: readonly string[]
}

const coreSources = ['ecmo-book-ch9', 'elso-circuit-2022', 'bounded-educational-model'] as const

export const ecmoFoundationSections: readonly EcmoFoundationSection[] = Object.freeze([
  {
    id: 'why-extracorporeal-support',
    title: 'Why extracorporeal support exists',
    shortTitle: 'Why ECMO',
    summary:
      'Start from what the tissues need and the three things that decide whether they get it, then name the one a circuit can stand in for.',
    minutes: 8,
    paragraphs: [
      'Extracorporeal support is not a treatment for a diagnosis; it is a way of substituting for a failing step in oxygen delivery or carbon dioxide clearance while something else is given time to recover or to be corrected. Before any console appears, the useful question is which step has failed.',
      'Oxygen delivery to the tissues is the product of blood flow and the oxygen content that blood carries. Oxygen content is dominated by hemoglobin and its saturation, with a small dissolved contribution. Oxygen consumption sits on the other side of the balance. A patient can therefore arrive at impaired delivery through a blood-flow problem, an oxygen-content problem, or a consumption problem — and those are not interchangeable, because support that raises one does not necessarily raise the others.',
      'Carbon dioxide behaves differently. It is far more diffusible than oxygen and its removal across a membrane is governed mostly by the gradient maintained on the gas side, not by how much blood is passing the membrane. That asymmetry is the reason the two controls on an extracorporeal circuit are not interchangeable, and it is developed in the blood-flow-versus-sweep section.',
      'Naming the failing step also names the limits. Extracorporeal support does not treat the underlying lung injury, the cardiac lesion, the sepsis, or the bleeding; it holds a physiologic variable while the treatable problem is treated. Every section that follows assumes this framing.',
    ],
    bullets: [
      'Delivery is flow multiplied by content; a normal saturation does not establish adequate delivery.',
      'Oxygen consumption is part of the same balance and can change independently of support.',
      'CO₂ removal and oxygenation are governed by different parts of the circuit.',
      'Support substitutes for a failing step; it does not treat the cause of the failure.',
    ],
    // A physiology audit in September 2026 found this section citing the module-wide circuit sources
    // for an argument about oxygen delivery, while the two records that actually support it — naming
    // the failing step before changing support, and flow as a titrated dose — went uncited. Both are
    // added here; the shared circuit sources stay because the section's closing paragraph is about
    // what a circuit does and does not treat.
    sourceIds: [
      ...coreSources,
      'ecmo-book-ch16',
      'ecmo-book-ch17',
      'elso-adult-vv-2021',
      'elso-adult-va-2021',
    ],
  },
  {
    id: 'circuit-flow-path',
    title: 'Drainage → pump → membrane lung → return: a walk round the circuit',
    shortTitle: 'Circuit walk',
    summary:
      'Walk the blood once round a running circuit, one stop per component, and learn where every displayed reading is taken before you read its value.',
    minutes: 10,
    paragraphs: [
      'Blood leaves the patient through a drainage cannula, passes through the pump, crosses the membrane lung, and is returned through a return cannula. Every signal on the console describes a location on that path, and almost every reasoning error in later sections comes from reading a signal without knowing where it sits.',
      'The drainage limb depends on the volume available to it and on the resistance between the patient and the pump inlet. It is where preload problems present. The pump does not create volume; it moves what reaches it, and it fails toward the drainage side when volume does not arrive.',
      'The membrane lung is where gas exchange occurs, across a membrane with blood on one side and sweep gas on the other. It has its own resistance, which is not fixed: it rises as the membrane ages or clots, and that rise is measurable across the device rather than at the patient.',
      'The return limb faces whatever resistance lies downstream of it — the cannula, the vessel, and in VA support the patient’s own arterial circulation. This is the source of the module’s spine claim: circuit blood flow is not effective flow, because what the circuit moves and what reaches the tissues are separated by where the blood is returned and what happens to it there.',
    ],
    bullets: [
      'Every displayed number belongs to a location on the path; name the location first.',
      'The drainage side reports availability of volume; the return side reports downstream resistance.',
      'Membrane resistance is a property of the device and changes over a run.',
      'Circuit flow and effective flow are different quantities, in both support modes.',
    ],
    sourceIds: [...coreSources, 'ecmo-book-ch16'],
  },
  {
    id: 'pump-and-pressure-zones',
    title: 'The pump, and the pressures either side of it',
    shortTitle: 'Pump & pressures',
    summary:
      'Turn the speed up on a running circuit and watch what the pressures either side of the pump do, then read the three of them as a set.',
    minutes: 10,
    paragraphs: [
      'A centrifugal pump generates flow by imparting energy to blood, and how much flow results at a given rotational speed depends on the conditions on both sides of it. It is preload dependent: without adequate volume arriving, raising speed does not produce proportional flow and instead generates increasingly negative pressure on the drainage side. It is afterload sensitive: as the resistance it pumps against rises, the flow produced at the same speed falls.',
      'This is why speed and flow are separate readings and why treating them as equivalent is the single most consequential misreading in the module. A rising speed with a falling flow is information, not a malfunction to be corrected by raising speed further.',
      'The circuit has distinguishable pressure zones. Pressure measured before the pump reflects drainage conditions and becomes more negative when volume is limited or inflow is obstructed. Pressure measured between pump and membrane, and the pressure drop measured across the membrane itself, reflect the membrane and what lies beyond it. Pressure after the membrane reflects the return pathway.',
      'Read the zones as a set. A change confined to the drainage zone, a change confined across the membrane, and a change on the return side point at different problems even when the flow they produce looks identical on the display.',
    ],
    bullets: [
      'Speed is a setting; flow is a result of that setting under the current loading conditions.',
      'A preload-limited pump answers a speed increase with more negative drainage pressure, not more flow.',
      'The pressure drop across the membrane belongs to the device, not to the patient.',
      'Localize a change to a zone before attributing a cause to it.',
    ],
    sourceIds: [...coreSources, 'ecmo-book-ch16', 'ecmo-book-ch17'],
  },
  {
    id: 'blood-flow-versus-sweep',
    title: 'The control panel: the three things you can change',
    shortTitle: 'Controls',
    summary:
      'You can change three things on this circuit; everything else is monitoring. Find out which problem each one reaches, and when none of them does.',
    minutes: 10,
    paragraphs: [
      'Oxygen transfer across the membrane is limited mainly by how much desaturated blood is presented to it. Raising blood flow through the circuit presents more blood for oxygenation and is therefore the control that principally affects oxygenation — subject to the drainage limits from the previous section.',
      'Carbon dioxide clearance is limited mainly by the gradient maintained on the gas side. Sweep gas flowing past the membrane carries CO₂ away and keeps that gradient wide. Increasing sweep increases CO₂ removal with comparatively little effect on oxygenation; increasing blood flow increases oxygenation with comparatively little effect on CO₂.',
      'The clinical consequence is that a patient who is hypercapnic with adequate oxygenation has a sweep-side problem, and a patient who is hypoxemic with adequate CO₂ clearance has a blood-flow-side or an effective-flow problem. Reaching for the wrong control produces either no response or an unwanted one, and — more damaging for learning — makes the next observation uninterpretable.',
      'A silent corollary: because sweep controls CO₂ so effectively, an interruption of the gas supply can produce rapid hypercapnia while the pump continues to run and the flow display stays entirely reassuring. Several of the failure sections later in this track are built on exactly that dissociation.',
    ],
    bullets: [
      'Blood flow is the oxygenation control; sweep is the CO₂ control.',
      'Predict which variable should move before changing either one.',
      'A normal flow display says nothing about whether sweep gas is reaching the membrane.',
      'Rapid CO₂ correction has its own hazards; rate of change is part of the decision.',
    ],
    sourceIds: [...coreSources, 'ecmo-book-ch16', 'elso-adult-vv-2021'],
  },

  // ---- VV track ----
  {
    id: 'vv-series-physiology',
    supportMode: 'vv',
    title: 'In series with the heart: what the flow number counts',
    shortTitle: 'In series',
    summary:
      'The circuit sits in series with the patient’s own circulation. Work out what the flow number counts and what it leaves out, using the drainage-line saturation against the patient’s own.',
    minutes: 10,
    paragraphs: [
      'VV support drains venous blood, oxygenates it, and returns it to the venous side. The patient’s own heart then pumps that blood through the lungs and onward. The circuit is in series with the native circulation: it improves the oxygen content of blood entering the right heart, and it provides no circulatory support.',
      'Effective flow is the portion of circuit flow that actually delivers freshly oxygenated blood into the systemic circulation. Recirculation is the portion that is drained again immediately after being returned, without having reached the tissues. Recirculated blood is counted by the flow display exactly like effective flow, because the circuit cannot tell the difference.',
      'This is the VV form of the module’s spine claim. A displayed flow that has not changed, or has even risen, is compatible with a falling effective flow — most commonly because cannula position, patient volume state, or cardiac output has shifted the relationship between the drainage and return points.',
      'The practical signature is a rising drainage-side oxygen saturation with worsening systemic oxygenation and an unremarkable flow display. Recognizing it is the difference between repositioning a cannula and repeatedly raising pump speed, which increases recirculation rather than relieving it.',
    ],
    bullets: [
      'VV supports gas exchange only; it does not support the circulation.',
      'Effective flow, not displayed flow, determines what the tissues receive.',
      'Recirculated blood is indistinguishable from effective flow on the display.',
      'Raising speed against recirculation usually makes recirculation worse.',
    ],
    sourceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch16'],
  },
  {
    id: 'vv-normal-state',
    supportMode: 'vv',
    title: 'A stable VV run: the baseline you read everything against',
    shortTitle: 'Normal VV',
    summary:
      'What a steady, uneventful run looks like for this patient and this circuit, so that every later change has something to be read against.',
    minutes: 8,
    paragraphs: [
      'A stable VV run has a settled relationship between its parts: a drainage pressure that is negative but steady, a flow that matches the set speed without hunting, a pressure drop across the membrane that is stable from hour to hour, and gas exchange that is adequate on an unremarkable sweep setting.',
      'The patient side is equally part of the normal state. The native lungs are still there and still contributing; the ventilator is typically set to rest them rather than to achieve gas exchange alone; the patient has a cardiac output that is doing the systemic work. Sedation, volume state, and temperature all sit inside this picture.',
      'What matters for the sections that follow is the idea of a baseline that is stable over time rather than any particular value. Every failure pattern in this track is a departure from a run that was previously steady: a drainage pressure that has become more negative than it was, a membrane pressure drop that has been climbing for hours, a saturation that has drifted.',
      'This module deliberately does not publish target ranges for these variables. Values depend on cannula size and position, patient size, temperature, hemoglobin, the specific device configuration, and local protocol. The teaching claim is about the trend and the relationship between signals, not about a number.',
    ],
    bullets: [
      'Normal is a stable relationship among signals, not a set of universal numbers.',
      'Establish the baseline for this patient and this circuit before interpreting a change.',
      'The native lungs and native cardiac output remain part of the state.',
      'Trends over hours carry more information than any single reading.',
    ],
    sourceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch18'],
  },
  {
    id: 'vv-integration-capstone',
    supportMode: 'vv',
    title: 'One presentation, four explanations: flow unchanged, patient worse',
    shortTitle: 'Integrate VV',
    summary:
      'The flow display has not moved and the patient is deteriorating. Name the explanation you expect and what you expect to find if you are right, then look.',
    minutes: 18,
    paragraphs: [
      'This section combines the whole track. A patient on stable VV support deteriorates — worsening systemic oxygenation, or a rising CO₂, or both — and the flow display has not changed. The flow display not changing is the point: it is what makes each of the competing explanations survive a casual look.',
      'Four explanations are usually live. Recirculation has risen, so effective flow has fallen while circuit flow has not. The membrane is failing, so blood is crossing a device that is no longer transferring gas adequately. The gas side has been interrupted, so the membrane is intact but no sweep is reaching it. Or the patient has changed — native lung injury has progressed, cardiac output or consumption has risen — and the circuit is doing exactly what it was doing before against a larger demand.',
      'Each of these predicts something different elsewhere. Recirculation predicts a rise in drainage-side saturation with position or volume as the trigger. Membrane failure predicts a rising pressure drop across the device and a post-membrane gas that no longer looks like the output of a working lung. A gas-side interruption predicts a CO₂ that moves fast while oxygenation and all circuit pressures stay unremarkable. A patient change predicts findings at the bedside and in the ventilator rather than in the circuit.',
      'Work the section by naming which explanation you expect and what you expect to find if you are right, then look. The discipline being taught is not the differential itself — it is refusing to act on the flow display when the flow display is the one signal that cannot discriminate.',
    ],
    bullets: [
      'An unchanged flow display is compatible with a large fall in effective flow.',
      'Separate the four explanations by what each predicts elsewhere in the circuit.',
      'Check the gas side explicitly; it fails silently with respect to flow.',
      'A patient-side cause is a real member of the differential, not a diagnosis of exclusion.',
      'Commit to the expected finding before measuring, so the measurement can contradict you.',
    ],
    sourceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch16', 'ecmo-book-ch17'],
  },

  // ---- VA track ----
  {
    id: 'va-parallel-physiology',
    supportMode: 'va',
    title: 'In parallel with the heart: who fills the aorta',
    shortTitle: 'In parallel',
    summary:
      'The heart still ejects into the aorta the circuit returns to. Work out where the two streams meet, what moves that place, and which signals tell you.',
    minutes: 12,
    paragraphs: [
      'VA support drains venous blood, oxygenates it, and returns it to the arterial side. The circuit now runs in parallel with the native heart rather than in series with it, and it provides circulatory support as well as gas exchange. The consequences of that parallelism are the whole of this track.',
      'The first consequence is loading. Returning blood into the arterial system raises the resistance the left ventricle must eject against, while venous drainage reduces what reaches it. A ventricle that is recovering, or that is being supported at high circuit flows, can end up distended and unable to open the aortic valve. LV loading is therefore not a complication of VA support so much as a property of it that must be actively watched.',
      'The second consequence is mixing. With peripheral femoral cannulation, oxygenated circuit blood travels up the aorta while blood ejected by the native heart travels down it. The two meet somewhere, and the location of that watershed depends on how much the native heart is ejecting relative to circuit flow. As native function recovers, the watershed moves distally.',
      'That produces differential oxygenation: poorly oxygenated blood from failing native lungs can be delivered to the upper body — including the coronary and cerebral circulations — while circuit blood keeps the lower body well saturated. It is the reason monitoring site matters in this track, and the reason recovery of native cardiac function can present as a new hypoxemia problem rather than as good news.',
    ],
    bullets: [
      'VA supports gas exchange and the circulation; VV supports only gas exchange.',
      'Arterial return increases LV afterload; watch for distension and valve opening.',
      'The mixing watershed moves as native ejection changes.',
      'Sampling and saturation monitoring site is part of the measurement, not a detail.',
    ],
    sourceIds: [
      ...coreSources,
      'elso-adult-va-2021',
      'ecmo-book-ch17',
      'elso-dual-circulation-2024',
      'elso-maastricht-nomenclature-2019',
      'elso-neuro-monitoring-2024',
    ],
  },
  {
    id: 'va-normal-state',
    supportMode: 'va',
    title: 'A stable VA run: VV plus two ideas',
    shortTitle: 'Plus two ideas',
    summary:
      'Everything a stable VV run has, plus the signals that exist only because the return goes to an artery and two circulations share one aorta.',
    minutes: 10,
    paragraphs: [
      'A stable VA run shares the circuit-side picture of a stable VV run: a steady negative drainage pressure, a flow that matches the set speed, a stable pressure drop across the membrane, and adequate gas exchange on an unremarkable sweep. Those are read the same way here.',
      'What is added is everything produced by parallel circulation. There is an arterial waveform whose pulsatility reports how much the native heart is still ejecting. There is evidence about whether the aortic valve is opening. There is an upper-body oxygenation signal that is distinct from the circuit’s own, because of the mixing watershed. And there is a perfusion question at the cannulated limb, distal to an arterial cannula that occupies part of the vessel.',
      'A normal state therefore includes a pulsatility that is present and stable, an upper-body saturation that is being monitored at a site chosen deliberately, a limb that is being checked, and a left ventricle that is being watched for distension. Losing any of these is a change even when circuit flow is unchanged.',
      'As in the VV track, this module does not publish target values. Pulsatility, saturation, and pressure targets depend on the cannulation strategy, native function, the assay and monitoring site, and local protocol. What transfers is which signals belong to the normal state and what a departure in each one implies.',
    ],
    bullets: [
      'The VA normal state includes native pulsatility and aortic-valve opening.',
      'Upper-body oxygenation is monitored separately, at a deliberately chosen site.',
      'Distal limb perfusion belongs to the routine assessment, not to complications.',
      'A stable circuit display does not by itself establish a stable VA state.',
    ],
    sourceIds: [...coreSources, 'elso-adult-va-2021', 'elso-neuro-monitoring-2024'],
  },
  {
    id: 'va-integration-capstone',
    supportMode: 'va',
    title: 'The same unchanged flow, with a second circulation to blame',
    shortTitle: 'Integrate VA',
    summary:
      'The flow display has not moved and the patient is deteriorating, and parallel circulation adds explanations VV never had. Name what you expect and what would confirm it, then look.',
    minutes: 18,
    paragraphs: [
      'A patient on stable peripheral VA support deteriorates while the flow display is unchanged. Everything from the VV integration section still applies — recirculation has a VA analogue, the membrane can fail, the gas side can be interrupted, and the patient can change — but parallel circulation adds explanations that do not exist in VV.',
      'Native ejection may have recovered, moving the mixing watershed distally and delivering poorly oxygenated blood to the upper body. Systemic vascular resistance may have fallen, so the same circuit flow now produces a lower pressure and a different distribution. The left ventricle may have distended against arterial return, which presents as a pulmonary and pulsatility problem rather than as a circuit one. Or the arterial cannula may be compromising the limb it sits in.',
      'What discriminates them is where you look and what you sample. Differential oxygenation is invisible unless the upper body is being monitored. LV loading shows itself in pulsatility, valve opening, and the lungs rather than in a circuit pressure. Vasoplegia shows itself as a pressure–flow mismatch with an unremarkable circuit. Limb ischemia shows itself only if the limb is examined.',
      'The section is worked the same way as its VV counterpart: name the explanation, name the finding that would confirm and the finding that would refute it, then look. Circuit flow remains the one signal that cannot settle the question, and in VA it is joined by a second misleading reassurance — a systemic pressure that the circuit is generating on the patient’s behalf.',
    ],
    bullets: [
      'Every VV explanation still applies; parallel circulation adds more.',
      'Recovering native function can present as new upper-body hypoxemia.',
      'LV distension presents in pulsatility and the lungs, not in circuit pressures.',
      'A circuit-generated arterial pressure is not evidence of native recovery.',
      'Examine the cannulated limb; nothing on the console will raise it for you.',
    ],
    sourceIds: [
      ...coreSources,
      'elso-adult-va-2021',
      'elso-neuro-monitoring-2024',
      'ecmo-book-ch17',
      'elso-dual-circulation-2024',
      'elso-maastricht-nomenclature-2019',
    ],
  },
])

export const ecmoFoundationSectionById = new Map(
  ecmoFoundationSections.map((section) => [section.id, section] as const),
)

export function ecmoFoundationSectionsForMode(
  supportMode: SupportMode,
): readonly EcmoFoundationSection[] {
  return ecmoFoundationSections.filter(
    (section) => section.supportMode === undefined || section.supportMode === supportMode,
  )
}

export function isEcmoFoundationSectionId(value: unknown): value is string {
  return typeof value === 'string' && ecmoFoundationSectionById.has(value)
}
