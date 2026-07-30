/**
 * Browser entry for the interactive foundation-workspace fixture.
 *
 * `render-ecmo-teaching-panels.mts` renders the teaching panels on their own, which is the right
 * harness for panel content and the wrong one for this package: an isolated panel cannot show
 * whether the console is clipped, whether the workspace has a bounded height, whether a pane scrolls
 * independently of the page, what the fit scale resolves to, whether maximizing a pane works, or
 * what the semantic colour tokens inherit. All six only exist once the whole activity is mounted
 * inside the module frame, which is what this does.
 *
 * The real components are mounted: `EcmoFoundationLessonActivity`, `CardiohelpConsole`,
 * `CircuitAndMonitors`, `CardiohelpModuleFrame`. Three modules are shimmed, each for a reason given
 * in `preview-navigation.tsx` and `preview-static-shims.tsx`.
 *
 * `<html class="dark">` is deliberate. The unreadable teaching text only happens when the document
 * root carries the dark theme — `next-themes` puts it there whenever the visitor prefers dark — so a
 * fixture without it would review the one case that never had the bug.
 *
 * Build:
 *   npx esbuild scripts/cardiohelp-ecmo/build-foundation-workspace-preview.mts --bundle \
 *     --platform=node --format=cjs --packages=external --log-level=error \
 *     --outfile=node_modules/.cache/ecmo/workspace-preview.cjs \
 *     && node node_modules/.cache/ecmo/workspace-preview.cjs
 *
 * Serve: the `trainer-prod-static` launch config on :8099, at
 * /ecmo-teaching-preview/workspace.html
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { CardiohelpModuleFrame } from '../../src/features/cardiohelp-ecmo/components/CardiohelpModuleFrame'
import { EcmoFoundationLessonActivity } from '../../src/features/cardiohelp-ecmo/components/EcmoFoundationLessonActivity'
import { ecmoFoundationSectionById } from '../../src/features/cardiohelp-ecmo/content/foundationLessons'
import {
  ecmoFoundationSupportMode,
  ecmoInteractiveFoundationSectionIds,
  ecmoSharedFoundationSectionIds,
  ecmoVaOnlyFoundationSectionIds,
  ecmoVvOnlyFoundationSectionIds,
  isEcmoInteractiveFoundationSectionId,
  type EcmoInteractiveFoundationSectionId,
} from '../../src/features/cardiohelp-ecmo/content/foundationLessonRuntime'
import type { SupportMode } from '../../src/features/cardiohelp-ecmo/engine/types'
import {
  criticalCareActivityPhases,
  type CriticalCareActivityPhase,
} from '../../src/features/learning-module/activity/types'
import { cardiohelpEcmoNavBase } from '../../src/features/learning-module/moduleRoutes'

/* ------------------------------------------------------------------ *
 * Measurement probe
 * ------------------------------------------------------------------ */

type Rgb = readonly [number, number, number]

function parseColor(value: string): Rgb | null {
  const match = /rgba?\(([^)]+)\)/.exec(value)
  if (!match) return null
  const parts = match[1]
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number)
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null
  return [parts[0], parts[1], parts[2]]
}

