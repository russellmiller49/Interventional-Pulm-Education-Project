import { question } from './authoring'
import { n } from './teachingNumbers'
import type { Lesson } from './types'

/** Chapter 1: what an examination from the esophagus adds for someone who already performs EBUS. */
export const whatEusBAdds: Lesson = {
  id: 'what-eus-b-adds',
  title: 'What the esophagus adds to your EBUS',
  minutes: 8,
  objective:
    'Say which targets an examination from the esophagus adds to airway EBUS, and which it leaves to the airway.',
  steps: [
    {
      kind: 'predict',
      id: 'two-targets',
      title: 'Two targets left after the airway',
      stem: 'A patient with a left upper lobe mass has FDG uptake in a station 8 node beside the lower esophagus and in the left adrenal gland. You have finished the airway examination: stations 4R, 4L and 7 are sampled, and the EBUS scope is still in your hand.',
      question: question(
        'two-targets',
        'What can the same scope still examine?',
        [
          'Both: the station 8 node through the esophageal wall and the left adrenal gland through the gastric wall',
          'Passed into the esophagus, the EBUS scope reaches the nodes that lie along it below the carina, and from the proximal stomach it reaches the left adrenal gland. The 2026 ERS/ESGE/ESTS guideline suggests EUS-B-FNA or EUS-FNA for a left adrenal gland suspected of metastasis.',
        ],
        [
          'The station 8 node only; the left adrenal gland needs a gastrointestinal echoendoscope',
          `From the proximal stomach the EBUS scope shows the left adrenal gland in most patients. In pooled studies the gland was seen in ${n('adrenal-seen-eus-b')} of patients with the EBUS scope and ${n('adrenal-seen-eus')} with a gastrointestinal echoendoscope.`,
        ],
        [
          'Neither: both lie outside the reach of an EBUS scope',
          'Both lie outside the reach of the scope while it is in the airway. From the esophagus and the stomach the same scope reaches them.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'what-changes',
      title: 'What changes from EBUS',
      body: [
        'You keep the scope, the image orientation, the way a node looks and the way the needle is handled. Four things change.',
        'The course follows one survey of six landmarks, examined in the same order every time: three below the diaphragm, then three in the mediastinum as the scope is withdrawn.',
      ],
      points: [
        'The way in. The scope passes behind the larynx into the esophagus instead of between the vocal cords.',
        'Nothing to steer by in white light. There are no cartilage rings, no carina and no bronchial openings to count. Vessels, the heart and the upper abdominal organs are the landmarks, and they are found on ultrasound.',
        'Rotation does most of the work. The esophagus has structures on every side, so turning the shaft sweeps the image through a full circle at one level. Advancing and withdrawing change the level.',
        'The examination continues below the diaphragm. Through the gastric wall you see the left lobe of the liver, the abdominal aorta with the celiac trunk and superior mesenteric artery, and the left adrenal gland.',
      ],
      figure: 'survey-route',
    },
    {
      kind: 'brief',
      id: 'what-each-route-reaches',
      title: 'What each route reaches',
      body: [
        'The two routes overlap at the left paratracheal stations and station 7, and differ elsewhere. The airway keeps the hilar and interlobar nodes and the right paratracheal stations. The esophagus adds the nodes that lie along it below the carina and the targets below the diaphragm.',
        `The 2026 ERS/ESGE/ESTS guideline states that, ideally, EBUS-TBNA is combined with EUS-FNA or EUS-B-FNA for mediastinal staging instead of being used alone. How much the second route adds depends on where the nodes are. A 2016 meta-analysis found that adding the esophageal route raised sensitivity for N2 or N3 disease by ${n('added-sensitivity-eus')}. A 2024 randomised trial found a sensitivity of ${n('trial-sensitivity-ebus-alone')} with EBUS alone and ${n('trial-sensitivity-combined')} with EBUS plus EUS-B, a difference that was not statistically significant. Its authors conclude that the gain is greatest when EUS-B is used for nodes EBUS cannot reach.`,
      ],
      figure: 'reach-table',
    },
    {
      kind: 'check',
      id: 'interlobar-node',
      title: 'A different target',
      stem: 'A patient with a right lower lobe tumor has one enlarged node on CT, between the bronchus intermedius and the lower lobe pulmonary artery (station 11Ri).',
      question: question(
        'interlobar-node',
        'What does an examination from the esophagus add for this node?',
        [
          'Nothing: this node is examined from the airway',
          'Hilar and interlobar nodes lie beside the bronchi, lateral to the esophagus, with a bronchus in between. The esophageal route does not replace the airway examination for them.',
        ],
        [
          'A second window on the node from behind, useful when the airway window is unstable',
          'That holds for stations 4L and 7, which lie between the airway and the esophagus. An interlobar node lies lateral to both.',
        ],
        [
          'A needle path that avoids the pulmonary artery beside the node',
          'The node cannot be brought into the image from the esophagus, so there is no path to choose.',
        ],
      ),
    },
  ],
  takeaways: [
    'EUS-B uses the scope you already handle. The landmarks are vessels and organs instead of airways.',
    'The esophagus adds stations 8 and 9 and the targets below the diaphragm. Hilar and interlobar nodes stay with the airway.',
    'One survey, six landmarks, the same order every time.',
  ],
  sources: ['issa2023', 'ers2026', 'combined2015', 'korevaar2016', 'oki2024', 'moretti2023'],
}
