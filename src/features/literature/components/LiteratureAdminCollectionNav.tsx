import { cn } from '@/lib/cn'
import { Link } from '@/i18n/navigation'

interface LiteratureAdminCollectionNavProps {
  active: 'all' | 'curated'
  labels: {
    all: string
    curated: string
    navigation: string
  }
}

export function LiteratureAdminCollectionNav({
  active,
  labels,
}: LiteratureAdminCollectionNavProps) {
  const items = [
    { id: 'curated' as const, href: '/admin/literature/curated', label: labels.curated },
    { id: 'all' as const, href: '/admin/literature', label: labels.all },
  ]

  return (
    <nav aria-label={labels.navigation} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            active === item.id
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-input bg-background hover:bg-muted',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