function isTransparent(value: string): boolean {
  if (value === 'transparent') return true
  const match = /rgba?\(([^)]+)\)/.exec(value)
  if (!match) return false
  const parts = match[1]
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number)
  return parts.length >= 4 && parts[3] === 0
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (raw: number) => {
    const scaled = raw / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

/** The colour actually painted behind an element, found by walking up past transparent ancestors. */
function paintedBackground(element: Element): { color: string; from: string } {
  let node: Element | null = element
  while (node) {
    const background = window.getComputedStyle(node).backgroundColor
    if (!isTransparent(background)) {
      return {
        color: background,
        from:
          node.tagName.toLowerCase() +
          (node.className ? `.${String(node.className).split(/\s+/)[0]}` : ''),
      }
    }
    node = node.parentElement
  }
  return { color: 'rgb(255, 255, 255)', from: 'assumed-white' }
}

function sampleContrast(name: string, selector: string) {
  const element = document.querySelector(selector)
  if (!element) return { name, selector, found: false }
  const computed = window.getComputedStyle(element)
  const foreground = parseColor(computed.color)
  const background = paintedBackground(element)
  const backgroundRgb = parseColor(background.color)
  const fontSizePx = Number.parseFloat(computed.fontSize)
  const fontWeight = Number.parseInt(computed.fontWeight, 10) || 400
  // WCAG "large text": 18.66px bold or 24px regular.
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700)
  const ratio = foreground && backgroundRgb ? contrastRatio(foreground, backgroundRgb) : null
  return {
    name,
    selector,
    found: true,
    text: (element.textContent ?? '').trim().slice(0, 60),
    foreground: computed.color,
    background: background.color,
    backgroundFrom: background.from,
    fontSizePx,
    lineHeight: computed.lineHeight,
    fontWeight,
    large,
    ratio: ratio === null ? null : Number(ratio.toFixed(2)),
    required: large ? 3 : 4.5,
    passes: ratio === null ? null : ratio >= (large ? 3 : 4.5),
  }
}

function rect(element: Element | null) {
  if (!element) return null
  const box = element.getBoundingClientRect()
  return {
    left: Number(box.left.toFixed(1)),
    top: Number(box.top.toFixed(1)),
    right: Number(box.right.toFixed(1)),
    bottom: Number(box.bottom.toFixed(1)),
    width: Number(box.width.toFixed(1)),
    height: Number(box.height.toFixed(1)),
  }
}

function paneReport(pane: string) {
  const element = document.querySelector(`[data-scroll-pane="${pane}"]`)
  if (!element) return null
  const box = element.getBoundingClientRect()
  return {
    width: Number(box.width.toFixed(1)),
    height: Number(box.height.toFixed(1)),
    hidden: element.hasAttribute('hidden'),
    display: window.getComputedStyle(element).display,
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflowY: window.getComputedStyle(element).overflowY,
    overscrollBehavior: window.getComputedStyle(element).overscrollBehavior,
  }
}

