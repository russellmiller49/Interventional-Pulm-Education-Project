import {
  r as l,
  n as M,
  j as t,
  P as x,
  i as R,
  s as ue,
  k as Q,
  m as pe,
  u as ze,
  b as h,
  l as Qe,
  c as P,
  w as Ue,
} from './iframe-AbuOJf2D.js'
import { u as U } from './index-CH_5SHUt.js'
import { u as me, R as We, I as Je, c as fe } from './index-DKPo23kZ.js'
import './preload-helper-Dp1pzeXC.js'
var L = 'Collapsible',
  [Xe, ge] = Q(L),
  [Ze, W] = Xe(L),
  he = l.forwardRef((e, r) => {
    const {
        __scopeCollapsible: o,
        open: a,
        defaultOpen: s,
        disabled: n,
        onOpenChange: i,
        ...c
      } = e,
      [p, f] = M({ prop: a, defaultProp: s ?? !1, onChange: i, caller: L })
    return t.jsx(Ze, {
      scope: o,
      disabled: n,
      contentId: U(),
      open: p,
      onOpenToggle: l.useCallback(() => f((u) => !u), [f]),
      children: t.jsx(x.div, {
        'data-state': X(p),
        'data-disabled': n ? '' : void 0,
        ...c,
        ref: r,
      }),
    })
  })
he.displayName = L
var be = 'CollapsibleTrigger',
  xe = l.forwardRef((e, r) => {
    const { __scopeCollapsible: o, ...a } = e,
      s = W(be, o)
    return t.jsx(x.button, {
      type: 'button',
      'aria-controls': s.contentId,
      'aria-expanded': s.open || !1,
      'data-state': X(s.open),
      'data-disabled': s.disabled ? '' : void 0,
      disabled: s.disabled,
      ...a,
      ref: r,
      onClick: R(e.onClick, s.onOpenToggle),
    })
  })
xe.displayName = be
var J = 'CollapsibleContent',
  ve = l.forwardRef((e, r) => {
    const { forceMount: o, ...a } = e,
      s = W(J, e.__scopeCollapsible)
    return t.jsx(ue, {
      present: o || s.open,
      children: ({ present: n }) => t.jsx(et, { ...a, ref: r, present: n }),
    })
  })
