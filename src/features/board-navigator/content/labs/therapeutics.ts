import { num } from '../teachingNumbers'
import { PILOT_PROVENANCE, type LearningObjective } from '../types'

/**
 * Therapeutic modalities: four objectives on matching the tool to the lesion and keeping the
 * airway from catching fire. The recurring misconception is treating every energy source as
 * interchangeable, in effect and in hazard.
 */
const THERMAL_MODULE = {
  label: 'Thermal ablation module',
  href: '/thermal-ablation',
  kind: 'module',
} as const
const THERMAL_CHAPTER = {
  label: 'Board chapter: thermal ablative therapies',
  href: '/board-prep/thermal-ablatitive-therapies',
  kind: 'chapter',
} as const
const DELAYED_CHAPTER = {
  label: 'Board chapter: delayed ablative therapies',
  href: '/board-prep/delayed-ablative-therapies',
  kind: 'chapter',
} as const

export const THERAPEUTIC_OBJECTIVES: readonly LearningObjective[] = [
  {
    id: 'tm-01',
    topicId: 'airway-ablation-dilation',
    secondaryTopicIds: ['malignant-airway-obstruction'],
    title: 'Know which modalities work today and which work next week',
    competency:
      'You can sort the ablative modalities by the timing of their effect and depth of action, and choose one that fits the urgency of the obstruction.',
    whatToKnow: [
      'Immediate effect: mechanical coring and microdebrider, Nd:YAG laser, electrocautery, argon plasma coagulation, and cryo-extraction (freeze, adhere, pull).',
      'Delayed effect over days to weeks: contact and spray cryotherapy (freeze–thaw with later sloughing), brachytherapy and photodynamic therapy.',
      `Depth differs: the laser coagulates and vaporises deeply and can perforate; electrocautery depth depends on power and contact time; argon plasma coagulation is superficial, ${num('apc-depth')}, and suits bleeding surfaces and flat lesions more than bulk.`,
      'A critically narrowed airway needs an immediate modality. A delayed modality there risks swelling and sloughing into a lumen that has no reserve.',
    ],
    prerequisites: [],
    concepts: ['mechanism', 'strategy-selection'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'tm-01.cryo-spray-immediate',
        label: 'Spray cryotherapy opens an obstructed airway at the time of the procedure.',
        repair:
          'Freeze–thaw cryotherapy kills tissue that sloughs over days. The lumen is not larger at the end of the procedure, and may be smaller from oedema. Cryo-extraction, which pulls frozen tissue out on the probe, is the immediate form.',
      },
      {
        id: 'tm-01.apc-deep-debulk',
        label: 'Argon plasma coagulation debulks a bulky tumour as efficiently as a laser.',
        repair: `APC coagulates ${num('apc-depth')} of tissue without contact. It is efficient for haemostasis and flat spread, and slow for bulk, which needs the laser, electrocautery or mechanical removal.`,
      },
    ],
    resources: [THERMAL_MODULE, THERMAL_CHAPTER, DELAYED_CHAPTER],
    sourceIds: ['ers-ats-ip-statement-2002', 'ernst-cao-2004'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'tm-01.diagnose',
        kind: 'sort',
        stem: 'Sort each modality by when the airway is larger: at the end of the procedure, or days to weeks later.',
        hint: 'Ask whether the tissue leaves the airway during the procedure, or dies and sloughs afterwards.',
        teachingPoint:
          'Heat and mechanical removal act now; freeze–thaw, radiation and photodynamic therapy act later.',
        sourceIds: ['ers-ats-ip-statement-2002'],
        buckets: [
          { id: 'now', label: 'Immediate relief' },
          { id: 'later', label: 'Delayed effect (days to weeks)' },
        ],
        items: [
          {
            id: 'laser',
            label: 'Nd:YAG laser',
            bucketId: 'now',
            rationale: 'Vaporises and coagulates during the procedure.',
          },
          {
            id: 'cautery',
            label: 'Electrocautery (snare, probe, knife)',
            bucketId: 'now',
            rationale: 'Cuts and coagulates on contact.',
          },
          {
            id: 'apc',
            label: 'Argon plasma coagulation',
            bucketId: 'now',
            rationale: `Immediate, superficial coagulation (${num('apc-depth')}).`,
          },
          {
            id: 'mechanical',
            label: 'Rigid coring and microdebrider',
            bucketId: 'now',
            rationale: 'Tissue is removed in the room.',
          },
          {
            id: 'cryoextract',
            label: 'Cryo-extraction (freeze, adhere and pull)',
            bucketId: 'now',
            rationale: 'The frozen tissue comes out on the probe.',
            misconceptionId: 'tm-01.cryo-spray-immediate',
          },
          {
            id: 'cryospray',
            label: 'Spray or contact cryotherapy (freeze–thaw)',
            bucketId: 'later',
            rationale: 'Tissue dies and sloughs over days; a clean-up bronchoscopy follows.',
            misconceptionId: 'tm-01.cryo-spray-immediate',
          },
          {
            id: 'brachy',
            label: 'Endobronchial brachytherapy',
            bucketId: 'later',
            rationale: 'Radiation effect over weeks.',
          },
          {
            id: 'pdt',
            label: 'Photodynamic therapy',
            bucketId: 'later',
            rationale:
              'Necrosis over days with a debridement bronchoscopy, and photosensitivity for weeks.',
          },
        ],
      },
      repair: {
        principle:
          'Match the timing of the modality to the urgency of the airway, and the depth of the modality to the shape of the lesion.',
        explanation: [
          'The immediate modalities remove or destroy tissue while you watch: rigid coring and the microdebrider take it out mechanically; the Nd:YAG laser vaporises and coagulates deeply, which is why it debulks fast and why it can perforate; electrocautery cuts and coagulates on contact with a depth set by power and time; argon plasma coagulation paints a superficial coagulum without contact and is the tool for oozing surfaces and flat spread. Cryo-extraction belongs here too: the probe freezes to the tumour and the frozen piece is pulled out.',
          'The delayed modalities leave the lumen unchanged or smaller on the day. Freeze–thaw cryotherapy kills tissue that sloughs over the following days, brachytherapy works over weeks, and photodynamic therapy produces necrosis that is debrided at a second bronchoscopy, with weeks of photosensitivity. They have their place in non-critical, flat or recurrent disease, and no place as the only treatment of an airway that is already close to closing.',
          `Depth is the second axis. APC coagulates ${num('apc-depth')} and is slow for bulk; the laser reaches deep and fast. A broad oozing surface wants APC; a bulky obstruction wants mechanical removal with the laser or cautery for haemostasis.`,
        ],
        distinction:
          'Immediate modalities change the lumen in the room; delayed ones change it next week. The breathless patient needs the first; the second can be an adjunct, never the rescue.',
        manipulate: {
          id: 'tm-01.manipulate',
          kind: 'predict',
          stem: 'Keep the modality list and change the lesion.',
          baseline:
            'A bulky obstructing tumour, where mechanical removal with the laser or cautery is the plan.',
          change:
            'The lesion is instead a flat, oozing mucosal spread along the left main bronchus with 30% narrowing and no bulk.',
          hint: 'What depth and what action does this lesion need?',
          teachingPoint: 'Flat, bleeding and superficial is the lesion APC was made for.',
          sourceIds: ['ers-ats-ip-statement-2002'],
          options: [
            {
              id: 'apc',
              label:
                'Argon plasma coagulation suits it: non-contact, superficial, and it stops the oozing',
              rationale: `Yes. ${num('apc-depth')} of coagulation across a surface, without contact, is the match for flat spread and bleeding.`,
            },
            {
              id: 'laser',
              label: 'Nd:YAG laser, because it is the most powerful',
              rationale:
                'Deep energy into a thin wall risks perforation, and there is no bulk to vaporise.',
              misconceptionId: 'tm-01.apc-deep-debulk',
            },
            {
              id: 'cryospray',
              label: 'Spray cryotherapy as the sole treatment for the oozing today',
              rationale: 'Cryotherapy does not stop bleeding at the time and acts over days.',
              misconceptionId: 'tm-01.cryo-spray-immediate',
            },
          ],
          answerId: 'apc',
        },
      },
      verify: {
        id: 'tm-01.verify',
        kind: 'choice',
        stem: 'A patient with a 70% tracheal obstruction and stridor at rest is scheduled for debulking. A colleague proposes spray cryotherapy alone as the treatment today. What is wrong with the plan?',
        hint: 'When will this airway be bigger, and what might it be in between?',
        teachingPoint:
          'A critically narrowed airway needs an immediate modality; a delayed one risks oedema and slough in a lumen without reserve.',
        sourceIds: ['ers-ats-ip-statement-2002', 'ernst-cao-2004'],
        options: [
          {
            id: 'delayed',
            label:
              'Its effect is delayed; the lumen is no larger today and oedema and slough may narrow it further. Use an immediate modality, mechanical or heat-based, with a stent if the lumen does not hold',
            rationale:
              'Yes. Freeze–thaw cryotherapy acts over days. An airway at 70% with stridor at rest has no reserve for that wait.',
          },
          {
            id: 'fine',
            label: 'Nothing; cryotherapy is the safest modality for the trachea',
            rationale:
              'Its safety profile does not change its timing. The airway needs relief today.',
            misconceptionId: 'tm-01.cryo-spray-immediate',
          },
          {
            id: 'pdt',
            label: 'Photodynamic therapy would be better because it is more complete',
            rationale:
              'Photodynamic therapy is also delayed and causes oedema; it is contraindicated for critical obstruction.',
          },
          {
            id: 'apc-bulk',
            label: 'APC alone is the most efficient immediate choice for a bulky lesion',
            rationale: `APC is immediate but superficial (${num('apc-depth')}); bulk needs mechanical removal or the laser.`,
            misconceptionId: 'tm-01.apc-deep-debulk',
          },
        ],
        answerId: 'delayed',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'tm-02',
    topicId: 'airway-ablation-dilation',
    secondaryTopicIds: ['physiology-anesthesia-sedation'],
    title: 'Keep the airway from burning, and know the first moves if it does',
    competency:
      'You can state the oxygen limit and the other precautions that prevent an airway fire during heat-based ablation, and put the response to a fire in order.',
    whatToKnow: [
      `Heat-based modalities (laser, electrocautery, argon plasma coagulation) are activated only with the inspired oxygen at ${num('fio2-thermal')}, confirmed with the anaesthetist before each activation.`,
      'Remove or keep the probe away from flammable material: endotracheal tubes, silicone stents, suction catheters.',
      'Argon is not a fire retardant. Argon plasma coagulation carries heat into the airway and ignites fuel in oxygen just as the laser does.',
      'If a fire starts: stop the energy and remove the probe, stop the oxygen and disconnect the circuit, remove the burning material and flood the airway with saline, re-establish the airway and ventilate, then assess the injury bronchoscopically.',
    ],
    prerequisites: ['tm-01'],
    concepts: ['rescue', 'complication', 'team-decision'],
    safetyCritical: true,
    misconceptions: [
      {
        id: 'tm-02.apc-cannot-ignite',
        label: 'APC uses argon, an inert gas, so it cannot start a fire.',
        repair:
          'The argon carries a plasma hot enough to coagulate tissue. In an oxygen-rich airway with fuel nearby, that heat ignites just as a laser does.',
      },
      {
        id: 'tm-02.oxygen-up-first',
        label: 'When the patient desaturates during the fire, turn the oxygen up first.',
        repair:
          'Oxygen is the oxidiser. It is stopped first and restored only once the fire is out and the airway re-established.',
      },
    ],
    resources: [
      THERMAL_MODULE,
      THERMAL_CHAPTER,
      {
        label: 'Board chapter: anesthesia for interventional pulmonology',
        href: '/board-prep/anesthesia-for-ip',
        kind: 'chapter',
      },
    ],
    sourceIds: ['accp-ip-procedures-2003', 'ernst-cao-2004'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'tm-02.diagnose',
        kind: 'sequence',
        stem: 'During electrocautery through an endotracheal tube you see a flash and then flame in the airway. Put your first moves in order.',
        hint: 'Remove the three parts of the fire in the order they can be removed, then look after the patient.',
        teachingPoint:
          'Energy off, oxygen off, fuel out and saline in, then airway and ventilation, then assessment.',
        sourceIds: ['accp-ip-procedures-2003'],
        steps: [
          {
            id: 'airway',
            label: 'Re-establish the airway and ventilate, air first, oxygen once the fire is out',
          },
          { id: 'energy', label: 'Stop the energy source and withdraw the probe' },
          { id: 'assess', label: 'Bronchoscopic assessment of the airway injury' },
          { id: 'oxygen', label: 'Stop the oxygen and disconnect the breathing circuit' },
          {
            id: 'fuel',
            label: 'Remove the burning tube or material and flood the airway with saline',
          },
        ],
        order: ['energy', 'oxygen', 'fuel', 'airway', 'assess'],
        rationale:
          'The heat is removed first (stop the energy), then the oxidiser (stop the oxygen and disconnect), then the fuel (pull the burning tube and flood with saline). Only then is the airway re-established and ventilated, with oxygen restored once nothing is burning, and the injury assessed by bronchoscopy.',
        earlyMisconceptions: { airway: 'tm-02.oxygen-up-first', assess: 'tm-02.oxygen-up-first' },
      },
      repair: {
        principle:
          'A fire needs heat, fuel and oxygen. Prevention removes the oxygen and the fuel before the heat is applied; the response removes them in the order they can be removed.',
        explanation: [
          `Prevention is a conversation before each activation. The inspired oxygen is brought to ${num('fio2-thermal')} and the anaesthetist confirms it; the operator does not fire until it is. Flammable material is taken out of the field: an endotracheal tube is withdrawn above the target or the procedure is done through a rigid barrel, silicone stents are not heated, suction catheters are removed. If the patient cannot tolerate the lower oxygen, the energy is not applied and the plan changes.`,
          'Argon plasma coagulation is included. The gas is inert but the plasma it carries is hot enough to coagulate tissue, and it ignites fuel in an oxygen-rich airway. The oxygen limit and the fuel rules apply to every heat-based modality.',
          'The response runs in one order. Stop the energy and withdraw the probe. Stop the oxygen and disconnect the circuit. Remove the burning material and flood the airway with saline. Re-establish the airway and ventilate, with oxygen restored only once nothing is burning. Then assess the airway bronchoscopically, and plan intensive care and the surgical or airway teams according to the injury.',
        ],
        distinction:
          'Desaturation during a fire is the symptom; oxygen is the cause. Treating the symptom with more oxygen feeds the cause. The order is fixed because the chemistry is.',
        manipulate: {
          id: 'tm-02.manipulate',
          kind: 'predict',
          stem: 'Keep the procedure and change the oxygen.',
          baseline: `A planned laser debulking with the inspired oxygen at ${num('fio2-thermal')} and the tube withdrawn above the target.`,
          change:
            'The anaesthetist reports that the patient desaturates whenever the oxygen is lowered and is running at 0.9.',
          hint: 'What is the condition for activating the laser, and is it met?',
          teachingPoint:
            'No activation above the oxygen limit. Pause, pre-oxygenate, lower the oxygen for the activation window, or change to a modality without heat.',
          sourceIds: ['accp-ip-procedures-2003'],
          options: [
            {
              id: 'no-fire',
              label:
                'Do not fire. Pre-oxygenate, then lower the oxygen for short activation windows; if that cannot be done, change to a non-heat modality such as mechanical debulking or cryo-extraction',
              rationale:
                'Yes. The limit is a precondition, not a preference. If the patient cannot meet it, the heat is not applied.',
            },
            {
              id: 'fire-briefly',
              label: 'Fire in brief pulses at 0.9; short activations do not ignite',
              rationale:
                'Ignition takes a fraction of a second in high oxygen. Pulse length does not make it safe.',
            },
            {
              id: 'apc-instead',
              label: 'Switch to argon plasma coagulation, which is safe in high oxygen',
              rationale: 'APC carries heat and ignites in high oxygen like the laser.',
              misconceptionId: 'tm-02.apc-cannot-ignite',
            },
          ],
          answerId: 'no-fire',
        },
      },
      verify: {
        id: 'tm-02.verify',
        kind: 'predict',
        stem: 'Keep the precautions and change the modality.',
        baseline: `Laser debulking, with the inspired oxygen at ${num('fio2-thermal')} and no flammable material in the field.`,
        change:
          'The next case is argon plasma coagulation of a bleeding lesion. The anaesthetist asks whether the oxygen precautions still apply, since APC uses argon.',
        hint: 'What does the argon carry?',
        teachingPoint:
          'The precautions apply to every heat-based modality. Argon is the carrier, not a retardant.',
        sourceIds: ['accp-ip-procedures-2003'],
        options: [
          {
            id: 'yes-same',
            label: `Yes: the same limit of ${num('fio2-thermal')} and the same fuel rules. APC carries a hot plasma and ignites in oxygen`,
            rationale:
              'Yes. Argon is inert, the plasma is not. Every heat-based modality follows the same precautions.',
          },
          {
            id: 'no-argon',
            label:
              'No: argon is inert and displaces oxygen at the tip, so the oxygen can stay high',
            rationale:
              'The plasma is hot enough to coagulate tissue and to ignite fuel. Airway fires with APC are described.',
            misconceptionId: 'tm-02.apc-cannot-ignite',
          },
          {
            id: 'only-laser',
            label: 'Only for the laser; cautery and APC are contact tools and do not ignite',
            rationale:
              'Electrocautery and APC both produce ignition in oxygen-rich airways with fuel present.',
            misconceptionId: 'tm-02.apc-cannot-ignite',
          },
        ],
        answerId: 'yes-same',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'tm-03',
    topicId: 'airway-ablation-dilation',
    secondaryTopicIds: ['malignant-airway-obstruction', 'airway-stenting'],
    title: 'Let the lesion choose the modality',
    competency:
      'You can match an ablative modality to a lesion from its shape, its bleeding, its location and what is already in the airway.',
    whatToKnow: [
      'A pedunculated lesion with a stalk is snared with electrocautery at the stalk: immediate, haemostatic and it retrieves the specimen.',
      'A bulky obstruction with distal patency is debulked mechanically with the laser or cautery for haemostasis; a flat oozing surface is painted with argon plasma coagulation.',
      'Granulation or tumour at the end of a silicone stent is treated without heat: cryotherapy or mechanical debridement. Heat melts or ignites silicone.',
      'In small distal airways contact heat carries more perforation risk; cryotherapy or careful mechanical techniques are preferred.',
    ],
    prerequisites: ['tm-01', 'ao-01'],
    concepts: ['strategy-selection'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'tm-03.one-tool',
        label: 'One modality, used well, handles every lesion.',
        repair:
          'Each modality has a geometry it suits: the snare a stalk, APC a surface, the laser and the barrel a bulk, cryotherapy a lesion where heat is unsafe. Choosing by habit rather than by lesion is where the complications come from.',
      },
      {
        id: 'tm-03.heat-near-silicone',
        label: 'A little APC at the end of a silicone stent is harmless.',
        repair:
          'Silicone melts and burns. Tissue at the ends of a silicone stent is treated with cryotherapy or mechanical debridement, or the stent is removed first.',
      },
    ],
    resources: [
      THERMAL_MODULE,
      THERMAL_CHAPTER,
      { label: 'Airway stent mechanics explorer', href: '/airway-stent-mechanics', kind: 'module' },
    ],
    sourceIds: ['ers-ats-ip-statement-2002', 'ernst-cao-2004'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'tm-03.diagnose',
        kind: 'choice',
        stem: 'Granulation tissue at the proximal end of an in-situ silicone tracheal stent is narrowing the lumen by half. Which modality do you choose?',
        hint: 'What is sitting a few millimetres from the tissue you want to treat, and what does heat do to it?',
        teachingPoint:
          'No heat near silicone. Cryotherapy or mechanical debridement, or remove the stent first.',
        sourceIds: ['ers-ats-ip-statement-2002'],
        options: [
          {
            id: 'cryo-mech',
            label:
              'Cryotherapy or mechanical debridement of the granulation, keeping heat away from the stent',
            rationale:
              'Yes. Both treat granulation without heating the silicone. If the stent itself has to go, it is removed first.',
          },
          {
            id: 'apc',
            label: 'Argon plasma coagulation of the granulation at the stent edge',
            rationale: 'Heat at the edge of a silicone stent melts and can ignite it.',
            misconceptionId: 'tm-03.heat-near-silicone',
          },
          {
            id: 'laser',
            label: 'Nd:YAG laser at low power',
            rationale:
              'Low power is still heat next to silicone, and the laser reaches deeper than the granulation.',
            misconceptionId: 'tm-03.heat-near-silicone',
          },
          {
            id: 'remove-forever',
            label: 'Remove the stent permanently; granulation means it has failed',
            rationale:
              'Granulation at the ends is a common, treatable complication. Removal is for recurrent or uncontrollable granulation, and the patient still needs the lumen held.',
          },
        ],
        answerId: 'cryo-mech',
      },
      repair: {
        principle:
          'Read the lesion before picking up a tool: its shape, whether it bleeds, where it is, and what else is in the airway. Each answer removes modalities from the list.',
        explanation: [
          'Shape first. A stalk is snared: electrocautery through the stalk is immediate, stops the bleeding as it cuts, and gives the pathologist the whole lesion. A bulk is cored or lasered, with the barrel or the laser providing haemostasis as the tissue comes out. A flat spread or an oozing surface is painted with argon plasma coagulation, which is built for surfaces.',
          'Then the surroundings. A silicone stent nearby rules out heat: it melts and burns, so granulation at its ends is treated with cryotherapy or mechanical debridement, or the stent is removed before heat is used. A small distal airway with a thin wall makes contact heat a perforation risk, so cryotherapy or careful mechanical work is preferred. An oxygen requirement that cannot be lowered rules out heat altogether.',
          'The habit to avoid is a favourite tool. Complications in ablation come from applying a modality to a lesion it does not suit: deep energy into a thin wall, heat beside silicone, a delayed modality in a closing airway.',
        ],
        distinction:
          'The tool is the last variable chosen, after shape, bleeding, location and neighbours. A learner who starts with the tool is answering a different question from the one the lesion asks.',
      },
      verify: {
        id: 'tm-03.verify',
        kind: 'predict',
        baseline:
          'Granulation at the end of a silicone stent, treated with cryotherapy or mechanical debridement because heat is unsafe there.',
        change:
          'A different lesion: a pedunculated endobronchial tumour on a thin stalk in the left main bronchus, distal airway patent, no stent in place.',
        stem: 'Which modality do you choose now?',
        hint: 'What is the narrowest part of this lesion, and which tool is made for it?',
        teachingPoint:
          'A stalk is snared with electrocautery: immediate, haemostatic, and the specimen comes out whole.',
        sourceIds: ['ers-ats-ip-statement-2002'],
        options: [
          {
            id: 'snare',
            label: 'Electrocautery snare around the stalk',
            rationale:
              'Yes. The snare cuts and coagulates the stalk and retrieves the lesion intact for histology.',
          },
          {
            id: 'cryospray',
            label: 'Spray cryotherapy of the lesion',
            rationale: 'Delayed, leaves the lesion in place to slough, and gives no specimen.',
            misconceptionId: 'tm-03.one-tool',
          },
          {
            id: 'apc-paint',
            label: 'Argon plasma coagulation over the surface of the lesion',
            rationale:
              'Superficial coagulation of a bulky lesion leaves most of it behind; the stalk is the target.',
            misconceptionId: 'tm-03.one-tool',
          },
          {
            id: 'brachy',
            label: 'Endobronchial brachytherapy',
            rationale:
              'Delayed and reserved for recurrent or inoperable disease, not a stalked lesion that can be removed today.',
          },
        ],
        answerId: 'snare',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'tm-04',
    topicId: 'airway-ablation-dilation',
    secondaryTopicIds: ['nonmalignant-airway-obstruction'],
    title: 'Dilate what dilation can fix',
    competency:
      'You can describe how balloon dilation works, which stenoses it settles, which it only bridges, and what it can injure.',
    whatToKnow: [
      'A balloon delivers radial force to a stenosis under direct vision, inflated in controlled increments; a rigid barrel can dilate as well.',
      'For a short web, radial incisions with electrocautery or laser before the balloon let the scar open along cuts rather than tear, and the result is often durable.',
      'For a complex stenosis with cartilage damage or malacia, dilation gives short-lived relief and recurs; it is a bridge to surgery or a stent.',
      'Complications: mucosal tears, bleeding, perforation with pneumomediastinum, and worsened malacia from over-dilation. Adjuncts such as intralesional steroid and mitomycin have limited evidence.',
    ],
    prerequisites: ['ao-06'],
    concepts: ['mechanism', 'complication'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'tm-04.dilation-cures-complex',
        label: 'Dilation repeated often enough cures a complex stenosis.',
        repair:
          'A wall that has lost cartilage or collapses on expiration is not restored by stretching. Dilation is the bridge; resection or a stent is the plan.',
      },
      {
        id: 'tm-04.one-big-inflation',
        label: 'Inflate straight to the final diameter to save time.',
        repair:
          'Incremental inflation under vision lets you stop at a tear or at bleeding. A single large inflation is how perforation happens.',
      },
    ],
    resources: [
      {
        label: 'Board chapter: mechanical debridement and balloon dilation',
        href: '/board-prep/mechanical-debridement-and-balloon-dilitation',
        kind: 'chapter',
      },
      {
        label: 'Board chapter: non-malignant central airway obstruction',
        href: '/board-prep/non-malignant-cao',
        kind: 'chapter',
      },
    ],
    sourceIds: ['ers-ats-ip-statement-2002', 'freitag-stenosis-2007'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'tm-04.diagnose',
        kind: 'choice',
        stem: 'A fit, symptomatic 40-year-old has a 5 mm-thick web-like subglottic stenosis with intact cartilage and no collapse on expiration. What do you offer first?',
        hint: 'What kind of stenosis is this, and what does that class respond to?',
        teachingPoint:
          'A simple web is cut radially and dilated, with a good chance of lasting relief.',
        sourceIds: ['ers-ats-ip-statement-2002', 'freitag-stenosis-2007'],
        options: [
          {
            id: 'incise-dilate',
            label: 'Radial incisions and balloon dilation under direct vision',
            rationale:
              'Yes. A simple web on an intact wall is the stenosis endoscopic treatment settles.',
          },
          {
            id: 'resection-first',
            label: 'Tracheal resection as the first step',
            rationale:
              'Resection is definitive for complex stenosis. For a thin web, an endoscopic attempt first spares the patient an operation that may not be needed.',
          },
          {
            id: 'sems',
            label: 'An uncovered metallic stent',
            rationale:
              'Metallic stents are a last resort in benign disease, and this lesion does not need a device.',
          },
          {
            id: 'cryo',
            label: 'Spray cryotherapy alone',
            rationale: 'Cryotherapy does not open scar and its effect is delayed.',
          },
        ],
        answerId: 'incise-dilate',
      },
      repair: {
        principle:
          'Dilation stretches scar. It settles a stenosis whose wall is intact and bridges one whose wall has failed. Done in increments under vision, it tells you when to stop.',
        explanation: [
          'The balloon applies radial force; the scar yields by tearing. Radial incisions made first with electrocautery or a laser knife direct the tearing along the cuts, so the mucosa opens in a controlled way rather than splitting at random. For a short web on intact cartilage the opened lumen often holds, and the patient may need no further treatment or infrequent repeats.',
          'When the cartilage is damaged or the wall collapses on expiration, the same manoeuvre stretches a wall that cannot hold the shape it is given. Relief is real and short, and the stenosis returns. Here dilation is the bridge: it buys time to a resection in the fit patient, or to a silicone stent in the patient who cannot have surgery.',
          'Increments matter. Inflating under direct vision in steps lets you stop at a mucosal tear or at bleeding; a single inflation to the final diameter is how perforation and pneumomediastinum happen. Intralesional steroid and mitomycin are used as adjuncts with limited evidence; they may lengthen intervals but do not change the class of the stenosis.',
        ],
        distinction:
          'Durable dilation is a property of the wall, not of the technique. The same balloon cures a web and merely postpones a complex stenosis.',
      },
      verify: {
        id: 'tm-04.verify',
        kind: 'predict',
        stem: 'Keep the technique and change the stenosis.',
        baseline:
          'Radial incisions and balloon dilation of a 5 mm web with intact cartilage, expected to be durable.',
        change:
          'The same technique is applied to a 3 cm post-intubation stenosis with cartilage collapse on expiration.',
        hint: 'What holds the lumen open after the balloon comes out?',
        teachingPoint:
          'Relief will be short and the stenosis will recur. Dilation is a bridge here, to surgery in a fit patient or to a silicone stent.',
        sourceIds: ['freitag-stenosis-2007', 'ers-ats-ip-statement-2002'],
        options: [
          {
            id: 'bridge',
            label:
              'Short-lived improvement with recurrence likely; treat the dilation as a bridge and refer for surgical assessment, or plan a silicone stent if surgery is not possible',
            rationale: 'Yes. The wall has lost its structure; stretching does not restore it.',
          },
          {
            id: 'durable',
            label: 'The same durable result, since the technique is the same',
            rationale:
              'Durability comes from the wall, not the technique. Complex stenosis recurs after dilation.',
            misconceptionId: 'tm-04.dilation-cures-complex',
          },
          {
            id: 'bigger-balloon',
            label: 'Durable if a larger balloon is used in a single inflation',
            rationale:
              'A larger single inflation adds perforation risk and still cannot restore cartilage.',
            misconceptionId: 'tm-04.one-big-inflation',
          },
        ],
        answerId: 'bridge',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
]
