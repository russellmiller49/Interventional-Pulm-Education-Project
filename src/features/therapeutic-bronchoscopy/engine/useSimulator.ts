'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type * as THREE from 'three'
import { loadAirwayStlGeometry } from '@/lib/airway-anatomy/airway-render'
import { createLumenCollider } from '@/lib/airway-anatomy/lumen-collider'
import { resolveAdminAirwayAssetPath } from '@/lib/airway-anatomy/admin-assets'
import type { AirwayGraph, AirwayAnatomyCaseManifest } from '@/lib/airway-anatomy/types'
import { usePathology } from '@/components/airway-anatomy/pathology/usePathology'
import { DEFAULT_PATHOLOGY, type PathologySettings } from '@/lib/airway-anatomy/pathology/model'
import {
  combinePathologyCollider,
  createLesionCollider,
} from '@/lib/airway-anatomy/pathology/geometry'
import {
  plus,
  times,
  steerFrame,
  rollFrame,
  type OpticalFrame,
  type LumenCollider,
} from '@/lib/bronchoscopy-core/frame'
import { geometryFromData, serializeGeometry, type TissueCut, type TissueResult } from './tissue'
import {
  initialInstrumentState,
  instrumentContact,
  instrumentTransition,
  makeTumorTarget,
  approachPose,
  canRepositionScope,
  SCOPE_RADIUS_MM,
  type InstrumentAction,
  type InstrumentId,
  type InstrumentState,
} from './instruments'

export const INITIAL_SCENARIO: PathologySettings = {
  ...DEFAULT_PATHOLOGY,
  morphology: 'obstructing',
  site: 'trachea',
  size: 0.85,
  bleeding: 'oozing',
}

function useTissue(
  geometry: THREE.BufferGeometry | null,
  revision: number,
  onCut: (result: TissueResult) => void,
) {
  const [state, setState] = useState<{
    source: THREE.BufferGeometry | null
    revision: number
    ready: boolean
    busy: boolean
    error: string
    geometry: THREE.BufferGeometry | null
    remaining: number
  }>({
    source: null,
    revision: -1,
    ready: false,
    busy: false,
    error: '',
    geometry: null,
    remaining: 1,
  })
  const worker = useRef<Worker | null>(null),
    request = useRef(0),
    waiting = useRef<number | null>(null),
    callback = useRef(onCut),
    cutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    callback.current = onCut
  }, [onCut])
  useEffect(() => {
    if (!geometry) return
    let active = true,
      currentGeometry: THREE.BufferGeometry | null = null
    const fail = (message: string) => {
      if (active) {
        waiting.current = null
        setState((s) => ({
          ...s,
          source: geometry,
          revision,
          ready: false,
          busy: false,
          error: message,
        }))
      }
    }
    // Synchronize the new external worker revision with the UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      source: geometry,
      revision,
      ready: false,
      busy: false,
      error: '',
      geometry: null,
      remaining: 1,
    })
    let w: Worker
    try {
      w = new Worker(new URL('./tissue.worker.ts', import.meta.url))
      worker.current = w
    } catch {
      fail('The tissue engine could not start. Reload the model to retry.')
      return
    }
    w.onerror = () => {
      clearTimeout(timer)
      clearTimeout(cutTimer.current)
      fail('The tissue engine stopped. Reload the model to retry.')
    }
    w.onmessage = ({ data }) => {
      if (!active || data.revision !== revision) return
      clearTimeout(timer)
      clearTimeout(cutTimer.current)
      if (data.kind === 'ready') setState((s) => ({ ...s, ready: true }))
      if (data.kind === 'error') fail(data.message)
      if (data.kind === 'result' && waiting.current === data.request) {
        waiting.current = null
        const next = geometryFromData(data.result)
        currentGeometry?.dispose()
        currentGeometry = next
        setState((s) => ({
          ...s,
          geometry: next,
          remaining: data.result.remainingFraction,
          busy: false,
        }))
        callback.current(data.result)
      }
    }
    w.postMessage({
      kind: 'init',
      revision,
      request: ++request.current,
      mesh: serializeGeometry(geometry),
    })
    const timer = setTimeout(() => {
      w.terminate()
      fail('Tissue preparation timed out. Reload the model to retry.')
    }, 30000)
    return () => {
      active = false
      clearTimeout(timer)
      clearTimeout(cutTimer.current)
      w.terminate()
      worker.current = null
      waiting.current = null
      currentGeometry?.dispose()
    }
  }, [geometry, revision])
  const available = state.source === geometry && state.revision === revision
  const cut = (operation: TissueCut) => {
    if (!available || !state.ready || state.busy || waiting.current !== null || !worker.current)
      return false
    const id = ++request.current
    waiting.current = id
    setState((s) => ({ ...s, busy: true }))
    worker.current.postMessage({ kind: 'cut', revision, request: id, cut: operation })
    cutTimer.current = setTimeout(() => {
      worker.current?.terminate()
      waiting.current = null
      setState((s) => ({
        ...s,
        ready: false,
        busy: false,
        error: 'Tissue removal timed out. Reload the model to retry.',
      }))
    }, 30000)
    return true
  }
  return {
    geometry: available ? (state.geometry ?? geometry) : geometry,
    remaining: available ? state.remaining : 1,
    ready: available && state.ready,
    busy: available && state.busy,
    error: available ? state.error : '',
    cut,
  }
}

