'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { RotateCcw } from 'lucide-react'

import { BronchoscopeSizeExplorer } from '@/components/bronchoscope-size-explorer/BronchoscopeSizeExplorer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'

import {
  assessBronchoscopyDecision,
  calculateEttOcclusion,
  classifyStenosis,
  scoreBalQuality,
  scoreBleedingSequence,
  type BleedingAction,
} from '../engine/introCalculations'
import type {
  CaseTriageActivity,
  HotspotDiagramActivity,
  ImageDescriptionActivity,
  IntroPracticeActivity,
  MatchingActivity,
  ReportBuilderActivity,
  SequenceBuilderActivity,
  SimulatorActivity,
} from '../types'

export function IntroPracticeActivities({ activities }: { activities: IntroPracticeActivity[] }) {
  return (
    <div className="space-y-5">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  )
}

function ActivityCard({ activity }: { activity: IntroPracticeActivity }) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Interactive practice
        </p>
        <h3 className="text-lg font-semibold text-foreground">{activity.title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{activity.prompt}</p>
      </div>

      <div className="mt-5">
        {activity.type === 'case-triage' && <CaseTriage activity={activity} />}
        {activity.type === 'hotspot-diagram' && <HotspotDiagram activity={activity} />}
        {activity.type === 'simulator' && <Simulator activity={activity} />}
        {activity.type === 'image-description' && <ImageDescription activity={activity} />}
        {activity.type === 'drag-drop' && <Matching activity={activity} />}
        {activity.type === 'sequence-builder' && <SequenceBuilder activity={activity} />}
        {activity.type === 'report-builder' && <ReportBuilder activity={activity} />}
        {activity.type === 'scope-size-explorer' && (
          <div className="-mx-5 rounded-lg border-t border-border/70 pt-5">
            <BronchoscopeSizeExplorer />
          </div>
        )}
      </div>
    </section>
  )
}

