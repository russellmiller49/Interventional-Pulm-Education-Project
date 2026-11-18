import { question as q } from './authoring'
import type { NodeAnnotationLabel } from './node-feature-annotations.generated'
import { EBUS_NUMBERS } from './teachingNumbers'
import type { Question } from './types'

/*
 * Chapter reviews (2026-11-11): a few image questions at the end of a chapter, mixed across the
 * lessons the learner has finished so far. They are retrieval practice: each shows an image first
 * and names nothing on it until the learner has answered.
 *
 * Every image here already carries labels the owner checked: his outlines on the station stills
 * and the node stills, and the marks he confirmed on the two patient recordings. A question asks
 * only what those labels and the lesson it draws on support. The needle picture is the lab's own
 * simulated picture. Four chapters have a review; the first three end before the course has shown
 * an image with checked labels to ask about.
 *
 * Owner ruling `ebus-review-stems` (2026-11-14, "Correct named stems"), on four of these:
 * a still shows a craniocaudal slice, so the 10R and 2L stems say what is given (the scope's
 * position, the side) and what the picture shows (which side of the vessel the nodes lie on);
 * the necrosis stem says the still is grayscale and that the absent flow is supposed, and gives
 * the sign as associated with malignancy, not diagnostic; the Doppler stem says where the vessel
 * lies relative to the needle's entry. He confirms the image-dependent details before any of the
 * four is recorded as approved.
 */
export type ReviewImage =
  /** A station's ultrasound still. Its outlines are numbered from the start and named after the answer. */
  | { kind: 'still'; station: string }
  /** One of lesson 16's node stills. The listed outlines open after the answer. */
  | { kind: 'node'; slug: string; layers: NodeAnnotationLabel[] }
  /** A paused frame of a patient recording. Its marks open after the answer. */
  | { kind: 'clip'; clip: string; stop: string }
  /** The needle lab's simulated picture. The true tip is marked after the answer. */
  | { kind: 'needle'; state: 'at-stop' | 'turned' }
export interface ReviewItem {
  /** The lesson this image question draws on. */
  lessonId: string
  image: ReviewImage
  question: Question
}
export interface ChapterReview {
  chapterId: string
  items: ReviewItem[]
}
const item = (lessonId: string, image: ReviewImage, question: Question): ReviewItem => ({
  lessonId,
  image,
  question,
})