export function useSimulator() {
  const [settings, setSettings] = useState(INITIAL_SCENARIO),
    [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState<{
    graph: AirwayGraph
    geometry: THREE.BufferGeometry
    lumen: LumenCollider
  } | null>(null)
  const [loadError, setLoadError] = useState(''),
    [retry, setRetry] = useState(0)
  const [frame, setFrame] = useState<OpticalFrame | null>(null),
    [instrument, setInstrument] = useState(initialInstrumentState)
  const [normal, setNormal] = useState(false),
    [movement, setMovement] = useState('')
  const [compared, setCompared] = useState(false)
  const stateRef = useRef(instrument),
    frameRef = useRef(frame),
    clock = useRef(0),
    cuttingInstrument = useRef<InstrumentId>('forceps'),
    cuttingRadius = useRef<number | undefined>(undefined)
  stateRef.current = instrument
  frameRef.current = frame
  const publish = useCallback((state: InstrumentState) => {
    stateRef.current = state
    setInstrument(state)
  }, [])
  useEffect(() => {
    let active = true
    setLoadError('')
    const json = async (url: string) => {
      const r = await fetch(resolveAdminAirwayAssetPath(url))
      if (!r.ok) throw new Error('Asset unavailable')
      return r.json()
    }
    void (async () => {
      const manifest = (await json(
        '/airway-anatomy/case-001/case_manifest.json',
      )) as AirwayAnatomyCaseManifest
      if (
        !manifest.geometryValidation?.closed ||
        manifest.geometryValidation.coordinateSystem !== 'LPS'
      )
        throw new Error('The reviewed closed airway is required')
      const [graph, geometry] = await Promise.all([
        json(manifest.assets.airwayGraphJson),
        loadAirwayStlGeometry(resolveAdminAirwayAssetPath(manifest.assets.reviewedLumenGlb!)),
      ])
      const lumen = createLumenCollider(geometry)
      if (active) setLoaded({ graph, geometry, lumen })
    })().catch(() => {
      if (active)
        setLoadError('The reviewed airway could not load. Check the connection and retry.')
    })
    return () => {
      active = false
    }
  }, [retry])
  const pathology = usePathology(settings, true, loaded?.graph ?? null, loaded?.lumen ?? null)
  const tissue = useTissue(pathology.geometry, revision, (result) => {
    if (!contactRef.current) return
    publish(
      instrumentTransition(
        stateRef.current,
        {
          type: 'cut-complete',
          instrument: cuttingInstrument.current,
          removedMm3: result.removedMm3,
          radius: cuttingRadius.current,
        },
        contactRef.current,
      ).state,
    )
  })
  const tumor = useMemo(() => makeTumorTarget(tissue.geometry), [tissue.geometry])
  const collider = useMemo(() => {
    if (!loaded) return null
    return tissue.geometry?.getAttribute('position').count
      ? combinePathologyCollider(loaded.lumen, createLesionCollider(tissue.geometry))
      : loaded.lumen
  }, [loaded, tissue.geometry])
  const { id, extension, rotation } = instrument
  const contact = useMemo(
    () =>
      frame && loaded && pathology.placement
        ? instrumentContact(
            frame,
            { id, extension, rotation },
            tumor,
            loaded.lumen,
            pathology.placement,
            settings.morphology,
          )
        : null,
    [frame, id, extension, rotation, tumor, loaded, pathology.placement, settings.morphology],
  )
  const contactRef = useRef(contact)
  contactRef.current = contact
  const approach = useCallback(
    (id: InstrumentId = stateRef.current.id) => {
      if (!pathology.frames || !pathology.placement || !collider) return
      if (!canRepositionScope(stateRef.current)) {
        setMovement('Retrieve the instrument before repositioning the scope.')
        return
      }
      const pose = approachPose(pathology.frames, pathology.placement, collider, settings.site, id)
      if (!pose) {
        setMovement(
          'No approach with sufficient scope clearance was found. Choose another site or reduce the lesion.',
        )
        return
      }
      frameRef.current = pose
      setFrame(pose)
      setMovement('Approach view. Aim and advance the instrument under direct vision.')
    },
    [pathology.frames, pathology.placement, settings.site, collider],
  )
  // A new scenario resets the procedure. Changes to the residual mesh must never reset the view.
  const approached = useRef<THREE.BufferGeometry | null>(null)
  useEffect(() => {
    if (!pathology.ready || (settings.morphology !== 'none' && !pathology.geometry)) return
    if (approached.current === pathology.geometry && frameRef.current) return
    approached.current = pathology.geometry
    publish(initialInstrumentState(stateRef.current.id))
    approach()
  }, [pathology.ready, pathology.geometry, settings.morphology, approach, publish])
  const ready =
    !!frame &&
    !!loaded &&
    pathology.ready &&
    (settings.morphology === 'none' || tissue.ready) &&
    !tissue.error
  const action = useCallback(
    (event: InstrumentAction) => {
      if (!contactRef.current || !ready || tissue.busy || normal) return
      const next = instrumentTransition(stateRef.current, event, contactRef.current)
      if (next.cut) {
        cuttingInstrument.current = stateRef.current.id
        cuttingRadius.current = next.cut.kind === 'bite' ? next.cut.radius : undefined
        if (!tissue.cut(next.cut)) return
      }
      publish(next.state)
      if (event.type === 'reenter' && !next.state.unsafe) approach()
    },
    [ready, tissue, normal, publish, approach],
  )
  useEffect(() => {
    const handle = setInterval(() => {
      if (document.hidden || !contactRef.current || !ready || tissue.busy || normal) return
      clock.current += 0.1
      const s = stateRef.current
      if (s.freezing || s.bleedingRate || s.suction)
        publish(instrumentTransition(s, { type: 'tick', dt: 0.1 }, contactRef.current).state)
    }, 100)
    return () => clearInterval(handle)
  }, [ready, tissue.busy, normal, publish])
  const move = (forward: number, right = 0, up = 0, roll = 0) => {
    if (!frameRef.current || !collider || !ready || tissue.busy || normal) return
    const s = stateRef.current
    if (
      s.outside ||
      s.pending ||
      s.freezing ||
      s.loopCaptured ||
      (forward !== 0 && s.extension > 0)
    ) {
      setMovement(
        'Retrieve the instrument before advancing or withdrawing the scope; attached tissue also locks steering.',
      )
      return
    }
    let next = rollFrame(steerFrame(frameRef.current, right, up), roll)
    if (forward) {
      const swept = collider.sweep(
        next.position,
        plus(next.position, times(next.forward, forward)),
        SCOPE_RADIUS_MM,
      )
      next = { ...next, position: swept.point }
      setMovement(
        swept.contact.touching
          ? 'Scope contacts tissue. Withdraw or redirect the tip.'
          : 'Scope position updated.',
      )
    }
    // Steering cannot push a deployed tip through the first surface on its new axis.
    if (s.extension > 0 && loaded && pathology.placement) {
      const c = instrumentContact(
        next,
        s,
        tumor,
        loaded.lumen,
        pathology.placement,
        settings.morphology,
      )
      publish({ ...s, extension: Math.min(s.extension, c.maximumExtension) })
    }
    frameRef.current = next
    setFrame(next)
  }
  const reset = (next = settings, id: InstrumentId = stateRef.current.id) => {
    publish(initialInstrumentState(id))
    setNormal(false)
    setCompared(false)
    clock.current = 0
    setRevision((v) => v + 1)
    setSettings({ ...next })
    approached.current = null
  }
  return {
    settings,
    revision,
    reset,
    loaded,
    pathology,
    scene: { ...pathology, geometry: normal ? null : tissue.geometry },
    frame,
    instrument,
    contact,
    ready,
    busy: tissue.busy,
    error: loadError || pathology.error || tissue.error,
    remaining: tissue.remaining,
    action,
    move,
    approach,
    normal,
    compared,
    toggleNormal: () => {
      if (instrument.extension || instrument.pending || instrument.outside || tissue.busy) return
      setNormal((v) => !v)
      setCompared(true)
    },
    movement,
    clock,
    retry: () => {
      setRetry((v) => v + 1)
      pathology.retry()
      reset()
    },
  }
}
export type Simulator = ReturnType<typeof useSimulator>
