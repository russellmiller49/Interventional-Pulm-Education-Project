import { question } from './authoring'
import { n } from './teachingNumbers'
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

export const celiacTrunk: Lesson = {
  id: 'celiac-trunk',
  title: 'Landmark 2: the aorta, celiac trunk and SMA',
  minutes: 7,
  stop: 2,
  objective:
    'Bring the abdominal aorta and its first large branches into the image from the liver, and tell the aorta from the inferior vena cava.',
  steps: [
    {
      kind: 'predict',
      id: 'which-is-the-aorta',
      title: 'Two vessels side by side',
      stem: 'Below the diaphragm you are looking for the abdominal aorta. Two large echo-free vessels lie deep beyond the gastric wall, side by side.',
      question: question(
        'which-is-the-aorta',
        'What tells you which of the two is the aorta?',
        [
          'Its pulsation, with arterial flow on Doppler',
          'The aorta pulses with each heartbeat, and Doppler shows arterial flow in it. The inferior vena cava, the other large vessel at this level, does neither; its width changes with breathing instead.',
        ],
        [
          'A smaller vessel meeting its front',
          'Both have one. The celiac trunk and the superior mesenteric artery leave the front of the aorta, and the hepatic veins join the front of the inferior vena cava just below the diaphragm. On a still image a vessel joining looks like one leaving.',
        ],
        [
          'It is the wider of the two',
          'Width does not separate them. The inferior vena cava is often as wide as the aorta or wider, and its width changes with breathing.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'first-branches',
      title: 'The aorta and its first branches',
      body: [
        'The second landmark is the abdominal aorta with the first large vessels that leave its front: the celiac trunk and, just below it, the superior mesenteric artery (SMA). Below the diaphragm the aorta lies behind the stomach; from the cardia the transducer is turned onto it, then advanced along it to the celiac trunk.',
        'In this patient the branches lie at the level of the liver, so turning alone brings them in. The image cuts the three vessels obliquely: all three are in it, but not the point where the branches leave the aorta.',
      ],
      view: 'celiac-view',
      station: 'stop-2',
    },
    {
      kind: 'lab',
      id: 'turn-to-the-celiac-trunk',
      title: 'Turn to the celiac trunk',
      instruction:
        'The left lobe of the liver fills the image. Without advancing or withdrawing, turn the shaft and bring the celiac trunk into the image.',
      lab: 'celiac-rotate',
    },
    {
      kind: 'identify',
      id: 'mark-stop-2',
      title: 'The aorta and its branches, with nothing named',
      instruction:
        'This is the course’s view of the aorta and its first branches with nothing named. Click each landmark in the image as it is asked for.',
      lab: 'celiac-landmarks',
    },
    {
      kind: 'debrief',
      id: 'celiac-labeled',
      title: 'Your image, labeled',
      of: 'turn-to-the-celiac-trunk',
      body: [
        'Turning from the liver, the celiac trunk and the SMA came into the image before the aorta, nearer the transducer than it. The large vessel in the deep right corner, where your image includes it, is the inferior vena cava.',
      ],
      station: 'stop-2',
    },
    {
      kind: 'check',
      id: 'no-branch-yet',
      title: 'The aorta, but no branch',
      stem: 'In another patient, turning from the liver brings the aorta into the image along its length, but no vessel leaves it.',
      question: question(
        'no-branch-yet',
        'How do you bring the celiac trunk into the image?',
        [
          'Advance along the aorta until the first vessel leaves its front',
          'The celiac trunk is the first large vessel to leave the front of the abdominal aorta below the diaphragm. Following the aorta down along its length brings it in, with the SMA just below it.',
        ],
        [
          'Increase the depth',
          'The celiac trunk leaves the front of the aorta, between the aorta and the transducer. More depth shows what lies beyond the aorta, not in front of it.',
        ],
        [
          'Keep turning the shaft the same way',
          'Turning further takes the transducer off the aorta, toward the patient’s back and left, where the left adrenal gland and the left kidney come in.',
        ],
      ),
    },
  ],
  takeaways: [
    'The celiac trunk and the SMA are the first large vessels that leave the front of the abdominal aorta.',
    'From the cardia, turning the shaft brings in the aorta; advancing along it brings in the celiac trunk and the SMA.',
    'The aorta is the deep vessel the celiac trunk and the SMA leave; its pulsation and arterial Doppler flow confirm it.',
  ],
  sources: ['bugalho2018', 'issa2023'],
}

export const leftAdrenal: Lesson = {
  id: 'left-adrenal',
  title: 'Landmark 3: the left adrenal gland',
  minutes: 7,
  stop: 3,
  objective:
    'Find the left adrenal gland from the celiac trunk, tell it from the left kidney, and decide what to report when the scope does not reach it.',
  steps: [
    {
      kind: 'predict',
      id: 'from-the-celiac-trunk',
      title: 'From the celiac trunk',
      stem: 'The celiac trunk and the SMA are in the image. The CT shows a nodule in the left adrenal gland.',
      question: question(
        'from-the-celiac-trunk',
        'Where is the gland from here?',
        [
          'Turn the shaft past the aorta, advancing slightly',
          'The left adrenal gland lies to the patient’s left of the aorta at the level of the celiac trunk, behind the stomach. Turning past the aorta brings it in; in this patient the scope also advances about a centimetre. Turning further still brings in the left kidney.',
        ],
        [
          'Toward the patient’s right, behind the inferior vena cava',
          'That is where the right adrenal gland lies. From the stomach the EBUS scope does not reach it.',
        ],
        [
          'Above the diaphragm, in the lower esophagus',
          'The left adrenal gland lies below the diaphragm, behind the stomach. Withdrawing into the lower esophagus brings the heart into the image instead.',
        ],
      ),
    },
    {
      kind: 'brief',
      id: 'behind-the-stomach',
      title: 'Behind the stomach, before the kidney',
      body: [
        'The left adrenal gland lies behind the stomach, to the patient’s left of the aorta at the level of the celiac trunk, with the upper pole of the left kidney beyond it. It is the third landmark, and a target in its own right: a nodule or an enlarged gland can be sampled through the gastric wall.',
        'In this patient the gland is a thin, darker band close to the transducer, with the kidney beyond it. In a patient the gland is often Y- or V-shaped, and the kidney shows a bright central sinus that is not drawn here.',
      ],
      view: 'adrenal-view',
      station: 'stop-3',
    },
    {
      kind: 'lab',
      id: 'find-the-adrenal',
      title: 'Find the left adrenal gland',
      instruction:
        'The celiac trunk and the SMA are in the image. Bring the left adrenal gland into the image.',
      lab: 'adrenal-reach',
    },
    {
      kind: 'identify',
      id: 'mark-stop-3',
      title: 'The gland and the kidney, with nothing named',
      instruction:
        'This is the course’s view of the left adrenal gland with nothing named. Click each landmark in the image as it is asked for.',
      lab: 'adrenal-landmarks',
    },
    {
      kind: 'debrief',
      id: 'adrenal-labeled',
      title: 'Your image, labeled',
      of: 'find-the-adrenal',
      body: [
        'Turning from the celiac trunk, the aorta left the image and the gland came in close to the transducer; turning further brings the kidney in beyond it.',
        `The EBUS scope does not always reach the gland. In a 2023 meta-analysis of mostly small studies it was seen in ${n('adrenal-seen-eus-b')} of patients with the EBUS scope and ${n('adrenal-seen-eus')} with a gastrointestinal echoendoscope.`,
      ],
      station: 'stop-3',
    },
    {
      kind: 'check',
      id: 'gland-not-seen',
      title: 'When the gland is not in the image',
      stem: 'Staging a left lower lobe tumor, the CT shows a nodule in the left adrenal gland. With the EBUS scope in the stomach you cannot bring the gland into the image.',
      question: question(
        'gland-not-seen',
        'What do you write in the report about the left adrenal gland?',
        [
          'Not visualized, so not assessed',
          'A gland the scope did not bring into the image has not been examined, and the nodule is still unexplained. A gastrointestinal echoendoscope reaches the gland more often than the EBUS scope does.',
        ],
        [
          'No enlarged gland was seen',
          'This reads as a normal examination. The gland was never in the image, so nothing about the nodule was learned.',
        ],
        [
          'The nodule lies beyond the reach of endosonography',
          'The EBUS scope did not reach it in this patient. A gastrointestinal echoendoscope is a different instrument and reaches the left adrenal gland more often.',
        ],
        true,
      ),
    },
  ],
  takeaways: [
    'The left adrenal gland lies behind the stomach, to the patient’s left of the aorta at the level of the celiac trunk, with the left kidney beyond it.',
    'From the celiac trunk it is found by turning the shaft past the aorta.',
    'A gland the scope did not bring into the image has not been examined.',
  ],
  sources: ['bugalho2018', 'shweihat2019', 'moretti2023'],
}
