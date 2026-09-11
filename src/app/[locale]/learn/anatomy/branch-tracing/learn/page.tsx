import { BranchTracingLesson } from '@/features/bronchial-branch-tracing/components/BranchTracingLesson'

export default async function BranchTracingLearnPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>
}) {
  const { lesson } = await searchParams
  return <BranchTracingLesson requestedId={typeof lesson === 'string' ? lesson : undefined} />
}
