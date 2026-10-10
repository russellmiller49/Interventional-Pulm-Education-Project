import { NavRouteHost } from '@/features/bronchial-branch-tracing/components/NavRouteHost'

export default async function BranchTracingClosingSetPage({
  searchParams,
}: {
  searchParams: Promise<{ lesion?: string }>
}) {
  const { lesion } = await searchParams
  return (
    <NavRouteHost mode="assess" requestedTarget={typeof lesion === 'string' ? lesion : undefined} />
  )
}