function CaseTriage({ activity }: { activity: CaseTriageActivity }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {activity.cases.map((clinicalCase) => {
        const picked = answers[clinicalCase.id]
        const pickedChoice = clinicalCase.choices.find((choice) => choice.id === picked)
        const correct = picked === clinicalCase.bestChoiceId
        return (
          <div key={clinicalCase.id} className="space-y-3 rounded-lg border border-border/70 p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">{clinicalCase.title}</h4>
              <p className="text-sm leading-6 text-muted-foreground">{clinicalCase.scenario}</p>
            </div>
            <div className="space-y-2">
              {clinicalCase.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() =>
                    setAnswers((current) => ({ ...current, [clinicalCase.id]: choice.id }))
                  }
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    picked === choice.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            {pickedChoice && (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm leading-6',
                  correct
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-700',
                )}
              >
                <span className="font-semibold">{correct ? 'Best choice: ' : 'Reconsider: '}</span>
                {pickedChoice.feedback}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function HotspotDiagram({ activity }: { activity: HotspotDiagramActivity }) {
  if (activity.photoAtlas) {
    return <ScopePhotoAtlas manifestUrl={activity.photoAtlas.manifestUrl} />
  }

  return <SchematicHotspotDiagram activity={activity} />
}

function SchematicHotspotDiagram({ activity }: { activity: HotspotDiagramActivity }) {
  const hotspots = activity.hotspots ?? []
  const [activeId, setActiveId] = useState(hotspots[0]?.id ?? '')
  const active = hotspots.find((hotspot) => hotspot.id === activeId)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
      <div className="rounded-lg border border-border/70 bg-background p-4">
        <svg viewBox="0 0 640 320" role="img" aria-label={activity.title} className="h-auto w-full">
          <rect x="40" y="80" width="360" height="46" rx="23" fill="#dbeafe" stroke="#38bdf8" />
          <rect x="395" y="48" width="118" height="132" rx="28" fill="#e0f2fe" stroke="#0284c7" />
          <rect x="504" y="116" width="68" height="28" rx="14" fill="#fef3c7" stroke="#f59e0b" />
          <path
            d="M70 103 C116 52, 196 52, 242 103"
            fill="none"
            stroke="#64748b"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M430 46 L455 16 L486 46"
            fill="none"
            stroke="#64748b"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {hotspots.map((hotspot) => {
            const activeHotspot = hotspot.id === activeId
            return (
              <g key={hotspot.id}>
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={hotspot.label}
                  onClick={() => setActiveId(hotspot.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setActiveId(hotspot.id)
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={(hotspot.x / 100) * 640}
                    cy={(hotspot.y / 100) * 320}
                    r={activeHotspot ? 18 : 14}
                    fill={activeHotspot ? '#0ea5e9' : '#f8fafc'}
                    stroke="#020617"
                    strokeWidth="3"
                  />
                </g>
                <text
                  x={(hotspot.x / 100) * 640}
                  y={(hotspot.y / 100) * 320 + 38}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="15"
                  fontWeight="700"
                >
                  {hotspot.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="rounded-lg border border-border/70 bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Selected hotspot
        </p>
        <h4 className="mt-2 text-lg font-semibold text-foreground">{active?.label}</h4>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{active?.teaching}</p>
      </div>
    </div>
  )
}

interface ScopePhotoAtlasManifest {
  images: ScopePhotoAtlasImage[]
}

interface ScopePhotoAtlasImage {
  id: string
  title: string
  alt: string
  summary: string
  src: string
  width: number
  height: number
  annotations: ScopePhotoAnnotation[]
}

interface ScopePhotoAnnotation {
  id: string
  label: string
  points: [number, number][]
  centroid: { x: number; y: number }
}

const SCOPE_PHOTO_TEACHING: Record<string, { role: string; check: string }> = {
  'Control section': {
    role: 'The operator hand anchors here. It brings the control lever, suction access, and channel access into one working grip.',
    check:
      'Before entering the airway, identify which finger controls suction and which thumb movement flexes the distal tip.',
  },
  'Insertion tube': {
    role: 'This is the patient-facing portion that transmits rotation, tip flexion, suction, and tool passage.',
    check: 'Keep it as straight as practical; loops and torque reduce predictable tip control.',
  },
  'Universal cord': {
    role: 'Connects the scope to the processor/light source and carries the scope away from the operator hand.',
    check:
      'Route it so it does not pull the control section or create torque while the scope is in the airway.',
  },
  'Control lever': {
    role: 'Moves the distal tip up and down through the angulation wires.',
    check:
      'Use the lever deliberately, then release tension before advancing into a narrow branch.',
  },
  'Working channel port': {
    role: 'Entry point into the working channel for saline, topical medication, brushes, forceps, needles, and other tools.',
    check:
      'Confirm the biopsy valve adapter is seated before instrument passage to limit leak and splash.',
  },
  'Suction valve': {
    role: 'When seated and depressed, it connects the working channel to suction for secretion or blood clearance.',
    check:
      'If suction is weak or continuous, check that the valve is seated correctly and the tubing path is intact.',
  },
  'Suction valve Port': {
    role: 'The socket for the suction valve. It is the interface between the hand control and the suction path.',
    check: 'A missing or poorly seated valve makes suction control unreliable.',
  },
  'Working channel adapter': {
    role: 'Adapter hardware that interfaces with the working channel entry depending on the scope setup.',
    check:
      'Match the adapter to the planned accessory and confirm it does not obstruct instrument passage.',
  },
  'Biopsy Valve Adapter': {
    role: 'A seal over the working-channel entry that allows instruments to pass while reducing air and fluid leak.',
    check: 'Replace it if it is torn, loose, or leaking during tool exchanges.',
  },
  'Rotary Function': {
    role: 'A model-specific control area on the control section that affects handling setup and ergonomics.',
    check:
      'Name its function on the actual scope before the case; do not discover a control for the first time in the airway.',
  },
}

function pointsToString(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

function ScopePhotoAtlas({ manifestUrl }: { manifestUrl: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [manifest, setManifest] = useState<ScopePhotoAtlasManifest | null>(null)
  const [activeImageId, setActiveImageId] = useState<string | null>(null)
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(manifestUrl, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load scope photo atlas: ${response.status}`)
        return response.json() as Promise<ScopePhotoAtlasManifest>
      })
      .then((data) => {
        if (cancelled) return
        setManifest(data)
        setActiveImageId(data.images[0]?.id ?? null)
        setActiveAnnotationId(data.images[0]?.annotations[0]?.id ?? null)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('scope photo atlas failed to load', error)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [manifestUrl])

  const activeImage = useMemo(
    () =>
      manifest?.images.find((image) => image.id === activeImageId) ?? manifest?.images[0] ?? null,
    [activeImageId, manifest],
  )

  const activeAnnotation =
    activeImage?.annotations.find((annotation) => annotation.id === activeAnnotationId) ??
    activeImage?.annotations[0] ??
    null
  const teaching = activeAnnotation
    ? (SCOPE_PHOTO_TEACHING[activeAnnotation.label] ?? {
        role: 'Use this structure to orient your handling and accessory setup.',
        check: 'Identify it on the real scope before the case starts.',
      })
    : null

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-muted-foreground">
        The bronchoscope photo atlas could not be loaded.
      </div>
    )
  }

  if (status === 'loading' || !activeImage) {
    return (
      <div className="rounded-lg border border-border/70 bg-background p-4 text-sm text-muted-foreground">
        Loading bronchoscope photo atlas...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {manifest?.images.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => {
              setActiveImageId(image.id)
              setActiveAnnotationId(image.annotations[0]?.id ?? null)
            }}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              image.id === activeImage.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {image.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="rounded-lg border border-border/70 bg-background p-3">
          <div
            className="relative w-full overflow-hidden rounded-md bg-white"
            style={{ aspectRatio: `${activeImage.width} / ${activeImage.height}` }}
          >
            <Image
              src={activeImage.src}
              alt={activeImage.alt}
              fill
              sizes="(min-width: 1280px) 58vw, 100vw"
              className="object-contain"
              priority={activeImage.id === 'full-scope'}
            />
            <svg
              viewBox={`0 0 ${activeImage.width} ${activeImage.height}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label={`${activeImage.title} annotated regions`}
            >
              {activeImage.annotations.map((annotation, index) => {
                const active = annotation.id === activeAnnotation?.id
                const color = active ? '#0ea5e9' : '#f59e0b'
                return (
                  <g
                    key={annotation.id}
                    role="button"
                    tabIndex={0}
                    aria-label={annotation.label}
                    onClick={() => setActiveAnnotationId(annotation.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActiveAnnotationId(annotation.id)
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <polygon
                      points={pointsToString(annotation.points)}
                      fill={active ? 'rgba(14,165,233,0.20)' : 'rgba(245,158,11,0.10)'}
                      stroke="rgba(2,6,23,0.72)"
                      strokeWidth={active ? 8 : 5}
                    />
                    <polygon
                      points={pointsToString(annotation.points)}
                      fill="none"
                      stroke={color}
                      strokeWidth={active ? 5 : 3}
                    />
                    <circle
                      cx={annotation.centroid.x}
                      cy={annotation.centroid.y}
                      r={active ? 24 : 18}
                      fill={active ? '#0ea5e9' : '#f8fafc'}
                      stroke={color}
                      strokeWidth={5}
                    />
                    <text
                      x={annotation.centroid.x}
                      y={annotation.centroid.y + 7}
                      textAnchor="middle"
                      fontSize="22"
                      fontWeight="800"
                      fill={active ? '#ffffff' : '#0f172a'}
                    >
                      {index + 1}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current photo
            </p>
            <h4 className="mt-2 text-lg font-semibold text-foreground">{activeImage.title}</h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeImage.summary}</p>
          </div>

          {activeAnnotation && teaching && (
            <div className="rounded-lg border border-border/70 bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected structure
              </p>
              <h4 className="mt-2 text-lg font-semibold text-foreground">
                {activeAnnotation.label}
              </h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{teaching.role}</p>
              <p className="mt-3 rounded-md bg-muted/70 px-3 py-2 text-sm leading-6 text-muted-foreground">
                {teaching.check}
              </p>
            </div>
          )}

          <div className="grid gap-2">
            {activeImage.annotations.map((annotation, index) => (
              <button
                key={annotation.id}
                type="button"
                onClick={() => setActiveAnnotationId(annotation.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  annotation.id === activeAnnotation?.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {index + 1}
                </span>
                {annotation.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Simulator({ activity }: { activity: SimulatorActivity }) {
  if (activity.simulator === 'ett-occlusion') return <EttOcclusionSimulator />
  if (activity.simulator === 'bal-quality') return <BalQualitySimulator />
  if (activity.simulator === 'stenosis') return <StenosisSimulator />
  if (activity.simulator === 'suction') return <SuctionSimulator />
  if (activity.simulator === 'bleeding') return <BleedingSimulator />
  return <ValueEquationSimulator />
}

function ValueEquationSimulator() {
  const [expectedBenefit, setExpectedBenefit] = useState(7)
  const [physiologicRisk, setPhysiologicRisk] = useState(4)
  const [alternativeYield, setAlternativeYield] = useState(3)
  const [urgency, setUrgency] = useState(5)
  const [resultChangesManagement, setResultChangesManagement] = useState(true)
  const result = assessBronchoscopyDecision({
    alternativeYield,
    expectedBenefit,
    physiologicRisk,
    resultChangesManagement,
    urgency,
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Slider label="Expected benefit" value={expectedBenefit} onChange={setExpectedBenefit} />
        <Slider label="Physiologic risk" value={physiologicRisk} onChange={setPhysiologicRisk} />
        <Slider label="Alternative yield" value={alternativeYield} onChange={setAlternativeYield} />
        <Slider label="Urgency" value={urgency} onChange={setUrgency} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={resultChangesManagement}
            onCheckedChange={(value) => setResultChangesManagement(Boolean(value))}
          />
          Result changes management
        </label>
      </div>
      <ResultPanel
        title={`Decision: ${result.decision}`}
        detail={result.rationale}
        metric={`Benefit ${result.benefitScore} / Risk ${result.riskScore}`}
      />
    </div>
  )
}

function EttOcclusionSimulator() {
  const [ett, setEtt] = useState(8)
  const [scope, setScope] = useState(5.8)
  const result = calculateEttOcclusion(ett, scope)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <NumberControl
          label="ETT inner diameter (mm)"
          value={ett}
          min={5}
          max={9.5}
          onChange={setEtt}
        />
        <NumberControl
          label="Scope outer diameter (mm)"
          value={scope}
          min={2.8}
          max={6.4}
          onChange={setScope}
        />
        <ResultPanel
          title={`${result.percentOccluded}% area occupied`}
          metric={`${result.residualAreaMm2.toFixed(1)} mm2 residual area`}
          detail={result.message}
        />
      </div>
      <svg
        viewBox="0 0 320 260"
        role="img"
        aria-label="ETT occlusion visual"
        className="h-auto w-full"
      >
        <circle cx="160" cy="130" r="108" fill="#e0f2fe" stroke="#0284c7" strokeWidth="5" />
        <circle
          cx="160"
          cy="130"
          r={Math.max(12, (scope / ett) * 108)}
          fill="#0f172a"
          opacity="0.78"
        />
        <text x="160" y="134" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">
          {result.percentOccluded}%
        </text>
      </svg>
    </div>
  )
}

function BalQualitySimulator() {
  const [targetSelected, setTargetSelected] = useState(true)
  const [avoidedProximalSuction, setAvoidedProximalSuction] = useState(true)
  const [wedged, setWedged] = useState(true)
  const [instilledMl, setInstilledMl] = useState(120)
  const [returnedMl, setReturnedMl] = useState(45)
  const [sentCorrectTests, setSentCorrectTests] = useState(true)
  const result = scoreBalQuality({
    avoidedProximalSuction,
    instilledMl,
    returnedMl,
    sentCorrectTests,
    targetSelected,
    wedged,
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-3 text-sm text-muted-foreground">
        {[
          ['Disease-based target selected', targetSelected, setTargetSelected],
          [
            'Avoided proximal suction before wedge',
            avoidedProximalSuction,
            setAvoidedProximalSuction,
          ],
          ['Maintained a wedge', wedged, setWedged],
          ['Sent correct tests', sentCorrectTests, setSentCorrectTests],
        ].map(([label, checked, setter]) => (
          <label key={String(label)} className="flex items-center gap-2">
            <Checkbox
              checked={Boolean(checked)}
              onCheckedChange={(value) => (setter as (next: boolean) => void)(Boolean(value))}
            />
            {String(label)}
          </label>
        ))}
        <NumberControl
          label="Instilled volume (mL)"
          value={instilledMl}
          min={20}
          max={180}
          onChange={setInstilledMl}
        />
        <NumberControl
          label="Return volume (mL)"
          value={returnedMl}
          min={0}
          max={120}
          onChange={setReturnedMl}
        />
      </div>
      <ResultPanel
        title={`${result.quality} BAL`}
        metric={`Score ${result.score}/10, return ${result.returnPercent}%`}
        detail={
          result.misses.length > 0
            ? result.misses.join(' ')
            : 'Technique meets the major quality checks for a useful BAL.'
        }
      />
    </div>
  )
}

function StenosisSimulator() {
  const [percent, setPercent] = useState(60)
  const result = classifyStenosis(percent)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Slider label="Estimated percent narrowing" value={percent} onChange={setPercent} />
        <ResultPanel
          title={result.label}
          metric={`Severity: ${result.severity}`}
          detail="Pair the percentage with location, intrinsic/extrinsic pattern, mucosal appearance, and dynamic behavior."
        />
      </div>
      <svg
        viewBox="0 0 320 240"
        role="img"
        aria-label="Airway stenosis visual"
        className="h-auto w-full"
      >
        <rect
          x="64"
          y="28"
          width="192"
          height="184"
          rx="92"
          fill="#dbeafe"
          stroke="#0284c7"
          strokeWidth="5"
        />
        <rect
          x={160 - (96 * (100 - percent)) / 100}
          y="28"
          width={(192 * (100 - percent)) / 100}
          height="184"
          rx="40"
          fill="#0f172a"
          opacity="0.78"
        />
      </svg>
    </div>
  )
}

function SuctionSimulator() {
  const [targeting, setTargeting] = useState(70)
  const [time, setTime] = useState(35)
  const safe = targeting >= 65 && time <= 55

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Slider label="Aim at base of material" value={targeting} onChange={setTargeting} />
        <Slider label="Time suctioning in one position" value={time} onChange={setTime} />
      </div>
      <ResultPanel
        title={safe ? 'Effective clearance pattern' : 'Refine technique'}
        metric={`Base targeting ${targeting}% / dwell ${time}%`}
        detail={
          safe
            ? 'Targeting the base and avoiding prolonged fixed suction helps maintain view and ventilation.'
            : 'Avoid burying the scope tip or suctioning too long in one position.'
        }
      />
    </div>
  )
}

function BleedingSimulator() {
  const actions: { id: BleedingAction; label: string }[] = [
    { id: 'announce', label: 'Announce bleeding' },
    { id: 'suction', label: 'Suction to maintain view' },
    { id: 'protect-good-lung', label: 'Protect good lung' },
    { id: 'wedge', label: 'Wedge/isolate source' },
    { id: 'topical', label: 'Apply topical control' },
    { id: 'escalate', label: 'Escalate' },
  ]
  const [selected, setSelected] = useState<BleedingAction[]>([])
  const result = scoreBleedingSequence(selected)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant={selected.includes(action.id) ? 'secondary' : 'outline'}
            onClick={() =>
              setSelected((current) =>
                current.includes(action.id) ? current : [...current, action.id],
              )
            }
          >
            {selected.indexOf(action.id) >= 0 ? selected.indexOf(action.id) + 1 : ''}
            {selected.indexOf(action.id) >= 0 ? '. ' : ''}
            {action.label}
          </Button>
        ))}
        <Button type="button" variant="ghost" onClick={() => setSelected([])}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reset
        </Button>
      </div>
      <ResultPanel
        title={result.complete ? 'Complete sequence' : `Sequence score ${result.score}/6`}
        metric={selected.join(' -> ') || 'No actions selected yet'}
        detail={result.feedback}
      />
    </div>
  )
}

function ImageDescription({ activity }: { activity: ImageDescriptionActivity }) {
  const [activeId, setActiveId] = useState(activity.patterns[0]?.id ?? '')
  const [picked, setPicked] = useState<string[]>([])
  const active = activity.patterns.find((pattern) => pattern.id === activeId)
  const descriptors = [
    'location',
    'severity',
    'dynamic',
    'vascularity',
    'obstruction',
    'posterior wall',
  ]
  const correct =
    active &&
    picked.length === active.correctDescriptors.length &&
    active.correctDescriptors.every((descriptor) => picked.includes(descriptor))

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-2">
        {activity.patterns.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            onClick={() => {
              setActiveId(pattern.id)
              setPicked([])
            }}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-left text-sm',
              activeId === pattern.id
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border/70 text-muted-foreground',
            )}
          >
            {pattern.label}
          </button>
        ))}
      </div>
      <div className="space-y-4 rounded-lg border border-border/70 p-4">
        <SchematicAirway label={active?.label ?? 'Airway finding'} />
        <p className="text-sm text-muted-foreground">{active?.finding}</p>
        <div className="flex flex-wrap gap-2">
          {descriptors.map((descriptor) => (
            <Button
              key={descriptor}
              type="button"
              variant={picked.includes(descriptor) ? 'secondary' : 'outline'}
              onClick={() =>
                setPicked((current) =>
                  current.includes(descriptor)
                    ? current.filter((item) => item !== descriptor)
                    : [...current, descriptor],
                )
              }
            >
              {descriptor}
            </Button>
          ))}
        </div>
        <ResultPanel
          title={correct ? 'Descriptor set matches' : 'Commit descriptors'}
          metric={active?.description ?? ''}
          detail={
            correct
              ? 'Good. This description includes the important reporting dimensions.'
              : 'Try to select only descriptors needed to make the finding clinically useful.'
          }
        />
      </div>
    </div>
  )
}

function Matching({ activity }: { activity: MatchingActivity }) {
  const [left, setLeft] = useState<string | null>(null)
  const [matches, setMatches] = useState<Record<string, string>>({})
  const rightItems = [...activity.pairs].reverse()
  const correctCount = activity.pairs.filter((pair) => matches[pair.id] === pair.right).length

  function chooseRight(right: string) {
    if (!left) return
    setMatches((current) => ({ ...current, [left]: right }))
    setLeft(null)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        {activity.pairs.map((pair) => (
          <button
            key={pair.id}
            type="button"
            onClick={() => setLeft(pair.id)}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-left text-sm',
              left === pair.id ? 'border-primary bg-primary/10' : 'border-border/70',
            )}
          >
            {pair.left}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {rightItems.map((pair) => (
          <button
            key={pair.right}
            type="button"
            onClick={() => chooseRight(pair.right)}
            className="w-full rounded-lg border border-border/70 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
          >
            {pair.right}
          </button>
        ))}
        <div className="rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
          Correct matches: {correctCount}/{activity.pairs.length}
        </div>
      </div>
    </div>
  )
}

function SequenceBuilder({ activity }: { activity: SequenceBuilderActivity }) {
  const [selected, setSelected] = useState<string[]>([])
  const correct = selected.every((id, index) => activity.steps[index]?.id === id)
  const complete = selected.length === activity.steps.length

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-wrap gap-2">
        {activity.steps.map((step) => (
          <Button
            key={step.id}
            type="button"
            variant={selected.includes(step.id) ? 'secondary' : 'outline'}
            onClick={() =>
              setSelected((current) =>
                current.includes(step.id) ? current : [...current, step.id],
              )
            }
          >
            {step.label}
          </Button>
        ))}
        <Button type="button" variant="ghost" onClick={() => setSelected([])}>
          Reset
        </Button>
      </div>
      <div className="space-y-2 rounded-lg border border-border/70 p-4">
        <p className="text-sm font-semibold text-foreground">Your sequence</p>
        <ol className="space-y-1 text-sm text-muted-foreground">
          {selected.map((id, index) => {
            const step = activity.steps.find((item) => item.id === id)
            return (
              <li key={id}>
                {index + 1}. {step?.label}
              </li>
            )
          })}
        </ol>
        {complete && (
          <ResultPanel
            title={correct ? 'Correct order' : 'Order needs work'}
            metric={correct ? 'Ready to apply' : 'Compare with the rationale'}
            detail={
              correct
                ? activity.steps.map((step) => step.rationale).join(' ')
                : 'Reset and rebuild the sequence from preparation toward execution and documentation.'
            }
          />
        )}
      </div>
    </div>
  )
}

function ReportBuilder({ activity }: { activity: ReportBuilderActivity }) {
  const [included, setIncluded] = useState<string[]>([])
  const [draft, setDraft] = useState(activity.exampleFinding)
  const missing = activity.requiredElements.filter((element) => !included.includes(element))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-2">
        {activity.requiredElements.map((element) => (
          <label key={element} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={included.includes(element)}
              onCheckedChange={(value) =>
                setIncluded((current) =>
                  value ? [...current, element] : current.filter((item) => item !== element),
                )
              }
            />
            {element}
          </label>
        ))}
      </div>
      <div className="space-y-3">
        <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} />
        <ResultPanel
          title={missing.length === 0 ? 'Required elements included' : `${missing.length} missing`}
          metric={missing.length > 0 ? missing.join(', ') : 'Ready for note review'}
          detail="A useful bronchoscopy note explains indication, findings, samples, interventions, complications, and next steps."
        />
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block space-y-1 text-sm text-muted-foreground">
      <span className="flex justify-between gap-3">
        <span>{label}</span>
        <span className="font-mono text-foreground">{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </label>
  )
}

function NumberControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block space-y-1 text-sm text-muted-foreground">
      <span>{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ResultPanel({ title, metric, detail }: { title: string; metric: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">{metric}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  )
}

function SchematicAirway({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 520 180"
      role="img"
      aria-label={label}
      className="h-auto w-full rounded-lg bg-slate-950"
    >
      <rect
        x="64"
        y="38"
        width="392"
        height="104"
        rx="52"
        fill="#1e293b"
        stroke="#94a3b8"
        strokeWidth="5"
      />
      <ellipse cx="286" cy="90" rx="58" ry="34" fill="#ef4444" opacity="0.8" />
      <path d="M120 90 H250" stroke="#f8fafc" strokeWidth="7" strokeLinecap="round" opacity="0.4" />
      <path d="M330 90 H410" stroke="#f8fafc" strokeWidth="7" strokeLinecap="round" opacity="0.4" />
      <text x="260" y="160" textAnchor="middle" fill="#f8fafc" fontSize="18" fontWeight="700">
        {label}
      </text>
    </svg>
  )
}
