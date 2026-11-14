import { Link } from '@/i18n/navigation'
import { lessonById, lessonHref, lessonNumber } from '../content/curriculum'
import { STATIONS, stationById, type Station } from '../content/stations'
import styles from './eus-b-guided.module.css'

/**
 * The landmarks of one station as a numbered list. Beside a labeled image the numbers are the
 * numbers on the image: both come from the same list, in the same order.
 */
export function StationLandmarkList({ station }: { station: string }) {
  const entry = stationById(station)
  if (!entry) return null
  return (
    <section className={styles.landmarks} data-station-landmarks={entry.id}>
      <h3>Landmarks of {entry.name.replace(/^S/, 's')}</h3>
      <ol>
        {entry.landmarks.map((landmark) => (
          <li key={landmark.key} data-landmark={landmark.key}>
            <strong>{landmark.name}.</strong> {landmark.where}
          </li>
        ))}
      </ol>
    </section>
  )
}

function StationRow({ station, open }: { station: Station; open: boolean }) {
  const lesson = lessonById(station.lesson)
  if (!open)
    return (
      <tr data-station-row={station.id} data-open="false">
        <th scope="row">{station.name}</th>
        <td colSpan={3} className={styles.muted}>
          {lesson ? (
            <>
              Its landmarks open with lesson {lessonNumber(lesson.id)},{' '}
              <Link href={lessonHref(lesson.id)}>{lesson.title}</Link>.
            </>
          ) : (
            'Its lesson is not open yet.'
          )}
        </td>
      </tr>
    )
  return (
    <tr data-station-row={station.id} data-open="true">
      <th scope="row">
        {station.name}
        <small>{station.called}</small>
      </th>
      <td data-label="Where the transducer is">{station.scope}</td>
      <td data-label="Landmarks that identify it">
        <ol>
          {station.landmarks.map((landmark) => (
            <li key={landmark.key}>
              <strong>{landmark.name}.</strong> {landmark.where}
            </li>
          ))}
        </ol>
      </td>
      <td data-label="Not to be taken for">
        <p>{station.mistakenFor}</p>
        <p className={styles.muted}>Sampled from the esophagus: {station.sampled}</p>
      </td>
    </tr>
  )
}

/**
 * Every station seen from the esophagus with the landmarks that identify it. A station's row is
 * filled in once its lesson has taught it, so the table never answers a prediction the learner
 * has not yet made; `open` lists the stations to fill in, or is 'all'.
 */
export function StationTable({ open }: { open: ReadonlySet<string> | 'all' }) {
  return (
    <div className={styles.stationsWrap}>
      <table className={styles.stations} data-station-table>
        <caption>
          Nodal stations seen from the esophagus, from the lowest up. Left of the image is the side
          of the scope’s tip; right is the side of the handle.
        </caption>
        <thead>
          <tr>
            <th scope="col">Station</th>
            <th scope="col">Where the transducer is</th>
            <th scope="col">Landmarks that identify it</th>
            <th scope="col">Not to be taken for</th>
          </tr>
        </thead>
        <tbody>
          {STATIONS.map((station) => (
            <StationRow
              key={station.id}
              station={station}
              open={open === 'all' || open.has(station.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The stations a learner has been taught: those whose lesson they have reached the end of. */
export function stationsTaught(reviewedLessonIds: readonly string[]) {
  return new Set(
    STATIONS.filter((station) => reviewedLessonIds.includes(station.lesson)).map(
      (station) => station.id,
    ),
  )
}
