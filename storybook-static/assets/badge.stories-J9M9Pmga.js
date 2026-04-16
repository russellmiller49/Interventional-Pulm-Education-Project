import { j as e } from './iframe-AbuOJf2D.js'
import { B as a } from './badge-5iP3i9jX.js'
import './preload-helper-Dp1pzeXC.js'
import './index-DuT5EQq1.js'
const u = {
    title: 'Design System/Badge',
    component: a,
    tags: ['autodocs'],
    args: { children: 'Clinical Beta' },
    argTypes: {
      variant: {
        control: 'select',
        options: ['default', 'secondary', 'destructive', 'outline', 'success', 'info'],
      },
      size: { control: 'select', options: ['sm', 'md', 'lg'] },
    },
  },
  r = {},
  t = {
    render: () =>
      e.jsxs('div', {
        className: 'flex flex-wrap gap-3',
        children: [
          e.jsx(a, { variant: 'default', children: 'Default' }),
          e.jsx(a, { variant: 'secondary', children: 'Secondary' }),
          e.jsx(a, { variant: 'info', children: 'Information' }),
          e.jsx(a, { variant: 'success', children: 'Validated' }),
          e.jsx(a, { variant: 'destructive', children: 'Deprecated' }),
          e.jsx(a, { variant: 'outline', children: 'Draft' }),
        ],
      }),
  }
var s, n, d
r.parameters = {
  ...r.parameters,
  docs: {
    ...((s = r.parameters) == null ? void 0 : s.docs),
    source: {
      originalSource: '{}',
      ...((d = (n = r.parameters) == null ? void 0 : n.docs) == null ? void 0 : d.source),
    },
  },
}
var o, i, c
t.parameters = {
  ...t.parameters,
  docs: {
    ...((o = t.parameters) == null ? void 0 : o.docs),
    source: {
      originalSource: `{
  render: () => <div className="flex flex-wrap gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="info">Information</Badge>
      <Badge variant="success">Validated</Badge>
      <Badge variant="destructive">Deprecated</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
}`,
      ...((c = (i = t.parameters) == null ? void 0 : i.docs) == null ? void 0 : c.source),
    },
  },
}
const f = ['Playground', 'Palette']
export { t as Palette, r as Playground, f as __namedExportsOrder, u as default }
