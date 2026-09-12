import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M03 — Equipment, preparation and infection prevention. Before any control is taught, the learner
 * names the parts of a real flexible bronchoscope and meets the check before use as four functional
 * systems, each shown working before insertion; suction is taught as a physical path. Knowledge spec
 * §3 (S1 PDF 89–100; S2 PDF 55–59; T02, T10, T14; U3), drills D01 and D15, and §17.1 / §17.7 for the
 * transfer (S1 PDF 155–158; T15).
 */
export const section: BronchSectionDefinition = {
  id: 'pre-use-check',
  title: 'The bronchoscope before use',
  shortTitle: 'Check before use',
  minutes: 7,
  moduleIds: ['M03'],
  objectives: [
    {
      objectiveId: 'M03-O1',
      subtask:
        'Names eight outlined parts on real bronchoscope photographs — control section, suction valve and its port, biopsy valve adapter and the working-channel port, insertion tube, universal cord and rotary function — and reads what each does, what the bending section at the tip holds, and how misuse harms them.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M03-O2',
      subtask:
        'Chooses, in a practice case, between two released scopes from their device profiles for secretion clearance and a planned forceps biopsy, weighing the approved accessory against access and suction, and names what the choice still leaves to confirm.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M03-O3',
      subtask:
        'Commits the next move when suction does not draw at the tip while image and steering are ready; the four-system check itself is performed on a real instrument under faculty observation.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M03-O4',
      subtask:
        'Decides, in a practice case, what happens to a clean, working scope with no documented reprocessing release, and to a single-use scope that has already been used.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M03-O5',
      subtask:
        'Commits which conclusion easy passage through an endotracheal tube supports, separating external diameter, working-channel function, accessory compatibility and ventilation.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D01', 'D15'],
  prerequisites: ['shared-airway'],

  clinicalQuestion:
    'Before a supervised bronchoscopy, how do you decide that the instrument is ready to enter the patient, and what happens when part of it does not work?',
  recognizeTitle: 'A flexible bronchoscope before use',
  objective:
    'Name the working parts of a flexible bronchoscope and decide, system by system, whether it is ready to enter the patient.',
  why: 'Steering, suction, sampling and rescue all depend on an instrument whose parts work. Knowing the parts, and what each must show before use, is part of preparing the patient.',
  newConcept:
    'A bronchoscope is ready only when each of its four functional systems — image, steering, suction, and the system and environment around it — has been made to work before insertion; a check that does not hold is corrected, or the equipment replaced, not compensated for.',
  incrementSentence:
    'This section adds one idea to the shared airway: the instrument is itself a set of systems that can stop working, and each is shown working before the scope enters the airway the patient breathes through.',
  harmfulReflex:
    'Turning the vacuum up, or starting the inspection anyway, when suction does not draw at the tip, instead of finding the fault along the suction path before insertion.',
  anchor: {
    analogy:
      'A pilot’s walk-around before take-off: the aircraft is not trusted because it looks sound on the stand. Each system is made to work on the ground, and a fault found on the ground is fixed there, not flown with.',
    precise:
      'A bronchoscope is ready when its image, steering, suction, and system and environment have each been shown working before insertion. Suction is a physical path from the distal opening to the vacuum source; when material does not move, the fault is found along that path, not overpowered with more vacuum.',
    checklistLabel: 'Before the scope goes in',
    checklist: [
      'Image: live, clear and oriented, on the right patient record',
      'Steering: smooth deflection and return; tip and exterior intact',
      'Suction: material moving at the tip, not only a pressed valve',
      'System: connections, power, backup, oxygen and a separate oral suction',
    ],
  },

  spineStops: [],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'no-control-change-the-plan',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'monitoring',
      deflection: 'monitoring',
      suction: 'harmful-reflex',
      accessory: 'monitoring',
    },
    sentence:
      'No control at the scope repairs a check that does not hold. Turning the vacuum up, or starting the inspection anyway, is the harmful reflex; the fault is found along the suction path and corrected before the scope goes in. The five controls themselves come in the Handle phase.',
  },
  precommitDenyPatterns: [
    /\bsuction path\b/i,
    /one connection at a time/i,
    /compensat/i,
    /not material moving/i,
    /to the vacuum source/i,
  ],
  modelBoundary:
    'The photographs show one flexible bronchoscope and are authored teaching media, pending review. Parts, controls, dimensions and approved accessories differ between models, and the device’s instructions govern. Nothing on this page simulates suction, image quality or reprocessing, and the page’s text states no dimension for any scope; a number printed on the instrument in a photograph belongs to that model and is read against its instructions.',
  physicalSkillNote:
    'The app can show the parts and the reasoning of the check. It cannot see the hands carry out the check or feel the deflection return; the check itself is performed on a real instrument and observed by faculty.',
  localPolicyIds: ['scope_ifu'],
  reviewItemIds: ['R02', 'R31', 'R42'],

  blocks: [
    {
      id: 'what-ready-means',
      kind: 'question',
      role: 'framing',
      heading: 'What ready means',
      body: 'Before a bronchoscope enters a patient, someone decides that it is ready. That decision rests on knowing the parts of the instrument, what each one does, and what the check before use has to show.\n\nThe bronchoscope photograph in the Simulator panel is the instrument this section works with.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 97 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
      ],
    },
    {
      id: 'ready-scope',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A ready scope, system by system',
      body: 'The check before use regroups the textbook’s four instrument systems by function. On a scope that is ready, each one shows its normal behavior.',
      pointsLabel: 'What each system shows when it is ready',
      points: [
        'Image and illumination: the right patient record and image source, a clean lens, a live, interpretable image rather than a frozen frame, at suitable brightness, white balance where the system requires it, and capture and orientation confirmed',
        'Steering and integrity: exterior and distal tip intact, the tip bending smoothly with the lever and returning, no unexplained resistance, and no sign of damage or of incomplete reprocessing',
        'Suction and channel: pressing the suction valve draws material in at the distal tip, and the planned instruments suit the channel',
        'System and environment: power or battery ready, video and power connections secure, cables protected, a backup plan, oxygen and a separate oral suction at hand, and rescue equipment within reach',
      ],
      claimClass: 'source',
      sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } }],
    },
    {
      id: 'suction-is-a-path',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Suction is a physical path',
      body: 'Suction runs along one physical path: the distal opening, the working channel, the suction valve, the collection trap, the tubing and the vacuum source. An open working-channel port, disconnected tubing, a full or misconnected trap, an accessory filling the channel, mucosa drawn onto the distal opening, or a blocked channel can each stop material moving, and a darkened image does not say which.\n\nSuction being requested is not material moving: a pressed valve or a live vacuum indicator does not prove aspiration. The response is a reasoned check along the path, not more vacuum. A channel blocked by tenacious material is cleared by the device-approved process — the lecture describes withdrawing to clear it outside the patient — and is not flushed forcefully into a distal airway. Where withdrawing would give up a position that is controlling bleeding or otherwise preserving life, an experienced operator coordinates the alternative.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T10', location: { kind: 'time-span', start: '00:09:41', end: '00:10:15' } },
        { sourceId: 'T14', location: { kind: 'time-span', start: '00:03:51', end: '00:04:33' } },
      ],
      reviewItemIds: ['R42'],
    },
    {
      id: 'scene-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The scene, worked through',
      body: 'The scene from the prediction, worked through the four systems before the patient arrives:',
      pointsLabel: 'The check, as it went',
      points: [
        'Image and illumination: live and clear, on the right record. Holds.',
        'Steering and integrity: bends and returns smoothly; tip and exterior intact. Holds.',
        'Suction and channel: the indicator shows vacuum, yet nothing moves at the tip. Does not hold.',
        'Traced from the distal opening — the channel, the suction valve in its port, the working-channel port, the collection trap, the tubing at both ends, the vacuum source — the biopsy valve adapter is missing and the working-channel port is open. Adapter seated and the valve pressed again: material moves in at the tip and on into the trap. Holds.',
        'System and environment: video and power connections secure, cables protected, a backup plan, oxygen and a separate oral suction ready, rescue equipment accessible. Holds.',
        'The inspection begins with all four holding. Had the fault not been found, the scope, or the tubing and trap, would have been replaced before the patient arrived.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
        { sourceId: 'T10', location: { kind: 'time-span', start: '00:09:41', end: '00:10:15' } },
      ],
    },
    {
      id: 'two-diameters',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Two diameters, two questions',
      body: 'External diameter decides access: whether the scope fits the airway or an artificial airway, and how much of that lumen it occupies. Working-channel diameter constrains the tools that fit through it and the suction available. A color code has meaning only within its manufacturer’s system, and a word such as large, slim, therapeutic, diagnostic or single-use is not a substitute for either dimension.\n\nRead both from the device profile — model, external and channel diameters, approved accessory combinations, and where the channel exits relative to the camera rather than a fixed position on the screen — and state a complete choice: the task, the channel it needs, the planned accessory and whether suction and deflection stay usable with it in place, and whether the external diameter suits this patient’s airway and ventilation. If the suction needed and the airway access cannot both be had, the team reconsiders the scope, the airway, the setting or the plan rather than ranking one requirement above the other by default. A dimension the profile does not give stays unknown.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T02', location: { kind: 'time-span', start: '00:05:10', end: '00:06:17' } },
        { sourceId: 'T10', location: { kind: 'time-span', start: '00:03:30', end: '00:06:57' } },
        { sourceId: 'T10', location: { kind: 'time-span', start: '00:10:15', end: '00:12:57' } },
      ],
      localPolicyIds: ['scope_ifu'],
      reviewItemIds: ['R02'],
    },
    {
      id: 'released-not-clean',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Released, not merely clean',
      body: 'A scope that looks clean is not the same as one released for clinical use after the prescribed process. Point-of-use handling, contained transport, identification of the device, inspection and trained reprocessing staff are each part of that release, and identifying the device is what lets its processing be traced.\n\nA single-use scope is outside reprocessing but not outside care: it still needs aseptic handling and proper disposal, and its label is not permission to use it again.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 59 } },
      ],
    },
    {
      id: 'reprocessing-program',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Reprocessing follows the device and the program',
      body: 'CDC guidance on disinfection and sterilization requires cleaning before disinfection or sterilization, processes compatible with the device, appropriate channel cleaning, drying and protected storage, and staff trained on the specific device. A scope that does not hold its leak check is taken out of service. Reusable endoscopes that contact mucosa need at least high-level disinfection; reusable accessories that breach mucosa need appropriate sterilization.\n\nThe sequence itself comes from the manufacturer’s compatible instructions and your institution’s infection-prevention program, not from this course.',
      claimClass: 'update',
      sourceRefs: [
        { sourceId: 'U3', location: { kind: 'section', label: 'recommendations 2, 3, and 7' } },
      ],
      localPolicyIds: ['scope_ifu'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors lets one sign stand in for a system that has not been shown to work.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Turning the vacuum up when suction does not draw: find the fault along the path first.',
        'Reading a pressed valve or a live vacuum indicator as working suction: look for material moving at the tip.',
        'Moving closer to a suspected lesion to make up for a poor image: fix the image system before beginning.',
        'Forcing a flush through a blocked channel into the airway: clear it by the device-approved process; if withdrawing would give up a position that is controlling bleeding or otherwise preserving life, an experienced operator coordinates the alternative.',
        'Taking a label such as slim, therapeutic or single-use, or a color, for a dimension: read both diameters from the device profile.',
        'Treating a clean-looking scope as released, or a used single-use scope as reusable because it still works: confirm the documented release; dispose of a single-use scope after its patient.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
        { sourceId: 'T10', location: { kind: 'time-span', start: '00:09:41', end: '00:10:15' } },
        { sourceId: 'T14', location: { kind: 'time-span', start: '00:03:51', end: '00:04:33' } },
        { sourceId: 'T02', location: { kind: 'time-span', start: '00:05:10', end: '00:06:17' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95 } },
      ],
      reviewItemIds: ['R02', 'R42'],
    },
  ],

  workspace: {
    kind: 'media',
    caption: 'A flexible bronchoscope, photographed whole before use',
    media: [{ kind: 'scope-photo', imageId: 'full-scope' }],
  },

  steps: {
    recognize: {
      instruction:
        'Look at the bronchoscope photograph in the Simulator panel, then read A ready scope, system by system, in the Teaching panel.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.photograph,
        alsoPane: 'teaching',
        alsoLandmark: 'A ready scope, system by system',
      },
    },
    act: {
      title: 'The parts of the bronchoscope',
      instruction:
        'For each of the views to name on this card, choose the name of the outlined part, then check the set.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.identifyRows },
    },
    explain: {
      title: 'The check, system by system',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and Suction is a physical path in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'identify',
    identify: {
      id: 'scope-parts',
      prompt:
        'Eight views, each with one part of a flexible bronchoscope outlined. Name the outlined part in each.',
      rows: [
        {
          id: 'control-section',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-control-section-1',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'control-section', label: 'Control section' },
            { id: 'universal-cord', label: 'Universal cord' },
            { id: 'insertion-tube', label: 'Insertion tube' },
            { id: 'rotary-function', label: 'Rotary function' },
          ],
          answerId: 'control-section',
          rationale:
            'The handle held in one hand. It carries the lever that bends the distal tip, the suction valve and the working-channel port; the universal cord leaves it near the top and the insertion tube at the bottom.',
        },
        {
          id: 'suction-valve',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-suction-valve-2',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'suction-valve', label: 'Suction valve' },
            { id: 'suction-valve-port', label: 'Suction valve port' },
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
            { id: 'working-channel-port', label: 'Working-channel port' },
          ],
          answerId: 'suction-valve',
          rationale:
            'The valve at the top of the control section, pressed to apply suction through the working channel. It has to be seated in its port: a valve that is missing or not seated leaves suction requested but not delivered.',
        },
        {
          id: 'biopsy-valve-adapter',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-biopsy-valve-adapter-3',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
            { id: 'working-channel-port', label: 'Working-channel port' },
            { id: 'suction-valve', label: 'Suction valve' },
            { id: 'suction-valve-port', label: 'Suction valve port' },
          ],
          answerId: 'biopsy-valve-adapter',
          rationale:
            'The cap on the working-channel port, lower on the control section. It keeps the port sealed, with or without an instrument through it; left open or missing, the port leaks and suction at the tip is reduced or lost.',
        },
        {
          id: 'insertion-tube',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-insertion-tube-4',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'insertion-tube', label: 'Insertion tube' },
            { id: 'universal-cord', label: 'Universal cord' },
            { id: 'control-section', label: 'Control section' },
          ],
          answerId: 'insertion-tube',
          rationale:
            'The flexible shaft that leaves the bottom of the control section and ends free at the bending section and tip; the universal cord ends in a connector instead. It carries the working channel into the airway and is not made to be sharply kinked, forcibly twisted, trapped under equipment or bitten — a bite block protects it throughout an oral procedure, however deep the sedation appears. The bending section at its end holds vulnerable steering components, and the tip is kept from being dropped or struck.',
        },
        {
          id: 'universal-cord',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-universal-cord-5',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'universal-cord', label: 'Universal cord' },
            { id: 'insertion-tube', label: 'Insertion tube' },
            { id: 'control-section', label: 'Control section' },
          ],
          answerId: 'universal-cord',
          rationale:
            'The cord from the control section to the connector that joins the imaging and illumination system. It stays outside the patient, and is kept from bearing loads or bending sharply because the image and the light depend on it.',
        },
        {
          id: 'rotary-function',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-rotary-function-6',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'rotary-function', label: 'Rotary function' },
            { id: 'insertion-tube', label: 'Insertion tube' },
            { id: 'control-section', label: 'Control section' },
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
          ],
          answerId: 'rotary-function',
          rationale:
            'The ring where the insertion tube leaves the control section. On models that have this function it turns the insertion tube relative to the control section; what turning the scope does to the image and the tip comes in the Handle phase. Whether a scope has the function, and how it is used, comes from its instructions.',
        },
        {
          id: 'suction-valve-port',
          media: {
            kind: 'scope-photo',
            imageId: 'suction-valve-setup',
            highlight: 'suction-valve-setup-suction-valve-port-2',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'suction-valve-port', label: 'Suction valve port' },
            { id: 'working-channel-port', label: 'Working-channel port' },
            { id: 'suction-valve', label: 'Suction valve' },
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
          ],
          answerId: 'suction-valve-port',
          rationale:
            'The opening at the top of the control section that the suction valve, held above it here, seats into. Controlled suction is available only once the valve is fully seated; an unseated valve is one of the faults a suction check finds.',
        },
        {
          id: 'working-channel-port',
          media: {
            kind: 'scope-photo',
            imageId: 'biopsy-adapter-setup',
            highlight: 'biopsy-adapter-setup-working-channel-port-2',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'working-channel-port', label: 'Working-channel port' },
            { id: 'suction-valve-port', label: 'Suction valve port' },
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
            { id: 'suction-valve', label: 'Suction valve' },
          ],
          answerId: 'working-channel-port',
          rationale:
            'The entry to the working channel (also called the accessory port), with the biopsy valve adapter held beside it. Accessories, fluid and suction share this channel, so an open port is a leak in the suction path, not a second suction lumen. The printed label beside it can help identify the model; the device’s instructions confirm the channel’s dimension.',
        },
      ],
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 97 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
        { sourceId: 'T02', location: { kind: 'time-span', start: '00:05:10', end: '00:06:17' } },
      ],
    },
  },

  prediction: {
    id: 'N02',
    itemType: 'management-decision',
    situation:
      'A fellow and the procedure nurse are readying a flexible bronchoscope for a supervised airway inspection; the patient is not yet in the room. The image on the display is live and clear, and the tip bends smoothly with the lever and returns to straight. The vacuum indicator shows suction on, but when the suction valve is pressed, nothing is drawn in at the distal tip.',
    stem: 'What should happen next?',
    choices: [
      {
        id: 'a',
        label: 'Trace the suction path from the tip to the vacuum source, one connection at a time',
        rationale:
          'The indicator shows suction requested, not material moving. Suction travels a physical path — distal opening, working channel, valve, collection trap, tubing, vacuum source — and a break or blockage anywhere on it stops flow at the tip. Checking each part in turn finds the fault before the patient is involved.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Turn the vacuum up until the tip draws, then begin once the patient arrives',
        rationale:
          'More vacuum cannot reconnect tubing, seat a valve, close an open working-channel port or empty a full trap, so the fault stays in the suction path. If the higher setting then draws, it hides that fault and carries it into the patient, where stronger suction can pull mucosa onto the distal opening and contribute to loss of lung volume. The setting comes from the device’s instructions, not from a check that did not hold.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Confirm the setting at the vacuum source, then begin once the indicator reads in range',
        rationale:
          'The indicator already shows vacuum at the source, and a reading in range reports suction requested, not material moving at the tip. Whatever is stopping flow — an open working-channel port, an unseated valve, a full trap or a blocked channel — would go into the patient undiscovered, with no working suction to clear secretions or blood.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label:
          'Swap in another scope, since no suction at the tip means this one’s channel is blocked',
        rationale:
          'Replacing equipment is a sound response once the fault is found in the scope, but no suction at the tip does not locate it. Disconnected tubing, a full or misconnected trap, an unseated valve or an open working-channel port each stop suction with a clear channel, and if the fault is in the tubing, trap or vacuum source, a second scope connected to them would draw nothing either.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Suction is a physical path from the distal opening through the working channel, valve, collection trap and tubing to the vacuum source, and a fault anywhere along it stops flow at the tip. Suction being requested — a pressed valve, a live indicator — is not material moving. Tracing the path one connection at a time finds the fault, and a check that does not hold is corrected, or the equipment replaced, before insertion rather than compensated for with more vacuum.',
    objectiveIds: ['M03-O3'],
    claimClass: 'transcript-source',
    sourceRefs: [
      { sourceId: 'T10', location: { kind: 'time-span', start: '00:09:41', end: '00:10:15' } },
      { sourceId: 'T14', location: { kind: 'time-span', start: '00:03:51', end: '00:04:33' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
    ],
  },

  transfer: {
    id: 'Q13',
    seedId: 'Q13',
    itemType: 'mechanism-interpretation',
    situation:
      'In the intensive care unit, a supervised bronchoscopy is planned through a ventilated adult’s endotracheal tube, to clear secretions and to take a sample with an accessory through the working channel. The chosen single-use scope advances through the bronchoscopy adapter and along the full length of the tube without resistance.',
    stem: 'Which conclusion does the easy passage support?',
    choices: [
      {
        id: 'a',
        label: 'That ventilation will stay adequate while the scope is in the tube',
        rationale:
          'Passage shows that the external diameter fits; it does not show gas flow, exhalation or tolerance. The scope occupies part of the tube’s lumen, and together they can greatly increase resistance and limit expiration.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'That the planned sampling accessory will fit through the working channel',
        rationale:
          'Fit in the tube reflects the external diameter. Whether the accessory fits depends on the working-channel diameter and the device’s approved accessory combinations: a second dimension, read from the device profile.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'That the scope’s external diameter allows access through this tube',
        rationale:
          'Easy passage answers the access question and nothing more. The working channel and the approved accessories answer the accessory question, and ventilation with the scope in place is watched on the ventilator and in the patient throughout.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label:
          'That this single-use scope suits both the secretion clearance and the planned sampling',
        rationale:
          'Passage shows only that the external diameter fits this tube. Suitability also needs a channel for the expected secretions, an approved fit for the planned accessory, and ventilation this patient tolerates with the scope in the tube; the single-use label settles none of these, and does not remove the physiological or handling risks of the procedure.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Easy passage shows only that the scope’s external diameter fits this tube. The working-channel diameter and the device’s approved accessories decide whether the accessory fits, and ventilation with the scope in place is a physiological question for the ventilator readings and the patient. Dimensions are screening information, not a guarantee of ventilation, and a label such as single-use settles neither.',
    objectiveIds: ['M03-O5'],
    claimClass: 'transcript-source',
    sourceRefs: [
      { sourceId: 'T02', location: { kind: 'time-span', start: '00:05:10', end: '00:06:17' } },
      { sourceId: 'T10', location: { kind: 'time-span', start: '00:03:30', end: '00:06:57' } },
      { sourceId: 'T15', location: { kind: 'time-span', start: '00:16:23', end: '00:22:00' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } },
    ],
    reviewItemIds: ['R31'],
    transferVariant:
      'In the intensive care unit, at the start of a procedure through a ventilated patient’s endotracheal tube with a single-use scope: fit in the tube instead of suction at the tip, read against the same rule that one property shown to work does not establish another.',
  },

  practice: [
    {
      id: 'mc-unreleased-scope',
      presentationTitle: 'A bronchoscope found on the procedure cart',
      situation:
        'A short inspection has been added to the end of the day, and the team is ready to start. The scope usually used is away for repair. A reusable bronchoscope is found on a cart in the procedure room: it looks clean and dry, the image is live, the tip bends and returns, and suction draws at the tip. Nobody can find a record of its reprocessing, and no one present knows where it was last used or processed. A single-use scope from a brief inspection earlier today is still in its tray and working.',
      item: {
        id: 'mc-unreleased-scope',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label:
              'Take the found scope out of use for reprocessing, and use one that has been released',
            rationale:
              'Appearance and function do not show that the prescribed process was completed. A documented release, tied to the scope’s identity, is what makes a scope available for clinical use; without one, this scope goes back for reprocessing and a released one is used.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Use the found scope: it looks clean and dry, and every system has just worked',
            rationale:
              'A scope can look clean and work in every system without having been processed after its last patient. Using it on appearance and function is the error the release exists to prevent.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Wipe the found scope down, flush its channel with sterile water and log the cleaning, then use it',
            rationale:
              'A wipe and a flush in the procedure room is not reprocessing, and logging it does not make it a release; using the scope afterwards exposes this patient to contamination from its last use. The prescribed process is cleaning and disinfection by trained staff, under the device’s instructions and the institution’s program, with a record of release.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Use the single-use scope from earlier today instead, since it still works',
            rationale:
              'A single-use scope is made for one patient, and this one has already been in another patient’s airway. Its label means proper disposal after use, not reuse while it still functions.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'A scope that looks clean and works is not thereby released for clinical use. Release follows the prescribed cleaning and disinfection process, carried out by trained staff under the device’s instructions and recorded against the scope’s identity, which is also what lets its use be traced. A single-use scope is disposed of after its one patient. The found scope is taken out of use and sent for reprocessing, and a released one is used.',
        objectiveIds: ['M03-O4'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 59 } },
        ],
      },
    },
    {
      id: 'mc-scope-for-sampling',
      presentationTitle: 'Two scopes for a sampling inspection',
      situation:
        'A supervised airway inspection is planned for a nonintubated adult, to clear secretions and to take forceps biopsies of a known endobronchial lesion. Two released reusable scopes are available. The device profile of the slimmer scope does not list the planned biopsy forceps among its approved accessories; the profile of the larger scope lists them, and gives it the larger external diameter and the larger working channel.',
      item: {
        id: 'mc-scope-for-sampling',
        itemType: 'management-decision',
        stem: 'Which scope and accessory should the team choose?',
        choices: [
          {
            id: 'a',
            label:
              'The slimmer scope for easier passage, watching closely that its suction keeps up with the secretions',
            rationale:
              'A smaller scope may go in more easily, but access is one requirement, not the one that settles the choice. Its profile does not list the planned forceps, so watching its suction does not rescue the sampling the task needs, which would rest on an unapproved combination or be given up.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label:
              'The larger scope with the listed forceps, confirming its external diameter suits this patient',
            rationale:
              'Only the larger scope’s profile lists the planned forceps, so it is the only one that can do the planned sampling with an approved combination. What the choice still leaves to confirm is that its larger external diameter suits this patient’s airway and ventilation, and that suction and deflection stay usable with the forceps in the channel.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label:
              'The slimmer scope, with whichever forceps can be pushed through its channel on the day',
            rationale:
              'Getting through on the day is not an approved combination. An accessory the profile does not list may meet resistance and be forced, or leave too little suction and deflection with it in the channel; the approved combinations in the device profile decide which accessory is used.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Either scope, since both are labelled for bronchoscopy and have a documented release',
            rationale:
              'Release makes a scope available for clinical use; it says nothing about what its channel can carry. A label or category is not a substitute for the channel dimension and the approved accessory combinations, and here only one profile lists the planned forceps.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A scope is chosen for the task: the channel it needs, the planned accessory among the scope’s approved combinations, and an external diameter that suits this patient’s airway and ventilation. Only the larger scope’s profile lists the planned forceps, so the choice turns on it; what remains to confirm is that its larger external diameter suits this patient and that suction and deflection stay usable with the forceps in place. Had its external diameter not suited this patient, the team would reconsider the scope, the airway, the setting or the plan rather than rank one requirement above the other by default.',
        objectiveIds: ['M03-O2'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95, to: 96 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
          { sourceId: 'T02', location: { kind: 'time-span', start: '00:05:10', end: '00:06:17' } },
          { sourceId: 'T10', location: { kind: 'time-span', start: '00:03:30', end: '00:06:57' } },
          { sourceId: 'T10', location: { kind: 'time-span', start: '00:10:15', end: '00:12:57' } },
        ],
        reviewItemIds: ['R02'],
      },
    },
  ],
}