ve.displayName = J
var et = l.forwardRef((e, r) => {
  const { __scopeCollapsible: o, present: a, children: s, ...n } = e,
    i = W(J, o),
    [c, p] = l.useState(a),
    f = l.useRef(null),
    u = pe(r, f),
    d = l.useRef(0),
    g = d.current,
    v = l.useRef(0),
    E = v.current,
    _ = i.open || c,
    y = l.useRef(_),
    C = l.useRef(void 0)
  return (
    l.useEffect(() => {
      const m = requestAnimationFrame(() => (y.current = !1))
      return () => cancelAnimationFrame(m)
    }, []),
    ze(() => {
      const m = f.current
      if (m) {
        ;((C.current = C.current || {
          transitionDuration: m.style.transitionDuration,
          animationName: m.style.animationName,
        }),
          (m.style.transitionDuration = '0s'),
          (m.style.animationName = 'none'))
        const w = m.getBoundingClientRect()
        ;((d.current = w.height),
          (v.current = w.width),
          y.current ||
            ((m.style.transitionDuration = C.current.transitionDuration),
            (m.style.animationName = C.current.animationName)),
          p(a))
      }
    }, [i.open, a]),
    t.jsx(x.div, {
      'data-state': X(i.open),
      'data-disabled': i.disabled ? '' : void 0,
      id: i.contentId,
      hidden: !_,
      ...n,
      ref: u,
      style: {
        '--radix-collapsible-content-height': g ? `${g}px` : void 0,
        '--radix-collapsible-content-width': E ? `${E}px` : void 0,
        ...e.style,
      },
      children: _ && s,
    })
  )
})
function X(e) {
  return e ? 'open' : 'closed'
}
var tt = he,
  ot = xe,
  rt = ve,
  b = 'Accordion',
  at = ['Home', 'End', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'],
  [Z, nt, st] = Qe(b),
  [$] = Q(b, [st, ge]),
  ee = ge(),
  _e = h.forwardRef((e, r) => {
    const { type: o, ...a } = e,
      s = a,
      n = a
    return t.jsx(Z.Provider, {
      scope: e.__scopeAccordion,
      children: o === 'multiple' ? t.jsx(dt, { ...n, ref: r }) : t.jsx(lt, { ...s, ref: r }),
    })
  })
_e.displayName = b
var [ye, it] = $(b),
  [Ce, ct] = $(b, { collapsible: !1 }),
  lt = h.forwardRef((e, r) => {
    const { value: o, defaultValue: a, onValueChange: s = () => {}, collapsible: n = !1, ...i } = e,
      [c, p] = M({ prop: o, defaultProp: a ?? '', onChange: s, caller: b })
    return t.jsx(ye, {
      scope: e.__scopeAccordion,
      value: h.useMemo(() => (c ? [c] : []), [c]),
      onItemOpen: p,
      onItemClose: h.useCallback(() => n && p(''), [n, p]),
      children: t.jsx(Ce, {
        scope: e.__scopeAccordion,
        collapsible: n,
        children: t.jsx(we, { ...i, ref: r }),
      }),
    })
  }),
  dt = h.forwardRef((e, r) => {
    const { value: o, defaultValue: a, onValueChange: s = () => {}, ...n } = e,
      [i, c] = M({ prop: o, defaultProp: a ?? [], onChange: s, caller: b }),
      p = h.useCallback((u) => c((d = []) => [...d, u]), [c]),
      f = h.useCallback((u) => c((d = []) => d.filter((g) => g !== u)), [c])
    return t.jsx(ye, {
      scope: e.__scopeAccordion,
      value: i,
      onItemOpen: p,
      onItemClose: f,
      children: t.jsx(Ce, {
        scope: e.__scopeAccordion,
        collapsible: !0,
        children: t.jsx(we, { ...n, ref: r }),
      }),
    })
  }),
  [ut, O] = $(b),
  we = h.forwardRef((e, r) => {
    const { __scopeAccordion: o, disabled: a, dir: s, orientation: n = 'vertical', ...i } = e,
      c = h.useRef(null),
      p = pe(c, r),
      f = nt(o),
      d = me(s) === 'ltr',
      g = R(e.onKeyDown, (v) => {
        var re
        if (!at.includes(v.key)) return
        const E = v.target,
          _ = f().filter((K) => {
            var ae
            return !((ae = K.ref.current) != null && ae.disabled)
          }),
          y = _.findIndex((K) => K.ref.current === E),
          C = _.length
        if (y === -1) return
        v.preventDefault()
        let m = y
        const w = 0,
          F = C - 1,
          G = () => {
            ;((m = y + 1), m > F && (m = w))
          },
          H = () => {
            ;((m = y - 1), m < w && (m = F))
          }
        switch (v.key) {
          case 'Home':
            m = w
            break
          case 'End':
            m = F
            break
          case 'ArrowRight':
            n === 'horizontal' && (d ? G() : H())
            break
          case 'ArrowDown':
            n === 'vertical' && G()
            break
          case 'ArrowLeft':
            n === 'horizontal' && (d ? H() : G())
            break
          case 'ArrowUp':
            n === 'vertical' && H()
            break
        }
        const Be = m % C
        ;(re = _[Be].ref.current) == null || re.focus()
      })
    return t.jsx(ut, {
      scope: o,
      disabled: a,
      direction: s,
      orientation: n,
      children: t.jsx(Z.Slot, {
        scope: o,
        children: t.jsx(x.div, { ...i, 'data-orientation': n, ref: p, onKeyDown: a ? void 0 : g }),
      }),
    })
  }),
  D = 'AccordionItem',
  [pt, te] = $(D),
  Ae = h.forwardRef((e, r) => {
    const { __scopeAccordion: o, value: a, ...s } = e,
      n = O(D, o),
      i = it(D, o),
      c = ee(o),
      p = U(),
      f = (a && i.value.includes(a)) || !1,
      u = n.disabled || e.disabled
    return t.jsx(pt, {
      scope: o,
      open: f,
      disabled: u,
      triggerId: p,
      children: t.jsx(tt, {
        'data-orientation': n.orientation,
        'data-state': Re(f),
        ...c,
        ...s,
        ref: r,
        disabled: u,
        open: f,
        onOpenChange: (d) => {
          d ? i.onItemOpen(a) : i.onItemClose(a)
        },
      }),
    })
  })
Ae.displayName = D
var Ne = 'AccordionHeader',
  Te = h.forwardRef((e, r) => {
    const { __scopeAccordion: o, ...a } = e,
      s = O(b, o),
      n = te(Ne, o)
    return t.jsx(x.h3, {
      'data-orientation': s.orientation,
      'data-state': Re(n.open),
      'data-disabled': n.disabled ? '' : void 0,
      ...a,
      ref: r,
    })
  })
Te.displayName = Ne
var Y = 'AccordionTrigger',
  Ie = h.forwardRef((e, r) => {
    const { __scopeAccordion: o, ...a } = e,
      s = O(b, o),
      n = te(Y, o),
      i = ct(Y, o),
      c = ee(o)
    return t.jsx(Z.ItemSlot, {
      scope: o,
      children: t.jsx(ot, {
        'aria-disabled': (n.open && !i.collapsible) || void 0,
        'data-orientation': s.orientation,
        id: n.triggerId,
        ...c,
        ...a,
        ref: r,
      }),
    })
  })
Ie.displayName = Y
var je = 'AccordionContent',
  Pe = h.forwardRef((e, r) => {
    const { __scopeAccordion: o, ...a } = e,
      s = O(b, o),
      n = te(je, o),
      i = ee(o)
    return t.jsx(rt, {
      role: 'region',
      'aria-labelledby': n.triggerId,
      'data-orientation': s.orientation,
      ...i,
      ...a,
      ref: r,
      style: {
        '--radix-accordion-content-height': 'var(--radix-collapsible-content-height)',
        '--radix-accordion-content-width': 'var(--radix-collapsible-content-width)',
        ...e.style,
      },
    })
  })
Pe.displayName = je
function Re(e) {
  return e ? 'open' : 'closed'
}
var mt = _e,
  ft = Ae,
  gt = Te,
  Ee = Ie,
  Se = Pe
const B = mt,
  A = l.forwardRef(({ className: e, ...r }, o) =>
    t.jsx(ft, {
      ref: o,
      className: P(
        'group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        e,
      ),
      ...r,
    }),
  )
A.displayName = 'AccordionItem'
const N = l.forwardRef(({ className: e, children: r, ...o }, a) =>
  t.jsx(gt, {
    className: 'flex',
    children: t.jsxs(Ee, {
      ref: a,
      className: P(
        'flex flex-1 items-center justify-between gap-4 rounded-2xl px-6 py-4 text-left text-base font-medium transition-all hover:bg-muted focus:outline-none [&[data-state=open]>svg]:rotate-180',
        e,
      ),
      ...o,
      children: [
        t.jsx('span', { children: r }),
        t.jsx(Ue, {
          className: 'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
        }),
      ],
    }),
  }),
)
N.displayName = Ee.displayName
const T = l.forwardRef(({ className: e, children: r, ...o }, a) =>
  t.jsx(Se, {
    ref: a,
    className: P(
      'grid overflow-hidden text-sm text-muted-foreground transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
      e,
    ),
    ...o,
    children: t.jsx('div', { className: 'px-6 pb-6 pt-1', children: r }),
  }),
)
T.displayName = Se.displayName
try {
  ;((B.displayName = 'Accordion'),
    (B.__docgenInfo = {
      description: '',
      displayName: 'Accordion',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/accordion.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-primitive/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'asChild',
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
      },
      tags: {},
    }))
} catch {}
try {
  ;((A.displayName = 'AccordionItem'),
    (A.__docgenInfo = {
      description: '',
      displayName: 'AccordionItem',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/accordion.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-primitive/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'asChild',
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
      },
      tags: {},
    }))
} catch {}
try {
  ;((N.displayName = 'AccordionTrigger'),
    (N.__docgenInfo = {
      description: '',
      displayName: 'AccordionTrigger',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/accordion.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-primitive/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'asChild',
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
      },
      tags: {},
    }))
} catch {}
try {
  ;((T.displayName = 'AccordionContent'),
    (T.__docgenInfo = {
      description: '',
      displayName: 'AccordionContent',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/accordion.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-primitive/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'asChild',
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
      },
      tags: {},
    }))
} catch {}
var q = 'Tabs',
  [ht] = Q(q, [fe]),
  ke = fe(),
  [bt, oe] = ht(q),
  De = l.forwardRef((e, r) => {
    const {
        __scopeTabs: o,
        value: a,
        onValueChange: s,
        defaultValue: n,
        orientation: i = 'horizontal',
        dir: c,
        activationMode: p = 'automatic',
        ...f
      } = e,
      u = me(c),
      [d, g] = M({ prop: a, onChange: s, defaultProp: n ?? '', caller: q })
    return t.jsx(bt, {
      scope: o,
      baseId: U(),
      value: d,
      onValueChange: g,
      orientation: i,
      dir: u,
      activationMode: p,
      children: t.jsx(x.div, { dir: u, 'data-orientation': i, ...f, ref: r }),
    })
  })
