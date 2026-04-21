import { j as s } from './iframe-AbuOJf2D.js'
import { B as r } from './button-DgRBlQDr.js'
import { S as l } from './section-header-DmWwOtvr.js'
import './preload-helper-Dp1pzeXC.js'
import './index-DuT5EQq1.js'
const h = {
    title: 'Design System/Section Header',
    component: l,
    tags: ['autodocs'],
    args: {
      eyebrow: 'Learning pathway',
      title: 'Rigid bronchoscopy mastery',
      description:
        'Combine hands-on simulation, debrief checklists, and asynchronous feedback from global mentors.',
      align: 'left',
    },
    argTypes: { align: { control: 'inline-radio', options: ['left', 'center'] } },
  },
  e = { args: { actions: s.jsx(r, { size: 'sm', children: 'View outline' }) } },
  t = {
    args: {
      align: 'center',
      actions: s.jsxs('div', {
        className: 'flex gap-3',
        children: [
          s.jsx(r, { variant: 'outline', size: 'sm', children: 'Share' }),
          s.jsx(r, { size: 'sm', children: 'Start module' }),
        ],
      }),
    },
  }
var o, a, n
e.parameters = {
  ...e.parameters,
  docs: {
    ...((o = e.parameters) == null ? void 0 : o.docs),
    source: {
      originalSource: `{
  args: {
    actions: <Button size="sm">View outline</Button>
  }
}`,
      ...((n = (a = e.parameters) == null ? void 0 : a.docs) == null ? void 0 : n.source),
    },
  },
}
var i, c, m
t.parameters = {
  ...t.parameters,
  docs: {
    ...((i = t.parameters) == null ? void 0 : i.docs),
    source: {
      originalSource: `{
  args: {
    align: 'center',
    actions: <div className="flex gap-3">
        <Button variant="outline" size="sm">
          Share
        </Button>
        <Button size="sm">Start module</Button>
      </div>
  }
}`,
      ...((m = (c = t.parameters) == null ? void 0 : c.docs) == null ? void 0 : m.source),
    },
  },
}
const x = ['Playground', 'CenterAligned']
export { t as CenterAligned, e as Playground, x as __namedExportsOrder, h as default }
