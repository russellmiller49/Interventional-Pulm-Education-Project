'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { LumenCollider } from '@/lib/bronchoscopy-core/frame'
import type { AirwayGraph } from '@/lib/airway-anatomy/types'
import { buildTransportFrames } from '@/lib/airway-anatomy/transport-frames'
import {
  advanceBleedingTime,
  siteFor,
  type PathologySettings,
  type MorphologyId,
} from '@/lib/airway-anatomy/pathology/model'
import {
  combinePathologyCollider,
  createBloodFilm,
  createLesionCollider,
  createPlacedLesionGeometry,
  placePathology,
} from '@/lib/airway-anatomy/pathology/geometry'

const cache = new Map<string, Promise<THREE.BufferGeometry>>()
function loadLesion(id: Exclude<MorphologyId, 'none'>) {
  if (!cache.has(id)) {
    cache.set(
      id,
      new GLTFLoader()
        .loadAsync(`/bronchoscopy-abnormalities/${id}.glb`)
        .then((gltf) => {
          const meshes: THREE.Mesh[] = []
          gltf.scene.updateMatrixWorld(true)
          gltf.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) meshes.push(object)
          })
          if (meshes.length !== 1)
            throw new Error('A lesion asset must contain one closed surface.')
          const geometry = meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld)
          for (const mesh of meshes) {
            mesh.geometry.dispose()
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
              material.dispose()
          }
          if (!geometry.getAttribute('color'))
            throw new Error('The lesion tissue colors are missing.')
          return geometry
        })
        .catch((error) => {
          cache.delete(id)
          throw error
        }),
    )
  }
  return cache.get(id)!
}

export function usePathology(
  settings: PathologySettings,
  enabled: boolean,
  graph: AirwayGraph | null,
  lumen: LumenCollider | null,
) {
  const [asset, setAsset] = useState<{ id: MorphologyId; geometry: THREE.BufferGeometry } | null>(
    null,
  )
  const [loadError, setLoadError] = useState<{
    id: MorphologyId
    attempt: number
    message: string
  } | null>(null)
  const [retry, setRetry] = useState(0)
  // Physical anchors must not move when the operator selects a camera orientation profile.
  const frames = useMemo(() => (graph ? buildTransportFrames(graph) : null), [graph])
  const id = enabled ? settings.morphology : 'none'
  useEffect(() => {
    if (id === 'none') return
    let cancelled = false
    loadLesion(id)
      .then((geometry) => {
        if (!cancelled) {
          setAsset({ id, geometry })
          setLoadError(null)
        }
      })
      .catch(() => {
        if (!cancelled)
          setLoadError({
            id,
            attempt: retry,
            message: 'The abnormality model could not load. Retry to continue.',
          })
      })
    return () => {
      cancelled = true
    }
  }, [id, retry])

  const placed = useMemo(() => {
    if (!enabled || !frames || !lumen) return null
    try {
      const placement = placePathology(settings, frames, lumen)
      const geometry =
        id !== 'none' && asset?.id === id
          ? createPlacedLesionGeometry(
              asset.geometry,
              settings,
              placement,
              frames,
              lumen,
              graph!.edges.find((e) => e.id === siteFor(settings.site).edgeId)!.lengthMm,
            )
          : null
      geometry?.computeVertexNormals()
      const lesionCollider = geometry ? createLesionCollider(geometry) : null
      return {
        placement,
        geometry,
        lesionCollider,
        collider: lesionCollider ? combinePathologyCollider(lumen, lesionCollider) : lumen,
        error: '',
      }
    } catch {
      return {
        placement: null,
        geometry: null,
        lesionCollider: null,
        collider: lumen,
        error: 'This wall placement is unavailable. Select another site or wall position.',
      }
    }
  }, [enabled, frames, lumen, graph, settings, asset, id])
  useEffect(
    () => () => {
      placed?.geometry?.dispose()
    },
    [placed],
  )

  const { site, wallAngleDeg, bleeding } = settings
  const film = useMemo(() => {
    if (!enabled || !frames || !lumen || !graph || bleeding === 'off') return null
    try {
      const edge = graph.edges.find((e) => e.id === siteFor(site).edgeId)!
      return createBloodFilm({ site, wallAngleDeg }, frames, lumen, edge.lengthMm)
    } catch {
      return null
    }
  }, [enabled, frames, lumen, graph, site, wallAngleDeg, bleeding])
  useEffect(
    () => () => {
      film?.dispose()
    },
    [film],
  )

  const error = enabled
    ? (loadError?.id === id && loadError.attempt === retry ? loadError.message : '') ||
      placed?.error ||
      (settings.bleeding !== 'off' && !film && lumen
        ? 'The bleeding surface could not be placed. Select another location.'
        : '')
    : ''
  const ready =
    enabled && !!lumen && !!placed?.placement && !error && (id === 'none' || !!placed.geometry)
  return {
    placement: placed?.placement ?? null,
    geometry: placed?.geometry ?? null,
    lesionCollider: placed?.lesionCollider ?? null,
    collider: placed?.collider ?? null,
    film,
    frames,
    error,
    ready,
    retry: () => setRetry((v) => v + 1),
  }
}
export type PathologyScene = ReturnType<typeof usePathology>

export function useBleedingClock(running: boolean, resetKey: string) {
  const time = useRef(0)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    time.current = 0
    const handle = requestAnimationFrame(() => setElapsed(0))
    return () => cancelAnimationFrame(handle)
  }, [resetKey])
  useEffect(() => {
    if (!running) return
    let handle = 0,
      last = 0,
      published = 0
    const tick = (now: number) => {
      time.current = advanceBleedingTime(
        time.current,
        last ? (now - last) / 1000 : 0,
        !document.hidden,
      )
      last = now
      if (now - published > 200) {
        setElapsed(time.current)
        published = now
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(handle)
      setElapsed(time.current)
    }
  }, [running])
  return { time, elapsed }
}
