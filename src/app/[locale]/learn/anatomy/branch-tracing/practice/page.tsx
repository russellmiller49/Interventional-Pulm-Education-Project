import { NavRouteHost } from '@/features/bronchial-branch-tracing/components/NavRouteHost'

export default async function BranchTracingPracticePage({
  searchParams,
}: {
  searchParams: Promise<{ lesion?: string }>
}) {
  const { lesion } = await searchParams
  return (
    <NavRouteHost
      mode="practice"
      requestedTarget={typeof lesion === 'string' ? lesion : undefined}
    />
  )
}
