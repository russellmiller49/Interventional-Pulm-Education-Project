import type { Metadata } from 'next'

import { Badge } from '@/components/ui/badge'
import { PleuralLearningPath } from '@/features/pleural-procedures/components/PleuralLearningPath'
import { introPleuralModules } from '@/features/intro-pleural-course/engine/moduleRegistry'

export const metadata: Metadata = {
  title: 'Pleural Procedures',
  description:
    'An ordered pleural procedures curriculum — from ultrasound and fluid analysis through drainage, infection, pneumothorax, and malignant effusion.',
}

export default function PleuralProceduresPage() {
  return (
    <div className="space-y-10 py-16">
      <section className="container space-y-6">
        <div className="max-w-4xl space-y-3">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Pleural procedures
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Pleural procedures curriculum
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
            Work the path in order, or jump to the module you need. Each module follows the same
            shape — Learn the concepts, Practice on interactive cases, then check yourself in the
            Assessment. Your progress is saved on this device.
          </p>
        </div>
      </section>

      <section className="container">
        <PleuralLearningPath modules={introPleuralModules} />
      </section>
    </div>
  )
}
