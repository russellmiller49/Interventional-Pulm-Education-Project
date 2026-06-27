'use client'

import type { ReactNode } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { MarkdownContent } from '@/components/board-review/MarkdownContent'

import type {
  BoardDeepDiveSection,
  LearnBlock,
  LearnImageMedia,
  LearnMedia,
  LearnVideoMedia,
} from '../types'
import { HandoffContent } from '@/i18n/handoff'

interface LearnSectionProps {
  intro?: ReactNode
  coreBlocks: LearnBlock[]
  goDeeperBlocks?: LearnBlock[]
  /** Board-chapter prose, pre-fetched server-side, shown under "Go deeper". */
  boardSections?: BoardDeepDiveSection[]
  boardSourceLabel?: string
}

/**
 * Renders a Learn page in the layered-depth pattern:
 *   - core blocks: always visible didactic teaching (the "everyone" layer)
 *   - go-deeper blocks + board prose: collapsed in an accordion (the "advanced" layer)
 *
 * Content is data-driven so any templated module can reuse this by supplying
 * blocks; the board prose is passed in already-fetched (this is a client
 * component, the board loader is server-only).
 */
export function LearnSection({
  intro,
  coreBlocks,
  goDeeperBlocks = [],
  boardSections = [],
  boardSourceLabel,
}: LearnSectionProps) {
  const hasGoDeeper = goDeeperBlocks.length > 0 || boardSections.length > 0

  return (
    <HandoffContent>
      {
        <div className="container max-w-4xl space-y-6">
          {intro ? (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-5 text-sm leading-7 text-foreground">
              {intro}
            </div>
          ) : null}

          {coreBlocks.map((block) => (
            <article
              key={block.id}
              className="rounded-lg border border-border/80 bg-card p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{block.title}</h2>
                <Badge
                  variant="outline"
                  className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
                >
                  Core
                </Badge>
              </div>
              <LearnBlockBody block={block} />
            </article>
          ))}

          {hasGoDeeper ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Go deeper</h2>
                <Badge
                  variant="outline"
                  className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  Advanced
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Optional depth for advanced learners — dynamic signs and the board-level detail
                behind the core teaching above.
              </p>
              <Accordion type="multiple" className="space-y-3">
                {goDeeperBlocks.map((block) => (
                  <AccordionItem key={block.id} value={block.id}>
                    <AccordionTrigger>{block.title}</AccordionTrigger>
                    <AccordionContent>
                      <LearnBlockBody block={block} />
                    </AccordionContent>
                  </AccordionItem>
                ))}

                {boardSections.map((section) => (
                  <AccordionItem key={section.id} value={`board-${section.id}`}>
                    <AccordionTrigger>{section.title}</AccordionTrigger>
                    <AccordionContent>
                      {boardSourceLabel ? (
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {boardSourceLabel}
                        </p>
                      ) : null}
                      <MarkdownContent content={section.content} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : null}
        </div>
      }
    </HandoffContent>
  )
}

function LearnBlockBody({ block }: { block: LearnBlock }) {
  return (
    <HandoffContent>
      {
        <div className="mt-3 space-y-4">
          {block.paragraphs?.map((paragraph, index) => (
            <p key={index} className="text-sm leading-7 text-muted-foreground">
              {paragraph}
            </p>
          ))}

          {block.bullets?.length ? (
            <ul className="grid gap-2 text-sm leading-7 text-muted-foreground">
              {block.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {block.media ? (
            <Media media={block.media} />
          ) : block.figure ? (
            <Media media={block.figure} />
          ) : null}
        </div>
      }
    </HandoffContent>
  )
}

function Media({ media }: { media: LearnMedia }) {
  if (media.kind === 'video') {
    return <HandoffContent>{<VideoFigure video={media} />}</HandoffContent>
  }

  return <HandoffContent>{<ImageFigure figure={media} />}</HandoffContent>
}

function ImageFigure({ figure }: { figure: LearnImageMedia }) {
  return (
    <HandoffContent>
      {
        <figure className="overflow-hidden rounded-lg border border-border/80 bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={figure.src}
            alt={figure.alt}
            className="max-h-[28rem] w-full bg-background object-contain"
          />
          <figcaption className="space-y-1 border-t border-border/80 p-4 text-sm leading-6 text-muted-foreground">
            <p className="text-foreground">{figure.caption}</p>
            {figure.attribution ? (
              <p className="text-xs">
                Attribution: {figure.attribution}
                {figure.sourceUrl ? (
                  <>
                    {' · '}
                    <a
                      href={figure.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-sky-500 underline-offset-4"
                    >
                      {figure.license ?? 'Source'}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </figcaption>
        </figure>
      }
    </HandoffContent>
  )
}

function VideoFigure({ video }: { video: LearnVideoMedia }) {
  return (
    <HandoffContent>
      {
        <figure className="overflow-hidden rounded-lg border border-border/80 bg-muted/30">
          <video
            controls
            playsInline
            preload="metadata"
            poster={video.poster}
            aria-label={video.label}
            className="max-h-[28rem] w-full bg-black object-contain"
          >
            <source src={video.src} type={video.type ?? 'video/mp4'} />
            Your browser does not support embedded video.
          </video>
          <figcaption className="space-y-1 border-t border-border/80 p-4 text-sm leading-6 text-muted-foreground">
            <p className="text-foreground">{video.caption}</p>
            {video.attribution ? (
              <p className="text-xs">
                Attribution: {video.attribution}
                {video.sourceUrl ? (
                  <>
                    {' · '}
                    <a
                      href={video.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-sky-500 underline-offset-4"
                    >
                      {video.license ?? 'Source'}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </figcaption>
        </figure>
      }
    </HandoffContent>
  )
}
