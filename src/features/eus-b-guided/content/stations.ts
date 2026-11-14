import type { EusbLabId } from '@/lib/eus-b-guided-contract'

/**
 * The nodal stations seen from the esophagus, each with the landmarks that identify it.
 *
 * This is the one place a station's landmarks are written. The numbered list beside a labeled
 * image, the station table and the mark-the-landmarks task all read it, and a test holds each
 * list to the lab list (`src/lib/eus-b-guided-contract.ts`), so number 2 beside the text is
 * number 2 on the image.
 *
 * "Left of the image" is the side of the scope's tip (marked Distal); "right of the image" is the
 * side of the handle (marked Proximal).
 *
 * Sources: Bugalho et al. 2018 (step-by-step description and reach); Nayahangan, Clementsen et al.
 * 2022 (the landmarks of stations 7, 4L and 4R); the IASLC station borders. Where a landmark is
 * described by its place in the image, that is what this course's case shows.
 */
export interface StationLandmark {
  /** Structure key in the case. */
  key: string
  /** As it is written in a list: capitalized, no article. */
  name: string
  /** Where it lies in the image and what it tells you. */
  where: string
}

export interface Station {
  id: string
  name: string
  /** What the station is, in a few words. */
  called: string
  /** Lesson that teaches it. Its row of the station table opens with that lesson. */
  lesson: string
  /** The labeled still of the station, where the course has one. */
  view?: EusbLabId
  /** Where the transducer is and which way it faces. */
  scope: string
  /** Landmarks first, the node last. */
  landmarks: StationLandmark[]
  /** What it is taken for, and how the landmarks settle it. */
  mistakenFor: string
  /** Whether it is sampled from the esophagus. */
  sampled: string
}

