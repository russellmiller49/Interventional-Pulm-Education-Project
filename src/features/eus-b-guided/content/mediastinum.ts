import { question } from './authoring'
import type { Lesson } from './types'

/** Chapter 3: the mediastinal landmarks, met as the scope is withdrawn. */
export const stationSeven: Lesson = {
  id: 'station-7',
  title: 'Landmark 4: station 7',
  minutes: 9,
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
        'Two landmarks confirm it. The left atrium is just below the station, and the right pulmonary artery crosses beyond it. The numbers on the image are the numbers below.',
      ],
      view: 'station-7-view',
      station: 'station-7',
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
      kind: 'identify',
      id: 'mark-station-7',
      title: 'Station 7, with nothing named',
      instruction:
        'This is the course’s view of station 7 with nothing named. Click each landmark in the image as it is asked for.',
      lab: 'station-7-landmarks',
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
        'Deepest: the superior vena cava.',
        'The second, deeper node is station 10R. It is visible from here, with the pulmonary artery in front of it.',
      ],
      station: 'station-7',
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
  sources: ['issa2023', 'bugalho2018', 'nayahangan2022', 'combined2015'],
}

export const stationEight: Lesson = {
  id: 'station-8',
  title: 'Station 8: beside the lower esophagus',
  minutes: 7,
  objective:
    'Find station 8 on withdrawal from the stomach and identify it by the heart chambers around it.',
  steps: [
    {
      kind: 'predict',
      id: 'leaving-the-stomach',
      title: 'Leaving the stomach',
      stem: 'The left lobe of the liver is in the image. You withdraw through the gastroesophageal junction with the transducer facing forward and a little toward the patient’s right.',
      question: question(
        'leaving-the-stomach',
        'Which structure do you expect in the far field first?',
        [
          'The right atrium, with the inferior vena cava entering it',
          'The inferior vena cava passes through the diaphragm in front and to the right of the lower esophagus and enters the right atrium at once. Facing forward and to the right, they are the first cardiac structures in the image.',
        ],
        [
          'The left ventricle',
          'The left ventricle lies in front and to the left of the lower esophagus. It comes into the image when the transducer faces forward and to the left.',
        ],
        [
          'The descending aorta',
          'The descending aorta lies behind and to the left of the esophagus. It is seen by turning the transducer away from the heart.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'beside-the-esophagus',
      title: 'A station the airway does not reach',
      body: [
        'Station 8 is the paraesophageal station: nodes against the esophageal wall below the level of station 7. From the esophagus it is in the near field.',
        'The heart gives its level. The left atrium is above the station; the right atrium and the inferior vena cava are below and in front of it.',
      ],
      view: 'station-8-view',
      station: 'station-8',
    },
    {
      kind: 'lab',
      id: 'find-station-8',
      title: 'Find station 8',
      instruction:
        'The left lobe of the liver fills the image. Withdraw into the lower esophagus and bring station 8 into the image.',
      lab: 'station-8-reach',
    },
    {
      kind: 'identify',
      id: 'mark-station-8',
      title: 'Station 8, with nothing named',
      instruction:
        'This is the course’s view of station 8 with nothing named. Click each landmark in the image as it is asked for.',
      lab: 'station-8-landmarks',
    },
    {
      kind: 'debrief',
      id: 'station-8-labeled',
      title: 'Your image, labeled',
      of: 'find-station-8',
      body: [
        'The node is small and lies directly against the wall. What tells you the station is the heart around it, not the node itself.',
      ],
      station: 'station-8',
    },
    {
      kind: 'check',
      id: 'eight-or-seven',
      title: 'Which station is this node?',
      stem: 'A node lies in the near field against the esophageal wall. The left atrium is on the right of the image, above the node. A colleague records it as station 7.',
      question: question(
        'eight-or-seven',
        'What places this node at station 8?',
        [
          'The left atrium lies above the node',
          'Station 7 lies above the left atrium, under the carina. A node beside the esophagus with the left atrium above it is below the subcarinal station, which makes it station 8.',
        ],
        [
          'The node lies in the near field',
          'From the esophagus station 7 is also in the near field, against the wall. Depth in the image does not separate the two stations.',
        ],
        [
          'The pulmonary artery is not in the image',
          'At the subcarinal level a small rotation also takes the pulmonary artery out of the image. Its absence does not give the level; the position of the left atrium does.',
        ],
      ),
    },
  ],
  takeaways: [
    'Station 8 lies against the esophageal wall below the level of station 7.',
    'The left atrium above it, and the right atrium and inferior vena cava below it, give the level.',
    'It is examined from the esophagus; the airway route does not reach it.',
  ],
  sources: ['bugalho2018', 'combined2015'],
}

export const stationNine: Lesson = {
  id: 'station-9',
  title: 'Station 9: in the pulmonary ligament',
  minutes: 7,
  objective:
    'Find station 9 beside the lower esophagus and separate it from station 8 by the pulmonary vein and the lung.',
  steps: [
    {
      kind: 'predict',
      id: 'where-nine-begins',
      title: 'Where station 9 begins',
      stem: 'Station 8 is in the image. The CT report describes a second node lower in the chest, in the right pulmonary ligament.',
      question: question(
        'where-nine-begins',
        'Which structure marks the upper border of the station you are now looking for?',
        [
          'The inferior pulmonary vein',
          'The pulmonary ligament hangs from the inferior pulmonary vein down to the diaphragm. Station 9 is the nodes within it, so the vein is its upper border.',
        ],
        [
          'The carina',
          'The carina is the upper border of station 7. Stations 8 and 9 both lie below the subcarinal station.',
        ],
        [
          'The upper border of the left atrium',
          'The left atrium separates station 7 above it from station 8 beside the esophagus below. It does not bound the pulmonary ligament.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'in-the-ligament',
      title: 'Toward the lung, below the vein',
      body: [
        'Station 9 is the nodes in the pulmonary ligament. The transducer faces the lung on the side examined, here the patient’s right.',
        'Two things identify it: a pulmonary vein beside the node, and lung beyond it. The bright line where the image ends is the surface of the lung.',
      ],
      view: 'station-9-view',
      station: 'station-9',
    },
    {
      kind: 'lab',
      id: 'find-station-9',
      title: 'Find station 9',
      instruction:
        'Station 8 is in the image. Move along the lower esophagus and rotate until station 9 is in the image.',
      lab: 'station-9-reach',
    },
    {
      kind: 'identify',
      id: 'mark-station-9',
      title: 'Station 9, with nothing named',
      instruction:
        'This is the course’s view of station 9 with nothing named. Click each landmark in the image as it is asked for.',
      lab: 'station-9-landmarks',
    },
    {
      kind: 'debrief',
      id: 'station-9-labeled',
      title: 'Your image, labeled',
      of: 'find-station-9',
      body: [
        'Most of the image is lost in lung. That is expected here: the ligament runs out toward the lung, and the node lies in the short stretch of tissue before it.',
      ],
      station: 'station-9',
    },
    {
      kind: 'check',
      id: 'nine-on-the-left',
      title: 'The other side',
      stem: 'In another patient the node of interest is in the left pulmonary ligament.',
      question: question(
        'nine-on-the-left',
        'What changes in how you look for it?',
        [
          'The direction the transducer faces: toward the left lung, below the left inferior pulmonary vein',
          'There is a pulmonary ligament on each side. The level and the landmarks are the same; the transducer is turned toward the lung on the side of the node.',
        ],
        [
          'The level: the left pulmonary ligament lies above the left atrium',
          'Both ligaments hang below the inferior pulmonary veins, which enter the left atrium. Neither lies above it.',
        ],
        [
          'The route: a node in the left ligament is examined from the airway',
          'Neither pulmonary ligament is reached from the airway. Both are examined from the lower esophagus.',
        ],
      ),
    },
  ],
  takeaways: [
    'Station 9 is the nodes in the pulmonary ligament, below the inferior pulmonary vein.',
    'A pulmonary vein beside the node and lung beyond it identify the station.',
    'There is a ligament on each side: face the lung on the side of the node.',
  ],
  sources: ['bugalho2018', 'combined2015'],
}

export const stationFourL: Lesson = {
  id: 'station-4l',
  title: 'Landmark 5: station 4L',
  minutes: 9,
  stop: 5,
  objective:
    'Find station 4L between the aortic arch and the left pulmonary artery, and place stations 5, 6 and 4R at the same level.',
  steps: [
    {
      kind: 'predict',
      id: 'above-the-subcarinal-space',
      title: 'Above the subcarinal space',
      stem: 'Station 7 is in the image. You withdraw a few centimeters and turn the shaft toward the patient’s left.',
      question: question(
        'above-the-subcarinal-space',
        'Which two vessels frame the next station?',
        [
          'The aortic arch and the left pulmonary artery',
          'Station 4L lies in the angle between the arch above and the left pulmonary artery below. From the esophagus the two vessels are seen side by side with the node between them.',
        ],
        [
          'The aortic arch and the left subclavian artery',
          'The left subclavian artery leaves the top of the arch. It is beside station 2L, which is reached by withdrawing further.',
        ],
        [
          'The left atrium and the right pulmonary artery',
          'Those are the landmarks of station 7, the view you are leaving.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'between-two-vessels',
      title: 'A node between two vessels',
      body: [
        'Station 4L is the left lower paratracheal station. From the airway you reach it through the left wall of the trachea. From the esophagus the same node is seen from behind, with no cartilage in front of it.',
        'Look for two large echo-free vessels side by side: the aortic arch and the left pulmonary artery. Station 4L lies between them, medial to the ligamentum arteriosum.',
      ],
      view: 'station-4l-view',
      station: 'station-4l',
    },
    {
      kind: 'lab',
      id: 'find-station-4l',
      title: 'Find station 4L',
      instruction:
        'Station 7 is in the image. Withdraw toward the aortic arch and rotate until station 4L is in the image.',
      lab: 'station-4l-reach',
    },
    {
      kind: 'identify',
      id: 'mark-station-4l',
      title: 'Station 4L, with nothing named',
      instruction:
        'This is the course’s view of station 4L with nothing named. Click each landmark in the image as it is asked for.',
      lab: 'station-4l-landmarks',
    },
    {
      kind: 'debrief',
      id: 'station-4l-labeled',
      title: 'Your image, labeled',
      of: 'find-station-4l',
      body: [
        'The node fills the space between the two vessels. With color Doppler both vessels fill with flow and the node does not.',
      ],
      station: 'station-4l',
    },
    {
      kind: 'brief',
      id: 'deeper-in-the-window',
      title: 'Station 5: deeper in the same window',
      body: [
        'Turn a little further toward the patient’s left and the space between the two vessels is seen deeper. Station 5 lies beyond station 4L, lateral to the ligamentum arteriosum.',
        'From the esophagus station 5 is seen more often than it can be sampled. The needle path has to be free of the pulmonary artery and the aorta, which leaves only a low part of the station in some patients.',
      ],
      view: 'station-5-view',
      station: 'station-5',
    },
    {
      kind: 'brief',
      id: 'beyond-the-arch',
      title: 'Station 6: beyond the arch',
      body: [
        'Station 6 lies in front of and beside the aortic arch. Facing the patient’s left at this level, the arch is in the near field and the station is beyond it.',
        'It is recorded when it is seen. It is not routinely sampled along this path, because the aorta lies in between.',
        'Station 4R is at this level on the other side. The air in the trachea hides most of it; where its posterior part is seen, it lies behind the azygos vein.',
      ],
      view: 'station-6-view',
      station: 'station-6',
    },
    {
      kind: 'check',
      id: 'cough-at-the-left-wall',
      title: 'The same station, the other route',
      stem: 'A PET-avid node lies between the aortic arch and the left pulmonary artery. At airway EBUS the scope cannot be held against the left tracheal wall because of cough.',
      question: question(
        'cough-at-the-left-wall',
        'What does the esophageal route offer for this node?',
        [
          'The same station, 4L, with no airway wall to cross',
          'Station 4L lies between the trachea and the esophagus on the left. From the esophagus it is seen between the same two vessels, without cartilage in the path and with less cough.',
        ],
        [
          'Station 5 in its place, since 4L is reached only from the airway',
          'Station 4L is reached from either route. Station 5 lies deeper in the window and is not a substitute for it.',
        ],
        [
          'No view: the air in the trachea hides the left paratracheal nodes',
          'The trachea lies in front and to the right of the esophagus. Its air hides the right paratracheal stations, not the left ones.',
        ],
      ),
    },
  ],
  takeaways: [
    'Station 4L lies between the aortic arch and the left pulmonary artery.',
    'Station 5 is deeper in the same window; station 6 is beyond the arch. Neither is a routine target from the esophagus.',
    'Station 4R is at the same level on the right, mostly hidden by the air in the trachea.',
  ],
  sources: ['issa2023', 'bugalho2018', 'nayahangan2022', 'combined2015'],
}

export const stationTwoL: Lesson = {
  id: 'station-2l',
  title: 'Station 2L: above the aortic arch',
  minutes: 7,
  objective:
    'Find station 2L above the aortic arch and separate it from station 4L by the top of the arch.',
  steps: [
    {
      kind: 'predict',
      id: 'above-the-arch',
      title: 'Above the arch',
      stem: 'Station 4L is in the image between the aortic arch and the left pulmonary artery. You withdraw until the pulmonary artery has left the image and only the top of the arch remains.',
      question: question(
        'above-the-arch',
        'Which vessels do you expect beside the next station?',
        [
          'The left subclavian and left common carotid arteries',
          'Both leave the top of the arch on the left of the trachea. Station 2L lies beside them, above the arch.',
        ],
        [
          'The brachiocephalic trunk and the right subclavian artery',
          'These lie in front and to the right of the trachea, beside the right upper paratracheal station. From the esophagus the air in the trachea lies in between.',
        ],
        [
          'The azygos vein and the superior vena cava',
          'The azygos vein arches into the superior vena cava on the right, at the level of station 4R. Both are lower and on the other side.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'the-top-of-the-arch',
      title: 'The top of the arch is the border',
      body: [
        'Station 2L is the left upper paratracheal station. From the esophagus it lies in the near field on the left, beside the arteries that leave the arch.',
        'The border with station 4L is the top of the aortic arch. A left paratracheal node above it is 2L; a node at or below it is 4L. So the arch must be identified before the node is named.',
      ],
      view: 'station-2l-view',
      station: 'station-2l',
    },
    {
      kind: 'lab',
      id: 'find-station-2l',
      title: 'Find station 2L',
      instruction:
        'Station 4L is in the image. Withdraw above the aortic arch and bring station 2L into the image.',
      lab: 'station-2l-reach',
    },
    {
      kind: 'identify',
      id: 'mark-station-2l',
      title: 'Station 2L, with nothing named',
      instruction:
        'This is the course’s view of station 2L with nothing named. Click each landmark in the image as it is asked for.',
      lab: 'station-2l-landmarks',
    },
    {
      kind: 'debrief',
      id: 'station-2l-labeled',
      title: 'Your image, labeled',
      of: 'find-station-2l',
      body: [
        'The node is small and close to the wall. The arteries beyond it are cut across, so each appears as a round echo-free vessel. Deeper still is the left brachiocephalic vein.',
      ],
      station: 'station-2l',
    },
    {
      kind: 'check',
      id: 'arch-beside-the-node',
      title: 'Naming a left paratracheal node',
      stem: 'On withdrawal from station 7 a left paratracheal node comes into the image. The aortic arch lies directly beside it, and the left subclavian artery is not yet in the image.',
      question: question(
        'arch-beside-the-node',
        'Which station is recorded?',
        [
          'Station 4L: the node is at the level of the arch',
          'The top of the aortic arch separates the two left paratracheal stations. A node with the arch beside it has not passed that border.',
        ],
        [
          'Station 2L: it is the left paratracheal node reached after station 7',
          'The order in which a node is met does not name it. Between station 7 and station 2L lies station 4L, at the level of the arch.',
        ],
        [
          'Station 5: the node lies beside the aortic arch',
          'Station 5 is not paratracheal. It lies deeper, between the aorta and the pulmonary artery, lateral to the ligamentum arteriosum.',
        ],
      ),
    },
  ],
  takeaways: [
    'Station 2L lies above the aortic arch, beside the left subclavian and left common carotid arteries.',
    'The top of the arch is the border between 2L and 4L.',
    'Identify the arch before naming a left paratracheal node.',
  ],
  sources: ['bugalho2018', 'combined2015'],
}
