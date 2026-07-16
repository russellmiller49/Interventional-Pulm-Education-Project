'use client'

import { useCallback, useState } from 'react'
import { Boxes, ClipboardCheck, Compass, Network, Video } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LEGEND_LOBES, LOBE_LABELS, lobeColor } from '@/lib/airway-anatomy-lesson/airway-graph'
import { cn } from '@/lib/cn'

import { Airway3DModel } from './Airway3DModel'
import { AirwaySurvey } from './AirwaySurvey'
import { AirwayTreeDiagram } from './AirwayTreeDiagram'
import { AirwayVideoAtlas } from './AirwayVideoAtlas'
import { AirwayAnatomyQuiz } from './AirwayAnatomyQuiz'
import { AirwayIdentifyQuiz } from './AirwayIdentifyQuiz'
import { AirwayStructureMediaPanel } from './AirwayStructureMediaPanel'
import { CtCorrelationView } from './CtCorrelationView'
import { SegmentDetailPanel } from './SegmentDetailPanel'

type TabKey = 'video' | 'overview' | 'survey' | 'explore' | 'assess'

const STATS = [
  { value: '2', label: 'Lungs' },
  { value: '5', label: 'Lobes' },
  { value: '18', label: 'Segmental bronchi' },
  { value: '~23', label: 'Airway generations' },
]

const ASYMMETRY: { feature: string; right: string; left: string }[] = [
  {
    feature: 'Main bronchus',
    right: 'Shorter, wider, more vertical',
    left: 'Longer, narrower, more horizontal',
  },
  { feature: 'Lobes', right: 'Upper, middle, lower (3)', left: 'Upper, lower (2) + lingula' },
  {
    feature: 'Upper-lobe takeoff',
    right: 'Off the main bronchus',
    left: 'Off the LMB, then upper division + lingula',
  },
  { feature: 'Basal segments', right: 'Four (RB7–RB10)', left: 'Three (LB7+8 fused, LB9, LB10)' },
  { feature: 'Aspiration tendency', right: 'Favored (in-line, vertical)', left: 'Less common' },
]

function LobeLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-2', className)}>
      {LEGEND_LOBES.map((lobe) => (
        <span key={lobe} className="flex items-center gap-1.5">
          <span
            className="inline-flex h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: lobeColor(lobe) }}
            aria-hidden
          />
          <span className="text-xs font-medium text-muted-foreground">{LOBE_LABELS[lobe]}</span>
        </span>
      ))}
    </div>
  )
}

