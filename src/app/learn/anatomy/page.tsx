'use client'

import { useMemo, useState } from 'react'

import { AnatomyViewer } from '@/components/3d/AnatomyViewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { anatomyModels } from '@/data/printable-models'
import type { AnatomyModel } from '@/lib/types'

export default function AnatomyLearnPage() {
  const models = anatomyModels
  const [selectedModel, setSelectedModel] = useState<AnatomyModel>(models[0])
  const [visibleSegments, setVisibleSegments] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(models[0].segments.map((segment) => [segment.id, true]))
  )
  const [crossSection, setCrossSection] = useState(0)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [resetSignal, setResetSignal] = useState(0)
  const [showDebugHelpers, setShowDebugHelpers] = useState(false)
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 })

  const segmentList = useMemo(() => selectedModel.segments, [selectedModel])

  const handleModelChange = (model: AnatomyModel) => {
    setSelectedModel(model)
    setVisibleSegments(Object.fromEntries(model.segments.map((segment) => [segment.id, true])))
    setCrossSection(0)
    setShowAnnotations(true)
    setResetSignal((signal) => signal + 1)
  }

  const handleToggleSegment = (segmentId: string) => {
    setVisibleSegments((prev) => ({
      ...prev,
      [segmentId]: !prev[segmentId],
    }))
  }

  const downloads = selectedModel.downloads

  return (
    <div className="space-y-16 py-16">
      <section className="container space-y-4">
        <div className="space-y-2">
          <Badge variant="info" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            Learn · Anatomy
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Interactive 3D Anatomy Viewer</h1>
          <p className="max-w-3xl text-muted-foreground">
            Explore airway structures, vasculature, and lobar relationships with orbit controls, cross-sectional slicing,
            and annotated segments. Built for fellows and faculty running rehearsal labs or patient consults.
          </p>
        </div>
      </section>

      <section className="container grid gap-12 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <AnatomyViewer
            key={selectedModel.id}
            model={selectedModel}
            visibleSegments={visibleSegments}
            crossSection={crossSection}
            showAnnotations={showAnnotations}
            resetSignal={resetSignal}
            showDebugHelpers={showDebugHelpers}
            rotation={rotation}
            onScreenshot={(dataUrl) => {
              const link = document.createElement('a')
              link.href = dataUrl
              link.download = `${selectedModel.slug}-anatomy.png`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }}
          />
          <div className="space-y-4 rounded-3xl border border-border/70 bg-card/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Viewer controls</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Cross-section</span>
                <span className="font-semibold text-foreground">{crossSection}%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={crossSection}
              onChange={(event) => setCrossSection(Number(event.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setShowAnnotations((prev) => !prev)}
                className="rounded-full border border-border/60 px-4 py-1.5 transition hover:border-primary hover:text-primary"
              >
                {showAnnotations ? 'Hide annotations' : 'Show annotations'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCrossSection(0)
                  setVisibleSegments(Object.fromEntries(segmentList.map((segment) => [segment.id, true])))
                  setShowAnnotations(true)
                  setResetSignal((signal) => signal + 1)
                  setRotation({ x: 0, y: 0, z: 0 })
                }}
                className="rounded-full border border-border/60 px-4 py-1.5 transition hover:border-primary hover:text-primary"
              >
                Reset all
              </button>
              <button
                type="button"
                onClick={() => setShowDebugHelpers((prev) => !prev)}
                className="rounded-full border border-border/60 px-4 py-1.5 transition hover:border-primary hover:text-primary"
              >
                {showDebugHelpers ? 'Hide grid' : 'Show grid'}
              </button>
            </div>
            <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Rotation</span>
                <button
                  type="button"
                  onClick={() => setRotation({ x: 0, y: 0, z: 0 })}
                  className="text-xs font-semibold text-primary transition hover:text-primary/80"
                >
                  Reset rotation
                </button>
              </div>
              {(['x', 'y', 'z'] as const).map((axis) => (
                <label key={axis} className="flex flex-col gap-2">
                  <span className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted-foreground/80">
                    <span>{axis.toUpperCase()} axis</span>
                    <span className="text-foreground">{rotation[axis].toFixed(0)}°</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={rotation[axis]}
                    onChange={(event) =>
                      setRotation((prev) => ({ ...prev, [axis]: Number(event.target.value) }))
                    }
                    className="w-full accent-primary"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-8">
          <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/30 p-6">
            <h2 className="text-lg font-semibold">About this structure</h2>
            <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
                  Clinical relevance
                </h3>
                <p className="mt-1 text-sm text-muted-foreground/90">{selectedModel.clinicalRelevance}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
                  Related procedures
                </h3>
                <p className="mt-1 text-sm text-muted-foreground/90">
                  {selectedModel.relatedProcedures.join(', ')}
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground/90">
              <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">Segments</h3>
              <ul className="space-y-2">
                {segmentList.map((segment) => (
                  <li key={segment.id} className="flex items-center justify-between gap-2 rounded-2xl bg-background/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                      <span className="text-sm font-medium text-foreground">{segment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleSegment(segment.id)}
                      className="text-xs font-semibold text-primary transition hover:text-primary/80"
                    >
                      {visibleSegments[segment.id] ?? true ? 'Hide' : 'Show'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-border/70 bg-card/70 p-6">
            <h2 className="text-lg font-semibold">Download model</h2>
            <p className="text-sm text-muted-foreground">
              Export the optimized STL or GLB to incorporate in your rehearsal lab, print farm, or teaching decks.
            </p>
            <div className="flex flex-wrap gap-2">
              {downloads.map((download) => (
                <Button key={download.url} asChild variant="outline">
                  <a href={download.url} download>
                    {download.format.toUpperCase()} · {download.sizeMB ? `${download.sizeMB} MB` : 'N/A'}
                  </a>
                </Button>
              ))}
            </div>
            {selectedModel.notes ? (
              <p className="text-xs text-muted-foreground/80">{selectedModel.notes}</p>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="container space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">Switch models</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => handleModelChange(model)}
              className={`flex flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition hover:border-primary hover:text-primary ${selectedModel.id === model.id ? 'border-primary text-primary' : 'border-border/70'}`}
            >
              <span className="text-sm font-semibold">{model.name}</span>
              <span className="text-xs text-muted-foreground">{model.description}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