De.displayName = q
var Ve = 'TabsList',
  Me = l.forwardRef((e, r) => {
    const { __scopeTabs: o, loop: a = !0, ...s } = e,
      n = oe(Ve, o),
      i = ke(o)
    return t.jsx(We, {
      asChild: !0,
      ...i,
      orientation: n.orientation,
      dir: n.dir,
      loop: a,
      children: t.jsx(x.div, { role: 'tablist', 'aria-orientation': n.orientation, ...s, ref: r }),
    })
  })
Me.displayName = Ve
var Le = 'TabsTrigger',
  $e = l.forwardRef((e, r) => {
    const { __scopeTabs: o, value: a, disabled: s = !1, ...n } = e,
      i = oe(Le, o),
      c = ke(o),
      p = Fe(i.baseId, a),
      f = Ge(i.baseId, a),
      u = a === i.value
    return t.jsx(Je, {
      asChild: !0,
      ...c,
      focusable: !s,
      active: u,
      children: t.jsx(x.button, {
        type: 'button',
        role: 'tab',
        'aria-selected': u,
        'aria-controls': f,
        'data-state': u ? 'active' : 'inactive',
        'data-disabled': s ? '' : void 0,
        disabled: s,
        id: p,
        ...n,
        ref: r,
        onMouseDown: R(e.onMouseDown, (d) => {
          !s && d.button === 0 && d.ctrlKey === !1 ? i.onValueChange(a) : d.preventDefault()
        }),
        onKeyDown: R(e.onKeyDown, (d) => {
          ;[' ', 'Enter'].includes(d.key) && i.onValueChange(a)
        }),
        onFocus: R(e.onFocus, () => {
          const d = i.activationMode !== 'manual'
          !u && !s && d && i.onValueChange(a)
        }),
      }),
    })
  })
