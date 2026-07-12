import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { rigidBronchoscopyNavBase } from '@/features/learning-module/moduleRoutes'
import { RigidTechniqueLibrary } from '@/features/rigid-bronchoscopy-techniques/components/RigidTechniqueLibrary'
import { techniqueCopy } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'
import { getOrderedTechniqueLessons } from '@/features/rigid-bronchoscopy-techniques/content/techniqueLessons'
import { techniqueClips } from '@/features/rigid-bronchoscopy-techniques/content/techniqueVideos'
import { RigidBronchoscopyNav } from '@/features/rigid-bronchoscopy/components/RigidBronchoscopyNav'

export const metadata: Metadata = {
  title: 'Rigid Bronchoscopy — Technique Videos',
  description: techniqueCopy.moduleDescription,
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function RigidBronchoscopyTechniquesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  // Drafts (planned / faculty-review / revision-required) are shown ONLY outside
  // production so reviewers can preview them behind a badge. The production
  // learner route never falls back to draft media.
  const showDrafts = process.env.NODE_ENV !== 'production'

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={techniqueCopy.moduleEyebrow}
        title={techniqueCopy.moduleTitle}
        description={techniqueCopy.moduleDescription}
        disclaimer={techniqueCopy.standingDisclaimer}
      />
      <RigidBronchoscopyNav activeHref={rigidBronchoscopyNavBase} />

      <section className="container max-w-5xl space-y-6">
        <RigidTechniqueLibrary
          lessons={getOrderedTechniqueLessons()}
          clips={techniqueClips}
          basePath={`${rigidBronchoscopyNavBase}/techniques`}
          showDrafts={showDrafts}
        />
      </section>
    </div>
  )
}
