'use client'

import { useId, useMemo } from 'react'

import { lumenBudgetArchitecturePresets } from '../../content/lumenBudgetPresets'
import { circleAreaMm2, deriveInnerDiameterMm, lumenAreaFraction } from '../../engine/lumenBudget'
import {
  getStentExplorerArchitectureProfile,
  hasExplorerArchitectureCover,
} from '../../explorer/architectures'
import { applyStentMechanicsModifiers, getStentExplorerPose } from '../../explorer/pose'
import type { StentExplorerArchitectureId, StentExplorerPose } from '../../explorer/types'
import type { StentExplorerVisualizationProps } from './visualizationTypes'

const SVG_WIDTH = 600
const SVG_HEIGHT = 314
const SCALE_PX_PER_MM = 8
const ILLUSTRATIVE_OUTER_DIAMETER_MM = 14

interface ArchitectureSectionProfile {
  id: StentExplorerArchitectureId
  label: string
  wallThicknessMm: number
  wallClassName: string
  wallStrokeClassName: string
}

interface SectionMetric extends ArchitectureSectionProfile {
  innerDiameterMm: number
  innerToOuterRatio: number
  lumenAreaFraction: number
  lumenAreaMm2: number
  outerDiameterMm: number
}

const siliconeWallThickness =
  lumenBudgetArchitecturePresets.find((preset) => preset.id === 'generic-silicone-tube')
    ?.wallThicknessMm ?? 1.5
const scaffoldWallThickness =
  lumenBudgetArchitecturePresets.find((preset) => preset.id === 'generic-thin-wall-scaffold')
    ?.wallThicknessMm ?? 0.5

const SECTION_PROFILES: Record<StentExplorerArchitectureId, ArchitectureSectionProfile> = {
  'solid-silicone': {
    id: 'solid-silicone',
    label: 'Solid-wall silicone',
    wallThicknessMm: siliconeWallThickness,
    wallClassName: 'fill-cyan-500/80',
    wallStrokeClassName: 'stroke-cyan-900 dark:stroke-cyan-100',
  },
  'free-crossing-braid': {
    id: 'free-crossing-braid',
    label: 'Free-crossing braid',
    wallThicknessMm: scaffoldWallThickness,
    wallClassName: 'fill-violet-500/70',
    wallStrokeClassName: 'stroke-violet-900 dark:stroke-violet-100',
  },
  'hook-cross-covered': {
    id: 'hook-cross-covered',
    label: 'Covered captured braid',
    wallThicknessMm: 0.65,
    wallClassName: 'fill-sky-500/70',
    wallStrokeClassName: 'stroke-sky-900 dark:stroke-sky-100',
  },
  'laser-cut-covered': {
    id: 'laser-cut-covered',
    label: 'Covered laser-cut lattice',
    wallThicknessMm: 0.65,
    wallClassName: 'fill-indigo-500/70',
    wallStrokeClassName: 'stroke-indigo-900 dark:stroke-indigo-100',
  },
  'single-wire-knit-partial-cover': {
    id: 'single-wire-knit-partial-cover',
    label: 'Partial-cover single-wire knit',
    wallThicknessMm: 0.6,
    wallClassName: 'fill-emerald-500/70',
    wallStrokeClassName: 'stroke-emerald-900 dark:stroke-emerald-100',
  },
  'balloon-expanded-metal': {
    id: 'balloon-expanded-metal',
    label: 'Balloon-expanded metal reference',
    wallThicknessMm: scaffoldWallThickness,
    wallClassName: 'fill-amber-400/70',
    wallStrokeClassName: 'stroke-amber-900 dark:stroke-amber-100',
  },
  'silicone-y': {
    id: 'silicone-y',
    label: 'Silicone Y limb',
    wallThicknessMm: siliconeWallThickness,
    wallClassName: 'fill-teal-500/75',
    wallStrokeClassName: 'stroke-teal-900 dark:stroke-teal-100',
  },
  'dynamic-y': {
    id: 'dynamic-y',
    label: 'Dynamic Y limb',
    wallThicknessMm: 1.2,
    wallClassName: 'fill-emerald-500/75',
    wallStrokeClassName: 'stroke-emerald-900 dark:stroke-emerald-100',
  },
  'metallic-y': {
    id: 'metallic-y',
    label: 'Metallic Y limb',
    wallThicknessMm: 0.65,
    wallClassName: 'fill-indigo-500/70',
    wallStrokeClassName: 'stroke-indigo-900 dark:stroke-indigo-100',
  },
}