$e.displayName = Le
var Oe = 'TabsContent',
  qe = l.forwardRef((e, r) => {
    const { __scopeTabs: o, value: a, forceMount: s, children: n, ...i } = e,
      c = oe(Oe, o),
      p = Fe(c.baseId, a),
      f = Ge(c.baseId, a),
      u = a === c.value,
      d = l.useRef(u)
    return (
      l.useEffect(() => {
        const g = requestAnimationFrame(() => (d.current = !1))
        return () => cancelAnimationFrame(g)
      }, []),
      t.jsx(ue, {
        present: s || u,
        children: ({ present: g }) =>
          t.jsx(x.div, {
            'data-state': u ? 'active' : 'inactive',
            'data-orientation': c.orientation,
            role: 'tabpanel',
            'aria-labelledby': p,
            hidden: !g,
            id: f,
            tabIndex: 0,
            ...i,
            ref: r,
            style: { ...e.style, animationDuration: d.current ? '0s' : void 0 },
            children: g && n,
          }),
      })
    )
  })
qe.displayName = Oe
function Fe(e, r) {
  return `${e}-trigger-${r}`
}
function Ge(e, r) {
  return `${e}-content-${r}`
}
var xt = De,
  He = Me,
  Ke = $e,
  Ye = qe
const z = xt,
  V = l.forwardRef(({ className: e, ...r }, o) =>
    t.jsx(He, {
      ref: o,
      className: P(
        'inline-flex w-full items-center justify-start gap-1 rounded-full border border-border/80 bg-muted/60 p-1 text-muted-foreground shadow-sm',
        e,
      ),
      ...r,
    }),
  )
