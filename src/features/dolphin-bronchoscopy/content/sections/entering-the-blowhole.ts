import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const enteringTheBlowhole: DolphinSectionDefinition = {
  ...dolphinSectionMeta('entering-the-blowhole'),
  clinicalQuestion:
    'The scope tip faces the laryngeal spout of a sedated dolphin, and the glottis is shut. When do you advance, and how far?',
  newConcept:
    'The glottis opens for only a fraction of a second with each breath, so the scope crosses the spout in stages, each timed to a breath.',
  incrementSentence:
    'This section adds one idea to the last: the glottis you found at the spout tip opens only with a breath, so the breath decides when you advance.',
  harmfulReflex: 'Pushing the scope through the spout between breaths, against a closed glottis.',
  harmfulReflexPatterns: [
    /\bpush (on|through|harder)\b/i,
    /\bbetween breaths\b/i,
    /\bforce (it|the scope)\b/i,
  ],
  anchor: {
    analogy:
      'Boarding through a door that opens for an instant with each breath: wait at the door, take one step as it opens, then wait for the next.',
    precise:
      'The glottis opens for a fraction of a second with each breath. Advance a short stage as it opens, hold while it is shut, and never push.',
    checklistLabel: 'At the spout',
    checklist: [
      'Topical lidocaine on the glottis, then wait.',
      'Tip centered on the glottis; watch it open.',
      'Advance a short stage only as it opens.',
      'Cough or clamping: stop and withdraw to the nasopharynx.',
    ],
  },
  recognizeInstruction:
    'The scope sits at the foot of the nasopharynx, facing the laryngeal spout. Watch the breathing cue above the view through two breaths before you touch the controls.',
  blocks: [
    {
      id: 'the-breath-hold',
      kind: 'question',
      role: 'framing',
      heading: 'A breath-hold, then one fast breath',
      body: 'A resting dolphin breathes apneustically. It holds its breath at the end of inspiration, then breathes out and in rapidly. Between breaths the glottis stays tightly shut. With each breath it bursts open for a fraction of a second, then closes again.',
      numberIds: ['breath-window'],
      sourceIds: ['ivancic-2014', 'tsang-2002', 'venn-watson-2012'],
    },
    {
      id: 'at-the-spout',
      kind: 'signals',
      role: 'signals',
      heading: 'What you see at the spout',
      body: 'The nasopharynx is 4–5 cm across and often holds copious, tenacious mucus. The laryngeal spout rises pale pink in its center. The glottis at its tip is rosette-shaped, with no epiglottis over it. Shut, it shows no lumen; open, it shows a dark lumen for an instant.',
      numberIds: ['nasopharynx-width'],
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'the-cue',
      kind: 'signals',
      role: 'framing',
      heading: 'The breathing cue',
      body: 'The cue above the view changes from breath-hold to breath. Watch the glottis in the view as it changes. Steer with the ring, then use Advance and Withdraw.',
      sourceIds: ['dolphin-001-ct'],
    },
    {
      id: 'tsangs-sequence',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'How Tsang crossed the spout',
      body: 'Tsang sprayed 2 mL of 4% lignocaine onto the open spout twice, a short interval apart. He held the scope tip at the center of the numbed glottis, judged from the openings he had watched.\n\nThe spout could not be crossed in one smooth movement. He advanced gently in stages, as each breath relaxed the spout, and waited for further breaths between stages.',
      numberIds: ['lignocaine-tsang'],
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'inside-the-spout',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Inside the spout and below it',
      body: 'The spout is about 5–7 cm long, and the view blurs while the tip is inside it. You entered at the center of a glottis you watched open, so each stage follows that line on a breath. A lost view anywhere else means stop and pull back.\n\nResistance with no lumen ahead means the glottis is shut, not that you need more force. Below the spout, a pear-shaped laryngeal cavity leads to the trachea and its complete rings.',
      numberIds: ['spout-length'],
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
    {
      id: 'the-cough',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Why the spout makes it cough',
      body: 'Tsang’s animals tolerated the procedure well apart from some coughing, most of it while the scope crossed the spout. A cough there means the spout is not numb enough. More topical lidocaine treats that; more sedation does not. Count every extra milliliter of lidocaine against the maximum.',
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each one treats the glottis as a door you can open by pushing.',
      points: [
        'Pushing on against the resistance of a closed glottis.',
        'Advancing on a guess while the glottis is shut, instead of on a breath you watched.',
        'Trying to cross the whole spout in one movement.',
        'Holding on through a cough instead of withdrawing to the nasopharynx.',
      ],
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
  ],
  firstMoves: [
    {
      id: 'closed-glottis',
      troubleRowId: 'closed-glottis',
      heading: 'Resistance at the spout',
      steps: [
        'Never push.',
        'Hold at the spout, tip centered.',
        'Advance only in the moment it opens, in stages.',
      ],
      callForHelp:
        'Call the attending veterinarian if the animal keeps straining or its breaths grow further apart.',
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
    {
      id: 'spout-cough',
      troubleRowId: 'spout-cough',
      heading: 'Cough or clamping at the spout',
      steps: [
        'Stop.',
        'Withdraw to the nasopharynx.',
        'More topical lidocaine: the atomizer, or through the scope.',
        'Top up sedation only if the animal is still intolerant.',
        'Wait for regular breaths.',
      ],
      callForHelp:
        'Call the attending veterinarian if the cough does not settle or the breathing stays irregular.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
  ],
  workspace: {
    kind: 'scope',
    start: 'spout-approach',
    labels: 'shown',
    showLocation: true,
    breathCue: true,
    caption:
      'The CT dolphin’s nasopharynx, scope facing the laryngeal spout. The breathing cue sits above the view.',
  },
  act: {
    kind: 'scope-lab',
    prompt:
      'Hold the tip at the spout and watch the cue. Enter the glottis only while it is open, then go on into the larynx.',
    goals: [
      {
        kind: 'hold-at',
        abbr: 'NPX',
        thenAbbr: 'LS',
        untilCue: 'glottis-open',
        label: 'Wait at the spout; enter the glottis as it opens',
        hint: 'The glottis was shut. Never push against it: pull back to the nasopharynx, hold the tip centered, and advance only as it opens.',
      },
      { kind: 'reach', abbr: 'LX', label: 'On into the larynx' },
      {
        kind: 'avoid',
        abbr: 'NPF',
        label: 'Stay out of the fornix',
        hint: 'This is a nasopharyngeal fornix, a blind pouch beside the spout. Pull back until both fornices are in view, then aim at the midline spout tip.',
      },
    ],
  },
  prediction: {
    id: 'enter-predict',
    itemType: 'management-decision',
    situation:
      'The scope tip is centered on the laryngeal spout. Lidocaine went onto the glottis a moment ago. The glottis is shut, and the dolphin is holding its breath.',
    stem: 'What do you do with the scope now?',
    choices: [
      {
        id: 'a',
        label:
          'Hold the tip centered and wait; advance a short way the moment the glottis opens with a breath.',
        rationale:
          'The glottis opens only for a fraction of a second. A short stage on each opening crosses the spout without forcing it.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Push on gently through the closed glottis; steady pressure will open it.',
        rationale:
          'A closed glottis resists, and the animal strains against it. Pressure brings cough and clamping, not an opening.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Spray more lidocaine; a numbed glottis stays open for the scope.',
        rationale:
          'Topical lidocaine blunts the cough. The numbed glottis still stays shut between breaths and opens only with one.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Wait for the next breath, then advance all the way to the trachea.',
        rationale:
          'The timing holds, but one opening is too brief to cross the whole spout. It takes several breaths, a stage on each.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The glottis bursts open for a fraction of a second with each breath and is tightly shut between them. Hold the tip centered, advance a short stage as it opens, and wait for the next breath. Tsang crossed the spout in several stages this way.',
    objectiveIds: ['O3'],
    numberIds: ['breath-window'],
    sourceIds: ['tsang-2002', 'ivancic-2014'],
  },
  transfer: {
    id: 'enter-transfer',
    itemType: 'management-decision',
    transferVariant:
      'Partway down the spout when the animal coughs, instead of waiting at its tip.',
    situation:
      'The scope has advanced two stages into the spout, on two breaths, and the view is blurred. The dolphin coughs, the glottis clamps, and the scope is pushed back toward you.',
    stem: 'What is your first move?',
    choices: [
      {
        id: 'a',
        label:
          'Stop, withdraw to the nasopharynx, give more topical lidocaine, and wait for regular breaths.',
        rationale:
          'The cough says the spout is not numb enough. Out of the spout, you can numb it again and start the stages over.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Push through the cough; the next breath will open the way.',
        rationale:
          'Pushing against a clamped glottis drives the tip into the spout wall and prolongs the cough.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Give a sedation top-up and hold the scope where it is.',
        rationale:
          'Sedation does not numb the spout. Top up only if the animal stays intolerant after more topical lidocaine.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Hold still inside the spout and wait for the cough to settle.',
        rationale:
          'Stopping is the start, but the tip stays on the spout that is making it cough. Withdraw first.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Cough and clamping at the spout call for the same first moves wherever the tip is. Stop, withdraw to the nasopharynx, add topical lidocaine, top up sedation only if the animal is still intolerant, and wait for regular breaths before the next stage.',
    objectiveIds: ['O3'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },
  practice: [
    {
      id: 'enter-case-resistance',
      sectionId: 'entering-the-blowhole',
      presentationTitle: 'Resistance at the spout tip',
      situation:
        'A 190 kg dolphin is sedated and its glottis numbed. You advance on what looked like an opening. The tip meets firm resistance, no lumen lies ahead, and the animal strains.',
      troubleRowId: 'closed-glottis',
      item: {
        id: 'enter-p-resistance',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Stop, ease back to the spout tip, and hold until you see the glottis open.',
            rationale:
              'Resistance with no lumen is a shut glottis. Holding at the tip lets you advance on the next opening.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push harder; steady force will open a sedated glottis.',
            rationale:
              'Sedation does not open the glottis. Force against it brings straining, cough and clamping.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Spray more lidocaine onto the closed glottis and advance at once.',
            rationale:
              'Lidocaine numbs the glottis; it does not open it. It still opens only with a breath.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw fully to the blowhole and start again.',
            rationale:
              'That ends the straining, but you lose the view of the spout you need. Easing back to the tip is enough.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Resistance with no lumen ahead and an animal straining is a closed glottis. Never push. Hold at the spout, watch for it to open, and advance a short stage only as it does.',
        objectiveIds: ['O3'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
    {
      id: 'enter-case-cough',
      sectionId: 'entering-the-blowhole',
      presentationTitle: 'A cough as the tip touches the spout',
      situation:
        'Lidocaine went onto the glottis by atomizer. As the tip touches the spout, the dolphin coughs hard twice and its breathing turns irregular.',
      troubleRowId: 'spout-cough',
      item: {
        id: 'enter-p-cough',
        itemType: 'management-decision',
        stem: 'What comes first?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw to the nasopharynx and give more topical lidocaine through the scope.',
            rationale:
              'The spout is not numb enough. Off the spout, more topical lidocaine treats the cause.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on between breaths before it coughs again.',
            rationale:
              'A coughing, clamping glottis will not let the scope through, and pushing prolongs the cough.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Repeat the full first dose of midazolam.',
            rationale:
              'A cough at the spout is first a topical problem. Sedation is topped up only if the animal stays intolerant after more lidocaine.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Hold at the spout until the coughing stops.',
            rationale:
              'Waiting helps, but the tip is still touching what triggers the cough. Withdraw first, then numb.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'A cough at the spout means it is not numb enough. Withdraw to the nasopharynx, add topical lidocaine and count it against the maximum, then wait for regular breaths. Top up sedation only if the animal is still intolerant.',
        objectiveIds: ['O3'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
    {
      id: 'enter-case-overdue-breath',
      sectionId: 'entering-the-blowhole',
      presentationTitle: 'A breath that does not come',
      situation:
        'You are waiting at the spout. The gaps between breaths have grown longer. Now a breath is overdue, and the dolphin responds less to touch.',
      troubleRowId: 'breath-hold',
      item: {
        id: 'enter-p-overdue-breath',
        itemType: 'management-decision',
        stem: 'What is your first move?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw the scope to the nasopharynx or out, and let the animal breathe.',
            rationale:
              'Breaths further apart are the earliest sign. The scope comes off the airway first.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Advance between breaths while the glottis is quiet.',
            rationale:
              'A quiet glottis here is a sign of trouble, not an opening. Advancing adds to it.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Give a midazolam top-up to settle the breathing.',
            rationale: 'More sedation deepens what is already slowing the breaths.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Give oxygen and keep the scope at the spout.',
            rationale:
              'Oxygen comes in the sequence, but the scope comes off the airway first so the animal can breathe.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Breaths further apart, or none when one is due, is the earliest sign. Withdraw to the nasopharynx or out, let the animal breathe, give oxygen, and stop if breathing does not recover. Albuterol follows per the NMMP protocol.',
        objectiveIds: ['O3'],
        sourceIds: ['nmmp-workshop-2024'],
      },
    },
    {
      id: 'enter-case-pink-view',
      sectionId: 'entering-the-blowhole',
      presentationTitle: 'A pink view just inside the blowhole',
      situation:
        'You insert the lubricated scope into the blowhole with gentle, steady pressure. Within a few millimeters the view turns pink and smooth, and no lumen lies ahead.',
      troubleRowId: 'plug-mucus',
      item: {
        id: 'enter-p-pink-view',
        itemType: 'management-decision',
        stem: 'What is your first move?',
        choices: [
          {
            id: 'a',
            label:
              'Stop, withdraw to the naris, suction, and find the passage again before advancing.',
            rationale:
              'A pink, featureless view is a nasal plug or mucus against the lens. Backing out restores the view.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on; the nasal passage opens out below the plugs.',
            rationale:
              'You cannot see where the passage is. Pushing on drives the tip into the plug or the wall.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Insufflate air to open the passage ahead of the tip.',
            rationale:
              'A bronchoscope does not insufflate. The view clears by withdrawing and suctioning.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Suction in place and advance once the view clears.',
            rationale:
              'Suction clears the lens, but with the tip against the plug you cannot tell where the passage is. Withdraw first.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'A view that turns pink within a few millimeters is a nasal plug or mucus on the lens. Stop, withdraw to the naris, suction, and find the passage before advancing. Never advance blind.',
        objectiveIds: ['O3', 'O1'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
  ],
  precommitDenyPatterns: [
    /\bthe moment (it|the glottis) opens\b/i,
    /\bshort (stage|way)\b/i,
    /\bseveral (breaths|stages)\b/i,
  ],
  sourceIds: [
    'tsang-2002',
    'ivancic-2014',
    'nmmp-workshop-2024',
    'venn-watson-2012',
    'dolphin-001-ct',
  ],
}
