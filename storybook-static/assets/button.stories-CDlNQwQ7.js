import { j as e, A as y } from './iframe-AbuOJf2D.js'
import { B as n } from './button-DgRBlQDr.js'
import './preload-helper-Dp1pzeXC.js'
import './index-DuT5EQq1.js'
const A = {
    title: 'Design System/Button',
    component: n,
    tags: ['autodocs'],
    argTypes: {
      variant: {
        control: 'select',
        options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
      },
      size: { control: 'select', options: ['sm', 'default', 'lg', 'icon'] },
      elevated: { control: 'boolean' },
    },
    args: { children: 'Explore Tools' },
    parameters: { controls: { exclude: ['asChild'] }, a11y: { element: '#storybook-root' } },
  },
  r = { args: { variant: 'default' } },
  s = { args: { variant: 'outline' } },
  t = {
    render: (o) =>
      e.jsxs(n, { ...o, children: [e.jsx('span', { children: 'Continue' }), e.jsx(y, {})] }),
    args: { variant: 'secondary', elevated: !0 },
  },
  a = {
    render: (o) =>
      e.jsxs('div', {
        className: 'flex items-center gap-3',
        children: [
          e.jsx(n, { ...o, size: 'icon', 'aria-label': 'Create', children: e.jsx(y, {}) }),
          e.jsx('span', {
            className: 'text-sm text-muted-foreground',
            children: 'Accessible icon-only button',
          }),
        ],
      }),
    args: { size: 'icon' },
  }
var c, i, l
r.parameters = {
  ...r.parameters,
  docs: {
    ...((c = r.parameters) == null ? void 0 : c.docs),
    source: {
      originalSource: `{
  args: {
    variant: 'default'
  }
}`,
      ...((l = (i = r.parameters) == null ? void 0 : i.docs) == null ? void 0 : l.source),
    },
  },
}
var d, u, m
s.parameters = {
  ...s.parameters,
  docs: {
    ...((d = s.parameters) == null ? void 0 : d.docs),
    source: {
      originalSource: `{
  args: {
    variant: 'outline'
  }
}`,
      ...((m = (u = s.parameters) == null ? void 0 : u.docs) == null ? void 0 : m.source),
    },
  },
}
var p, g, x
t.parameters = {
  ...t.parameters,
  docs: {
    ...((p = t.parameters) == null ? void 0 : p.docs),
    source: {
      originalSource: `{
  render: args => <Button {...args}>
      <span>Continue</span>
      <ArrowRightIcon />
    </Button>,
  args: {
    variant: 'secondary',
    elevated: true
  }
}`,
      ...((x = (g = t.parameters) == null ? void 0 : g.docs) == null ? void 0 : x.source),
    },
  },
}
var v, h, f
a.parameters = {
  ...a.parameters,
  docs: {
    ...((v = a.parameters) == null ? void 0 : v.docs),
    source: {
      originalSource: `{
  render: args => <div className="flex items-center gap-3">
      <Button {...args} size="icon" aria-label="Create">
        <ArrowRightIcon />
      </Button>
      <span className="text-sm text-muted-foreground">Accessible icon-only button</span>
    </div>,
  args: {
    size: 'icon'
  }
}`,
      ...((f = (h = a.parameters) == null ? void 0 : h.docs) == null ? void 0 : f.source),
    },
  },
}
const z = ['Primary', 'Outline', 'WithIcon', 'IconButton']
export {
  a as IconButton,
  s as Outline,
  r as Primary,
  t as WithIcon,
  z as __namedExportsOrder,
  A as default,
}
