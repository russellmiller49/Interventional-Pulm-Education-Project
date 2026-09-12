'use client'

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { WebGLRenderer, type WebGLRendererParameters } from 'three'
import { PerspectiveCamera, View } from '@react-three/drei'
import { BronchLabelOverlay } from '@/components/airway-anatomy/scope-primitives'
import type { OstiumLabel } from '@/lib/airway-anatomy/ostia'
import { OPTICAL_ASPECT } from '../../engine/scope/scopeOstia'
import { ScopeOpticalView } from './ScopeOpticalView'
import { ObserverView } from './ObserverView'
import { loadSceneAssets, type ScopeSceneAssets } from './scopeSceneAssets'
import { layoutOpticalLabels, projectScenePins, VIEW_DESCRIPTION } from './scopeSceneModel'
import { treeChoiceInputId, type ScopePaneProps, type AirwayLabel } from './types'
import styles from './scope-scene.module.css'

type SceneStatus = 'loading' | 'ready' | 'failed'
interface SceneProps extends ScopePaneProps {
  visible: boolean
  onStatus: (status: SceneStatus) => void
}

class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFailure()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function WebGLContextGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => {
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
  return null
}

function RenderLifecycle({ props, onDraw }: { props: SceneProps; onDraw: () => void }) {
  const { invalidate, gl } = useThree()
  const drawn = useRef(false)
  useEffect(() => {
    invalidate(2)
  }, [props.state, props.visible, invalidate])
  useEffect(() => {
    const update = () => invalidate(2)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [invalidate])
  useFrame(() => {
    if (!drawn.current && gl.info.render.calls > 0) {
      drawn.current = true
      queueMicrotask(onDraw)
    }
  }, 3)
  return null
}

export default function ScopeScene(props: SceneProps) {
  const [assets, setAssets] = useState<ScopeSceneAssets | null>(null)
  const [status, setStatus] = useState<SceneStatus>('loading')
  const [generation, setGeneration] = useState(0)
  const { onStatus, view, state } = props
  const root = useRef<HTMLDivElement>(null)
  const opticalRoot = useRef<HTMLDivElement>(null)
  const [opticalSize, setOpticalSize] = useState({ width: 320, height: 240 })
  const report = useCallback(
    (value: SceneStatus) => {
      setStatus(value)
      onStatus(value)
    },
    [onStatus],
  )
  const failed = useCallback(() => report('failed'), [report])
  const drawn = useCallback(() => report('ready'), [report])
  const createRenderer = useCallback(
    async (options: WebGLRendererParameters) => {
      try {
        return new WebGLRenderer({
          ...options,
          antialias: true,
          alpha: false,
          powerPreference: 'low-power',
        })
      } catch {
        // Fiber configures asynchronously, outside React's error boundary. Report the failure
        // and unmount this Canvas; leave its failed configuration suspended until teardown.
        queueMicrotask(failed)
        return new Promise<WebGLRenderer>(() => {})
      }
    },
    [failed],
  )
  const recover = useCallback(() => {
    report('loading')
    setGeneration((value) => value + 1)
  }, [report])
  useEffect(() => {
    let cancelled = false
    loadSceneAssets(view.mode, view.profile)
      .then((next) => {
        if (!cancelled) setAssets(next)
      })
      .catch(() => {
        if (!cancelled) failed()
      })
    return () => {
      cancelled = true
    }
  }, [view.mode, view.profile, generation, failed])
  const observer = ['controls-isolated', 'larynx-entry', 'tube', 'accessory'].includes(view.mode)
  const optical = view.mode !== 'idle'
  useEffect(() => {
    const element = opticalRoot.current
    if (!element) return
    const update = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width > 0 && height > 0) setOpticalSize({ width, height })
    }
    const resize = new ResizeObserver(update)
    resize.observe(element)
    update()
    return () => resize.disconnect()
  }, [assets, observer, generation])
  const placedPins = layoutOpticalLabels(
    projectScenePins(state),
    opticalSize.width,
    opticalSize.height,
    state.inputs.branchLabels,
  )
  const pins: OstiumLabel[] = placedPins.map((pin) => ({
    edgeId: pin.edgeId,
    abbr: pin.label,
    descriptor: '',
    pointLps: pin.pointLps,
  }))
  const pointerMode = useRef<'pointer' | 'touch'>('pointer')
  return (
    <div>
      <p className={styles.reviewStatus}>Teaching model · clinical review pending</p>
      <div
        className={styles.views}
        ref={root}
        data-three-state={status}
        data-observer={observer ? 'true' : undefined}
      >
        {assets && status !== 'failed' ? (
          <SceneBoundary key={generation} onFailure={failed}>
            <Canvas
              className={styles.canvas}
              // View's scissor coordinates are viewport-relative. A fixed canvas also stays
              // aligned when preceding teaching content expands without resizing this pane.
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
              }}
              eventSource={root as React.RefObject<HTMLDivElement>}
              frameloop={!props.visible ? 'never' : status === 'loading' ? 'always' : 'demand'}
              dpr={[1, 1.5]}
              gl={createRenderer}
              onCreated={({ gl }) => {
                gl.localClippingEnabled = true
              }}
              fallback={<span>3D is unavailable in this browser.</span>}
            >
              <View.Port />
              <WebGLContextGuard onLost={recover} />
              <RenderLifecycle props={props} onDraw={drawn} />
            </Canvas>
            <div
              className={styles.optical}
              ref={opticalRoot}
              role="group"
              tabIndex={0}
              aria-label={VIEW_DESCRIPTION[state.signals.view]}
              data-view-signal={state.signals.view}
            >
              <View className={styles.opticalViewport} index={1}>
                <PerspectiveCamera makeDefault near={0.05} far={1400} fov={55} />
                {optical ? (
                  <ScopeOpticalView assets={assets} props={props} />
                ) : (
                  <ObserverView assets={assets} props={props} />
                )}
              </View>
              <span className={styles.viewHeading}>{optical ? 'Scope view' : 'Airway model'}</span>
              {optical ? (
                <div
                  className={styles.lens}
                  aria-hidden="true"
                  data-lens-state={state.signals.view}
                />
              ) : null}
              {state.inputs.branchLabels && optical ? (
                <svg
                  className={styles.pinLeaders}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {placedPins
                    .filter((pin) => pin.displaced)
                    .map((pin) => (
                      <line
                        key={pin.label}
                        x1={pin.leftPct}
                        y1={pin.topPct}
                        x2={pin.labelLeftPct}
                        y2={pin.labelTopPct}
                      />
                    ))}
                </svg>
              ) : null}
              {state.pose && optical ? (
                <BronchLabelOverlay
                  ostia={pins}
                  pose={state.pose}
                  aspect={OPTICAL_ASPECT}
                  collider={null}
                  onAlignBranch={() => {}}
                  renderPin={(item) => {
                    const label = item.abbr as AirwayLabel
                    const projected = placedPins.find((pin) => pin.label === label)!
                    const choice = props.treeAnswer?.choices.find(
                      (choice) => choice.airway === label,
                    )
                    const shared = {
                      className: styles.ostium,
                      style: {
                        left: projected.labelLeftPct + '%',
                        top: projected.labelTopPct + '%',
                      },
                      'data-ostium-pin': label,
                      'aria-label': state.inputs.branchLabels ? label : 'An opening ahead',
                    }
                    const text = state.inputs.branchLabels ? label : '·'
                    if (choice)
                      return (
                        <label
                          key={label}
                          {...shared}
                          htmlFor={treeChoiceInputId(props.treeAnswer!.name, choice.id)}
                        >
                          {text}
                        </label>
                      )
                    if (view.assists['align-to-branch'])
                      return (
                        <button
                          key={label}
                          {...shared}
                          type="button"
                          disabled={!props.controlsEnabled}
                          onPointerDown={(event) => {
                            pointerMode.current =
                              event.pointerType === 'touch' ? 'touch' : 'pointer'
                          }}
                          onClick={(event) =>
                            props.onCommand(
                              { type: 'assist', assist: 'align-to-branch', label },
                              event.detail === 0 ? 'keyboard' : pointerMode.current,
                            )
                          }
                        >
                          {text}
                        </button>
                      )
                    return state.inputs.branchLabels ? (
                      <span key={label} {...shared}>
                        {text}
                      </span>
                    ) : null
                  }}
                />
              ) : null}
              {state.inputs.suction ? <span className={styles.suction}>Suction on</span> : null}
            </div>
            {observer ? (
              <div
                className={styles.observer}
                role="img"
                aria-label="Outside view of the authored teaching model"
              >
                <View className={styles.observerViewport} index={2}>
                  <PerspectiveCamera makeDefault near={0.05} far={1400} fov={48} />
                  <ObserverView assets={assets} props={props} />
                </View>
                <span className={styles.viewHeading}>
                  {view.mode === 'tube' ? 'Tube cutaway' : 'Outside view'} · authored model
                </span>
              </div>
            ) : null}
          </SceneBoundary>
        ) : null}
        {status !== 'ready' ? (
          <div className={styles.loading} role="status">
            {status === 'failed' ? (
              <>
                The 3D view could not be loaded.{' '}
                <button type="button" onClick={recover}>
                  Reload the 3D view
                </button>
              </>
            ) : (
              'Loading the teaching model…'
            )}
          </div>
        ) : null}
      </div>
      {state.message ? (
        <p className={styles.message} role="status" data-scope-message>
          {state.message}
        </p>
      ) : null}
      {state.place !== 'airway' ? (
        <p className={styles.context} data-scope-place={state.place}>
          {state.place === 'bench'
            ? 'The tip is on the bench, outside the model'
            : state.place === 'larynx'
              ? 'In the model larynx'
              : 'Inside the tube'}
        </p>
      ) : null}
    </div>
  )
}
