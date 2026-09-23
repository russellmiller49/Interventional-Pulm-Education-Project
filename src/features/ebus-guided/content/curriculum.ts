import { needleModel, contactModel, measurementModel, routeModel } from './models'
import type { Lesson, Topic } from './types'
import { question } from './authoring'
import { IMAGE_INTERPRETATIONS } from './image-items'
import { prepareLessons } from './prepare'
import { optimizeLessons } from './optimize'
import { locateLessons } from './locate'
import { planLessons } from './plan'
import { sampleLessons } from './sample'
import { completeLessons } from './complete'
export const BASE = '/ebus-guided'
export const RELEASE = 'unlisted-preview'
export const TOPICS: Topic[] = ['Prepare', 'Optimize', 'Locate', 'Plan', 'Sample', 'Complete']
export { question } from './authoring'
export const coupling: Lesson = {
  id: 'acoustic-contact',
  title: 'Acoustic contact and coupling',
  topic: 'Prepare',
  minutes: 8,
  objective: 'Distinguish loss of acoustic contact from an image-brightness problem.',
  recall:
    'The transducer is on one side of the distal scope. Rotating the scope changes which airway wall it faces; tip flexion and advancement also change its relationship to the wall. This activity uses tip flexion.',
  concept: 'Ultrasound needs an acoustic window',
  paragraphs: [
    'Air between the transducer and the airway wall reflects most of the incident ultrasound. A usable window requires contact between the transducer or fluid-filled balloon and the wall. Gain amplifies received echoes; it cannot replace missing contact.',
    'First locate the airway wall and establish a stable window. Then adjust depth and gain. The balloon can assist coupling, but inflation is device-specific and does not guarantee a good window.',
  ],
  checklist: [
    'Orient the transducer toward the wall.',
    'Establish contact without forcing the scope.',
    'Look for stable tissue echoes before changing gain.',
  ],
  worked: {
    context: 'During a sweep, the image disappears as the transducer turns away from the wall.',
    reasoning:
      'Return toward the prior window and reassess contact. Once tissue echoes return, optimize the image. A brighter blank sector would still lack an acoustic window.',
  },
  question: {
    ...question(
      'contact-predict',
      'Tissue echoes disappear during rotation although gain is unchanged. Which explanation should you check first?',
      [
        'Loss of contact with the airway wall',
        'A change with scope position suggests loss of the acoustic window. Reassess contact before amplifying the received signal.',
      ],
      [
        'A sudden change in lymph-node echogenicity',
        'The immediate link to scope rotation favors acquisition rather than a change in tissue.',
      ],
      [
        'An incorrect caliper position',
        'Calipers measure a displayed image; they do not establish acoustic contact.',
      ],
    ),
    imagePolicy: 'none',
  },
  lab: {
    kind: 'simulator',
    linkedLesson: 'acoustic-contact',
    goal: 'coupling',
    presetKey: 'station_7_node_a::rms',
    controls: ['flexion'],
    freeDrive: true,
    initialRoll: 0,
    instruction:
      'Compare the initial tip/wall close-up and ultrasound with the current acquisition. Use small Tip flexion changes in this authored setup and stop when tissue echoes return. Seeing the airway wall optically does not establish transducer contact. The comparison uses actual model acquisitions; the contact index is not pressure, force or balloon volume.',
  },
  observation: {
    ...question(
      'contact-observe',
      'What changed when the scan window returned?',
      [
        'Tissue echoes returned in the model',
        'The acoustic renderer now samples tissue through a coupled window. This is a simulated response, not a measurement in a patient.',
      ],
      [
        'The node became histologically benign',
        'An acquisition change supplies no histologic diagnosis.',
      ],
      [
        'The gain setting automatically increased',
        'Tip flexion changed the transducer-to-wall relationship; gain remained unchanged.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  transfer: {
    ...question(
      'contact-transfer',
      'At another station the airway wall remains in view, but the ultrasound sector becomes dark after withdrawing slightly. What is the next acquisition check?',
      [
        'Reassess transducer-to-wall contact',
        'An endoscopic view of the wall does not prove transducer contact. Re-establish the window, then optimize the ultrasound image.',
      ],
      [
        'Advance the needle to find tissue',
        'Needle passage without a reliable image removes essential guidance and risks injury.',
      ],
      [
        'Label the station free of lymph nodes',
        'Failure to display tissue is not evidence that the station contains no node.',
      ],
      true,
    ),
    imagePolicy: 'none',
  },
  diagram: 'ultrasound',
  takeaways: [
    'Contact precedes image optimization.',
    'An absent image is not a negative nodal assessment.',
  ],
  sources: ['ics2023', 'simulation'],
  boundary:
    'The grayscale image is simulated from one anatomy model. Contact quality is an authored model index; it is not a measured pressure or a clinical safety threshold.',
}
const authoredLessons: Lesson[] = [
  ...prepareLessons,
  coupling,
  contactModel,
  ...optimizeLessons,
  measurementModel,
  ...locateLessons,
  ...planLessons,
  routeModel,
  ...sampleLessons.flatMap((lesson) =>
    lesson.id === 'needle-safety' ? [lesson, needleModel] : [lesson],
  ),
  ...completeLessons,
]
export const HISTORICAL_IMAGE_QUESTIONS = authoredLessons
  .filter((lesson) => IMAGE_INTERPRETATIONS[lesson.id])
  .map((lesson) => lesson.observation)
export const HISTORICAL_MODEL_QUESTIONS = authoredLessons
  .filter((lesson) => lesson.lab?.kind === 'model')
  .map((lesson) => lesson.question)
function chapter(id: string, title: string, ids: string[]) {
  return {
    id,
    title,
    lessons: ids.map((lessonId) => {
      const lesson = authoredLessons.find((entry) => entry.id === lessonId)
      if (!lesson) throw new Error('Unknown EBUS chapter lesson: ' + lessonId)
      if (lesson.lab?.kind === 'model')
        return {
          ...lesson,
          question: { ...lesson.question, id: lesson.question.id + '-application-v2' },
        }
      return IMAGE_INTERPRETATIONS[lessonId]
        ? { ...lesson, observation: IMAGE_INTERPRETATIONS[lessonId] }
        : lesson
    }),
  }
}
/** The sole course-order registry. Topic IDs remain historical analytics categories. */
export const CHAPTERS = [
  chapter('prepare', 'Define the examination and prepare', ['clinical-question', 'preparation']),
  chapter('contact', 'Understand the scope and establish contact', [
    'scope-orientation',
    'acoustic-contact',
    'contact-cutaway-model',
  ]),
  chapter('image', 'Obtain and interpret a useful ultrasound image', [
    'image-depth',
    'gain-contrast',
    'doppler',
    'measurement-phantoms',
    'capture',
  ]),
  chapter('anatomy', 'Identify anatomical windows and stations', [
    'ct-map',
    'station-seven',
    'right-paratracheal',
    'left-paratracheal',
    'hilar-interlobar',
  ]),
  chapter('plan', 'Describe nodes and plan the examination', [
    'node-characterization',
    'systematic-staging',
    'eus-b',
    'eus-b-route-model',
  ]),
  chapter('sample', 'Sample and preserve useful tissue', [
    'needle-safety',
    'needle-assembly-model',
    'adequacy-rose',
    'specimen-triage',
  ]),
  chapter('report', 'Troubleshoot, recover, and report', [
    'difficult-acquisition',
    'complications-recovery',
    'results-reporting',
  ]),
]
export const LESSONS: Lesson[] = CHAPTERS.flatMap((entry) => entry.lessons)
export function chapterForLesson(id: string) {
  return CHAPTERS.find((entry) => entry.lessons.some((lesson) => lesson.id === id))!
}
export function lessonById(id: string | undefined) {
  return LESSONS.find((l) => l.id === id)
}
export function nextLesson(completed: readonly string[]) {
  return LESSONS.find((l) => !completed.includes(l.id))
}
export function lessonHref(id: string) {
  return BASE + '/learn?section=' + encodeURIComponent(id)
}
export const COURSE_OBJECTIVES = [
  'Distinguish a diagnostic request from the extent of a staging examination.',
  'Identify acquisition problems and correct the relevant image or scope control.',
  'Use airway and vascular landmarks to assign nodal stations.',
  'Plan sampling and specimen handling while preserving safety and staging information.',
  'Interpret a result in its sampling context and define the necessary follow-up.',
]
export const GUIDED_MINUTES = LESSONS.reduce((total, lesson) => total + lesson.minutes, 0)
