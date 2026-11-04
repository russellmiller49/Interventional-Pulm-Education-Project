import { num } from '../teachingNumbers'
import { PILOT_PROVENANCE, type LearningObjective } from '../types'

/**
 * Central airway obstruction and stents: six objectives from classifying the lesion to managing
 * the stent that treated it. The recurring misconception is reaching for a device before asking
 * what kind of obstruction it is and what lies beyond it.
 */
const STENT_EXPLORER = {
  label: 'Airway stent mechanics explorer',
  href: '/airway-stent-mechanics',
  kind: 'module',
} as const
const RIGID_MODULE = {
  label: 'Rigid bronchoscopy module',
  href: '/rigid-bronchoscopy',
  kind: 'module',
} as const
const MCAO_CHAPTER = {
  label: 'Board chapter: malignant central airway obstruction',
  href: '/board-prep/management-of-malignant-central-airway-obstruction',
  kind: 'chapter',
} as const
const STENT_CHAPTER = {
  label: 'Board chapter: airway stents',
  href: '/board-prep/airway-stents',
  kind: 'chapter',
} as const
const BENIGN_CHAPTER = {
  label: 'Board chapter: non-malignant central airway obstruction',
  href: '/board-prep/non-malignant-cao',
  kind: 'chapter',
} as const

