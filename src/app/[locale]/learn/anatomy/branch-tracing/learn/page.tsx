import { NavLessonHost } from '@/features/bronchial-branch-tracing/components/NavLessonHost'

export default async function BranchTracingLearnPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>
}) {
  const { lesson } = await searchParams
  return <NavLessonHost requestedId={typeof lesson === 'string' ? lesson : undefined} />
}