function calculateMetric(
  profile: ArchitectureSectionProfile,
  wallOccupancy?: number,
): SectionMetric {
  const wallThicknessMm =
    wallOccupancy === undefined
      ? profile.wallThicknessMm
      : profile.wallThicknessMm * (0.55 + wallOccupancy * 0.6)
  const innerDiameterMm = deriveInnerDiameterMm(ILLUSTRATIVE_OUTER_DIAMETER_MM, wallThicknessMm)

  return {
    ...profile,
    wallThicknessMm,
    innerDiameterMm,
    innerToOuterRatio: innerDiameterMm / ILLUSTRATIVE_OUTER_DIAMETER_MM,
    lumenAreaFraction: lumenAreaFraction(innerDiameterMm, ILLUSTRATIVE_OUTER_DIAMETER_MM),
    lumenAreaMm2: circleAreaMm2(innerDiameterMm),
    outerDiameterMm: ILLUSTRATIVE_OUTER_DIAMETER_MM,
  }
}

function formatMm(value: number) {
  return `${value.toFixed(1)} mm`
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`
}

function getComparisonArchitectureId(
  architectureId: StentExplorerArchitectureId,
): StentExplorerArchitectureId {
  return architectureId === 'solid-silicone' ? 'free-crossing-braid' : 'solid-silicone'
}

function ensureDeployedPose(pose: StentExplorerPose, stationId: string) {
  return stationId === 'deploy-rescue' ? pose : { ...pose, deployment: 1 }
}

function GranulationBumps({
  amount,
  centerX,
  centerY,
  lumenRadius,
}: {
  amount: number
  centerX: number
  centerY: number
  lumenRadius: number
}) {
  if (amount <= 0.01) return null
  const bumpRadius = 2 + amount * 11

  return (
    <g aria-hidden="true" className="fill-rose-500 stroke-rose-950 dark:stroke-rose-100">
      {[-0.78, -0.32, 0.18, 0.67].map((angle, index) => (
        <circle
          key={angle}
          cx={centerX + Math.cos(angle) * (lumenRadius - bumpRadius * 0.45)}
          cy={centerY + Math.sin(angle) * (lumenRadius - bumpRadius * 0.45)}
          r={bumpRadius * (index % 2 === 0 ? 1 : 0.76)}
          strokeWidth="1.5"
        />
      ))}
    </g>
  )
}

function TumorIngrowth({
  amount,
  centerX,
  centerY,
  lumenRadius,
}: {
  amount: number
  centerX: number
  centerY: number
  lumenRadius: number
}) {
  if (amount <= 0.01) return null
  const reach = lumenRadius * (0.12 + amount * 0.6)

  return (
    <g
      aria-hidden="true"
      className="fill-fuchsia-700/90 stroke-fuchsia-950 dark:stroke-fuchsia-100"
    >
      {[0.1, 0.42, 0.72].map((offset, index) => (
        <ellipse
          key={offset}
          cx={centerX + lumenRadius - reach * (0.42 + index * 0.2)}
          cy={centerY + (offset - 0.42) * lumenRadius}
          rx={reach * (0.58 - index * 0.08)}
          ry={5 + amount * 8}
          strokeWidth="1.2"
        />
      ))}
    </g>
  )
}

function MucusPool({
  amount,
  centerX,
  centerY,
  lumenRadius,
}: {
  amount: number
  centerX: number
  centerY: number
  lumenRadius: number
}) {
  if (amount <= 0.01) return null
  const poolHeight = 4 + amount * lumenRadius * 0.72
  const top = centerY + lumenRadius - poolHeight

  return (
    <path
      aria-hidden="true"
      d={`M ${centerX - lumenRadius * 0.82} ${centerY + lumenRadius * 0.46}
          Q ${centerX} ${top} ${centerX + lumenRadius * 0.82} ${centerY + lumenRadius * 0.46}
          Q ${centerX} ${centerY + lumenRadius * 1.04} ${centerX - lumenRadius * 0.82} ${centerY + lumenRadius * 0.46} Z`}
      className="fill-amber-400/90 stroke-amber-950 dark:stroke-amber-100"
      strokeWidth="1.5"
    />
  )
}

function SectionDrawing({
  centerX,
  metric,
  pose,
  preserveOuterEnvelope = false,
  showCover = true,
  showComplications,
}: {
  centerX: number
  metric: SectionMetric
  pose: StentExplorerPose
  preserveOuterEnvelope?: boolean
  showCover?: boolean
  showComplications: boolean
}) {
  const centerY = 114
  const outerRadius = (metric.outerDiameterMm / 2) * SCALE_PX_PER_MM
  const undeformedLumenRadius = (metric.innerDiameterMm / 2) * SCALE_PX_PER_MM
  const deploymentScale = 0.38 + pose.deployment * 0.62
  const compressionScale = preserveOuterEnvelope
    ? 1
    : Math.max(0.35, 1 - pose.radialCompression * 0.34 - pose.airwayCompression * 0.18)
  const lumenRadiusX = undeformedLumenRadius * deploymentScale * compressionScale
  const lumenRadiusY =
    undeformedLumenRadius *
    deploymentScale *
    Math.max(0.32, 1 - pose.kink * 0.52 - pose.branchCompromise * 0.3)
  const migrationOffset = pose.migration * outerRadius * 0.23
  const shiftedX = centerX + migrationOffset
  const shiftedY = centerY - migrationOffset * 0.35
  const posteriorDeflection = pose.posteriorMotion * 9

  return (
    <g>
      <circle
        aria-hidden="true"
        cx={centerX}
        cy={centerY}
        r={outerRadius + 13}
        className="fill-rose-100/30 stroke-rose-400/70 dark:fill-rose-950/20 dark:stroke-rose-300/50"
        strokeDasharray="5 4"
        strokeWidth="2"
      />
      <ellipse
        aria-hidden="true"
        cx={shiftedX}
        cy={shiftedY + posteriorDeflection * 0.2}
        rx={outerRadius * deploymentScale * compressionScale}
        ry={outerRadius * deploymentScale}
        className={`${showCover ? metric.wallClassName : 'fill-none'} ${metric.wallStrokeClassName}`}
        strokeDasharray={showCover ? undefined : '6 4'}
        strokeWidth="2"
      />
      <ellipse
        aria-hidden="true"
        cx={shiftedX}
        cy={shiftedY + posteriorDeflection}
        rx={lumenRadiusX}
        ry={lumenRadiusY}
        className="fill-white stroke-slate-800 dark:fill-slate-950 dark:stroke-slate-100"
        strokeWidth="2"
      />
      {pose.fracture > 0.01 ? (
        <path
          aria-hidden="true"
          d={`M ${shiftedX - outerRadius * 0.66} ${shiftedY - outerRadius * 0.62}
              l ${8 + pose.fracture * 8} ${9 + pose.fracture * 6}
              l ${-7 - pose.fracture * 3} ${8 + pose.fracture * 5}`}
          className="fill-none stroke-red-600 dark:stroke-red-300"
          strokeLinecap="round"
          strokeWidth={2 + pose.fracture * 3}
        />
      ) : null}
      {pose.coverFailure > 0.01 ? (
        <path
          aria-hidden="true"
          d={`M ${shiftedX + outerRadius * 0.36} ${shiftedY - outerRadius * 0.78}
              Q ${shiftedX + outerRadius * 0.7} ${shiftedY} ${shiftedX + outerRadius * 0.35} ${shiftedY + outerRadius * 0.76}`}
          className="fill-none stroke-orange-600 dark:stroke-orange-300"
          strokeDasharray="4 3"
          strokeWidth={2 + pose.coverFailure * 3}
        />
      ) : null}
      {showComplications ? (
        <>
          <MucusPool
            amount={pose.mucus}
            centerX={shiftedX}
            centerY={shiftedY + posteriorDeflection}
            lumenRadius={Math.min(lumenRadiusX, lumenRadiusY)}
          />
          <GranulationBumps
            amount={Math.max(pose.granulation, pose.tumorOvergrowth * 0.65)}
            centerX={shiftedX}
            centerY={shiftedY + posteriorDeflection}
            lumenRadius={Math.min(lumenRadiusX, lumenRadiusY)}
          />
          <TumorIngrowth
            amount={pose.tumorIngrowth}
            centerX={shiftedX}
            centerY={shiftedY + posteriorDeflection}
            lumenRadius={Math.min(lumenRadiusX, lumenRadiusY)}
          />
        </>
      ) : null}
      <line
        aria-hidden="true"
        x1={shiftedX - lumenRadiusX}
        x2={shiftedX + lumenRadiusX}
        y1={shiftedY + posteriorDeflection}
        y2={shiftedY + posteriorDeflection}
        className="stroke-slate-700 dark:stroke-slate-200"
        strokeDasharray="3 3"
      />
      <text
        x={centerX}
        y="210"
        textAnchor="middle"
        className="fill-slate-950 text-[13px] font-bold dark:fill-white"
      >
        {metric.label}
      </text>
      <text
        x={centerX}
        y="230"
        textAnchor="middle"
        className="fill-slate-600 text-[11px] dark:fill-slate-300"
      >
        OD {formatMm(metric.outerDiameterMm)} · illustrative wall {formatMm(metric.wallThicknessMm)}
      </text>
      <text
        x={centerX}
        y="248"
        textAnchor="middle"
        className="fill-slate-600 text-[11px] dark:fill-slate-300"
      >
        baseline ID {formatMm(metric.innerDiameterMm)} · ID/OD{' '}
        {formatPercent(metric.innerToOuterRatio)}
      </text>
      <text
        x={centerX}
        y="266"
        textAnchor="middle"
        className="fill-slate-600 text-[11px] dark:fill-slate-300"
      >
        baseline lumen {metric.lumenAreaMm2.toFixed(1)} mm² · area fraction{' '}
        {formatPercent(metric.lumenAreaFraction)}
      </text>
    </g>
  )
}

export function StentExplorerCrossSection({
  architectureId,
  className,
  modifiers,
  progress,
  showHotspots,
  station,
}: StentExplorerVisualizationProps) {
  const titleId = useId()
  const descriptionId = useId()
  const pose = useMemo(
    () =>
      ensureDeployedPose(
        applyStentMechanicsModifiers(
          station.id,
          getStentExplorerPose(station.id, architectureId, progress),
          modifiers,
        ),
        station.id,
      ),
    [architectureId, modifiers, progress, station.id],
  )
  const wallOccupancy =
    station.id === 'architecture-lumen' ? (modifiers?.wallOccupancy ?? 0.75) : undefined
  const primaryMetric = useMemo(
    () => calculateMetric(SECTION_PROFILES[architectureId], wallOccupancy),
    [architectureId, wallOccupancy],
  )
  const comparisonMetric = useMemo(
    () =>
      calculateMetric(SECTION_PROFILES[getComparisonArchitectureId(architectureId)], wallOccupancy),
    [architectureId, wallOccupancy],
  )
  const compare = station.id === 'architecture-lumen' && (modifiers?.comparisonReveal ?? 1) > 0
  const architectureProfile = getStentExplorerArchitectureProfile(architectureId)
  const comparisonProfile = getStentExplorerArchitectureProfile(comparisonMetric.id)
  const architectureHasCover = hasExplorerArchitectureCover(architectureId)
  const exposedEndSection =
    station.id === 'tumor-ingrowth-overgrowth' && (modifiers?.exposedEndIngrowth ?? 0) > 0
  const coverVisible =
    architectureHasCover &&
    (station.id !== 'metal-architecture' || (modifiers?.coverInspection ?? 1) > 0) &&
    !exposedEndSection
  const showFilledEnvelope = architectureProfile.coverage === 'solid-wall' || coverVisible
  const primaryX = compare ? 435 : 300
  const summary = compare
    ? `At the same illustrative outer diameter, ${primaryMetric.label} has a baseline inner diameter of ${formatMm(primaryMetric.innerDiameterMm)} and ${comparisonMetric.label} has a baseline inner diameter of ${formatMm(comparisonMetric.innerDiameterMm)}.`
    : `${primaryMetric.label} is shown at the same internal drawing scale. The current qualitative state includes ${station.reducedMotionSummary}`

  return (
    <section
      aria-labelledby={titleId}
      className={`h-full min-h-[22rem] overflow-auto bg-gradient-to-b from-slate-50 to-slate-100 p-4 text-slate-950 dark:from-slate-950 dark:to-slate-900 dark:text-white ${className ?? ''}`}
      data-cover-visible={String(coverVisible)}
      data-testid="stent-explorer-cross-section"
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
              True-scale cross-section
            </p>
            <h3 id={titleId} className="mt-1 text-base font-bold">
              Relative lumen geometry
            </h3>
          </div>
          <p className="rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-300">
            Same scale within this diagram
          </p>
        </div>

        <svg
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          className="mt-3 hidden h-auto w-full sm:block"
          role="img"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        >
          {compare ? (
            <SectionDrawing
              centerX={165}
              metric={comparisonMetric}
              pose={ensureDeployedPose(
                applyStentMechanicsModifiers(
                  station.id,
                  getStentExplorerPose(station.id, comparisonMetric.id, progress),
                  modifiers,
                ),
                station.id,
              )}
              preserveOuterEnvelope
              showCover={comparisonProfile.coverage !== 'uncovered'}
              showComplications={false}
            />
          ) : null}
          <SectionDrawing
            centerX={primaryX}
            metric={primaryMetric}
            pose={pose}
            preserveOuterEnvelope={compare}
            showCover={showFilledEnvelope}
            showComplications
          />
        </svg>

        <div className="mt-3 grid gap-2 sm:hidden">
          {compare ? (
            <svg
              aria-describedby={descriptionId}
              aria-labelledby={titleId}
              className="h-auto w-full"
              role="img"
              viewBox="0 0 360 286"
            >
              <SectionDrawing
                centerX={180}
                metric={comparisonMetric}
                pose={ensureDeployedPose(
                  applyStentMechanicsModifiers(
                    station.id,
                    getStentExplorerPose(station.id, comparisonMetric.id, progress),
                    modifiers,
                  ),
                  station.id,
                )}
                preserveOuterEnvelope
                showCover={comparisonProfile.coverage !== 'uncovered'}
                showComplications={false}
              />
            </svg>
          ) : null}
          <svg
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            className="h-auto w-full"
            role="img"
            viewBox="0 0 360 286"
          >
            <SectionDrawing
              centerX={180}
              metric={primaryMetric}
              pose={pose}
              preserveOuterEnvelope={compare}
              showCover={showFilledEnvelope}
              showComplications
            />
          </svg>
        </div>

        <p id={descriptionId} className="text-sm leading-6 text-slate-700 dark:text-slate-300">
          {summary}
        </p>
        {station.id === 'metal-architecture' ? (
          <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
            <p>
              This axial section shows illustrative material occupancy and coverage at one level. It
              cannot reveal longitudinal wire continuity, crossing behavior, connector layout, or
              expansion mechanism; inspect the external and cutaway views for those features.
            </p>
            {architectureHasCover && !coverVisible ? (
              <p>
                The covering layer is hidden in every synchronized view; the dashed structural
                envelope marks the selected scaffold rather than changing it to an uncovered stent.
              </p>
            ) : null}
          </div>
        ) : null}
        {exposedEndSection ? (
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
            This section is positioned through the selected exposed end-cell zone. The covered
            mid-body remains intact and is shown in the longitudinal 3D views.
          </p>
        ) : null}
        {showHotspots ? (
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
            Inspect the open white lumen, the filled solid or covered wall, the dashed uncovered
            scaffold boundary, and any labeled tissue, secretion, deformation, or integrity overlay.
            Color is supplemented by shape and text.
          </p>
        ) : null}
        <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
          Dimensions and wall thicknesses are illustrative geometry inputs, not product
          specifications, airflow predictions, or sizing recommendations. Deformation and
          complication overlays are qualitative and not drawn to a severity scale.
        </p>
      </div>
    </section>
  )
}
