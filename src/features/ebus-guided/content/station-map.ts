import coreStations from '../../../../EBUS-course/content/stations/core-stations.json'
import stationRules from '../../../../EBUS-course/content/tnm-staging/station-rules.json'

/**
 * The course's nodal map (owner-approved plan of 2026-11-10: one labelled map used across the
 * course, in place of five unlabelled ovals).
 *
 * Nothing about a station is written here. The ten stations a linear EBUS scope reaches come
 * from the owner's existing station records (`EBUS-course/content/stations/core-stations.json`:
 * names, borders, landmark vessels, EBUS window, access) and their side and basin from the
 * staging rules beside them (`tnm-staging/station-rules.json`). The four stations the course
 * names but does not scan (5, 6, 8, 9) carry only their IASLC name and what the EUS-B lesson
 * already says about reaching them.
 *
 * Only the positions are new: where each station sits on a schematic drawn like a coronal CT,
 * patient's right on the left of the picture. They are a drawing aid, not anatomy to measure.
 */
export type PrimarySide = 'right' | 'left'
export type NCategory = 'N1' | 'N2' | 'N3'
/** How the station is reached: airway only, airway or esophagus, esophagus only, or neither. */
export type StationAccess = 'ebus' | 'both' | 'eus-b' | 'neither'
type Side = 'right' | 'left' | 'midline' | 'either'
type Basin = 'mediastinal' | 'hilar' | 'intrapulmonary'
type CoreStation = (typeof coreStations)[number]

export interface MapStation {
  id: string
  name: string
  side: Side
  basin: Basin
  access: StationAccess
  /** Centre of the station on the 520 × 420 drawing, patient's right on the left. */
  x: number
  y: number
  /** The owner's station record, for the ten stations the course scans. */
  record?: CoreStation
  /** What the course says about a station it names but does not scan. */
  context?: string
}

const POSITIONS: Record<string, [number, number]> = {
  '2R': [228, 46],
  '2L': [292, 46],
  '4R': [228, 108],
  '4L': [288, 120],
  '7': [262, 206],
  '10R': [184, 160],
  '10L': [372, 180],
  '11Rs': [150, 212],
  '11Ri': [146, 326],
  '11L': [402, 246],
}
const rule = (id: string) => stationRules.find((entry) => entry.stationId === id)!

const scanned: MapStation[] = coreStations.map((record) => ({
  id: record.id,
  name: record.iaslcName,
  side: rule(record.id).side as Side,
  basin: rule(record.id).basin as Basin,
  access: record.accessProfile === 'Both' ? 'both' : 'ebus',
  x: POSITIONS[record.id][0],
  y: POSITIONS[record.id][1],
  record,
}))

/* The EUS-B lesson's own statements about the stations beyond the airway examination. */
const NOT_ROUTINE =
  'Not a routine target for standard EBUS-TBNA or EUS-B-FNA. Discuss another diagnostic route when a clinically important target here cannot be safely reached.'
const ESOPHAGEAL =
  'A lower mediastinal station. The esophageal route (EUS-B) can complement the airway examination here, depending on anatomy and operator expertise.'
const named: MapStation[] = [
  { id: '5', name: 'Subaortic (aortopulmonary window)', side: 'left', x: 348, y: 128 },
  { id: '6', name: 'Para-aortic', side: 'left', x: 404, y: 100 },
  { id: '8', name: 'Paraesophageal', side: 'either', x: 262, y: 276 },
  { id: '9', name: 'Pulmonary ligament', side: 'either', x: 286, y: 356 },
].map((station) => ({
  ...station,
  side: station.side as Side,
  basin: 'mediastinal' as Basin,
  access: (station.side === 'left' ? 'neither' : 'eus-b') as StationAccess,
  context: station.side === 'left' ? NOT_ROUTINE : ESOPHAGEAL,
}))

export const MAP_STATIONS: MapStation[] = [...scanned, ...named]
export const MAP_STATION_IDS = MAP_STATIONS.map((station) => station.id)
export const mapStation = (id: string) => MAP_STATIONS.find((station) => station.id === id)

/**
 * The N category a station carries for a primary on one side, from the staging rules: hilar and
 * intrapulmonary nodes on the primary's side are N1, mediastinal and subcarinal nodes on that
 * side are N2, and the other side is N3. Stations 8 and 9 lie to one side of the midline, so
 * the map cannot say which without the node: it returns both.
 */
export function nCategory(station: MapStation, primary: PrimarySide): NCategory | 'N2 or N3' {
  if (station.side === 'either') return 'N2 or N3'
  if (station.side === 'midline') return 'N2'
  if (station.side !== primary) return 'N3'
  return station.basin === 'mediastinal' ? 'N2' : 'N1'
}

/** The staging lesson's order: highest category first. */
export const SAMPLING_ORDER: NCategory[] = ['N3', 'N2', 'N1']

export const ACCESS_LABELS: Record<StationAccess, string> = {
  ebus: 'EBUS',
  both: 'EBUS or EUS-B',
  'eus-b': 'EUS-B',
  neither: 'Neither route',
}
