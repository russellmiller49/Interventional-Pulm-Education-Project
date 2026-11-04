import { num } from '../teachingNumbers'
import { PILOT_PROVENANCE, type LearningObjective } from '../types'

/**
 * Mediastinal staging: the pilot area the vision names first. Seven objectives run from where a
 * station lies to what a positive node means at the tumour board. The recurring misconception is
 * treating a staging problem as an anatomy problem — the labs separate the two on purpose.
 */
const STATIONS_MODULE = {
  label: 'Mediastinal Stations module',
  href: '/ebus-training/stations',
  kind: 'module',
  note: 'Station maps with CT, bronchoscopy and EBUS correlation.',
} as const

const TNM9_MODULE = {
  label: 'TNM-9 staging module',
  href: '/tnm-9-staging',
  kind: 'module',
  note: 'N map and stage groups.',
} as const

const STAGING_CHAPTER = {
  label: 'Board chapter: lung cancer staging',
  href: '/board-prep/lung-cancer-staging',
  kind: 'chapter',
} as const

export const STAGING_OBJECTIVES: readonly LearningObjective[] = [
  {
    id: 'ms-01',
    topicId: 'ebus',
    secondaryTopicIds: ['thoracic-oncology-staging'],
    title: 'Place a node in its station from airway landmarks',
    competency:
      'You can assign a mediastinal or hilar node to its IASLC station from its relationship to the trachea, the azygos vein, the left pulmonary artery and the main bronchi.',
    whatToKnow: [
      'Stations 2 and 4 are divided right from left by the left lateral border of the trachea, not by the midline. A node in front of the trachea is right-sided (2R or 4R).',
      'Station 2 becomes station 4 at the lower border of the left brachiocephalic vein where it crosses the trachea (right) and at the upper border of the aortic arch (left).',
      'The floor of 4R is the lower border of the azygos vein; the floor of 4L is the upper rim of the left main pulmonary artery. Below those borders a node beside the main bronchus is hilar (10).',
      'Station 7 lies below the carina and extends to the upper border of the lower lobe bronchus on the left and the lower border of the bronchus intermedius on the right. Station 11 lies between lobar bronchi.',
    ],
    prerequisites: [],
    concepts: ['anatomy', 'imaging-interpretation'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ms-01.midline-divide',
        label:
          'Paratracheal nodes are right or left by which side of the tracheal midline they sit on.',
        repair:
          'The IASLC map draws the right–left boundary at the left lateral wall of the trachea. Everything in front of the trachea, including a node a few millimetres left of the midline, is right-sided.',
      },
      {
        id: 'ms-01.four-vs-ten',
        label: 'Any node beside the right main bronchus is 4R.',
        repair:
          'The lower border of the azygos vein is the floor of 4R. A node beside the right main bronchus below that line is 10R, which changes the N descriptor from N2 to N1 for a right-sided tumour.',
      },
    ],
    resources: [STATIONS_MODULE, STAGING_CHAPTER],
    sourceIds: ['iaslc-node-map-2009'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'ms-01.diagnose',
        kind: 'choice',
        stem: `On CT, a 12 mm node lies immediately in front of the trachea, its centre 4 mm to the left of the tracheal midline, at the level of the azygos arch and above the carina. Which station do you record?`,
        hint: 'Find the boundary the IASLC map uses between right and left paratracheal nodes. It is not the midline.',
        teachingPoint:
          'Right versus left paratracheal is decided at the left lateral tracheal wall. Pretracheal nodes are right-sided.',
        sourceIds: ['iaslc-node-map-2009'],
        options: [
          {
            id: '4r',
            label: 'Station 4R',
            rationale:
              'Yes. The node is above the azygos floor and to the right of the left lateral tracheal wall, which puts every pretracheal node on the right.',
          },
          {
            id: '4l',
            label: 'Station 4L',
            rationale:
              'A node has to lie to the left of the left lateral wall of the trachea to be 4L. Four millimetres left of the midline is still in front of the trachea.',
            misconceptionId: 'ms-01.midline-divide',
          },
          {
            id: '10r',
            label: 'Station 10R',
            rationale:
              'Station 10R starts below the lower border of the azygos vein, beside the right main bronchus. This node is at the azygos arch and in front of the trachea.',
            misconceptionId: 'ms-01.four-vs-ten',
          },
          {
            id: '7',
            label: 'Station 7',
            rationale:
              'Station 7 is below the carina, between the main bronchi. This node is above the carina.',
          },
        ],
        answerId: '4r',
      },
      repair: {
        principle:
          'Station boundaries are drawn on vessels and airway walls, not on symmetry. Learn the four lines: the left lateral tracheal wall, the brachiocephalic vein and aortic arch, the azygos floor and the left pulmonary artery rim.',
        explanation: [
          'The IASLC map puts the right–left divide for stations 2 and 4 at the left lateral border of the trachea. This matters because the mediastinal nodes in front of the trachea drain both lungs and are reached from the right paratracheal position on EBUS; they count as right-sided.',
          'Going down the right side: 2R becomes 4R at the lower border of the left brachiocephalic vein, and 4R ends at the lower border of the azygos vein. Below that, a node beside the right main bronchus is 10R. Going down the left: 2L becomes 4L at the upper border of the aortic arch, and 4L ends at the upper rim of the left main pulmonary artery; below that is 10L.',
          'Station 7 sits under the carina and reaches further down than most learners expect: to the lower border of the bronchus intermedius on the right and the upper border of the lower lobe bronchus on the left.',
        ],
        distinction:
          'Right versus left is a boundary question (the left tracheal wall), not a midline question. Mediastinal versus hilar is a vessel question (azygos vein, left pulmonary artery), not a distance question.',
        manipulate: {
          id: 'ms-01.manipulate',
          kind: 'predict',
          stem: 'Hold everything else the same and move the node.',
          baseline:
            'The 12 mm node in front of the trachea, 4 mm left of the midline, above the carina: station 4R.',
          change:
            'The node now lies lateral to the left wall of the trachea, below the aortic arch and above the left pulmonary artery.',
          hint: 'Which boundary did the node cross, and which one did it not cross?',
          teachingPoint:
            'Crossing the left lateral tracheal wall changes the side. Staying above the pulmonary artery keeps it mediastinal.',
          sourceIds: ['iaslc-node-map-2009'],
          options: [
            {
              id: '4l',
              label: 'Station 4L',
              rationale:
                'Yes. It is now to the left of the left tracheal wall, below the arch and above the left pulmonary artery: lower left paratracheal.',
            },
            {
              id: '4r',
              label: 'Still 4R',
              rationale:
                'It has crossed the left lateral tracheal wall, which is the right–left boundary.',
              misconceptionId: 'ms-01.midline-divide',
            },
            {
              id: '10l',
              label: 'Station 10L',
              rationale:
                'Station 10L starts below the upper rim of the left pulmonary artery. The node is above it.',
              misconceptionId: 'ms-01.four-vs-ten',
            },
          ],
          answerId: '4l',
        },
      },
      verify: {
        id: 'ms-01.verify',
        kind: 'hotspot',
        figure: 'station-schematic',
        stem: 'A node lies beside the right main bronchus, below the lower border of the azygos vein and before the right upper lobe takeoff. Click the region on the schematic where this node is recorded.',
        hint: 'The azygos vein is the floor of one station and the ceiling of the next.',
        teachingPoint:
          'Below the azygos floor, beside the main bronchus, the node is hilar: station 10R, which is N1 for a right-sided tumour.',
        sourceIds: ['iaslc-node-map-2009'],
        answerRegionId: '10R',
        rationale:
          'Station 10R: the hilar node immediately adjacent to the right main bronchus, below the azygos vein and proximal to the upper lobe bronchus. Station 4R stops at the azygos; station 11R begins between the lobar bronchi.',
        regionMisconceptions: { '4R': 'ms-01.four-vs-ten' },
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ms-02',
    topicId: 'thoracic-oncology-staging',
    secondaryTopicIds: ['ebus'],
    title: 'Turn a station into an N descriptor',
    competency:
      'You can state the N descriptor for any involved station given the side of the primary tumour, including the ninth-edition split of N2 into single-station and multi-station disease.',
    whatToKnow: [
      'N1: ipsilateral hilar, interlobar, lobar and segmental nodes (stations 10 to 14).',
      'N2: ipsilateral mediastinal nodes (2, 4, 8, 9) and the subcarinal station 7, which counts as N2 for a tumour on either side.',
      'N3: any contralateral mediastinal or hilar node, and any scalene or supraclavicular node (station 1) on either side.',
      'The ninth edition (2024) divides N2 into N2a, a single N2 station, and N2b, more than one N2 station, because survival differed between them. N1 and N3 are unchanged.',
    ],
    prerequisites: ['ms-01'],
    concepts: ['anatomy', 'strategy-selection'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ms-02.seven-is-sided',
        label: 'Station 7 is N3 when the tumour is on the other side.',
        repair:
          'Station 7 is a midline station. It is N2 for a right-sided tumour and N2 for a left-sided tumour. Only the paired stations have a side.',
      },
      {
        id: 'ms-02.contralateral-hilar-n2',
        label:
          'A contralateral hilar node is N2 because hilar nodes are less advanced than mediastinal ones.',
        repair:
          'The side wins over the level. Any contralateral node, hilar or mediastinal, is N3. Hilar nodes are N1 only on the side of the tumour.',
      },
      {
        id: 'ms-02.supraclavicular-n2',
        label: 'An ipsilateral supraclavicular node is N2 because it is on the same side.',
        repair: 'Station 1 (supraclavicular and scalene) is N3 whichever side it is on.',
      },
    ],
    resources: [TNM9_MODULE, STAGING_CHAPTER, STATIONS_MODULE],
    sourceIds: ['tnm9-n-descriptors-2024', 'iaslc-node-map-2009'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'ms-02.diagnose',
        kind: 'sort',
        stem: 'A 3 cm right upper lobe adenocarcinoma. Sort each involved station into the N descriptor it gives this patient.',
        hint: 'Decide the side first, then the level. One station has no side at all.',
        teachingPoint:
          'Side first, then level: ipsilateral hilar is N1, ipsilateral mediastinal or subcarinal is N2, anything contralateral or supraclavicular is N3.',
        sourceIds: ['tnm9-n-descriptors-2024'],
        buckets: [
          { id: 'n1', label: 'N1' },
          { id: 'n2', label: 'N2' },
          { id: 'n3', label: 'N3' },
        ],
        items: [
          { id: '10r', label: 'Station 10R', bucketId: 'n1', rationale: 'Ipsilateral hilar: N1.' },
          {
            id: '11r',
            label: 'Station 11R',
            bucketId: 'n1',
            rationale: 'Ipsilateral interlobar: N1.',
          },
          {
            id: '4r',
            label: 'Station 4R',
            bucketId: 'n2',
            rationale: 'Ipsilateral lower paratracheal: N2.',
          },
          {
            id: '7',
            label: 'Station 7',
            bucketId: 'n2',
            rationale:
              'Subcarinal is a midline station and counts as N2 for a tumour on either side.',
            misconceptionId: 'ms-02.seven-is-sided',
          },
          {
            id: '4l',
            label: 'Station 4L',
            bucketId: 'n3',
            rationale: 'Contralateral mediastinal: N3.',
          },
          {
            id: '10l',
            label: 'Station 10L',
            bucketId: 'n3',
            rationale: 'Contralateral hilar is N3. The side decides before the level does.',
            misconceptionId: 'ms-02.contralateral-hilar-n2',
          },
          {
            id: '1r',
            label: 'Right supraclavicular node (station 1)',
            bucketId: 'n3',
            rationale: 'Station 1 is N3 on either side.',
            misconceptionId: 'ms-02.supraclavicular-n2',
          },
        ],
      },
      repair: {
        principle:
          'The N descriptor asks two questions in a fixed order: which side of the tumour is the node on, then how far from the lung is it. Station 7 and station 1 skip the first question.',
        explanation: [
          'For the paired stations the side decides first. Ipsilateral nodes are N1 if they are hilar or intrapulmonary (10 to 14) and N2 if they are mediastinal (2, 4, 8, 9). Contralateral nodes are N3 at any level, so a contralateral hilar node is as advanced as a contralateral mediastinal one.',
          'Two stations have no side. Station 7 is midline and is N2 for both lungs. Station 1 (scalene and supraclavicular) is N3 for both lungs.',
          'The ninth edition kept these definitions and split N2 by the number of involved N2 stations: N2a for a single station and N2b for several. The split was proposed because single-station N2 behaved closer to N1 and multi-station N2 closer to N3 in the staging database. It changes the stage grouping and the tumour-board conversation, not the anatomy.',
        ],
        distinction:
          'The side is a staging fact; the station number is an anatomy fact. The same station 7 is N2 for every tumour, and the same station 10 is N1 or N3 depending on which lung the tumour is in.',
      },
      verify: {
        id: 'ms-02.verify',
        kind: 'choice',
        stem: 'A left lower lobe squamous carcinoma. EBUS confirms tumour in stations 7 and 4L, and in station 10R. Using the ninth edition, what is the N descriptor?',
        hint: 'Look at every involved station and ask which lung it belongs to before you count N2 stations.',
        teachingPoint:
          'One contralateral node sets N3 whatever else is involved. The N2a/N2b count only matters when nothing is N3.',
        sourceIds: ['tnm9-n-descriptors-2024'],
        options: [
          {
            id: 'n2b',
            label: 'N2b: two involved mediastinal stations',
            rationale:
              'Stations 7 and 4L would be N2b on their own, but station 10R is a contralateral hilar node, and any contralateral node is N3.',
            misconceptionId: 'ms-02.contralateral-hilar-n2',
          },
          {
            id: 'n3',
            label: 'N3',
            rationale:
              'Yes. Station 10R is contralateral to a left-sided tumour. One contralateral node makes the patient N3 regardless of the N2 stations.',
          },
          {
            id: 'n2a',
            label: 'N2a: station 7 does not count as a left-sided station',
            rationale: 'Station 7 counts as N2 for both sides, and in any case 10R is N3 here.',
            misconceptionId: 'ms-02.seven-is-sided',
          },
          {
            id: 'n1',
            label: 'N1: hilar disease dominates the picture',
            rationale:
              'Hilar disease is N1 only on the side of the tumour. 10R is the opposite hilum.',
            misconceptionId: 'ms-02.contralateral-hilar-n2',
          },
        ],
        answerId: 'n3',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ms-03',
    topicId: 'ebus',
    secondaryTopicIds: ['thoracic-oncology-staging'],
    title: 'Order the sampling by stage, not by anatomy',
    competency:
      'You can plan the sampling order of an EBUS staging so that N3 stations are sampled before N2 and N2 before N1, and you can say why.',
    whatToKnow: [
      'Sample from the highest N stage downward: N3, then N2, then N1, then the primary tumour. The needle that has been in a lower-stage node must not carry cells into a higher-stage node.',
      'The first result that would change management is the N3 result. A positive N3 node gives the diagnosis and the stage in one sample.',
      `A systematic staging samples at least ${num('systematic-staging-stations')}, plus any node that is suspicious on imaging or ultrasound.`,
      'Size and PET avidity decide how hard a node is to hit, not where it comes in the order.',
    ],
    prerequisites: ['ms-02'],
    concepts: ['strategy-selection', 'cognitive-error'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ms-03.anatomy-order',
        label: 'Sample the stations in the order the scope reaches them.',
        repair:
          'The order is a staging decision. Going N3 to N2 to N1 means a needle never travels from a more involved node toward a less involved one, so a positive result at a higher station cannot be contamination from a lower one.',
      },
      {
        id: 'ms-03.biggest-first',
        label: 'Sample the largest or most PET-avid node first because it is most likely positive.',
        repair:
          'A positive N1 node proves little about the mediastinum. If a small N3 node is positive it sets the stage on its own. Sample the station whose result changes management the most, and that is the highest N station in view.',
      },
    ],
    resources: [
      STATIONS_MODULE,
      { label: 'EBUS simulator', href: '/ebus-training/simulator', kind: 'simulator' },
      STAGING_CHAPTER,
    ],
    sourceIds: ['ers-esge-ests-ebus-2015', 'accp-staging-2013'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'ms-03.diagnose',
        kind: 'sequence',
        stem: 'A right upper lobe tumour for EBUS staging. Three nodes are visible: a 7 mm node at 4L, a 14 mm node at station 7 and a 22 mm PET-avid node at 11R. You also plan an endobronchial biopsy of the primary. Put the four samples in the order you take them.',
        hint: 'Assign each station its N descriptor for a right-sided tumour, then order by descriptor.',
        teachingPoint:
          'N3 before N2 before N1 before the primary. The smallest node here is the one that matters most.',
        sourceIds: ['ers-esge-ests-ebus-2015'],
        steps: [
          { id: '11r', label: '11R, 22 mm, PET-avid' },
          { id: 'primary', label: 'Endobronchial biopsy of the primary tumour' },
          { id: '4l', label: '4L, 7 mm' },
          { id: '7', label: 'Station 7, 14 mm' },
        ],
        order: ['4l', '7', '11r', 'primary'],
        rationale:
          '4L is contralateral (N3) and goes first: if it is positive, the diagnosis and the stage come from one sample. Station 7 is N2 and goes second. 11R is ipsilateral interlobar (N1) and goes third. The primary, which has the most tumour cells, is sampled last so the needle and the working channel never carry its cells upward.',
        earlyMisconceptions: { '11r': 'ms-03.biggest-first', primary: 'ms-03.biggest-first' },
      },
      repair: {
        principle:
          'Order the sampling by what each result would change. The highest N station is sampled first because its result is decisive on its own and because the needle must never travel from a more involved node toward a less involved one.',
        explanation: [
          'Two reasons stack. The first is contamination: a needle that has passed through a tumour-filled N1 node and is then placed in a clean N3 node can leave malignant cells behind, and a false-positive N3 can take a patient out of a curative pathway. Sampling N3 then N2 then N1 means any contamination can only run toward stations that are already more involved.',
          'The second is information. A positive N3 node fixes the stage at IIIB or worse and provides histology at the same time; nothing sampled afterwards changes that. A positive N1 node tells you about the hilum and nothing about the mediastinum, so the mediastinum still has to be sampled.',
          `Within a systematic staging the minimum set is ${num('systematic-staging-stations')}. Nodes that are small on CT still get sampled when they are visible on ultrasound and the staging indication is present; a station is not skipped because it is below the CT threshold of ${num('ct-node-enlarged')}.`,
        ],
        distinction:
          'The anatomy tells you where the nodes are. The staging logic tells you the order. A learner who sequences by reach or by size is solving an anatomy problem when the question is a staging problem.',
        manipulate: {
          id: 'ms-03.manipulate',
          kind: 'predict',
          stem: 'Hold the plan and change the first result.',
          baseline: 'You sample 4L first, as planned, with rapid on-site evaluation available.',
          change: 'The 4L aspirate shows adenocarcinoma with adequate lymphocytes.',
          hint: 'What does a positive N3 node leave undecided?',
          teachingPoint:
            'A positive N3 node sets the stage. The remaining work is tissue for histology and molecular testing, not more staging.',
          sourceIds: ['accp-staging-2013'],
          options: [
            {
              id: 'tissue',
              label:
                'The stage is set at N3. Take further passes from 4L for molecular testing; sampling 7 and 11R no longer changes the stage.',
              rationale:
                'Yes. One positive contralateral node fixes N3. The remaining value is adequate material for the treatment decision.',
            },
            {
              id: 'continue-all',
              label:
                'Continue to sample 7 and 11R in full, because the stage is incomplete until every station is sampled.',
              rationale:
                'Further nodal results cannot move the N descriptor above N3. Extra passes carry risk and time without a staging benefit.',
              misconceptionId: 'ms-03.anatomy-order',
            },
            {
              id: 'primary-now',
              label:
                'Move straight to the primary tumour because that is where the diagnosis comes from.',
              rationale:
                'The 4L aspirate has already given the diagnosis. Tissue from the node serves both diagnosis and molecular testing.',
              misconceptionId: 'ms-03.biggest-first',
            },
          ],
          answerId: 'tissue',
        },
      },
      verify: {
        id: 'ms-03.verify',
        kind: 'choice',
        stem: 'A left lower lobe tumour. On EBUS you see a 6 mm node at 4R, a 15 mm node at station 7 and a 20 mm hypermetabolic node at 10L. Which do you sample first?',
        hint: 'Which of these three stations is on the other side from the tumour?',
        teachingPoint:
          'The small contralateral node is the decisive one. Size and avidity do not move a node up the order.',
        sourceIds: ['ers-esge-ests-ebus-2015'],
        options: [
          {
            id: '10l',
            label: '10L, the largest and most avid node',
            rationale:
              '10L is ipsilateral hilar: N1. It is the last node in the staging order, however large.',
            misconceptionId: 'ms-03.biggest-first',
          },
          {
            id: '7',
            label: 'Station 7, because it is N2 and central',
            rationale: 'Station 7 is N2 and comes second. There is an N3 station in view.',
            misconceptionId: 'ms-03.anatomy-order',
          },
          {
            id: '4r',
            label: '4R, the 6 mm node',
            rationale:
              'Yes. For a left-sided tumour 4R is contralateral, so it is N3 and sampled first. A 6 mm node is harder to hit, but its result matters most.',
          },
          {
            id: 'primary',
            label: 'The primary tumour, to secure a diagnosis before staging',
            rationale:
              'A positive node gives the diagnosis as well as the stage. The primary is sampled last so its cells cannot travel upward.',
            misconceptionId: 'ms-03.biggest-first',
          },
        ],
        answerId: '4r',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ms-04',
    topicId: 'thoracic-oncology-staging',
    secondaryTopicIds: ['ebus'],
    title: 'Decide who needs invasive mediastinal staging',
    competency:
      'You can decide whether a patient needs invasive mediastinal staging, and whether that staging is systematic or targeted, from the tumour location and the CT and PET findings.',
    whatToKnow: [
      `Invasive staging is recommended when CT shows discrete mediastinal node enlargement (short axis ${num('ct-node-enlarged')}), when PET shows mediastinal uptake, and when the tumour is central or N1 nodes are enlarged or avid, even if the mediastinum looks clean on PET.`,
      'A peripheral clinical stage IA tumour with a normal mediastinum and hilum on CT and PET does not need invasive staging before treatment.',
      'A needle technique (EBUS, with EUS where useful) is the recommended first invasive test rather than mediastinoscopy.',
      `When staging is indicated it is systematic: at least ${num('systematic-staging-stations')}, not only the node that looks abnormal.`,
    ],
    prerequisites: ['ms-02'],
    concepts: ['strategy-selection', 'evidence-interpretation'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ms-04.pet-negative-skip',
        label:
          'A PET-negative mediastinum means no invasive staging is needed, whatever the tumour.',
        repair:
          'PET misses nodal disease in central tumours and when N1 nodes are involved. The guideline asks for invasive staging in those settings even with a PET-negative mediastinum. The exception is the peripheral stage IA tumour with a clean CT and PET.',
      },
      {
        id: 'ms-04.targeted-only',
        label: 'Sample only the node that is enlarged or avid.',
        repair: `A staging procedure is systematic because occult disease sits in normal-looking nodes. The minimum is ${num('systematic-staging-stations')}; the abnormal node is sampled in addition, in staging order.`,
      },
    ],
    resources: [STAGING_CHAPTER, STATIONS_MODULE, TNM9_MODULE],
    sourceIds: ['accp-staging-2013', 'ers-esge-ests-ebus-2015'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'ms-04.diagnose',
        kind: 'choice',
        stem: `A 4 cm central right lower lobe squamous carcinoma. All mediastinal nodes are below ${num('ct-node-enlarged')} on CT. PET shows no mediastinal uptake and faint uptake at 11R. The surgeon asks what comes next.`,
        hint: 'Two features of this tumour make imaging less reliable for the mediastinum. Find them.',
        teachingPoint:
          'A central tumour or an avid N1 node calls for invasive staging regardless of a PET-negative mediastinum, and the staging is systematic.',
        sourceIds: ['accp-staging-2013', 'ers-esge-ests-ebus-2015'],
        options: [
          {
            id: 'systematic',
            label: `Systematic EBUS staging of ${num('systematic-staging-stations')} and 11R`,
            rationale:
              'Yes. Central location and N1 uptake both lower the reliability of a negative PET, so the mediastinum is sampled systematically; 11R is added in staging order.',
          },
          {
            id: 'resect',
            label: 'Proceed to lobectomy; the mediastinum is clear on PET',
            rationale:
              'Central tumours and N1 involvement are the settings where a negative PET most often misses N2 disease. The guideline asks for invasive staging first.',
            misconceptionId: 'ms-04.pet-negative-skip',
          },
          {
            id: 'targeted',
            label: 'EBUS of 11R only, since it is the only abnormal node',
            rationale:
              'Confirming N1 does not stage the mediastinum. Staging is systematic when it is indicated.',
            misconceptionId: 'ms-04.targeted-only',
          },
          {
            id: 'mediastinoscopy',
            label: 'Mediastinoscopy as the first staging test',
            rationale:
              'A needle technique is the recommended first test. Surgical staging is reserved for a negative needle result with high suspicion.',
          },
        ],
        answerId: 'systematic',
      },
      repair: {
        principle:
          'Imaging decides whether invasive staging is needed; once it is needed, the staging is systematic. Peripheral stage IA with a clean CT and PET is the one setting that skips it.',
        explanation: [
          `The decision is made from the CT and PET together. Discrete mediastinal enlargement (${num('ct-node-enlarged')} short axis) or PET uptake in the mediastinum calls for tissue. So does a central tumour, and so does N1 node enlargement or uptake, because in both the negative predictive value of PET for N2 disease falls. The one group spared is the peripheral clinical stage IA tumour with a normal mediastinum and hilum on both tests.`,
          'Needle staging comes first: EBUS, adding EUS for stations the bronchoscope cannot reach. Mediastinoscopy is for a negative needle result when the pretest probability stays high.',
          `When the procedure is for staging, it is systematic. The minimum set is ${num('systematic-staging-stations')}, and any node that is suspicious on imaging or ultrasound is added, sampled in N3-to-N1 order. A targeted puncture of the one abnormal node answers a diagnostic question, not a staging one.`,
        ],
        distinction:
          'Diagnosis asks whether a node contains tumour. Staging asks whether the mediastinum contains tumour anywhere. The first can be targeted; the second cannot.',
        manipulate: {
          id: 'ms-04.manipulate',
          kind: 'predict',
          stem: 'Keep the imaging and change the tumour.',
          baseline:
            'The central 4 cm right lower lobe tumour with a PET-negative mediastinum and faint 11R uptake: systematic EBUS staging.',
          change:
            'The tumour is instead a 1.5 cm peripheral right upper lobe nodule. CT and PET show a normal mediastinum and no hilar uptake.',
          hint: 'Which clinical stage is this, and what does the guideline say about it?',
          teachingPoint:
            'Peripheral clinical stage IA with a clean CT and PET is the setting where invasive staging is not required.',
          sourceIds: ['accp-staging-2013'],
          options: [
            {
              id: 'no-staging',
              label: 'Invasive mediastinal staging is not required; proceed to treatment planning.',
              rationale:
                'Yes. A peripheral stage IA tumour with normal CT and PET of the mediastinum and hilum does not need invasive staging.',
            },
            {
              id: 'still-systematic',
              label: 'Systematic EBUS staging is still required for every lung cancer.',
              rationale:
                'The guideline spares the peripheral stage IA tumour with a clean mediastinum and hilum on both tests.',
              misconceptionId: 'ms-04.targeted-only',
            },
            {
              id: 'mediastinoscopy',
              label:
                'Mediastinoscopy, because a small peripheral tumour can be understaged by EBUS.',
              rationale:
                'No invasive staging is indicated here, and when it is, a needle technique comes first.',
            },
          ],
          answerId: 'no-staging',
        },
      },
      verify: {
        id: 'ms-04.verify',
        kind: 'sort',
        stem: 'Sort each patient by whether invasive mediastinal staging is recommended before treatment.',
        hint: 'Ask three questions of each: is a node enlarged on CT, is anything avid on PET, is the tumour central?',
        teachingPoint:
          'Any one of discrete enlargement, PET uptake, central location or N1 involvement is enough to require invasive staging.',
        sourceIds: ['accp-staging-2013'],
        buckets: [
          { id: 'yes', label: 'Invasive staging recommended' },
          { id: 'no', label: 'Not required' },
        ],
        items: [
          {
            id: 'ia-clean',
            label: '1.2 cm peripheral nodule, normal mediastinum and hilum on CT and PET',
            bucketId: 'no',
            rationale:
              'Peripheral stage IA with a clean mediastinum and hilum: the one group spared.',
          },
          {
            id: 'ct-enlarged',
            label: `2 cm peripheral tumour, a 12 mm short-axis 4R node on CT, no PET uptake anywhere`,
            bucketId: 'yes',
            rationale: `Discrete enlargement at or above ${num('ct-node-enlarged')} calls for tissue even when PET is negative.`,
            misconceptionId: 'ms-04.pet-negative-skip',
          },
          {
            id: 'central',
            label: '3 cm central tumour abutting the main bronchus, normal nodes on CT and PET',
            bucketId: 'yes',
            rationale: 'Central tumours are understaged by PET; invasive staging is recommended.',
            misconceptionId: 'ms-04.pet-negative-skip',
          },
          {
            id: 'pet-7',
            label: '2.5 cm peripheral tumour, PET-avid station 7, normal node size on CT',
            bucketId: 'yes',
            rationale:
              'Mediastinal PET uptake is an indication for tissue confirmation whatever the node size.',
          },
        ],
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ms-05',
    topicId: 'ebus',
    title: 'Read node features without letting them replace the needle',
    competency:
      'You can name the sonographic features that raise or lower suspicion of malignancy in a node, and you can say what they change and what they do not.',
    whatToKnow: [
      `Features associated with malignancy: round shape, distinct margin, heterogeneous echotexture, a coagulation necrosis sign, and short axis ${num('ebus-node-size-feature')}.`,
      'A central hilar structure, a hyperechoic linear core, is a feature of benign nodes. Oval or flat shape, indistinct margins and homogeneous echotexture lean benign.',
      'Features change how many passes you plan and how hard you look; they do not remove a station from a systematic staging.',
      'No feature set is accurate enough to stage a node without tissue.',
    ],
    prerequisites: ['ms-01'],
    concepts: ['imaging-interpretation', 'cognitive-error'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ms-05.skip-benign-looking',
        label: 'A node that looks benign on ultrasound can be skipped during staging.',
        repair:
          'Sonographic features shift probability; they do not stage. Occult N2 disease sits in small, oval, homogeneous nodes. In a systematic staging the minimum stations are sampled whatever they look like.',
      },
      {
        id: 'ms-05.size-alone',
        label: 'Size is the feature that matters; a small node is not worth sampling.',
        repair: `Size is one of several features and the weakest on its own. A node under ${num('ebus-node-size-feature')} with a coagulation necrosis sign is more suspicious than a larger homogeneous one, and a small node in a required station is sampled regardless.`,
      },
    ],
    resources: [
      STATIONS_MODULE,
      { label: 'EBUS simulator', href: '/ebus-training/simulator', kind: 'simulator' },
    ],
    sourceIds: ['fujiwara-2010', 'ers-esge-ests-ebus-2015'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'ms-05.diagnose',
        kind: 'choice',
        stem: 'During systematic staging of a right upper lobe tumour you reach 4L. The node is 8 mm in short axis, oval, with indistinct margins, homogeneous echotexture and a visible central hilar structure. What do you do?',
        hint: 'Separate what the features tell you about probability from what the procedure is for.',
        teachingPoint:
          'Benign-looking features lower the odds. In a staging procedure the required station is still sampled.',
        sourceIds: ['fujiwara-2010', 'ers-esge-ests-ebus-2015'],
        options: [
          {
            id: 'sample',
            label:
              'Sample it: 4L is a required station in a systematic staging, whatever it looks like',
            rationale:
              'Yes. The features make malignancy less likely, which is worth recording, but the station is part of the minimum set and the result is tissue, not appearance.',
          },
          {
            id: 'skip',
            label: 'Record it as benign and move on; the features are reassuring',
            rationale:
              'The features lower the probability; they do not reach the accuracy needed to call a contralateral station negative without tissue.',
            misconceptionId: 'ms-05.skip-benign-looking',
          },
          {
            id: 'conditional',
            label: 'Sample it only if station 7 turns out positive',
            rationale:
              'Sampling order runs from N3 downward, so 4L is sampled before 7, and its result matters on its own.',
            misconceptionId: 'ms-05.skip-benign-looking',
          },
          {
            id: 'too-small',
            label: 'Skip it because 8 mm is below the size that matters',
            rationale: `Size is one feature among several, and a required station is sampled at any size that can be hit.`,
            misconceptionId: 'ms-05.size-alone',
          },
        ],
        answerId: 'sample',
      },
      repair: {
        principle:
          'Sonographic features are a probability dial. They change how you sample a node, never whether a required station is sampled.',
        explanation: [
          `The standard feature set describes shape (round versus oval), margin (distinct versus indistinct), echotexture (heterogeneous versus homogeneous), the presence of a coagulation necrosis sign (a hypoechoic area without blood flow) and size (short axis ${num('ebus-node-size-feature')}). A central hilar structure is a benign feature. Round, distinct, heterogeneous nodes with a necrosis sign are much more often malignant.`,
          'That is useful: it tells you where to concentrate passes, when to ask for more passes before leaving a node, and how to read an inadequate aspirate. It is not a stage. Metastatic deposits in small, oval, homogeneous nodes are exactly what systematic staging exists to find.',
          'So the two decisions separate. Features inform the sampling of each node; the procedure type decides which nodes are sampled.',
        ],
        distinction:
          'What a node looks like changes your expectation of the result. What the procedure is for decides whether the node is sampled.',
        manipulate: {
          id: 'ms-05.manipulate',
          kind: 'predict',
          stem: 'Keep the station and change one feature.',
          baseline:
            'The 8 mm oval, homogeneous 4L node with a central hilar structure, sampled as part of systematic staging.',
          change:
            'Doppler shows a central area without flow and without echoes: a coagulation necrosis sign.',
          hint: 'Does this feature change the sampling, the staging, or both?',
          teachingPoint: 'A suspicious feature changes how you sample the node, not whether.',
          sourceIds: ['fujiwara-2010'],
          options: [
            {
              id: 'more-passes',
              label:
                'Suspicion rises. Plan more passes, target the necrotic area and its rim, and use rapid on-site evaluation if available.',
              rationale:
                'Yes. The feature raises the probability of malignancy and changes the sampling effort. The station was being sampled anyway.',
            },
            {
              id: 'call-positive',
              label: 'Call 4L positive on appearance and record N3.',
              rationale:
                'No feature set is accurate enough to stage without tissue. The N descriptor comes from cytology.',
              misconceptionId: 'ms-05.skip-benign-looking',
            },
            {
              id: 'no-change',
              label: 'Nothing changes; the node is small.',
              rationale:
                'Size is one feature. A necrosis sign in a small node raises suspicion and the number of passes.',
              misconceptionId: 'ms-05.size-alone',
            },
          ],
          answerId: 'more-passes',
        },
      },
      verify: {
        id: 'ms-05.verify',
        kind: 'sort',
        stem: 'Sort each ultrasound feature by the direction it moves your suspicion of malignancy.',
        hint: 'Think about what a reactive node and a replaced node each look like inside.',
        teachingPoint:
          'Round, distinct, heterogeneous, necrotic and large lean malignant. A central hilar structure, oval shape, indistinct margin and homogeneous texture lean benign.',
        sourceIds: ['fujiwara-2010'],
        buckets: [
          { id: 'up', label: 'Raises suspicion' },
          { id: 'down', label: 'Lowers suspicion' },
        ],
        items: [
          {
            id: 'round',
            label: 'Round shape',
            bucketId: 'up',
            rationale: 'A replaced node loses its flattened, oval outline.',
          },
          {
            id: 'necrosis',
            label: 'Coagulation necrosis sign',
            bucketId: 'up',
            rationale:
              'A hypoechoic area without flow inside the node is the most specific single feature.',
          },
          {
            id: 'heterogeneous',
            label: 'Heterogeneous echotexture',
            bucketId: 'up',
            rationale: 'Mixed echotexture reflects replacement of normal architecture.',
          },
          {
            id: 'distinct',
            label: 'Distinct margin',
            bucketId: 'up',
            rationale: 'Malignant nodes tend to have sharp, distinct borders.',
          },
          {
            id: 'chs',
            label: 'Central hilar structure',
            bucketId: 'down',
            rationale: 'A hyperechoic linear core is the preserved hilum of a benign node.',
          },
          {
            id: 'oval',
            label: 'Oval, flattened shape',
            bucketId: 'down',
            rationale: 'Reactive and normal nodes are oval.',
          },
          {
            id: 'homogeneous',
            label: 'Homogeneous echotexture',
            bucketId: 'down',
            rationale: 'Preserved architecture is uniform.',
            misconceptionId: 'ms-05.size-alone',
          },
        ],
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ms-06',
    topicId: 'advanced-diagnostic-bronchoscopy',
    secondaryTopicIds: ['ebus'],
    title: 'Tell a negative node from a node you missed',
    competency:
      'You can judge whether a lymph node aspirate is adequate and can distinguish a negative result from a non-diagnostic one.',
    whatToKnow: [
      'An aspirate is adequate when it shows the needle was in the node: abundant lymphocytes, germinal-centre fragments, or pigment-laden (anthracotic) macrophages.',
      'Blood and bronchial epithelial cells without lymphoid tissue mean the needle missed; "no malignant cells" on that sample is non-diagnostic, not negative.',
      'Rapid on-site evaluation guides how many passes you take at each station; the final cytopathology is the result.',
      'An adequate negative result still has a false-negative rate; with high pretest probability it is confirmed surgically.',
    ],
    prerequisites: ['ms-03'],
    concepts: ['evidence-interpretation', 'cognitive-error'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ms-06.absence-is-negative',
        label: 'No malignant cells on the slide means the station is negative.',
        repair:
          'A result is negative only when the slide proves the needle was in the node. Without lymphocytes or other nodal elements the sample is non-diagnostic, and the station has not been staged.',
      },
      {
        id: 'ms-06.blood-adequate',
        label: 'A bloody, cellular aspirate is an adequate sample.',
        repair:
          'Blood and bronchial cells come from the airway wall and the puncture path. Adequacy is about nodal tissue, not cellularity.',
      },
    ],
    resources: [
      {
        label: 'Board chapter: pathology, cytology and ROSE',
        href: '/board-prep/pathology-histology-cytology-rose-and-molecular-markers',
        kind: 'chapter',
      },
      STATIONS_MODULE,
    ],
    sourceIds: ['ers-esge-ests-ebus-2015', 'accp-staging-2013'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'ms-06.diagnose',
        kind: 'choice',
        stem: 'Two passes at station 7. Rapid on-site evaluation reports: "blood, scattered bronchial epithelial cells, no lymphocytes, no malignant cells." How do you record this station and what do you do next?',
        hint: 'What on the slide would prove the needle was inside the node?',
        teachingPoint:
          'No lymphoid tissue means no evidence of the node. The station is non-diagnostic and still needs sampling.',
        sourceIds: ['ers-esge-ests-ebus-2015'],
        options: [
          {
            id: 'nondiagnostic',
            label:
              'Non-diagnostic. Re-image the node, adjust the approach and take further passes.',
            rationale:
              'Yes. Without lymphocytes there is no proof of nodal sampling. The station is not yet staged.',
          },
          {
            id: 'negative',
            label: 'Negative. No malignant cells were seen; move to the next station.',
            rationale:
              'Absence of tumour cells in a sample that never reached the node says nothing about the node.',
            misconceptionId: 'ms-06.absence-is-negative',
          },
          {
            id: 'adequate-blood',
            label: 'Adequate. The sample is cellular; record it as negative.',
            rationale: 'Cellularity from blood and airway epithelium is not nodal tissue.',
            misconceptionId: 'ms-06.blood-adequate',
          },
          {
            id: 'positive',
            label: 'Suspicious. Bronchial cells in a node aspirate suggest tumour.',
            rationale:
              'Bronchial epithelial cells are picked up on the way through the airway wall; they are a contaminant, not a finding.',
          },
        ],
        answerId: 'nondiagnostic',
      },
      repair: {
        principle:
          'A node is negative only when the slide proves the needle was in it. Adequacy comes before interpretation.',
        explanation: [
          'The elements that prove nodal sampling are lymphocytes in quantity, germinal-centre fragments, tingible-body macrophages and pigment-laden macrophages. Blood, cartilage and bronchial epithelial cells come from the path, not the target.',
          'That gives three results for a station rather than two: positive, negative with adequate nodal material, and non-diagnostic. Only the first two stage the station. A non-diagnostic station is re-imaged, the needle path reconsidered and more passes taken; if it stays non-diagnostic, the report says so and the station may need another method.',
          'Even an adequate negative has a false-negative rate. When the pretest probability was high, an enlarged or avid node for example, a negative needle result is confirmed with surgical staging before a curative resection.',
        ],
        distinction:
          '"Negative" is a statement about the node. "No malignant cells" is a statement about the slide. The two coincide only when the slide contains the node.',
      },
      verify: {
        id: 'ms-06.verify',
        kind: 'predict',
        stem: 'Keep the station and change the slide.',
        baseline: 'Station 7 after two non-diagnostic passes: blood and bronchial cells only.',
        change:
          'A third pass shows abundant small lymphocytes, pigment-laden macrophages and no malignant cells.',
        hint: 'Does this slide prove the needle reached the node?',
        teachingPoint:
          'Lymphocytes and pigment-laden macrophages prove nodal sampling. This station can now be recorded.',
        sourceIds: ['ers-esge-ests-ebus-2015'],
        options: [
          {
            id: 'adequate-negative',
            label:
              'Adequate and negative at this station. Record it and continue in staging order.',
            rationale:
              'Yes. Nodal elements prove the sample; no malignant cells on an adequate sample is a negative result for this station.',
          },
          {
            id: 'still-non',
            label:
              'Still non-diagnostic until malignant cells are either seen or excluded by a fourth pass.',
            rationale:
              'Adequacy is decided by nodal elements, which are present. Further passes add little once the sample is adequate and on-site evaluation is negative.',
            misconceptionId: 'ms-06.blood-adequate',
          },
          {
            id: 'reactive-positive',
            label: 'Suspicious for lymphoma because of the lymphocyte count.',
            rationale:
              'Small lymphocytes and pigment-laden macrophages are the normal content of a node and the proof of adequacy.',
            misconceptionId: 'ms-06.absence-is-negative',
          },
        ],
        answerId: 'adequate-negative',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'ms-07',
    topicId: 'thoracic-oncology-staging',
    title: 'Carry a staging result to the treatment decision',
    competency:
      'You can state what an EBUS staging result changes at the tumour board, including when a negative result needs surgical confirmation.',
    whatToKnow: [
      'A positive mediastinal node moves the pathway from surgery-first toward multimodality treatment decided at the tumour board; the N2a/N2b split informs that discussion.',
      'A negative needle result in a patient with high pretest probability (enlarged or avid nodes, central tumour) is confirmed with surgical staging before resection.',
      'A negative needle result with low pretest probability can be acted on.',
      'Single-station N2 is not by itself a bar to surgery within a multimodality plan; that is a team decision, not a bronchoscopy decision.',
    ],
    prerequisites: ['ms-02', 'ms-04'],
    concepts: ['strategy-selection', 'team-decision', 'evidence-interpretation'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'ms-07.negative-is-final',
        label: 'A negative EBUS means N0, whatever the pretest probability.',
        repair:
          'Needle staging has a false-negative rate that matters most when the nodes looked abnormal. In that setting a negative result is confirmed surgically before a curative resection.',
      },
      {
        id: 'ms-07.n2-means-inoperable',
        label: 'Any N2 disease rules out surgery.',
        repair:
          'Single-station N2 may still be treated with surgery within a multimodality plan. The bronchoscopist reports the stage; the tumour board decides the pathway.',
      },
    ],
    resources: [STAGING_CHAPTER, TNM9_MODULE],
    sourceIds: ['accp-staging-2013', 'tnm9-n-descriptors-2024'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'ms-07.diagnose',
        kind: 'choice',
        stem: 'A right upper lobe tumour with a 15 mm PET-avid 4R node. Systematic EBUS: three adequate passes at 4R with abundant lymphocytes and no malignant cells; 4L and 7 adequate and negative. The surgeon asks whether to book the lobectomy.',
        hint: 'How likely was this node to be involved before the needle went in, and what does that do to a negative result?',
        teachingPoint:
          'A negative needle result in a high-probability node is confirmed surgically before resection.',
        sourceIds: ['accp-staging-2013'],
        options: [
          {
            id: 'confirm',
            label:
              'Recommend surgical mediastinal staging to confirm the negative 4R before resection',
            rationale:
              'Yes. An enlarged, avid node carries a high pretest probability; the guideline asks for surgical confirmation of a negative needle result in that setting.',
          },
          {
            id: 'book',
            label: 'Book the lobectomy; the staging was adequate and negative',
            rationale:
              'Adequate and negative is the right description of the sample, but the false-negative rate in an avid 15 mm node is too high to act on alone.',
            misconceptionId: 'ms-07.negative-is-final',
          },
          {
            id: 'repeat-ebus',
            label: 'Repeat the EBUS in two weeks',
            rationale:
              'Repeating the same test does not address its false-negative rate in this node; the next step is a different method.',
          },
          {
            id: 'chemoradiation',
            label: 'Treat as N2 with definitive chemoradiation',
            rationale: 'No tissue has shown N2 disease. Treatment follows confirmed stage.',
          },
        ],
        answerId: 'confirm',
      },
      repair: {
        principle:
          'The bronchoscopist delivers a stage with its uncertainty. A positive result is acted on; a negative result is acted on only when the pretest probability was low enough for the false-negative rate to be acceptable.',
        explanation: [
          'When needle staging is negative, the question is how probable nodal disease was before the procedure. In a patient whose indication was a central tumour or an avid or enlarged node, the guideline recommends surgical staging to confirm the negative before a curative resection. In a patient with a normal-looking mediastinum who was staged for completeness, the negative result stands.',
          'When needle staging is positive, the N descriptor decides the conversation. The ninth edition splits N2 into N2a (one station) and N2b (several). Single-station N2 is discussed as potentially resectable within a multimodality plan; multi-station N2 and N3 move toward non-surgical multimodality treatment. These are tumour-board decisions informed by the stage you report.',
          'Report the stations sampled, the adequacy of each, and the result of each. "Negative" without adequacy, or a stage without the stations, leaves the surgeon guessing.',
        ],
        distinction:
          'A positive result changes the stage. A negative result changes the stage only when the pretest probability allows it; otherwise it changes the next test.',
      },
      verify: {
        id: 'ms-07.verify',
        kind: 'predict',
        baseline:
          'The right upper lobe tumour with an avid 4R node that was adequate and negative, sent for surgical confirmation.',
        change:
          'A different patient: a left upper lobe adenocarcinoma. Systematic EBUS finds 4L positive for adenocarcinoma; 7, 4R and 10R are adequate and negative.',
        stem: 'What do you report to the tumour board?',
        hint: 'Count the involved N2 stations after checking the side of each.',
        teachingPoint:
          'One ipsilateral mediastinal station is N2a. The pathway is a multimodality discussion in which surgery can still have a place.',
        sourceIds: ['tnm9-n-descriptors-2024', 'accp-staging-2013'],
        options: [
          {
            id: 'n2a',
            label:
              'N2a: single-station ipsilateral mediastinal disease. Multimodality discussion, surgery possible within that plan.',
            rationale:
              'Yes. 4L is ipsilateral mediastinal and the only involved N2 station. The ninth edition calls that N2a, and single-station N2 is discussed for multimodality treatment that may include surgery.',
          },
          {
            id: 'n2b',
            label: 'N2b: 4L and 7 are both mediastinal stations.',
            rationale: 'Station 7 was adequate and negative. Only involved stations count.',
          },
          {
            id: 'n3',
            label: 'N3: the disease has reached the mediastinum, so surgery is excluded.',
            rationale:
              '4L is on the side of a left-sided tumour, so it is N2, and N2 disease is not by itself a bar to surgery.',
            misconceptionId: 'ms-07.n2-means-inoperable',
          },
          {
            id: 'n1',
            label: 'N1: book the lobectomy.',
            rationale: '4L is a mediastinal station, not a hilar one.',
          },
        ],
        answerId: 'n2a',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
]