export const AIRWAY_OBJECTIVES: readonly LearningObjective[] = [
  {
    id: 'ao-01',
    topicId: 'malignant-airway-obstruction',
    secondaryTopicIds: ['rigid-bronchoscopy', 'airway-stenting'],
    title: 'Classify the obstruction before choosing the tool',
    competency:
      'You can classify a central airway obstruction as endoluminal, extrinsic or mixed, confirm that there is patent airway and viable lung beyond it, and match the class to the approach.',
    whatToKnow: [
      'Endoluminal tumour is debulked (mechanical coring, heat-based ablation, cryo-extraction). Extrinsic compression with intact mucosa has nothing to ablate and is stented. Mixed lesions are debulked first, then stented if the lumen does not hold.',
      'Recanalisation is worthwhile only when there is a patent airway and functioning lung distal to the obstruction. Long-standing collapse with no distal airway is not opened.',
      `Symptoms appear late: exertional breathlessness once the tracheal lumen is down to ${num('tracheal-diameter-exertion')} and breathlessness at rest at ${num('tracheal-diameter-rest')}.`,
      'Dynamic collapse (malacia) is neither endoluminal nor extrinsic in the usual sense and is not ablated; it is managed with a stent or surgically.',
    ],
    prerequisites: [],
    concepts: ['mechanism', 'strategy-selection'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ao-01.stent-first',
        label: 'A stent is the treatment for central airway obstruction.',
        repair:
          'A stent holds open a lumen. For endoluminal tumour the lumen is restored by debulking, which also yields tissue and leaves no device to maintain; the stent is reserved for the lumen that will not hold.',
      },
      {
        id: 'ao-01.ablate-extrinsic',
        label: 'Ablate the narrowing whatever its cause.',
        repair:
          'Extrinsic compression has intact mucosa over it. Ablating through the wall toward the compressing mass perforates the airway; the treatment is to hold the lumen open from inside.',
      },
      {
        id: 'ao-01.open-anything',
        label: 'Any obstructed airway is worth opening.',
        repair:
          'Opening an airway to a lung that has no patent distal airway or no function beyond the lesion gives risk without relief. Confirm distal patency and viable lung on CT before the procedure.',
      },
    ],
    resources: [
      MCAO_CHAPTER,
      RIGID_MODULE,
      { label: 'Therapeutic bronchoscopy hub', href: '/therapeutic-bronchoscopy', kind: 'module' },
    ],
    sourceIds: ['ernst-cao-2004', 'ers-ats-ip-statement-2002'],
    evidence: [],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'ao-01.diagnose',
        kind: 'sort',
        stem: 'Sort each central airway lesion into the approach that fits it. Assume the distal airway is patent and the lung beyond is functioning.',
        hint: 'Ask of each lesion: is the tumour inside the lumen, outside the wall, or both?',
        teachingPoint:
          'Inside the lumen is debulked; outside the wall is stented; both is debulked and then stented if needed.',
        sourceIds: ['ernst-cao-2004'],
        buckets: [
          { id: 'debulk', label: 'Debulk (mechanical or ablative)' },
          { id: 'stent', label: 'Stent' },
          { id: 'both', label: 'Debulk, then stent if the lumen does not hold' },
        ],
        items: [
          {
            id: 'polypoid',
            label: 'Polypoid tumour filling the left main bronchus, normal wall beyond it',
            bucketId: 'debulk',
            rationale:
              'Endoluminal tumour: remove it. The restored lumen usually holds without a device.',
            misconceptionId: 'ao-01.stent-first',
          },
          {
            id: 'extrinsic',
            label:
              'Smooth tracheal narrowing with intact mucosa from a compressing mediastinal mass',
            bucketId: 'stent',
            rationale:
              'Extrinsic compression: nothing to ablate, and ablation would perforate. A stent holds the lumen open.',
            misconceptionId: 'ao-01.ablate-extrinsic',
          },
          {
            id: 'mixed',
            label:
              'Tumour in the lumen of the bronchus intermedius with surrounding extrinsic compression',
            bucketId: 'both',
            rationale:
              'Mixed: debulk the endoluminal part, then stent if the compressed segment collapses.',
          },
          {
            id: 'malacia',
            label: 'Expiratory collapse of the trachea to a slit with normal mucosa and no mass',
            bucketId: 'stent',
            rationale:
              'Malacia is a dynamic collapse: nothing to remove. A stent or surgical stabilisation is the treatment.',
            misconceptionId: 'ao-01.ablate-extrinsic',
          },
        ],
      },
      repair: {
        principle:
          'Three questions decide the plan: where is the obstruction relative to the wall, is there an airway and a lung beyond it, and how much lumen is left.',
        explanation: [
          'Endoluminal tumour is removed: by rigid coring or microdebrider, by heat-based ablation or by cryo-extraction. The restored lumen often holds, tissue is obtained, and no device is left to maintain. Extrinsic compression has intact mucosa and nothing to remove; ablating toward the mass goes through the wall. It is held open with a stent. Mixed lesions are the common malignant case: debulk, then look, and stent if the compressed segment collapses.',
          'Before any of this, look past the lesion on the CT. Recanalisation needs a patent distal airway and lung that still works. A lobe collapsed for months behind a complete obstruction, or an airway that has no visible distal tree, offers risk without relief.',
          `Symptoms are a late sign because the trachea has reserve: breathlessness on exertion appears at about ${num('tracheal-diameter-exertion')} of lumen and at rest at about ${num('tracheal-diameter-rest')}. A patient who is breathless at rest from a tracheal lesion has very little margin, which is why airway plans are made before, not after, sedation.`,
        ],
        distinction:
          'The device is the last decision, not the first. The class of obstruction and the state of the lung beyond it decide whether anything is done and what is done; the stent is for the lumen that will not hold on its own.',
        manipulate: {
          id: 'ao-01.manipulate',
          kind: 'predict',
          stem: 'Keep the patient and change what you find after debulking.',
          baseline:
            'The mixed lesion in the bronchus intermedius: endoluminal tumour with surrounding compression, planned for debulking and then a stent.',
          change:
            'After debulking, the lumen is wide, the wall holds its shape through the respiratory cycle, and there is no residual extrinsic narrowing.',
          hint: 'What was the stent for, and does that reason still exist?',
          teachingPoint:
            'A stent is for a lumen that will not hold. If debulking leaves a lumen that holds, no stent is placed.',
          sourceIds: ['ernst-cao-2004'],
          options: [
            {
              id: 'no-stent',
              label: 'No stent. Finish, and plan surveillance and oncological treatment.',
              rationale:
                'Yes. The indication for the stent was a lumen that would collapse. It does not.',
            },
            {
              id: 'stent-anyway',
              label: 'Place the stent as planned to prevent recurrence.',
              rationale:
                'A stent does not prevent tumour regrowth and brings its own complications. It is placed for a lumen that will not hold now.',
              misconceptionId: 'ao-01.stent-first',
            },
            {
              id: 'ablate-more',
              label: 'Ablate the wall where the compression was to be sure.',
              rationale:
                'There is no endoluminal tumour left to ablate; heating a normal wall risks perforation.',
              misconceptionId: 'ao-01.ablate-extrinsic',
            },
          ],
          answerId: 'no-stent',
        },
      },
      verify: {
        id: 'ao-01.verify',
        kind: 'choice',
        stem: 'CT shows the right middle and lower lobes collapsed behind a tumour occluding the bronchus intermedius. The referrer asks whether to recanalise. Which single finding most changes whether the procedure is worthwhile?',
        hint: 'What does recanalisation need on the far side of the lesion?',
        teachingPoint:
          'Patent airway and viable lung beyond the lesion are the precondition. Without them no technique helps.',
        sourceIds: ['ernst-cao-2004'],
        options: [
          {
            id: 'distal',
            label:
              'Whether there is a patent airway and functioning lung distal to the obstruction',
            rationale:
              'Yes. Recanalisation relieves symptoms only if the lung beyond can be ventilated.',
          },
          {
            id: 'length',
            label: 'The length of the lesion',
            rationale:
              'Length changes the technique and the stent, not whether opening the airway helps.',
          },
          {
            id: 'degree',
            label: 'The percentage of narrowing',
            rationale:
              'The degree of narrowing explains the symptoms; it does not decide whether the lung beyond can recover.',
          },
          {
            id: 'class',
            label: 'Whether the lesion is endoluminal or extrinsic',
            rationale:
              'The class chooses the tool. It is answered after the question of whether to proceed at all.',
            misconceptionId: 'ao-01.open-anything',
          },
        ],
        answerId: 'distal',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ao-06',
    topicId: 'nonmalignant-airway-obstruction',
    secondaryTopicIds: ['airway-ablation-dilation'],
    title: 'Separate simple from complex benign stenosis',
    competency:
      'You can classify a benign airway stenosis as simple or complex from its length, cartilage involvement and malacia, and say which class endoscopic treatment is likely to settle.',
    whatToKnow: [
      'Simple stenosis: a short, web-like scar without cartilage damage or malacia. Endoscopic treatment (radial incisions and dilation) is often durable.',
      'Complex stenosis: longer, with cartilage involvement, malacia or more than one level. Surgical resection is the definitive treatment when the patient is fit; endoscopic treatment palliates or bridges.',
      'Post-intubation stenosis forms at the cuff; post-tracheostomy stenosis at the stoma. Idiopathic subglottic stenosis is typically a short web in women and recurs.',
      'A classification that records structure (exophytic, extrinsic, distortion, scar) versus dynamic collapse, the degree and the location makes the plan communicable.',
    ],
    prerequisites: [],
    concepts: ['mechanism', 'strategy-selection'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ao-06.dilation-definitive-complex',
        label: 'Dilation settles any benign stenosis if repeated enough.',
        repair:
          'Dilation stretches scar; it cannot restore lost cartilage or stop malacia. In complex stenosis it recurs, and the durable answer in a fit patient is resection.',
      },
      {
        id: 'ao-06.all-surgical',
        label: 'Every benign stenosis is referred for resection.',
        repair:
          'A short web without cartilage damage is often cured endoscopically, sparing the patient a tracheal resection.',
      },
    ],
    resources: [
      BENIGN_CHAPTER,
      {
        label: 'Board chapter: mechanical debridement and balloon dilation',
        href: '/board-prep/mechanical-debridement-and-balloon-dilitation',
        kind: 'chapter',
      },
    ],
    sourceIds: ['freitag-stenosis-2007', 'ernst-cao-2004'],
    evidence: [],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'ao-06.diagnose',
        kind: 'sort',
        stem: 'Sort each benign stenosis by the treatment most likely to settle it in a fit patient.',
        hint: 'Look for cartilage damage, malacia and length. A thin web has none of them.',
        teachingPoint:
          'Short web without cartilage damage: endoscopic. Cartilage loss, malacia or length: surgical, with endoscopy as the bridge.',
        sourceIds: ['freitag-stenosis-2007'],
        buckets: [
          { id: 'endo', label: 'Endoscopic treatment first, likely durable' },
          { id: 'surgery', label: 'Surgical resection when fit; endoscopy as a bridge' },
        ],
        items: [
          {
            id: 'web',
            label: 'A 4 mm thick subglottic web, cartilage intact, no collapse on expiration',
            bucketId: 'endo',
            rationale: 'Simple stenosis: radial incisions and dilation are often durable.',
            misconceptionId: 'ao-06.all-surgical',
          },
          {
            id: 'cuff-complex',
            label:
              'A 3 cm post-intubation stenosis with the cartilage rings collapsing inward on expiration',
            bucketId: 'surgery',
            rationale:
              'Complex: length, cartilage damage and malacia. Dilation recurs; resection is definitive.',
            misconceptionId: 'ao-06.dilation-definitive-complex',
          },
          {
            id: 'iss',
            label: 'Recurrent idiopathic subglottic stenosis, a short web in a 45-year-old woman',
            bucketId: 'endo',
            rationale:
              'Typically a short web; endoscopic dilation is the usual first treatment, accepting that it recurs and is repeated.',
          },
          {
            id: 'stomal',
            label:
              'Stomal stenosis after tracheostomy with an A-frame deformity and loss of the anterior cartilage',
            bucketId: 'surgery',
            rationale: 'Cartilage loss with deformity: a structural problem dilation cannot fix.',
            misconceptionId: 'ao-06.dilation-definitive-complex',
          },
        ],
      },
      repair: {
        principle:
          'Scar can be stretched and cut. Cartilage that is gone, and a wall that collapses, cannot be fixed from inside. The classification is a question about what is wrong with the wall.',
        explanation: [
          'A simple stenosis is a short, web-like ring of scar on a wall whose cartilage is intact and holds its shape. Cutting the web radially and dilating it often gives durable relief. A complex stenosis is longer, involves the cartilage, shows malacia, or sits at more than one level. Dilation stretches it for a while, but the wall has lost the structure that keeps a lumen open, so it recurs.',
          'The aetiology predicts the type. Post-intubation stenosis forms where the cuff pressed, and is often complex because the cartilage was ischaemic. Post-tracheostomy stenosis forms at the stoma, where cartilage was removed or fractured. Idiopathic subglottic stenosis is usually a short web and is treated endoscopically, accepting recurrence.',
          'A fit patient with a complex stenosis is referred for resection; endoscopic treatment is the bridge or the palliation for the patient who cannot have surgery. Recording the structure, the degree and the location in a standard classification lets the surgeon and the bronchoscopist talk about the same lesion.',
        ],
        distinction:
          'Simple means the wall is intact and only the lumen is narrowed. Complex means the wall itself has failed. The first is an endoscopic problem; the second is a reconstructive one.',
      },
      verify: {
        id: 'ao-06.verify',
        kind: 'choice',
        stem: 'A fit 52-year-old has a 2 cm post-intubation tracheal stenosis with cartilage involvement. It has been dilated three times in six months and has recurred each time within weeks. What do you recommend?',
        hint: 'What does recurrence after each dilation tell you about the wall?',
        teachingPoint:
          'Recurrence after repeated dilation of a complex stenosis in a fit patient is the signal to refer for resection.',
        sourceIds: ['freitag-stenosis-2007', 'ernst-cao-2004'],
        options: [
          {
            id: 'surgery',
            label: 'Referral for tracheal resection',
            rationale:
              'Yes. Complex stenosis in a fit patient, recurring after dilation: the definitive treatment is surgical.',
          },
          {
            id: 'dilate-again',
            label: 'A fourth dilation with a larger balloon',
            rationale: 'The wall has lost its structure; stretching it more does not restore it.',
            misconceptionId: 'ao-06.dilation-definitive-complex',
          },
          {
            id: 'sems',
            label: 'A metallic stent to hold the lumen',
            rationale:
              'Metallic stents in benign disease carry serious complications and are a last resort when surgery and silicone stents are not possible.',
          },
          {
            id: 'steroid',
            label: 'Dilation with intralesional steroid and mitomycin, repeated indefinitely',
            rationale:
              'Adjuncts may lengthen the interval, but they do not change the wall. In a fit patient the question is surgical.',
            misconceptionId: 'ao-06.dilation-definitive-complex',
          },
        ],
        answerId: 'surgery',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ao-02',
    topicId: 'nonmalignant-airway-obstruction',
    secondaryTopicIds: ['airway-stenting'],
    title: 'Keep metal out of benign airways',
    competency:
      'You can explain why metallic stents are a last resort in benign airway disease, and choose the alternative that fits the patient.',
    whatToKnow: [
      'The 2005 FDA notification described serious complications of metallic stents in benign disease: granulation tissue, mucosal ingrowth through struts, fracture, migration, airway wall injury and removal that is difficult or impossible.',
      'In benign disease, metallic stents are used only after every other option (surgical resection, endoscopic dilation, a silicone stent) has been considered and found unsuitable.',
      'A silicone stent is removable and is the stent of choice when a benign stenosis needs stenting as a bridge or in a patient who cannot have surgery.',
      'In malignant disease with limited survival the calculus changes: metallic stents are placed through a flexible scope and their long-term complications matter less.',
    ],
    prerequisites: ['ao-06'],
    concepts: ['contraindication', 'complication', 'strategy-selection'],
    safetyCritical: true,
    misconceptions: [
      {
        id: 'ao-02.covered-sems-ok',
        label: 'A covered metallic stent avoids the problems in benign disease.',
        repair:
          'Covering reduces ingrowth through the struts but not granulation at the ends, fracture, or the difficulty of removal from a wall it has embedded in. The notification applies to metallic stents as a class.',
      },
      {
        id: 'ao-02.stent-definitive-benign',
        label: 'A stent is a definitive treatment for benign stenosis.',
        repair:
          'A stent is a bridge or a palliation in benign disease. The definitive treatment of a complex stenosis in a fit patient is resection; a simple one is often cured endoscopically.',
      },
    ],
    resources: [STENT_CHAPTER, BENIGN_CHAPTER, STENT_EXPLORER],
    sourceIds: ['fda-metal-stents-2005', 'ernst-cao-2004'],
    evidence: [],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'ao-02.diagnose',
        kind: 'choice',
        stem: 'A 34-year-old, otherwise well and a surgical candidate, has a complex post-intubation tracheal stenosis. A colleague proposes an uncovered metallic stent as the definitive treatment. What do you advise?',
        hint: 'The patient is young, fit and has benign disease. Which of those words changes the stent decision?',
        teachingPoint:
          'Fit patient, benign complex stenosis: resection is definitive. If a bridge is needed it is removable.',
        sourceIds: ['fda-metal-stents-2005'],
        options: [
          {
            id: 'surgery',
            label:
              'Refer for resection. If a bridge is needed first, use dilation or a removable silicone stent, not a metallic one',
            rationale:
              'Yes. Benign disease in a surgical candidate: metallic stents are a last resort because of their complications and the difficulty of removing them.',
          },
          {
            id: 'uncovered',
            label:
              'Agree: an uncovered metallic stent will integrate into the wall and hold the lumen for life',
            rationale:
              'Integration is the problem. The stent embeds, granulates, fractures and cannot be removed when it fails, in a patient with decades to live.',
            misconceptionId: 'ao-02.stent-definitive-benign',
          },
          {
            id: 'covered',
            label: 'Use a covered metallic stent instead; the covering prevents the complications',
            rationale:
              'Covering limits ingrowth through the struts but not granulation at the ends, fracture or difficult removal. The caution applies to metallic stents as a class.',
            misconceptionId: 'ao-02.covered-sems-ok',
          },
          {
            id: 'silicone-permanent',
            label: 'Place a silicone stent as the definitive, permanent treatment',
            rationale:
              'Silicone is the right material for a bridge, but a stent is not the definitive treatment of complex benign stenosis in a fit patient.',
            misconceptionId: 'ao-02.stent-definitive-benign',
          },
        ],
        answerId: 'surgery',
      },
      repair: {
        principle:
          'The stent decision in benign disease is about the next twenty years, not the next twenty minutes. Anything placed must be removable, and anything definitive must come from surgery.',
        explanation: [
          'Metallic stents embed in the airway wall. In a malignant airway with months of survival that is acceptable. In a benign airway the same property produces granulation tissue at the ends, mucosal ingrowth through uncovered struts, fracture under years of coughing, and a stent that cannot be removed when it fails. The 2005 FDA notification described these outcomes and advised that metallic stents in benign disease be used only when all other options have been exhausted.',
          'The hierarchy in a fit patient is resection for a complex stenosis and endoscopic treatment for a simple one. A silicone stent, removable and exchangeable, is the bridge when the airway must be held open before surgery, and the palliation when surgery is not possible. A covered metallic stent is still metallic: the covering addresses ingrowth, not the rest.',
          'The same device choice flips in malignant disease. A metallic stent placed through a flexible scope, covered or uncovered, is a reasonable palliation when survival is measured in months.',
        ],
        distinction:
          'The material is chosen for the lifetime of the patient, not the lesion. Benign disease means a long lifetime and a removable device; malignant disease with limited survival means the embedding is tolerable.',
        manipulate: {
          id: 'ao-02.manipulate',
          kind: 'predict',
          stem: 'Keep the stenosis and change the diagnosis.',
          baseline:
            'The complex tracheal stenosis in a fit 34-year-old, benign, referred for resection.',
          change:
            'The narrowing is instead extrinsic compression from an unresectable malignancy with an expected survival of about three months.',
          hint: 'Which fact about the patient governed the earlier choice, and has it changed?',
          teachingPoint:
            'With limited survival from malignancy, a metallic stent through a flexible scope is a reasonable palliation. The benign-disease caution no longer governs.',
          sourceIds: ['fda-metal-stents-2005', 'ernst-cao-2004'],
          options: [
            {
              id: 'sems-ok',
              label:
                'A metallic stent, covered or uncovered as the lesion dictates, placed through a flexible scope is reasonable',
              rationale:
                'Yes. The long-term complications of metal matter over years; this patient has months, and the device gives rapid relief.',
            },
            {
              id: 'still-no-metal',
              label: 'Still avoid metal; the FDA notification applies to all airway stents',
              rationale: 'The notification is specific to benign airway disorders.',
              misconceptionId: 'ao-02.covered-sems-ok',
            },
            {
              id: 'surgery',
              label: 'Refer for resection as before',
              rationale:
                'The malignancy is unresectable and survival is short; the plan is palliation.',
            },
          ],
          answerId: 'sems-ok',
        },
      },
      verify: {
        id: 'ao-02.verify',
        kind: 'predict',
        stem: 'Keep the stenosis and change the patient.',
        baseline:
          'The complex post-intubation stenosis, benign, previously in a fit surgical candidate.',
        change:
          'The patient is 71 with severe heart failure and is not a surgical candidate. Dilation has recurred twice.',
        hint: 'Surgery is off the table. What is the removable option, and what remains the last resort?',
        teachingPoint:
          'When surgery is not possible, a removable silicone stent with surveillance is the next step; a metallic stent remains the last resort.',
        sourceIds: ['fda-metal-stents-2005'],
        options: [
          {
            id: 'silicone',
            label: 'A silicone stent, removable and exchanged as needed, with surveillance',
            rationale:
              'Yes. Not a surgical candidate and dilation has not held: a removable stent palliates without the complications of metal in a benign airway.',
          },
          {
            id: 'sems',
            label: 'A covered metallic stent, since surgery is not possible',
            rationale:
              'Metal is the last resort after the silicone option, not the step after surgery is excluded.',
            misconceptionId: 'ao-02.covered-sems-ok',
          },
          {
            id: 'dilate-forever',
            label: 'Repeated dilation every few weeks indefinitely',
            rationale:
              'Two recurrences in a complex stenosis predict the next. A device that holds the lumen between visits is the better palliation.',
          },
        ],
        answerId: 'silicone',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ao-03',
    topicId: 'airway-stenting',
    title: 'Size the stent to the airway, not to the fear of migration',
    competency:
      'You can list the measurements a stent plan needs and predict what happens when the diameter or length is wrong in either direction.',
    whatToKnow: [
      'Measure the normal airway diameter above and below the lesion, the length of the lesion, and the distances to the carina and to the lobar orifices that must stay uncovered.',
      'Too narrow a stent migrates and leaves a gap for tumour at the ends. Too wide a stent presses the mucosa, causing pain, ischaemia and granulation, and is harder to seat.',
      'Too short a stent is overgrown at the ends. Too long a stent covers a lobar orifice and obstructs it or traps secretions behind it.',
      'A silicone stent relies on friction and is sized a little above the airway; a self-expanding metallic stent exerts continuous radial force and is matched to the airway with modest oversizing.',
    ],
    prerequisites: ['ao-01'],
    concepts: ['mechanism', 'complication'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ao-03.bigger-is-safer',
        label: 'A bigger stent is safer because it will not migrate.',
        repair:
          'Oversizing trades migration for mucosal ischaemia, pain and granulation, and a stent that is hard to seat. The diameter is matched to the measured normal airway with modest oversizing.',
      },
      {
        id: 'ao-03.cover-everything',
        label: 'A longer stent is safer because it covers more disease.',
        repair:
          'Every extra millimetre of length is a lobar orifice at risk. The length covers the lesion with a margin and stops short of the orifices that must stay open.',
      },
    ],
    resources: [STENT_EXPLORER, STENT_CHAPTER],
    sourceIds: ['ernst-cao-2004', 'ers-ats-ip-statement-2002'],
    evidence: [],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'ao-03.diagnose',
        kind: 'predict',
        stem: 'A silicone stent is planned for a distal tracheal stenosis. The normal trachea above and below measures 16 mm.',
        baseline: 'A silicone stent matched to the measured airway with modest oversizing.',
        change: 'You choose a stent well above the measured diameter so that it cannot migrate.',
        hint: 'What does continuous pressure on the mucosa do over weeks?',
        teachingPoint:
          'Oversizing trades migration for ischaemia, granulation, pain and a stent that is hard to seat.',
        sourceIds: ['ernst-cao-2004'],
        options: [
          {
            id: 'granulation',
            label:
              'Over weeks, mucosal ischaemia, pain and granulation tissue at the ends; the stent is also harder to deploy and seat',
            rationale:
              'Yes. Radial pressure beyond what the wall tolerates injures the mucosa, and the body answers with granulation.',
          },
          {
            id: 'no-downside',
            label: 'Migration is prevented with no downside',
            rationale:
              'Oversizing has a cost in ischaemia and granulation, and a very oversized stent may not fully expand or seat.',
            misconceptionId: 'ao-03.bigger-is-safer',
          },
          {
            id: 'migrates-anyway',
            label: 'The stent migrates distally because large stents are heavier',
            rationale:
              'Migration follows undersizing and a lesion that offers no grip. An oversized stent is held too firmly, not too loosely.',
          },
        ],
        answerId: 'granulation',
      },
      repair: {
        principle:
          'A stent fits a measured airway. The measurements come first, and each dimension has a failure mode in both directions.',
        explanation: [
          'Before choosing a stent, measure: the diameter of the normal airway above and below the lesion (the lesion itself is not the target), the length of the lesion, and the distance from the lesion to the carina and to any lobar orifice that must stay open. The airway tapers distally, so a stent that fits above may be large below.',
          'Diameter: too narrow and the stent migrates and leaves tumour room to grow around its ends; too wide and the mucosa is pressed to ischaemia, the patient has pain and cough, granulation forms at the ends, and the stent may not seat. Length: too short and tumour overgrows the ends; too long and a lobar orifice is covered, obstructing the lobe or trapping secretions behind the wall of the stent.',
          'Materials behave differently. A silicone stent is held by friction and its external studs, so it is sized a little above the airway. A self-expanding metallic stent pushes outward continuously; it is matched to the airway with modest oversizing and allowed to expand over days.',
        ],
        distinction:
          'Migration is a sizing problem solved by measurement, not by exaggeration. The stent that cannot migrate because it is jammed in place is injuring the wall it is jammed against.',
        manipulate: {
          id: 'ao-03.manipulate',
          kind: 'predict',
          stem: 'Keep the diameter right and change the length.',
          baseline:
            'A correctly sized stent for a right main bronchus lesion that ends 8 mm above the right upper lobe orifice.',
          change:
            'You choose a stent long enough to cover well past the lesion, so that its distal end lies over the right upper lobe orifice.',
          hint: 'What is behind the wall of the stent at its distal end?',
          teachingPoint:
            'Covering a lobar orifice obstructs the lobe and traps its secretions. Choose a shorter stent or a design that preserves the orifice.',
          sourceIds: ['ernst-cao-2004'],
          options: [
            {
              id: 'rul-obstruction',
              label:
                'Right upper lobe obstruction and secretion retention behind the stent wall; choose a shorter stent or a Y-type design that preserves the orifice',
              rationale: 'Yes. A covered wall over an orifice is an obstruction of that lobe.',
            },
            {
              id: 'fine',
              label: 'Acceptable: more coverage protects against overgrowth',
              rationale:
                'Overgrowth is addressed with a margin of a few millimetres, not by sacrificing a lobe.',
              misconceptionId: 'ao-03.cover-everything',
            },
            {
              id: 'migrates',
              label: 'The longer stent is more likely to migrate',
              rationale:
                'Length does not cause migration; undersized diameter and a lesion with no grip do.',
            },
          ],
          answerId: 'rul-obstruction',
        },
      },
      verify: {
        id: 'ao-03.verify',
        kind: 'choice',
        stem: 'Before choosing a stent for a left main bronchus lesion, which set of measurements do you need?',
        hint: 'A stent has two dimensions and two neighbours it must not cover.',
        teachingPoint:
          'Normal diameter above and below, lesion length, and the distances to the carina and the lobar orifices.',
        sourceIds: ['ernst-cao-2004'],
        options: [
          {
            id: 'full-set',
            label:
              'Normal airway diameter above and below the lesion, lesion length, and the distances to the carina and to the upper and lower lobe orifices',
            rationale:
              'Yes. Diameter is matched to the normal airway; length covers the lesion with a margin and stops short of the orifices.',
          },
          {
            id: 'length-only',
            label: 'The length of the lesion; diameters are standard for the left main bronchus',
            rationale:
              'Airway diameters vary between patients and taper along the airway. The normal airway is measured, not assumed.',
            misconceptionId: 'ao-03.bigger-is-safer',
          },
          {
            id: 'degree',
            label: 'The percentage of narrowing and the lesion length',
            rationale:
              'The degree of narrowing explains the symptoms; the stent is sized to the normal airway, not to the stenosis.',
          },
          {
            id: 'longest',
            label:
              'Only the longest stent that fits between the carina and the lower lobe, to cover all possible disease',
            rationale:
              'Length is set by the lesion and the orifices that must stay open, not by what fits.',
            misconceptionId: 'ao-03.cover-everything',
          },
        ],
        answerId: 'full-set',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ao-04',
    topicId: 'airway-stenting',
    secondaryTopicIds: ['malignant-airway-obstruction'],
    title: 'Think stent first when a stented patient gets worse',
    competency:
      'You can recognise the common stent complications from their timing and symptoms and name the first move for each.',
    whatToKnow: [
      'New cough, breathlessness or stridor in a stented patient is a stent problem until bronchoscopy says otherwise. The first move is to look.',
      'Mucus plugging builds over days with thick secretions; it is prevented with humidification and saline nebulisation and cleared bronchoscopically.',
      'Migration presents suddenly, often with a coughing fit and loss of the relief the stent gave; bronchoscopy repositions or removes it.',
      'Granulation at the ends forms over weeks to months and is treated by ablation or dilation, with removal or exchange if it recurs; metallic stents can fracture; infection and halitosis are common with silicone.',
    ],
    prerequisites: ['ao-03'],
    concepts: ['complication', 'rescue'],
    safetyCritical: true,
    misconceptions: [
      {
        id: 'ao-04.progression-assumed',
        label: 'New breathlessness in a stented cancer patient is tumour progression.',
        repair:
          'Progression is one possibility. Plugging, migration and granulation are more common and are reversible in an hour with a bronchoscope. The stent is inspected before the prognosis is rewritten.',
      },
      {
        id: 'ao-04.antibiotics-first',
        label:
          'Thick secretions and cough in a stented patient are an infection; treat with antibiotics first.',
        repair:
          'Secretions pool in a stent because the wall cannot clear them. The first move is to look and clear; antibiotics follow if infection is found.',
      },
    ],
    resources: [STENT_CHAPTER, STENT_EXPLORER],
    sourceIds: ['ernst-cao-2004', 'ers-ats-ip-statement-2002'],
    evidence: [],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'ao-04.diagnose',
        kind: 'choice',
        stem: 'Three weeks after a silicone stent for a malignant left main bronchus obstruction, a patient has two days of increasing breathlessness, thick secretions and a wheeze over the left chest. No fever. What do you do first?',
        hint: 'Which structure in this patient cannot clear its own secretions?',
        teachingPoint:
          'A stented airway that worsens is inspected and cleared before anything else is assumed.',
        sourceIds: ['ernst-cao-2004'],
        options: [
          {
            id: 'bronch',
            label:
              'Prompt bronchoscopy to inspect the stent and clear it; mucus plugging is the likely cause',
            rationale:
              'Yes. The timing and the secretions fit plugging. The bronchoscope both diagnoses and treats it.',
          },
          {
            id: 'ct-hospice',
            label: 'CT to document progression and a palliative care referral',
            rationale:
              'Progression is possible but less likely than a reversible stent complication at three weeks. Look first.',
            misconceptionId: 'ao-04.progression-assumed',
          },
          {
            id: 'antibiotics',
            label: 'Oral antibiotics and review in a week',
            rationale:
              'There is no fever and the secretions are explained by the stent. A week of plugging risks complete obstruction.',
            misconceptionId: 'ao-04.antibiotics-first',
          },
          {
            id: 'steroids',
            label: 'Increase inhaled corticosteroid for the wheeze',
            rationale: 'The wheeze is a fixed obstruction, not bronchospasm.',
          },
        ],
        answerId: 'bronch',
      },
      repair: {
        principle:
          'A stent is a foreign body in an airway that can no longer clear itself. When a stented patient gets worse, the stent is the first suspect and the bronchoscope is the first test.',
        explanation: [
          'Timing sorts the complications. In the first days: migration, which presents suddenly, often with a coughing fit, a change in voice or the abrupt return of the symptoms the stent had relieved. Over days to weeks: mucus plugging, with thick secretions, cough and gradual breathlessness, because the stented segment has no mucociliary clearance. Over weeks to months: granulation tissue at the ends, with slowly returning obstruction. Later still, in metallic stents, fracture; in silicone stents, infection and halitosis from the biofilm.',
          'Each has a first move. Plugging is prevented by humidification and saline nebulisation and cleared bronchoscopically. Migration is corrected by repositioning or removal. Granulation is treated with ablation or dilation at the ends, and a stent that keeps granulating is removed or exchanged. A fractured metallic stent is removed or replaced.',
          'The error with the worst consequence is to read every deterioration as the cancer. A patient referred to hospice with a plugged stent has a reversible problem recorded as a terminal one.',
        ],
        distinction:
          'Progression changes the prognosis; a stent complication changes the afternoon. Only the bronchoscope tells them apart, which is why it comes first.',
        manipulate: {
          id: 'ao-04.manipulate',
          kind: 'predict',
          stem: 'Keep the stent and change the timing and the story.',
          baseline:
            'A silicone stent in the trachea for extrinsic malignant compression, with good relief at the end of the procedure.',
          change:
            'On day two the patient has a violent coughing fit, then sudden loss of voice quality and return of the stridor.',
          hint: 'Sudden, after a cough, with the relief gone: what has moved?',
          teachingPoint:
            'Sudden loss of relief after a cough is migration. Bronchoscopy to reposition or remove.',
          sourceIds: ['ernst-cao-2004'],
          options: [
            {
              id: 'migration',
              label: 'Stent migration; urgent bronchoscopy to reposition or remove it',
              rationale:
                'Yes. The sudden onset after a cough and the return of the original symptoms are the signature of a stent that has moved.',
            },
            {
              id: 'plugging',
              label: 'Mucus plugging; nebulised saline and review tomorrow',
              rationale:
                'Plugging builds over days with secretions. This was sudden and followed a cough.',
            },
            {
              id: 'progression',
              label: 'Tumour progression; CT and oncology review',
              rationale:
                'Tumours do not progress in a day. A sudden change in a stented airway is a stent problem.',
              misconceptionId: 'ao-04.progression-assumed',
            },
          ],
          answerId: 'migration',
        },
      },
      verify: {
        id: 'ao-04.verify',
        kind: 'sort',
        stem: 'Match each stent complication to its first move.',
        hint: 'Ask what has physically happened to the stent or inside it.',
        teachingPoint:
          'Clear what is plugged, move what has migrated, ablate or dilate what has granulated, and replace what has fractured.',
        sourceIds: ['ernst-cao-2004'],
        buckets: [
          { id: 'clear', label: 'Humidification, saline nebulisation and bronchoscopic clearance' },
          { id: 'reposition', label: 'Bronchoscopy to reposition or remove' },
          { id: 'ablate', label: 'Ablation or dilation at the ends; exchange if recurrent' },
          { id: 'replace', label: 'Remove or replace the stent' },
        ],
        items: [
          {
            id: 'plug',
            label: 'Thick secretions and gradual breathlessness over several days',
            bucketId: 'clear',
            rationale: 'Mucus plugging: the stented segment cannot clear itself.',
            misconceptionId: 'ao-04.antibiotics-first',
          },
          {
            id: 'migrate',
            label: 'Sudden return of stridor after a coughing fit on day two',
            bucketId: 'reposition',
            rationale: 'Migration: the stent has moved off the lesion.',
          },
          {
            id: 'granulation',
            label: 'Slowly returning obstruction at eight weeks with tissue at the proximal end',
            bucketId: 'ablate',
            rationale: 'Granulation at the end of the stent.',
          },
          {
            id: 'fracture',
            label: 'A metallic stent with broken struts protruding into the lumen',
            bucketId: 'replace',
            rationale: 'A fractured metallic stent is removed or replaced.',
          },
        ],
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ao-05',
    topicId: 'rigid-bronchoscopy',
    secondaryTopicIds: ['malignant-airway-obstruction'],
    title: 'Choose rigid for the job it alone can do',
    competency:
      'You can say when a procedure needs a rigid bronchoscope rather than a flexible one, name the contraindications to rigid bronchoscopy, and describe its first moves in major airway bleeding.',
    whatToKnow: [
      'Rigid bronchoscopy gives a secured airway, ventilation through the barrel, a large working channel and the barrel itself as a tool for coring and tamponade.',
      'It is needed for silicone stent placement, large-volume debulking, control of major airway bleeding, and large foreign bodies. Self-expanding metallic stents, sampling and small ablations are done through a flexible scope.',
      'Contraindications: an unstable cervical spine, a jaw or mouth opening that will not admit the barrel, severe maxillofacial injury, and physiology that will not tolerate general anaesthesia and the barrel.',
      'In major bleeding during a rigid procedure the first moves are to keep the airway and ventilation, isolate the bleeding lung by advancing the barrel into the opposite main bronchus, and tamponade with the barrel, cold saline and topical vasoconstrictor while the team prepares the next step.',
    ],
    prerequisites: ['ao-01'],
    concepts: ['strategy-selection', 'contraindication', 'rescue'],
    safetyCritical: true,
    misconceptions: [
      {
        id: 'ao-05.rigid-for-all-stents',
        label: 'Every airway stent needs a rigid bronchoscope.',
        repair:
          'Self-expanding metallic stents deploy through a flexible scope over a guidewire. Silicone stents need the rigid barrel to be loaded and pushed.',
      },
      {
        id: 'ao-05.rigid-regardless',
        label: 'If the lesion needs rigid, the patient gets rigid.',
        repair:
          'The barrel has to pass the mouth, the jaw and the neck. When it cannot, the plan changes to a flexible approach through a tube or laryngeal mask, often with a metallic stent, rather than forcing the barrel.',
      },
    ],
    resources: [
      RIGID_MODULE,
      {
        label: 'Board chapter: rigid bronchoscopy',
        href: '/board-prep/rigid-bronchoscopy',
        kind: 'chapter',
      },
      {
        label: 'Board chapter: bronchoscopy in high-risk patients and complications',
        href: '/board-prep/bronchoscopy-in-high-risk-patients',
        kind: 'chapter',
      },
    ],
    sourceIds: ['ers-ats-ip-statement-2002', 'accp-ip-procedures-2003', 'ernst-cao-2004'],
    evidence: [],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'ao-05.diagnose',
        kind: 'choice',
        stem: 'Which of these procedures requires a rigid bronchoscope rather than a flexible one?',
        hint: 'Which device cannot be loaded or pushed through a flexible scope?',
        teachingPoint:
          'Silicone stents need the barrel. Metallic stents, sampling and small ablations do not.',
        sourceIds: ['ers-ats-ip-statement-2002'],
        options: [
          {
            id: 'silicone-y',
            label: 'Placing a silicone Y-stent at the carina',
            rationale:
              'Yes. Silicone stents are loaded into the rigid barrel and pushed into position; there is no flexible route.',
          },
          {
            id: 'sems',
            label: 'Placing a covered self-expanding metallic stent in the left main bronchus',
            rationale:
              'Metallic stents deploy over a guidewire through a flexible scope, often under fluoroscopy.',
            misconceptionId: 'ao-05.rigid-for-all-stents',
          },
          { id: 'ebus', label: 'Systematic EBUS staging', rationale: 'A flexible EBUS scope.' },
          {
            id: 'apc-small',
            label: 'Argon plasma coagulation of a small bleeding endobronchial lesion',
            rationale:
              'APC is delivered through a flexible scope for small lesions; rigid is for bulk and for bleeding that overwhelms a flexible approach.',
          },
        ],
        answerId: 'silicone-y',
      },
      repair: {
        principle:
          'Rigid bronchoscopy is chosen for what the barrel provides: a secured airway, ventilation, a wide channel, and a tool for coring and tamponade. It is withheld when the barrel cannot be passed or the patient cannot have the anaesthetic.',
        explanation: [
          'The barrel is both the airway and the instrument. Through it the patient is ventilated, large debulking tools and suction pass, silicone stents are loaded and pushed, and the barrel edge cores tumour and compresses a bleeding surface. That is why the rigid scope is the choice for silicone stents, large-volume debulking, major bleeding and large foreign bodies. Metallic stents, biopsies and small ablations go through a flexible scope.',
          'The barrel has to get in. An unstable cervical spine, a mouth that will not open, a fixed jaw or a severe facial injury rule it out, and the plan moves to a flexible approach through an endotracheal tube or laryngeal mask, usually with a metallic stent. Physiology that will not tolerate general anaesthesia and intermittent ventilation is the other limit.',
          'When major bleeding starts during a rigid procedure the barrel is the rescue. Keep the airway and ventilation; advance the barrel into the opposite main bronchus to isolate the good lung; use the barrel, cold saline and topical vasoconstrictor to tamponade the bleeding side; and have the team ready for the next step, whether a blocker, a bronchoscopic haemostatic technique or embolisation.',
        ],
        distinction:
          'Rigid is a tool with a short list of jobs it alone can do and a short list of patients who cannot have it. The lesion sets the first list; the patient sets the second.',
        manipulate: {
          id: 'ao-05.manipulate',
          kind: 'predict',
          stem: 'Keep the procedure and change the moment.',
          baseline:
            'Rigid debulking of a left main bronchus tumour, patient ventilated through the barrel.',
          change: 'Brisk bleeding fills the left main bronchus and the view is lost.',
          hint: 'The patient has one good lung. Which instrument is already in the airway that can protect it?',
          teachingPoint:
            'Isolate the good lung with the barrel, tamponade the bleeding side, keep ventilating.',
          sourceIds: ['ers-ats-ip-statement-2002', 'accp-ip-procedures-2003'],
          options: [
            {
              id: 'isolate',
              label:
                'Advance the barrel into the right main bronchus to protect the right lung, keep ventilating, then tamponade the left side with the barrel, cold saline and topical vasoconstrictor',
              rationale:
                'Yes. The first moves protect the lung that is not bleeding and keep oxygen going while the bleeding side is compressed.',
            },
            {
              id: 'withdraw',
              label:
                'Withdraw the rigid scope and pass a flexible scope to find the bleeding point',
              rationale:
                'Withdrawing the barrel loses the airway, the ventilation and the tamponade at the moment they matter most.',
            },
            {
              id: 'suction-only',
              label: 'Suction continuously through the barrel until the bleeding stops',
              rationale:
                'Suction clears the view but neither protects the other lung nor compresses the source.',
            },
          ],
          answerId: 'isolate',
        },
      },
      verify: {
        id: 'ao-05.verify',
        kind: 'predict',
        baseline:
          'A 72-year-old with a large tracheal tumour and stridor at rest, planned for rigid debulking.',
        change: 'Since a jaw reconstruction her mouth opens to two centimetres.',
        stem: 'What changes in the plan?',
        hint: 'What has to pass between the teeth for a rigid procedure?',
        teachingPoint:
          'When the barrel cannot be passed, the plan becomes a flexible approach through a secured airway, often with a metallic stent, not a cancelled procedure.',
        sourceIds: ['ers-ats-ip-statement-2002'],
        options: [
          {
            id: 'flexible-plan',
            label:
              'Rigid bronchoscopy is relatively contraindicated by the mouth opening; plan flexible debulking through an endotracheal tube or laryngeal mask with anaesthesia, with a metallic stent if the lumen does not hold',
            rationale:
              'Yes. The limitation is mechanical: the barrel cannot be passed. The airway is secured another way and the tools go through a flexible scope.',
          },
          {
            id: 'rigid-anyway',
            label: 'Proceed with rigid bronchoscopy; the lesion requires it',
            rationale:
              'Forcing a barrel through a two-centimetre opening risks dental and jaw injury and may not succeed at all. The patient, not the lesion, sets this limit.',
            misconceptionId: 'ao-05.rigid-regardless',
          },
          {
            id: 'cancel',
            label: 'Cancel; the airway cannot be treated bronchoscopically',
            rationale:
              'Stridor at rest from a tracheal tumour is an emergency with a flexible solution available.',
          },
          {
            id: 'ebus',
            label: 'Perform EBUS to stage first',
            rationale: 'Staging does not relieve an airway that is closing.',
          },
        ],
        answerId: 'flexible-plan',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
]
