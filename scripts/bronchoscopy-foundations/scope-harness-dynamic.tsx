import { lazy, Suspense, type ComponentType } from 'react'
/** Use the same client component in the standalone browser harness. No Next.js server needed. */
export default function dynamic<T extends object>(
  loader: () => Promise<{ default: ComponentType<T> }>,
) {
  const Component = lazy(loader)
  return function Dynamic(props: T) {
    return (
      <Suspense fallback={<p>Loading…</p>}>
        <Component {...props} />
      </Suspense>
    )
  }
}
