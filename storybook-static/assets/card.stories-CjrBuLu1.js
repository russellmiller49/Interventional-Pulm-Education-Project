import { r as s, j as e, c as o } from './iframe-AbuOJf2D.js'
import { B as x } from './badge-5iP3i9jX.js'
import { B as h } from './button-DgRBlQDr.js'
import './preload-helper-Dp1pzeXC.js'
import './index-DuT5EQq1.js'
const i = s.forwardRef(({ className: r, ...a }, t) =>
  e.jsx('div', {
    ref: t,
    className: o(
      'group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/10',
      r,
    ),
    ...a,
  }),
)
i.displayName = 'Card'
const d = s.forwardRef(({ className: r, ...a }, t) =>
  e.jsx('div', {
    ref: t,
    className: o('flex flex-col gap-2 border-b border-border/70 px-6 py-5', r),
    ...a,
  }),
)
d.displayName = 'CardHeader'
const c = s.forwardRef(({ className: r, ...a }, t) =>
  e.jsx('h3', {
    ref: t,
    className: o('text-xl font-semibold tracking-tight text-foreground', r),
    ...a,
  }),
)
c.displayName = 'CardTitle'
const l = s.forwardRef(({ className: r, ...a }, t) =>
  e.jsx('p', { ref: t, className: o('text-sm text-muted-foreground/90', r), ...a }),
)
l.displayName = 'CardDescription'
const p = s.forwardRef(({ className: r, ...a }, t) =>
  e.jsx('div', { ref: t, className: o('flex flex-col gap-4 px-6 py-5', r), ...a }),
)
p.displayName = 'CardContent'
const m = s.forwardRef(({ className: r, ...a }, t) =>
  e.jsx('div', {
    ref: t,
    className: o('flex items-center justify-between gap-3 border-t border-border/70 px-6 py-4', r),
    ...a,
  }),
)
m.displayName = 'CardFooter'
try {
  ;((i.displayName = 'Card'),
    (i.__docgenInfo = {
      description: '',
      displayName: 'Card',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/card.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((d.displayName = 'CardHeader'),
    (d.__docgenInfo = {
      description: '',
      displayName: 'CardHeader',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/card.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((c.displayName = 'CardTitle'),
    (c.__docgenInfo = {
      description: '',
      displayName: 'CardTitle',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/card.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((l.displayName = 'CardDescription'),
    (l.__docgenInfo = {
      description: '',
      displayName: 'CardDescription',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/card.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((p.displayName = 'CardContent'),
    (p.__docgenInfo = {
      description: '',
      displayName: 'CardContent',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/card.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((m.displayName = 'CardFooter'),
    (m.__docgenInfo = {
      description: '',
      displayName: 'CardFooter',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/card.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
const N = { title: 'Design System/Card', component: i, tags: ['autodocs'] },
  n = {
    render: () =>
      e.jsxs(i, {
        className: 'max-w-md',
        children: [
          e.jsxs(d, {
            children: [
              e.jsx(x, { variant: 'info', className: 'w-fit', children: 'Featured' }),
              e.jsx(c, { children: 'Navigational Bronchoscopy' }),
              e.jsx(l, {
                children:
                  'Simulation and learning module covering equipment setup, navigation planning, and hands-on practice scenarios.',
              }),
            ],
          }),
          e.jsx(p, {
            className: 'gap-3',
            children: e.jsxs('ul', {
              className: 'list-disc space-y-2 pl-4 text-sm text-muted-foreground',
              children: [
                e.jsx('li', { children: '4K walkthrough videos with annotations' }),
                e.jsx('li', { children: 'Interactive checklist with saveable progress' }),
                e.jsx('li', { children: 'Reusable 3D airway model with printable inserts' }),
              ],
            }),
          }),
          e.jsxs(m, {
            children: [
              e.jsx(h, { size: 'sm', children: 'Launch Module' }),
              e.jsx(h, { variant: 'ghost', size: 'sm', children: 'View curriculum' }),
            ],
          }),
        ],
      }),
  }
var _, u, g
n.parameters = {
  ...n.parameters,
  docs: {
    ...((_ = n.parameters) == null ? void 0 : _.docs),
    source: {
      originalSource: `{
  render: () => <Card className="max-w-md">
      <CardHeader>
        <Badge variant="info" className="w-fit">
          Featured
        </Badge>
        <CardTitle>Navigational Bronchoscopy</CardTitle>
        <CardDescription>
          Simulation and learning module covering equipment setup, navigation planning, and hands-on practice scenarios.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
          <li>4K walkthrough videos with annotations</li>
          <li>Interactive checklist with saveable progress</li>
          <li>Reusable 3D airway model with printable inserts</li>
        </ul>
      </CardContent>
      <CardFooter>
        <Button size="sm">Launch Module</Button>
        <Button variant="ghost" size="sm">
          View curriculum
        </Button>
      </CardFooter>
    </Card>
}`,
      ...((g = (u = n.parameters) == null ? void 0 : u.docs) == null ? void 0 : g.source),
    },
  },
}
const v = ['Overview']
export { n as Overview, v as __namedExportsOrder, N as default }
