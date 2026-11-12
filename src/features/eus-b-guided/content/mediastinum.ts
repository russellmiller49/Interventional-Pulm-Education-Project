import { question } from './authoring'
import type { Lesson } from './types'

/** Chapter 3: the mediastinal landmarks, met as the scope is withdrawn. */
export const stationSeven: Lesson = {
  id: 'station-7',
  title: 'Landmark 4: station 7',
  minutes: 8,
  stop: 4,
  objective:
    'Withdraw from the left atrium to the subcarinal space and confirm station 7 by its neighbors.',
  steps: [
    {
      kind: 'predict',
      id: 'above-the-atrium',
      title: 'Withdrawing from the left atrium',
      stem: 'The left atrium fills the image. You withdraw the scope slowly with the transducer still facing forward.',
      question: question(
        'above-the-atrium',
        'What comes into the image next?',
        [
          'The subcarinal space, with the pulmonary artery crossing in front of it',
          'The left atrium lies directly in front of the esophagus. Just above it is the subcarinal space, and the right pulmonary artery crosses in front of that space on its way to the right lung.',
        ],
        [
          'The aortic arch',
          'The arch is higher and lies to the left of the esophagus. It is reached by withdrawing further and turning toward the patient’s left.',
        ],
        [
          'The arch of the azygos vein',
          'The azygos vein arches forward on the right of the esophagus above the right main bronchus, higher than the subcarinal space.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'seen-from-behind',
      title: 'A station you know, seen from behind',
      body: [
        'From the airway, station 7 is seen through the medial wall of a main bronchus. From the esophagus it lies directly against the wall in the near field, with no airway in front of it.',
        'Two neighbors confirm it. The left atrium is just below the station, so it is on the tip side of the image, the left. The pulmonary artery is the large echo-free vessel beyond the node.',
        'Station 7 is the fourth landmark of the survey and the first in the mediastinum, reached as the scope is withdrawn from the stomach.',
      ],
      view: 'station-7-view',
    },
    {
      kind: 'lab',
      id: 'find-station-7',
      title: 'Find station 7',
      instruction:
        'The left atrium fills the image. Withdraw the scope and bring station 7 into the image.',
      lab: 'station-7-reach',
    },
    {
      kind: 'debrief',
      id: 'station-7-labeled',
      title: 'Your image, labeled',
      of: 'find-station-7',
      body: [
        'The node lies against the esophageal wall at the top of the image. Compare what surrounds it with the view you know from the airway.',
      ],
      points: [
        'Near field: station 7 against the esophageal wall.',
        'Beyond the node: the pulmonary artery, cut across as a round echo-free vessel.',
        'Deepest: the superior vena cava.',
        'Tip side of the image: the edge of the left atrium, where you started.',
        'The second, deeper node is station 10R. It is visible from here, with the pulmonary artery in front of it.',
      ],
    },
    {
      kind: 'check',
      id: 'same-node-other-side',
      title: 'The same node from the other side',
      stem: 'At airway EBUS a subcarinal node was seen only low and posteriorly, and the window was lost with each cough.',
      question: question(
        'same-node-other-side',
        'What do you expect with the scope in the esophagus at the same level?',
        [
          'The node in the near field, against the esophageal wall',
          'Station 7 lies between the airway and the esophagus. The low, posterior part of the station is the part closest to the esophagus.',
        ],
        [
          'The node hidden behind the air in the main bronchi',
          'From the esophagus the bronchi lie beyond the node, not in front of it. Their air ends the image in the far field and does not cover the node.',
        ],
        [
          'No view: the subcarinal station is examined from the airway only',
          'Stations 4L and 7 can be examined from either route.',
        ],
      ),
    },
  ],
  takeaways: [
    'From the esophagus, station 7 lies in the near field with no airway in front of it.',
    'The left atrium below and the pulmonary artery beyond confirm the station.',
    'The low, posterior part of the station is the part closest to the esophagus.',
  ],
  sources: ['issa2023', 'combined2015'],
}
