import { question } from './authoring'
import type { Lesson } from './types'

/** Chapter 2: the three landmarks below the diaphragm. */
export const liver: Lesson = {
  id: 'liver',
  title: 'Landmark 1: the left lobe of the liver',
  minutes: 8,
  stop: 1,
  objective:
    'Take the scope through the gastroesophageal junction and recognize the left lobe of the liver as the first landmark below the diaphragm.',
  steps: [
    {
      kind: 'predict',
      id: 'below-the-diaphragm',
      title: 'Arriving below the diaphragm',
      stem: 'The scope is in the lower esophagus and the left atrium fills the image. You advance.',
      question: question(
        'below-the-diaphragm',
        'What tells you the transducer has passed the gastroesophageal junction?',
        [
          'The heart leaves the image and even, solid tissue lies against the wall',
          'Below the diaphragm the first solid organ in front of the stomach is the left lobe of the liver. Its even, fine-grained texture replaces the moving, echo-free chambers of the heart.',
        ],
        [
          'The descending aorta comes to an end',
          'The aorta passes through the diaphragm and continues as the abdominal aorta. It marks a level only where the celiac trunk leaves it.',
        ],
        [
          'The image is lost in gastric air',
          'Contact can be lost in a stomach that holds air. That says the transducer is off the wall, not where it is.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'first-landmark',
      title: 'The first landmark',
      body: [
        'The survey starts at its deepest point. Once the scope is through the gastroesophageal junction, the left lobe of the liver is the first landmark. It confirms that the transducer is below the diaphragm, and a lesion in it can be sampled from here.',
        'The left lobe lies in front of the proximal stomach and extends toward the patient’s right. On ultrasound it is even, fine-grained, mid-gray tissue directly against the gastric wall.',
        'In a patient, branches of the portal and hepatic veins cross the liver as echo-free channels. They are not drawn in this case, so the liver looks more uniform here than it will at the bedside.',
      ],
      view: 'liver-view',
    },
    {
      kind: 'lab',
      id: 'find-the-liver',
      title: 'Find the left lobe',
      instruction:
        'The left atrium fills the image. Advance through the gastroesophageal junction and bring the left lobe of the liver into the image.',
      lab: 'liver-reach',
    },
    {
      kind: 'debrief',
      id: 'liver-labeled',
      title: 'Your image, labeled',
      of: 'find-the-liver',
      body: [
        'The liver lies beyond the gastric wall and fills the image. Note the distance on the shaft: the left lobe comes into view at about the gastroesophageal junction and stays in view as the scope goes on into the stomach.',
      ],
      points: [
        'Top of the image: the transducer against the gastric wall.',
        'Beyond the wall: the even parenchyma of the left lobe.',
        'No cardiac chamber is in the image. The heart is above the diaphragm.',
      ],
    },
    {
      kind: 'check',
      id: 'spleen-from-the-liver',
      title: 'From this view to another organ',
      stem: 'You are in the proximal stomach with the left lobe of the liver in the image.',
      question: question(
        'spleen-from-the-liver',
        'A colleague asks to see the spleen. Where is it from here?',
        [
          'Around the stomach: turn the shaft about half a circle at this level',
          'The left lobe of the liver lies in front of the proximal stomach and toward the right. The spleen lies behind it and to the left. Organs at one level are found by rotating.',
        ],
        [
          'In the same plane, deeper than the liver: increase the depth',
          'More depth shows more of what lies in front of the transducer. The spleen is on the other side of the stomach.',
        ],
        [
          'Above the diaphragm: withdraw into the esophagus',
          'The spleen is an abdominal organ. Withdrawing into the esophagus brings the heart back into the image.',
        ],
      ),
    },
  ],
  takeaways: [
    'The left lobe of the liver is the first solid organ seen through the gastric wall below the diaphragm.',
    'An organ in the image, not a distance on the shaft alone, tells you where the transducer is.',
    'At one level, other organs are found by rotating the shaft.',
  ],
  sources: ['issa2023'],
}
