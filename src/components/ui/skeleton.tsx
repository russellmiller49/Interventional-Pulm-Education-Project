import * as React from 'react'

import { cn } from '@/lib/cn'

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-xl bg-muted/60', className)} {...props} />
}
