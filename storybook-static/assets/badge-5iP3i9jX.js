import { j as n, c as i } from './iframe-AbuOJf2D.js'
import { c as o } from './index-DuT5EQq1.js'
const d = o(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        secondary: 'border-transparent bg-secondary/10 text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        outline: 'border-border text-muted-foreground',
        success: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        info: 'border-transparent bg-sky-500/15 text-sky-600 dark:text-sky-400',
      },
      size: { sm: 'text-[10px] px-2 py-0.5', md: 'text-xs px-2.5 py-0.5', lg: 'text-sm px-3 py-1' },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)
function t({ className: e, variant: r, size: a, ...s }) {
  return n.jsx('span', { className: i(d({ variant: r, size: a }), e), ...s })
}
try {
  ;((t.displayName = 'Badge'),
    (t.__docgenInfo = {
      description: '',
      displayName: 'Badge',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/badge.tsx',
      methods: [],
      props: {
        variant: {
          defaultValue: null,
          declarations: [],
          description: '',
          name: 'variant',
          required: !1,
          tags: {},
          type: {
            name: '"default" | "secondary" | "destructive" | "outline" | "info" | "success" | null',
          },
        },
        size: {
          defaultValue: null,
          declarations: [],
          description: '',
          name: 'size',
          required: !1,
          tags: {},
          type: { name: '"sm" | "lg" | "md" | null' },
        },
      },
      tags: {},
    }))
} catch {}
export { t as B }