export const STATIONS: Station[] = [
  {
    id: 'station-8',
    name: 'Station 8',
    called: 'Paraesophageal, below the carina',
    lesson: 'station-8',
    view: 'station-8-view',
    scope: 'Lower esophagus, between the diaphragm and the left atrium. Facing forward.',
    landmarks: [
      {
        key: 'left_atrium',
        name: 'Left atrium',
        where: 'Right of the image. It lies above the station.',
      },
      {
        key: 'right_atrium',
        name: 'Right atrium',
        where: 'Left of the image, deep.',
      },
      {
        key: 'inferior_vena_cava',
        name: 'Inferior vena cava',
        where: 'Left of the image, nearer the scope, entering the right atrium.',
      },
      {
        key: 'station_8',
        name: 'Station 8',
        where: 'Against the esophageal wall, in the near field.',
      },
    ],
    mistakenFor:
      'Station 7. A node above the left atrium, under the carina, is station 7. A node beside the esophagus below that level is station 8.',
    sampled: 'Yes. The airway route does not reach it.',
  },
  {
    id: 'station-9',
    name: 'Station 9',
    called: 'Pulmonary ligament',
    lesson: 'station-9',
    view: 'station-9-view',
    scope:
      'Lower esophagus, below the inferior pulmonary vein. Facing the lung on the side examined.',
    landmarks: [
      {
        key: 'pulmonary_veins',
        name: 'Pulmonary vein',
        where: 'Just beyond the node. The station begins below the inferior pulmonary vein.',
      },
      {
        key: 'station_9',
        name: 'Station 9',
        where: 'Against the esophageal wall, with lung beyond it.',
      },
    ],
    mistakenFor:
      'Station 8. Both lie beside the lower esophagus. Station 9 is the one in the pulmonary ligament, toward the lung and below the inferior pulmonary vein.',
    sampled: 'Yes. The airway route does not reach it.',
  },
  {
    id: 'station-7',
    name: 'Station 7',
    called: 'Subcarinal',
    lesson: 'station-7',
    view: 'station-7-view',
    scope: 'Mid esophagus, just above the left atrium. Facing forward.',
    landmarks: [
      {
        key: 'left_atrium',
        name: 'Left atrium',
        where: 'Left of the image, deep. It lies just below the station.',
      },
      {
        key: 'pulmonary_artery',
        name: 'Right pulmonary artery',
        where: 'Beyond the node, cut across as a round echo-free vessel.',
      },
      {
        key: 'station_7',
        name: 'Station 7',
        where: 'Against the esophageal wall, in the near field.',
      },
    ],
    mistakenFor:
      'Station 8, which lies lower, with the left atrium above it. Station 10R can be in the same image, deeper, beyond the pulmonary artery.',
    sampled: 'Yes. It is reached from either route.',
  },
  {
    id: 'station-4l',
    name: 'Station 4L',
    called: 'Left lower paratracheal',
    lesson: 'station-4l',
    view: 'station-4l-view',
    scope: 'At the aortic arch. Facing forward, turned toward the patient’s left.',
    landmarks: [
      {
        key: 'aorta',
        name: 'Aortic arch',
        where: 'Right of the image.',
      },
      {
        key: 'pulmonary_artery',
        name: 'Left pulmonary artery',
        where: 'Left of the image.',
      },
      {
        key: 'station_4l',
        name: 'Station 4L',
        where: 'Between the two vessels.',
      },
    ],
    mistakenFor:
      'Station 5, which lies deeper between the same two vessels, lateral to the ligamentum arteriosum.',
    sampled: 'Yes. It is reached from either route.',
  },
  {
    id: 'station-5',
    name: 'Station 5',
    called: 'Subaortic (aortopulmonary window)',
    lesson: 'station-4l',
    view: 'station-5-view',
    scope: 'At the level of station 4L, turned further toward the patient’s left.',
    landmarks: [
      {
        key: 'station_4l',
        name: 'Station 4L',
        where: 'In the near field. Station 5 is beyond it.',
      },
      {
        key: 'pulmonary_artery',
        name: 'Left pulmonary artery',
        where: 'Left of the image.',
      },
      {
        key: 'aorta',
        name: 'Aortic arch',
        where: 'Right of the image.',
      },
      {
        key: 'station_5',
        name: 'Station 5',
        where: 'Deeper, between the pulmonary artery and the aorta.',
      },
    ],
    mistakenFor: 'Station 4L, which is the nearer node, medial to the ligamentum arteriosum.',
    sampled: 'Not routinely. Only a low part of the station with no vessel in the needle path.',
  },
  {
    id: 'station-6',
    name: 'Station 6',
    called: 'Para-aortic',
    lesson: 'station-4l',
    view: 'station-6-view',
    scope: 'At the aortic arch, facing the patient’s left.',
    landmarks: [
      {
        key: 'aorta',
        name: 'Aortic arch',
        where: 'In the near field, filling most of the image.',
      },
      {
        key: 'station_6',
        name: 'Station 6',
        where: 'Beyond the aorta.',
      },
    ],
    mistakenFor:
      'Station 5, which lies between the aorta and the pulmonary artery, not beyond the aorta.',
    sampled: 'Not routinely. The aorta lies in the path.',
  },
  {
    id: 'station-4r',
    name: 'Station 4R',
    called: 'Right lower paratracheal',
    lesson: 'station-4l',
    scope: 'At the level of station 4L, turned toward the patient’s right.',
    landmarks: [
      {
        key: 'azygos_vein',
        name: 'Azygos vein',
        where: 'Arching forward on the right, close to the scope.',
      },
      {
        key: 'station_4r',
        name: 'Station 4R',
        where: 'Its posterior part only, behind the azygos vein, where it is seen at all.',
      },
    ],
    mistakenFor:
      'A station that has been examined. In many patients the air in the trachea hides most of it, and what is not seen has not been examined.',
    sampled: 'Its posterior part, in some patients. The airway is the usual route.',
  },
  {
    id: 'station-2l',
    name: 'Station 2L',
    called: 'Left upper paratracheal',
    lesson: 'station-2l',
    view: 'station-2l-view',
    scope: 'Upper esophagus, above the aortic arch. Facing forward and to the patient’s left.',
    landmarks: [
      {
        key: 'aorta',
        name: 'Aortic arch',
        where: 'Left of the image: the top of the arch, now below the transducer.',
      },
      {
        key: 'left_subclavian_artery',
        name: 'Left subclavian artery',
        where: 'Right of the image, beyond the node.',
      },
      {
        key: 'left_common_carotid_artery',
        name: 'Left common carotid artery',
        where: 'Deeper than the subclavian artery.',
      },
      {
        key: 'station_2l',
        name: 'Station 2L',
        where: 'Against the esophageal wall, in the near field.',
      },
    ],
    mistakenFor:
      'Station 4L. The top of the aortic arch is the border: a left paratracheal node above it is 2L, a node at or below it is 4L.',
    sampled: 'Yes. It is reached from either route.',
  },
]

export type StationId = (typeof STATIONS)[number]['id']

export function stationById(id: string): Station | undefined {
  return STATIONS.find((station) => station.id === id)
}