export const CHAPTER_REVIEWS: ChapterReview[] = [
  {
    chapterId: 'anatomy',
    items: [
      item(
        'doppler',
        { kind: 'clip', clip: 'doppler-node-vessels', stop: 'late' },
        q(
          'review-anatomy-pleura',
          'A frame from a patient recording with colour Doppler on. Deep to the node, a bright line runs across the image. What is it?',
          [
            'Pleura',
            'The bright line deep to the node is pleura, and the colour on it is a small vessel at the pleural line. What lies beyond a node matters as much as what lies in front of it.',
          ],
          [
            'The far wall of a large vessel',
            'A vessel shows a dark lumen between two walls. This is a single bright line.',
          ],
          [
            'The airway wall',
            'The airway wall is at the top of the image, against the transducer.',
          ],
        ),
      ),
      item(
        'left-paratracheal',
        { kind: 'still', station: '4L' },
        q(
          'review-anatomy-4l',
          'Outline 3 is the aorta and outline 4 is the pulmonary artery. In which station are the nodes outlined 1 and 2?',
          [
            '4L',
            'A left paratracheal node between the aortic arch and the left pulmonary artery is in station 4L. The two outlines are two nodes in that one station.',
          ],
          ['2L', 'Station 2L lies above the aortic arch.'],
          ['10L', 'Station 10L is hilar, beside the left main bronchus.'],
        ),
      ),
      item(
        'right-paratracheal',
        { kind: 'still', station: '4R' },
        q(
          'review-anatomy-4r',
          'Outline 2 is the superior vena cava. Which of these stations holds the node outlined 1?',
          [
            '4R',
            'The superior vena cava lies in front of the right paratracheal nodes. Of these three stations, only 4R is beside it.',
          ],
          ['4L', 'Station 4L is on the left, between the aorta and the left pulmonary artery.'],
          ['7', 'Station 7 lies below the carina, between the main bronchi.'],
        ),
      ),
    ],
  },
  {
    chapterId: 'plan',
    items: [
      item(
        'hilar-interlobar',
        { kind: 'still', station: '10R' },
        q(
          'review-plan-10r',
          'The scope is in the right main bronchus. Outline 3 is the azygos vein. The nodes outlined 1 and 2 lie on the side of the vein away from the orientation dot. Which station are they in?',
          [
            '10R',
            'The dot marks the cephalad side of the image, so nodes on the far side of the azygos vein from it lie caudal to the vein, below its lower border. That border is the lower limit of 4R. Below it, beside the right main bronchus, the nodes are hilar: station 10R. The still shows which side of the vein the nodes are on; that the scope is in the right main bronchus is given, not shown.',
          ],
          [
            '4R',
            'Station 4R ends at the lower border of the azygos vein. These nodes lie caudal to it.',
          ],
          [
            '11Rs',
            'Station 11Rs is interlobar, between the right upper-lobe bronchus and the bronchus intermedius.',
          ],
        ),
      ),
      item(
        'systematic-staging',
        { kind: 'still', station: '10R' },
        q(
          'review-plan-count',
          'The same still. Outlines 1 and 2 are two separate nodes. If both contained tumor, how many stations would be involved?',
          ['One', 'Both nodes are in station 10R. Stations are counted, not nodes.'],
          ['Two', 'Two nodes in one station are one involved station.'],
          [
            'It depends on the size of each node',
            'Size does not change which station a node is in, or how stations are counted.',
          ],
        ),
      ),
      item(
        'doppler',
        { kind: 'clip', clip: 'doppler-node-vessels', stop: 'flow' },
        q(
          'review-plan-path',
          'A frame with colour Doppler on, before a needle is passed into this node. Colour appears at the near margin of the node, on the side of the orientation dot. What does it change?',
          [
            'The needle path: choose a line into the node that avoids it',
            'The colour is a small vessel at the margin of the node. The needle enters the image from the side of the dot and crosses the near margin first, so this vessel lies where a needle would enter. Doppler is part of assessing the path: choose a line into the node that is clear of the vessel, and confirm it before the needle leaves the sheath.',
          ],
          [
            'Nothing: colour outside the node does not matter',
            'A vessel at the near margin, on the side the needle comes from, lies where a needle would enter the node. It matters to the path.',
          ],
          [
            'The diagnosis: flow at the margin means the node is malignant',
            'Colour flow is not pathology.',
          ],
        ),
      ),
    ],
  },
  {
    chapterId: 'sample',
    items: [
      item(
        'node-characterization',
        { kind: 'node', slug: 'station-4r-oval-chs', layers: ['node', 'chs'] },
        q(
          'review-sample-chs',
          'A node at station 4R. A bright band runs through its center. What is it, and which way does it point?',
          [
            'A central hilar structure, which favors a benign node',
            'A linear bright band in the center of a node is a central hilar structure. Its presence favors a benign node; malignant nodes tend to lose it.',
          ],
          [
            'A coagulation necrosis sign, which favors malignancy',
            'Necrosis is a dark area inside the node with no flow on Doppler, not a bright band.',
          ],
          [
            'A distinct margin, which favors malignancy',
            'The margin is the border of the node. This band runs through its center.',
          ],
        ),
      ),
      item(
        'hilar-interlobar',
        { kind: 'still', station: '11Rs' },
        q(
          'review-sample-11rs',
          'The scope is at the right upper-lobe takeoff. Outlines 1 and 3 are pulmonary artery. The node outlined 2 lies between the upper-lobe bronchus and the bronchus intermedius. Which station?',
          [
            '11Rs',
            'The interlobar station between the right upper-lobe bronchus and the bronchus intermedius is 11Rs.',
          ],
          ['11Ri', 'Station 11Ri is between the middle- and lower-lobe bronchi.'],
          ['10R', 'Station 10R is hilar, beside the right main bronchus.'],
        ),
      ),
      item(
        'node-characterization',
        { kind: 'node', slug: 'station-7-necrosis', layers: ['node', 'cns'] },
        q(
          'review-sample-necrosis',
          'A grayscale still of a node at station 7 with well-defined dark areas inside it. No Doppler is shown on this frame. Suppose Doppler were then applied and showed no flow in those areas. What would the sign be, and how much would it weigh?',
          [
            'A coagulation necrosis sign: associated with malignancy, and not a substitute for a sample',
            `A dark area inside the node with no flow on Doppler is a coagulation necrosis sign. On this still you can see only the dark areas; the absent flow is supposed for the question. The sign is associated with malignancy (specificity ${EBUS_NUMBERS.value('cns-specificity')} in pooled studies), but granulomatous disease such as tuberculosis can show it too, so it raises suspicion and the node is still sampled.`,
          ],
          [
            'A central hilar structure: it favors a benign node',
            'A central hilar structure is a bright band in the center of the node, not a dark area.',
          ],
          [
            'Vessels within the node: the areas would fill with colour',
            'With no flow on Doppler, as the question supposes, the dark areas are not vessels.',
          ],
        ),
      ),
    ],
  },
  {
    chapterId: 'report',
    items: [
      item(
        'needle-safety',
        { kind: 'needle', state: 'turned' },
        q(
          'review-report-tip',
          'The needle was at the stop a moment ago. The scope has turned slightly and the line on the screen is now shorter. Where is the tip?',
          [
            'Out of the image: the line that remains is shaft',
            'Less of the needle now lies in the imaging plane, and the tip is beyond the end of the line. Hold the needle still and turn the scope back until the tip returns.',
          ],
          [
            'At the end of the line, in the near part of the node',
            'The end of the line is where the needle leaves the imaging plane, not where the needle ends.',
          ],
          [
            'Back in the sheath: the needle has retracted',
            'The needle has not moved. The scope has.',
          ],
        ),
      ),
      item(
        'results-reporting',
        {
          kind: 'node',
          slug: 'station-7-round-distinct',
          layers: ['node', 'distinct-margin', 'long-axis', 'short-axis'],
        },
        q(
          'review-report-blood',
          'This round node with a distinct margin at station 7 is sampled, and the aspirate is blood only. How is station 7 reported?',
          [
            'Sampled, nonrepresentative: not a negative station',
            'Suspicious features do not make the node positive, and a sample of blood does not make it negative. The report says the sample did not represent the node.',
          ],
          [
            'Negative: no malignant cells were seen',
            'Blood alone does not show that the node was sampled, so it cannot be called negative.',
          ],
          [
            'Positive: a round node with a distinct margin is malignant',
            'Sonographic features raise or lower suspicion. Pathology makes the diagnosis.',
          ],
        ),
      ),
      item(
        'left-paratracheal',
        { kind: 'still', station: '2L' },
        q(
          'review-report-2l',
          'The scope is in the trachea with the transducer turned to the left wall. Outline 4 is the aorta and outline 1 is the brachiocephalic trunk. The nodes outlined 2 and 3 lie on the side of the aorta nearer the orientation dot. Which station?',
          [
            '2L',
            'The dot marks the cephalad side of the image, so these nodes lie above the aorta outlined here, which is the arch. The upper margin of the arch is the lower border of station 2L: a left paratracheal node above it is in 2L. The still shows that the nodes are above the arch; that they are left paratracheal comes from where the transducer is turned, which is given, not shown.',
          ],
          [
            '4L',
            'Station 4L lies lower, between the upper margin of the aortic arch and the left pulmonary artery.',
          ],
          [
            '2R',
            'Station 2R is on the right. Stations 2 and 4 are divided at the left lateral border of the trachea.',
          ],
        ),
      ),
    ],
  },
]
export const chapterReview = (chapterId: string | undefined) =>
  CHAPTER_REVIEWS.find((review) => review.chapterId === chapterId)
export const reviewHref = (chapterId: string) =>
  '/ebus-guided/learn?review=' + encodeURIComponent(chapterId)
