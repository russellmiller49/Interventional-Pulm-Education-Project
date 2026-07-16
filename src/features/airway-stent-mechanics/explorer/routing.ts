import { STENT_EXPLORER_STATION_IDS, type StentExplorerStationId } from './types'

type ExplorerQueryValue = string | readonly string[] | null | undefined

export interface ExplorerStationRequest {
  station?: ExplorerQueryValue
  lesson?: ExplorerQueryValue
  panel?: ExplorerQueryValue
}

const stationIds = new Set<string>(STENT_EXPLORER_STATION_IDS)

/** Keeps runtime URL input aligned with the compile-time station union. */
export function isStentExplorerStationId(value: unknown): value is StentExplorerStationId {
  return typeof value === 'string' && stationIds.has(value)
}

function firstQueryValue(value: ExplorerQueryValue): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first.trim() : undefined
}

export const legacyLessonToExplorerStation = {
  indication: 'architecture-lumen',
  'clinical-job': 'architecture-lumen',
  'architecture-choice': 'architecture-lumen',
  'fit-behavior': 'curve-buckle',
  'complications-surveillance': 'granulation',
  assessment: null,
  orient: 'architecture-lumen',
  architectures: 'metal-architecture',
  'force-lab': 'cough-motion',
  'tissue-time': 'granulation',
  'evidence-decisions': 'deploy-rescue',
} as const satisfies Readonly<Record<string, StentExplorerStationId | null>>

/**
 * Resolves canonical and retired deep links without restoring progress state.
 * A canonical `station` value wins. Any explicit unknown station or lesson,
 * including the retired assessment, resolves to `null` so the shell opens its hub.
 */
export function resolveExplorerStationRequest({
  station,
  lesson,
  panel,
}: ExplorerStationRequest): StentExplorerStationId | null {
  const requestedStation = firstQueryValue(station)
  if (requestedStation !== undefined) {
    return isStentExplorerStationId(requestedStation) ? requestedStation : null
  }

  const requestedLesson = firstQueryValue(lesson)
  if (requestedLesson !== undefined) {
    return (
      (
        legacyLessonToExplorerStation as Readonly<
          Record<string, StentExplorerStationId | null | undefined>
        >
      )[requestedLesson] ?? null
    )
  }

  return firstQueryValue(panel) === 'mechanics' ? 'architecture-lumen' : null
}
