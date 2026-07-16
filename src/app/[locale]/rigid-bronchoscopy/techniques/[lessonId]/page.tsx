import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { rigidBronchoscopyNavBase } from '@/features/learning-module/moduleRoutes'
import { RigidTechniqueLesson } from '@/features/rigid-bronchoscopy-techniques/components/RigidTechniqueLesson'
import { techniqueCopy } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'
import {
  getTechniqueLesson,
  techniqueLessons,
} from '@/features/rigid-bronchoscopy-techniques/content/techniqueLessons'
import { getTechniqueClipsForLesson } from '@/features/rigid-bronchoscopy-techniques/content/techniqueVideos'
import { RigidBronchoscopyNav } from '@/features/rigid-bronchoscopy/components/RigidBronchoscopyNav'

interface PageProps {
  params: Promise<{ locale: string; lessonId: string }>
}

export function generateStaticParams() {
  return techniqueLessons.map((lesson) => ({ lessonId: lesson.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lessonId } = await params
  const lesson = getTechniqueLesson(lessonId)
  if (!lesson) {
    return { title: 'Technique Videos' }
  }
  return {
    title: `${lesson.title} — Rigid Bronchoscopy Technique Videos`,
    description: lesson.objective,
  }
}

export default async function RigidBronchoscopyTechniqueLessonPage({ params }: PageProps) {
  const { locale, lessonId } = await params
  setRequestLocale(locale)

  const lesson = getTechniqueLesson(lessonId)
  if (!lesson) {
    notFound()
  }

  const clips = getTechniqueClipsForLesson(lesson.id)
  const showDrafts = process.env.NODE_ENV !== 'production'

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={techniqueCopy.moduleEyebrow}
        title={lesson.title}
        description={lesson.objective}
        disclaimer={techniqueCopy.standingDisclaimer}
      />
      <RigidBronchoscopyNav activeHref={rigidBronchoscopyNavBase} />

      <section className="container max-w-5xl space-y-6">
        <Link
          href={`${rigidBronchoscopyNavBase}/techniques` as Route}
          className="inline-flex items-center text-sm font-medium text-sky-600 hover:text-sky-500"
        >
          ← All technique videos
        </Link>
        <RigidTechniqueLesson lesson={lesson} clips={clips} showDrafts={showDrafts} />
      </section>
    </div>
  )
}