function probe() {
  const frame = document.querySelector('[data-ecmo-workspace-frame]')
  const workspace = frame?.querySelector('section[aria-label]') ?? null
  const fitSurface = document.querySelector('[data-fit-width-surface]')
  const consoleSection = document.querySelector('#cardiohelp-console')
  const consoleRect = consoleSection?.getBoundingClientRect() ?? null
  const surfaceRect = fitSurface?.getBoundingClientRect() ?? null
  const wideMatrix = document.querySelector('[data-hypothesis-matrix]')

  return {
    lesson: document.body.dataset.previewLesson ?? null,
    track: document.body.dataset.previewTrack ?? null,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    frame: {
      ...rect(frame),
      offsetVariable: frame
        ? window.getComputedStyle(frame).getPropertyValue('--ecmo-workspace-offset').trim()
        : null,
      overflow: frame ? window.getComputedStyle(frame).overflow : null,
      focus: frame instanceof HTMLElement ? frame.dataset.workspaceFocus : null,
    },
    workspace: {
      ...rect(workspace),
      height: workspace ? Number(workspace.getBoundingClientRect().height.toFixed(1)) : null,
      compact: workspace instanceof HTMLElement ? (workspace.dataset.compact ?? 'false') : null,
    },
    panes: {
      primary: paneReport('primary'),
      secondary: paneReport('secondary'),
      tertiary: paneReport('tertiary'),
    },
    consoleFit:
      fitSurface instanceof HTMLElement
        ? {
            mode: fitSurface.dataset.fitMode,
            measured: fitSurface.dataset.fitMeasured,
            scale: Number(fitSurface.dataset.fitScale),
            intrinsicWidth: Number(fitSurface.dataset.intrinsicWidth),
            availableWidth: Number(fitSurface.dataset.availableWidth),
            surfaceRect: rect(fitSurface),
            consoleRect: rect(consoleSection),
            consoleFullyWithinSurface:
              consoleRect && surfaceRect
                ? consoleRect.left >= surfaceRect.left - 1 &&
                  consoleRect.right <= surfaceRect.right + 1
                : null,
            surfaceScrollWidth: fitSurface.scrollWidth,
            surfaceClientWidth: fitSurface.clientWidth,
          }
        : null,
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      horizontalOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
    },
    wideMatrix: wideMatrix
      ? {
          width: Number(wideMatrix.getBoundingClientRect().width.toFixed(1)),
          scrollerOverflowX: wideMatrix.parentElement
            ? window.getComputedStyle(wideMatrix.parentElement).overflowX
            : null,
          scrollerScrollWidth: wideMatrix.parentElement?.scrollWidth ?? null,
          scrollerClientWidth: wideMatrix.parentElement?.clientWidth ?? null,
        }
      : null,
    contrast: [
      sampleContrast('teaching body paragraph', '[data-lesson-paragraphs] p'),
      sampleContrast('teaching narrative summary (muted)', '#lesson-narrative-heading ~ p'),
      sampleContrast('teaching panel muted copy', '[data-pane="teaching"] .text-muted-foreground'),
      sampleContrast('lesson bullet', '[data-lesson-bullets] li'),
      sampleContrast('your turn required action', '[data-pane="your-turn"] section p'),
      sampleContrast(
        'your turn muted teaching point',
        '[data-pane="your-turn"] .text-muted-foreground',
      ),
      sampleContrast('guided action label', '[data-guided-action] span'),
      sampleContrast('device boundary note', '[data-device-boundary]'),
      sampleContrast('state on screen value', '[data-active-state-variant] p + p'),
    ],
  }
}

const CAPTURE_STYLE_ID = 'ecmo-workspace-capture-style'

/**
 * Bring the workspace to the top of the viewport for a screenshot without changing its geometry.
 *
 * The chrome above the workspace is around 570px tall, so on a 768px window the frame is mostly
 * below the fold, and this preview surface cannot photograph a scrolled page. Everything above the
 * frame is therefore hidden with `visibility: hidden`, which keeps its layout — so the frame's
 * document position, its width, the pane widths and the fit scale are all exactly what they were —
 * and the frame is moved into view with a translate, which is a paint-time transform and changes no
 * layout either. What is photographed is the same workspace that was measured.
 */
function captureMode(on = true) {
  const frame = document.querySelector('[data-ecmo-workspace-frame]')
  if (!(frame instanceof HTMLElement)) return 'no workspace frame'
  document.getElementById(CAPTURE_STYLE_ID)?.remove()
  if (!on) {
    frame.style.transform = ''
    return 'capture mode off'
  }
  const style = document.createElement('style')
  style.id = CAPTURE_STYLE_ID
  style.textContent = [
    '[data-learning-module-v2-theme-root] > header,',
    '[data-learning-module-v2-theme-root] > nav,',
    "[data-learning-module-v2-theme-root] > section[role='note'],",
    '[data-preview-chrome],',
    'main[data-support-mode] > *:not([data-ecmo-workspace-frame])',
    '{ visibility: hidden !important; }',
  ].join('\n')
  document.head.append(style)
  const documentTop = frame.getBoundingClientRect().top + window.scrollY
  frame.style.transform = `translateY(${-(documentTop - 8)}px)`
  return `capture mode on, frame translated by ${-Math.round(documentTop - 8)}px`
}