export function AirwayAnatomyLesson() {
  const [activeTab, setActiveTab] = useState<TabKey>('video')
  const [selectedId, setSelectedId] = useState<string | null>('trachea')

  const openInExplorer = useCallback((id: string) => {
    setSelectedId(id)
    setActiveTab('explore')
  }, [])

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
      <TabsList className="flex flex-wrap gap-1">
        <TabsTrigger value="video" className="min-w-0 flex-1 gap-2">
          <Video className="h-4 w-4" aria-hidden /> Real bronchoscopy
        </TabsTrigger>
        <TabsTrigger value="overview" className="min-w-0 flex-1 gap-2">
          <Network className="h-4 w-4" aria-hidden /> Overview
        </TabsTrigger>
        <TabsTrigger value="survey" className="min-w-0 flex-1 gap-2">
          <Compass className="h-4 w-4" aria-hidden /> Guided survey
        </TabsTrigger>
        <TabsTrigger value="explore" className="min-w-0 flex-1 gap-2">
          <Boxes className="h-4 w-4" aria-hidden /> Explore the tree
        </TabsTrigger>
        <TabsTrigger value="assess" className="min-w-0 flex-1 gap-2">
          <ClipboardCheck className="h-4 w-4" aria-hidden /> Test yourself
        </TabsTrigger>
      </TabsList>

      {/* ---- Real bronchoscopy video atlas ---- */}
      <TabsContent value="video" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">
              Pause-and-reveal bronchoscopy atlas
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Play a focused, cropped normal airway survey without moving labels. Pause anywhere to
              reveal unlabeled markers, turn labels on when you want the atlas view, or click a
              marker to identify the airway before opening the same structure in CT, 3D, and the
              tree explorer.
            </p>
          </div>
          <LobeLegend />
        </div>
        <AirwayVideoAtlas onOpenStructure={openInExplorer} />
      </TabsContent>

      {/* ---- Overview / Learn ---- */}
      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-center"
            >
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-5">
            <h3 className="text-lg font-semibold text-foreground">
              The tree, from cords to segments
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              The airway is a branching tree that begins at the glottis and divides — roughly
              dichotomously — through about 23 generations. Bronchoscopy travels the first several:
              trachea, main bronchi, lobar bronchi, and the{' '}
              <strong>bronchopulmonary segments</strong>, the smallest units named and targeted
              during a procedure.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Each segment is numbered in the Boyden system —{' '}
              <span className="font-mono">RB1–RB10</span> on the right and{' '}
              <span className="font-mono">LB1–LB10</span> on the left — so any team member can name
              exactly where a biopsy, washing, or bleed occurred.
            </p>
            <LobeLegend className="pt-1" />
          </section>

          <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-5">
            <h3 className="text-lg font-semibold text-foreground">
              Staying oriented in the scope image
            </h3>
            <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                  aria-hidden
                />
                <span>
                  Keep <strong>anterior at 12 o&apos;clock</strong> and the flat{' '}
                  <strong>membranous wall at 6 o&apos;clock</strong> — it is your reliable posterior
                  landmark when you lose your bearings.
                </span>
              </li>
              <li className="flex gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                  aria-hidden
                />
                <span>
                  In this neutral orientation the{' '}
                  <strong>patient&apos;s right is toward the left</strong> of your video image, so
                  the right main bronchus opens to your left.
                </span>
              </li>
              <li className="flex gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                  aria-hidden
                />
                <span>
                  Downstream openings are described by the <strong>clock face</strong> — the guided
                  survey shows where each daughter orifice sits at every branch point.
                </span>
              </li>
            </ul>
          </section>
        </div>

        <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Right versus left: the asymmetry that matters
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Feature</th>
                  <th className="py-2 pr-4 font-semibold text-sky-500">Right</th>
                  <th className="py-2 font-semibold text-amber-500">Left</th>
                </tr>
              </thead>
              <tbody>
                {ASYMMETRY.map((row) => (
                  <tr key={row.feature} className="border-b border-border/40 align-top">
                    <td className="py-2 pr-4 font-medium text-foreground">{row.feature}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{row.right}</td>
                    <td className="py-2 text-muted-foreground">{row.left}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Continue to{' '}
            <button
              type="button"
              onClick={() => setActiveTab('survey')}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              the guided survey
            </button>{' '}
            to walk the tree the way you would with a scope, or{' '}
            <button
              type="button"
              onClick={() => setActiveTab('explore')}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              explore the 3D model
            </button>
            .
          </p>
        </section>
      </TabsContent>

      {/* ---- Guided survey ---- */}
      <TabsContent value="survey">
        <AirwaySurvey onOpenStructure={openInExplorer} />
      </TabsContent>

      {/* ---- Explore ---- */}
      <TabsContent value="explore" className="space-y-5">
        <div className="rounded-xl border border-border/70 bg-card/50 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Labeled tree — click any structure
            </p>
            <LobeLegend />
          </div>
          <AirwayTreeDiagram selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
            <AirwayStructureMediaPanel nodeId={selectedId} />
            {selectedId && <CtCorrelationView focusNodeId={selectedId} />}
          </div>
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1">
            <Airway3DModel selectedId={selectedId} onSelect={setSelectedId} />
            <SegmentDetailPanel nodeId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      </TabsContent>

      {/* ---- Assess ---- */}
      <TabsContent value="assess" className="space-y-8">
        <AirwayIdentifyQuiz onOpenStructure={openInExplorer} />
        <div className="space-y-3 border-t border-border/60 pt-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Knowledge check</h3>
            <p className="text-sm text-muted-foreground">
              Test the concepts behind the anatomy — orientation, branching patterns, and clinical
              correlations.
            </p>
          </div>
          <AirwayAnatomyQuiz onOpenStructure={openInExplorer} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