V.displayName = He.displayName
const I = l.forwardRef(({ className: e, ...r }, o) =>
  t.jsx(Ke, {
    ref: o,
    className: P(
      'inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      e,
    ),
    ...r,
  }),
)
I.displayName = Ke.displayName
const j = l.forwardRef(({ className: e, ...r }, o) =>
  t.jsx(Ye, {
    ref: o,
    className: P(
      'mt-6 rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      e,
    ),
    ...r,
  }),
)
j.displayName = Ye.displayName
try {
  ;((z.displayName = 'Tabs'),
    (z.__docgenInfo = {
      description: '',
      displayName: 'Tabs',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/tabs.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-primitive/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'asChild',
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
      },
      tags: {},
    }))
} catch {}
try {
  ;((V.displayName = 'TabsList'),
    (V.__docgenInfo = {
      description: '',
      displayName: 'TabsList',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/tabs.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-primitive/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'asChild',
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
      },
      tags: {},
    }))
} catch {}
try {
  ;((I.displayName = 'TabsTrigger'),
    (I.__docgenInfo = {
      description: '',
      displayName: 'TabsTrigger',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/tabs.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-primitive/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'asChild',
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
      },
      tags: {},
    }))
} catch {}
try {
  ;((j.displayName = 'TabsContent'),
    (j.__docgenInfo = {
      description: '',
      displayName: 'TabsContent',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/tabs.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-primitive/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'asChild',
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
      },
      tags: {},
    }))
} catch {}
const wt = { title: 'Design System/Navigation Primitives' },
  S = {
    render: () => {
      const [e, r] = l.useState('overview')
      return t.jsxs(z, {
        value: e,
        onValueChange: r,
        className: 'w-full max-w-2xl',
        children: [
          t.jsxs(V, {
            children: [
              t.jsx(I, { value: 'overview', children: 'Overview' }),
              t.jsx(I, { value: 'curriculum', children: 'Curriculum' }),
              t.jsx(I, { value: 'resources', children: 'Resources' }),
            ],
          }),
          t.jsx(j, {
            value: 'overview',
            children: t.jsx('p', {
              className: 'text-sm text-muted-foreground',
              children:
                'Quick snapshot of the module: estimated time commitment, recommended prerequisites, and expected outcomes for learners before entering the bronchoscopy suite.',
            }),
          }),
          t.jsx(j, {
            value: 'curriculum',
            children: t.jsxs('ul', {
              className: 'list-disc space-y-2 pl-4 text-sm text-muted-foreground',
              children: [
                t.jsx('li', { children: 'Pre-procedural assessment' }),
                t.jsx('li', { children: 'Therapeutic interventions with decision trees' }),
                t.jsx('li', { children: 'Post-procedure care pathways' }),
              ],
            }),
          }),
          t.jsx(j, {
            value: 'resources',
            children: t.jsx('p', {
              className: 'text-sm text-muted-foreground',
              children:
                'Reference articles, printable checklists, and videos curated by contributors across the Interventional Pulmonology community.',
            }),
          }),
        ],
      })
    },
  },
  k = {
    render: () =>
      t.jsxs(B, {
        type: 'single',
        collapsible: !0,
        className: 'w-full max-w-2xl space-y-3',
        children: [
          t.jsxs(A, {
            value: 'item-1',
            children: [
              t.jsx(N, { children: 'What equipment is required for this module?' }),
              t.jsx(T, {
                children: t.jsx('p', {
                  className: 'text-sm text-muted-foreground',
                  children:
                    "You'll need the printable airway phantom, a standard bronchoscopy tower, and the open-source analytics app. Suggested 3D printer settings are linked within the module guide.",
                }),
              }),
            ],
          }),
          t.jsxs(A, {
            value: 'item-2',
            children: [
              t.jsx(N, { children: 'Does the training support offline mode?' }),
              t.jsx(T, {
                children: t.jsx('p', {
                  className: 'text-sm text-muted-foreground',
                  children:
                    'Yes. All core content can be cached locally, with progress syncing whenever an internet connection becomes available.',
                }),
              }),
            ],
          }),
          t.jsxs(A, {
            value: 'item-3',
            children: [
              t.jsx(N, { children: 'How are learner outcomes measured?' }),
              t.jsx(T, {
                children: t.jsx('p', {
                  className: 'text-sm text-muted-foreground',
                  children:
                    'Metrics focus on practical skill acquisition, adherence to safety checklists, and reflective assessments authored by clinical leads.',
                }),
              }),
            ],
          }),
        ],
      }),
  }