/** Scroll the teaching pane and report what moved. */
function scrollProbe(pane: 'primary' | 'secondary' | 'tertiary' = 'secondary', by = 400) {
  const read = () => ({
    primary: document.querySelector('[data-scroll-pane="primary"]')?.scrollTop ?? null,
    secondary: document.querySelector('[data-scroll-pane="secondary"]')?.scrollTop ?? null,
    tertiary: document.querySelector('[data-scroll-pane="tertiary"]')?.scrollTop ?? null,
    windowScrollY: window.scrollY,
  })
  const before = read()
  const target = document.querySelector(`[data-scroll-pane="${pane}"]`)
  if (target) target.scrollTop = (target.scrollTop || 0) + by
  return { pane, by, before, after: read() }
}

/* ------------------------------------------------------------------ *
 * Fixture chrome
 * ------------------------------------------------------------------ */

const SCOPES: readonly {
  readonly label: string
  readonly ids: readonly EcmoInteractiveFoundationSectionId[]
}[] = [
  { label: 'Shared by both tracks', ids: ecmoSharedFoundationSectionIds },
  { label: 'VV only', ids: ecmoVvOnlyFoundationSectionIds },
  { label: 'VA only', ids: ecmoVaOnlyFoundationSectionIds },
]

/**
 * The phase the fixture opens the lesson at, so a `?phase=` restoration can be reviewed here.
 *
 * The route validates the same parameter the same way and hands it to the same prop, and the
 * activity's remount key includes it — so selecting a phase here reproduces a URL arrival rather than
 * a click through the phase navigation, which is the case worth looking at.
 */
function requestedPhase(value: string | null): CriticalCareActivityPhase {
  return (criticalCareActivityPhases as readonly string[]).includes(value ?? '')
    ? (value as CriticalCareActivityPhase)
    : 'recognize'
}

function initialSelection(): {
  lesson: EcmoInteractiveFoundationSectionId
  track: SupportMode
  phase: CriticalCareActivityPhase
} {
  const params = new URLSearchParams(window.location.search)
  const lesson = params.get('lesson')
  const track = params.get('track') === 'va' ? 'va' : 'vv'
  return {
    lesson: isEcmoInteractiveFoundationSectionId(lesson)
      ? lesson
      : ecmoSharedFoundationSectionIds[0],
    track,
    phase: requestedPhase(params.get('phase')),
  }
}

function Fixture() {
  const [selection, setSelection] = useState(initialSelection)
  const resolvedTrack = ecmoFoundationSupportMode(selection.lesson, selection.track)

  // Published so the acceptance measurements can switch lessons without a page reload, and so the
  // probe output records which lesson it measured.
  useEffect(() => {
    document.body.dataset.previewLesson = selection.lesson
    document.body.dataset.previewTrack = resolvedTrack
    document.body.dataset.previewPhase = selection.phase
  }, [selection.lesson, resolvedTrack, selection.phase])

  useEffect(() => {
    const globals = window as unknown as Record<string, unknown>
    globals.__ecmoWorkspaceSelect = (lesson: string, track?: string, phase?: string) => {
      if (!isEcmoInteractiveFoundationSectionId(lesson)) return `unknown lesson: ${lesson}`
      setSelection({
        lesson,
        track: track === 'va' ? 'va' : 'vv',
        phase: requestedPhase(phase ?? null),
      })
      return lesson
    }
    return () => {
      delete globals.__ecmoWorkspaceSelect
    }
  }, [])

  return (
    <>
      <CardiohelpModuleFrame locale="en" activeHref={`${cardiohelpEcmoNavBase}/learn`}>
        <EcmoFoundationLessonActivity
          sectionId={selection.lesson}
          supportMode={resolvedTrack}
          initialPhase={selection.phase}
        />
      </CardiohelpModuleFrame>

      {/*
        The chrome sits below everything the workspace measures. A control bar above the workspace
        would inflate the measured header offset and make every recorded frame height wrong for the
        real route, and a fixed overlay would sit on top of the screenshots.
      */}
      <section
        data-preview-chrome=""
        style={{
          padding: '1.5rem',
          borderTop: '2px solid #1d3b42',
          color: '#dcecee',
          background: '#04141a',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: '0.8125rem',
        }}
      >
        <p style={{ margin: '0 0 0.75rem', fontWeight: 800, letterSpacing: '0.06em' }}>
          OFFLINE FIXTURE — pick a lesson and an opening phase. Also available as{' '}
          <code>
            window.__ecmoWorkspaceSelect(&apos;id&apos;, &apos;vv|va&apos;, &apos;phase&apos;)
          </code>
          , <code>window.__ecmoWorkspaceProbe()</code> and{' '}
          <code>window.__ecmoWorkspaceScrollProbe()</code>.
        </p>
        <p style={{ margin: '0 0 1rem', color: '#96b3b6' }}>
          Currently showing <strong>{selection.lesson}</strong> on the{' '}
          <strong>{resolvedTrack.toUpperCase()}</strong> reference circuit, opened at the{' '}
          <strong>{selection.phase}</strong> phase.
          {resolvedTrack === selection.track
            ? null
            : ' Track was forced by the lesson, exactly as the route forces it.'}
        </p>

        {/* Opening phase, so a `?phase=` arrival can be reviewed rather than only clicked into. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem' }}>
          {criticalCareActivityPhases.map((phase) => {
            const active = selection.phase === phase
            return (
              <button
                key={phase}
                type="button"
                data-preview-phase={phase}
                onClick={() => setSelection((current) => ({ ...current, phase }))}
                style={{
                  minHeight: '2.25rem',
                  padding: '0.35rem 0.6rem',
                  color: active ? '#04211f' : '#dcecee',
                  border: '1px solid rgba(163, 206, 209, 0.4)',
                  borderRadius: '0.5rem',
                  background: active ? '#a3ced1' : 'rgba(16, 46, 52, 0.7)',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontWeight: 700,
                }}
              >
                open at {phase}
              </button>
            )
          })}
        </div>
        {SCOPES.map((scope) => (
          <div key={scope.label} style={{ marginBottom: '0.9rem' }}>
            <p
              style={{
                margin: '0 0 0.35rem',
                color: '#71e1e5',
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {scope.label}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {scope.ids.map((id) => {
                const tracks: readonly SupportMode[] =
                  scope.label === 'Shared by both tracks' ? ['vv', 'va'] : [resolvedTrack]
                return tracks.map((track) => {
                  const active = selection.lesson === id && resolvedTrack === track
                  return (
                    <button
                      key={`${id}:${track}`}
                      type="button"
                      // Keeps the chosen opening phase, so a phase can be compared across lessons.
                      onClick={() => setSelection((current) => ({ ...current, lesson: id, track }))}
                      style={{
                        minHeight: '2.25rem',
                        padding: '0.35rem 0.6rem',
                        color: active ? '#04211f' : '#dcecee',
                        border: '1px solid rgba(163, 206, 209, 0.4)',
                        borderRadius: '0.5rem',
                        background: active ? '#71e1e5' : 'rgba(16, 46, 52, 0.7)',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontWeight: 700,
                      }}
                    >
                      {ecmoFoundationSectionById.get(id)?.title ?? id}
                      {scope.label === 'Shared by both tracks' ? ` · ${track.toUpperCase()}` : ''}
                    </button>
                  )
                })
              })}
            </div>
          </div>
        ))}
        <p style={{ margin: 0, color: '#7b989b' }}>
          {ecmoInteractiveFoundationSectionIds.length} interactive foundation sections registered.
        </p>
      </section>
    </>
  )
}

const globals = window as unknown as Record<string, unknown>
globals.__ecmoWorkspaceProbe = probe
globals.__ecmoWorkspaceScrollProbe = scrollProbe
globals.__ecmoWorkspaceCapture = captureMode

const host = document.getElementById('root')
if (!host) throw new Error('fixture host #root is missing')
createRoot(host).render(<Fixture />)