var ne, se, ie
S.parameters = {
  ...S.parameters,
  docs: {
    ...((ne = S.parameters) == null ? void 0 : ne.docs),
    source: {
      originalSource: `{
  render: () => {
    const [value, setValue] = useState('overview');
    return <Tabs value={value} onValueChange={setValue} className="w-full max-w-2xl">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p className="text-sm text-muted-foreground">
            Quick snapshot of the module: estimated time commitment, recommended prerequisites, and
            expected outcomes for learners before entering the bronchoscopy suite.
          </p>
        </TabsContent>
        <TabsContent value="curriculum">
          <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
            <li>Pre-procedural assessment</li>
            <li>Therapeutic interventions with decision trees</li>
            <li>Post-procedure care pathways</li>
          </ul>
        </TabsContent>
        <TabsContent value="resources">
          <p className="text-sm text-muted-foreground">
            Reference articles, printable checklists, and videos curated by contributors across the
            Interventional Pulmonology community.
          </p>
        </TabsContent>
      </Tabs>;
  }
}`,
      ...((ie = (se = S.parameters) == null ? void 0 : se.docs) == null ? void 0 : ie.source),
    },
  },
}
var ce, le, de
k.parameters = {
  ...k.parameters,
  docs: {
    ...((ce = k.parameters) == null ? void 0 : ce.docs),
    source: {
      originalSource: `{
  render: () => <Accordion type="single" collapsible className="w-full max-w-2xl space-y-3">
      <AccordionItem value="item-1">
        <AccordionTrigger>What equipment is required for this module?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            You&apos;ll need the printable airway phantom, a standard bronchoscopy tower, and the open-source
            analytics app. Suggested 3D printer settings are linked within the module guide.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Does the training support offline mode?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Yes. All core content can be cached locally, with progress syncing whenever an internet
            connection becomes available.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>How are learner outcomes measured?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Metrics focus on practical skill acquisition, adherence to safety checklists, and reflective
            assessments authored by clinical leads.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
}`,
      ...((de = (le = k.parameters) == null ? void 0 : le.docs) == null ? void 0 : de.source),
    },
  },
}
const At = ['TabsExample', 'AccordionExample']
export { k as AccordionExample, S as TabsExample, At as __namedExportsOrder, wt as default }
