import {
  j as r,
  c as D,
  E as xe,
  x as ge,
  I as ve,
  r as a,
  n as ye,
  m as ae,
  P as be,
  i as T,
  s as Te,
  k as Ce,
  D as _e,
  y as we,
  z as je,
} from './iframe-AbuOJf2D.js'
import { B as Pe } from './badge-5iP3i9jX.js'
import { B as $ } from './button-DgRBlQDr.js'
import { c as Ne } from './index-DuT5EQq1.js'
import { u as ke } from './index-CH_5SHUt.js'
import { R as Ee, A as Re, c as ie, C as Ie, a as Ae } from './index-JLQ5BAH0.js'
import './preload-helper-Dp1pzeXC.js'
const Se = Ne(
    'relative flex gap-3 rounded-2xl border px-4 py-4 text-sm leading-relaxed shadow-sm',
    {
      variants: {
        variant: {
          info: 'border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100',
          success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
          warning: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100',
        },
      },
      defaultVariants: { variant: 'info' },
    },
  ),
  Oe = {
    info: r.jsx(ve, { className: 'h-4 w-4 shrink-0' }),
    success: r.jsx(ge, { className: 'h-4 w-4 shrink-0' }),
    warning: r.jsx(xe, { className: 'h-4 w-4 shrink-0' }),
  }
function P({ className: e, variant: o, title: t, children: n, ...s }) {
  return r.jsxs('div', {
    role: 'status',
    className: D(Se({ variant: o }), e),
    ...s,
    children: [
      r.jsx('div', { className: 'mt-1 text-current', children: Oe[o ?? 'info'] }),
      r.jsxs('div', {
        className: 'space-y-1',
        children: [
          t ? r.jsx('p', { className: 'text-sm font-semibold', children: t }) : null,
          r.jsx('div', { className: 'text-sm text-current/90', children: n }),
        ],
      }),
    ],
  })
}
try {
  ;((P.displayName = 'Callout'),
    (P.__docgenInfo = {
      description: '',
      displayName: 'Callout',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/callout.tsx',
      methods: [],
      props: {
        title: {
          defaultValue: null,
          declarations: [
            { fileName: 'IP_website/src/components/ui/callout.tsx', name: 'CalloutProps' },
          ],
          description: '',
          name: 'title',
          parent: { fileName: 'IP_website/src/components/ui/callout.tsx', name: 'CalloutProps' },
          required: !1,
          tags: {},
          type: { name: 'ReactNode' },
        },
        variant: {
          defaultValue: null,
          declarations: [],
          description: '',
          name: 'variant',
          required: !1,
          tags: {},
          type: { name: '"info" | "success" | "warning" | null' },
        },
      },
      tags: {},
    }))
} catch {}
function S({ className: e, ...o }) {
  return r.jsx('kbd', {
    className: D(
      'inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border/70 bg-muted px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm',
      e,
    ),
    ...o,
  })
}
try {
  ;((S.displayName = 'Kbd'),
    (S.__docgenInfo = {
      description: '',
      displayName: 'Kbd',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/kbd.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
function N({ className: e, ...o }) {
  return r.jsx('div', { className: D('animate-pulse rounded-xl bg-muted/60', e), ...o })
}
try {
  ;((N.displayName = 'Skeleton'),
    (N.__docgenInfo = {
      description: '',
      displayName: 'Skeleton',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/skeleton.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
var De = Symbol('radix.slottable')
function Le(e) {
  const o = ({ children: t }) => r.jsx(r.Fragment, { children: t })
  return ((o.displayName = `${e}.Slottable`), (o.__radixId = De), o)
}
var [L] = Ce('Tooltip', [ie]),
  H = ie(),
  le = 'TooltipProvider',
  He = 700,
  B = 'tooltip.open',
  [Me, q] = L(le),
  ce = (e) => {
    const {
        __scopeTooltip: o,
        delayDuration: t = He,
        skipDelayDuration: n = 300,
        disableHoverableContent: s = !1,
        children: c,
      } = e,
      l = a.useRef(!0),
      f = a.useRef(!1),
      i = a.useRef(0)
    return (
      a.useEffect(() => {
        const p = i.current
        return () => window.clearTimeout(p)
      }, []),
      r.jsx(Me, {
        scope: o,
        isOpenDelayedRef: l,
        delayDuration: t,
        onOpen: a.useCallback(() => {
          ;(window.clearTimeout(i.current), (l.current = !1))
        }, []),
        onClose: a.useCallback(() => {
          ;(window.clearTimeout(i.current),
            (i.current = window.setTimeout(() => (l.current = !0), n)))
        }, [n]),
        isPointerInTransitRef: f,
        onPointerInTransitChange: a.useCallback((p) => {
          f.current = p
        }, []),
        disableHoverableContent: s,
        children: c,
      })
    )
  }
ce.displayName = le
var k = 'Tooltip',
  [Be, M] = L(k),
  de = (e) => {
    const {
        __scopeTooltip: o,
        children: t,
        open: n,
        defaultOpen: s,
        onOpenChange: c,
        disableHoverableContent: l,
        delayDuration: f,
      } = e,
      i = q(k, e.__scopeTooltip),
      p = H(o),
      [d, m] = a.useState(null),
      h = ke(),
      u = a.useRef(0),
      x = l ?? i.disableHoverableContent,
      v = f ?? i.delayDuration,
      g = a.useRef(!1),
      [b, y] = ye({
        prop: n,
        defaultProp: s ?? !1,
        onChange: (Y) => {
          ;(Y ? (i.onOpen(), document.dispatchEvent(new CustomEvent(B))) : i.onClose(),
            c == null || c(Y))
        },
        caller: k,
      }),
      _ = a.useMemo(() => (b ? (g.current ? 'delayed-open' : 'instant-open') : 'closed'), [b]),
      w = a.useCallback(() => {
        ;(window.clearTimeout(u.current), (u.current = 0), (g.current = !1), y(!0))
      }, [y]),
      j = a.useCallback(() => {
        ;(window.clearTimeout(u.current), (u.current = 0), y(!1))
      }, [y]),
      U = a.useCallback(() => {
        ;(window.clearTimeout(u.current),
          (u.current = window.setTimeout(() => {
            ;((g.current = !0), y(!0), (u.current = 0))
          }, v)))
      }, [v, y])
    return (
      a.useEffect(
        () => () => {
          u.current && (window.clearTimeout(u.current), (u.current = 0))
        },
        [],
      ),
      r.jsx(Ee, {
        ...p,
        children: r.jsx(Be, {
          scope: o,
          contentId: h,
          open: b,
          stateAttribute: _,
          trigger: d,
          onTriggerChange: m,
          onTriggerEnter: a.useCallback(() => {
            i.isOpenDelayedRef.current ? U() : w()
          }, [i.isOpenDelayedRef, U, w]),
          onTriggerLeave: a.useCallback(() => {
            x ? j() : (window.clearTimeout(u.current), (u.current = 0))
          }, [j, x]),
          onOpen: w,
          onClose: j,
          disableHoverableContent: x,
          children: t,
        }),
      })
    )
  }
de.displayName = k
var K = 'TooltipTrigger',
  ue = a.forwardRef((e, o) => {
    const { __scopeTooltip: t, ...n } = e,
      s = M(K, t),
      c = q(K, t),
      l = H(t),
      f = a.useRef(null),
      i = ae(o, f, s.onTriggerChange),
      p = a.useRef(!1),
      d = a.useRef(!1),
      m = a.useCallback(() => (p.current = !1), [])
    return (
      a.useEffect(() => () => document.removeEventListener('pointerup', m), [m]),
      r.jsx(Re, {
        asChild: !0,
        ...l,
        children: r.jsx(be.button, {
          'aria-describedby': s.open ? s.contentId : void 0,
          'data-state': s.stateAttribute,
          ...n,
          ref: i,
          onPointerMove: T(e.onPointerMove, (h) => {
            h.pointerType !== 'touch' &&
              !d.current &&
              !c.isPointerInTransitRef.current &&
              (s.onTriggerEnter(), (d.current = !0))
          }),
          onPointerLeave: T(e.onPointerLeave, () => {
            ;(s.onTriggerLeave(), (d.current = !1))
          }),
          onPointerDown: T(e.onPointerDown, () => {
            ;(s.open && s.onClose(),
              (p.current = !0),
              document.addEventListener('pointerup', m, { once: !0 }))
          }),
          onFocus: T(e.onFocus, () => {
            p.current || s.onOpen()
          }),
          onBlur: T(e.onBlur, s.onClose),
          onClick: T(e.onClick, s.onClose),
        }),
      })
    )
  })
ue.displayName = K
var Ke = 'TooltipPortal',
  [ct, Ve] = L(Ke, { forceMount: void 0 }),
  C = 'TooltipContent',
  pe = a.forwardRef((e, o) => {
    const t = Ve(C, e.__scopeTooltip),
      { forceMount: n = t.forceMount, side: s = 'top', ...c } = e,
      l = M(C, e.__scopeTooltip)
    return r.jsx(Te, {
      present: n || l.open,
      children: l.disableHoverableContent
        ? r.jsx(me, { side: s, ...c, ref: o })
        : r.jsx(Fe, { side: s, ...c, ref: o }),
    })
  }),
  Fe = a.forwardRef((e, o) => {
    const t = M(C, e.__scopeTooltip),
      n = q(C, e.__scopeTooltip),
      s = a.useRef(null),
      c = ae(o, s),
      [l, f] = a.useState(null),
      { trigger: i, onClose: p } = t,
      d = s.current,
      { onPointerInTransitChange: m } = n,
      h = a.useCallback(() => {
        ;(f(null), m(!1))
      }, [m]),
      u = a.useCallback(
        (x, v) => {
          const g = x.currentTarget,
            b = { x: x.clientX, y: x.clientY },
            y = $e(b, g.getBoundingClientRect()),
            _ = ze(b, y),
            w = Je(v.getBoundingClientRect()),
            j = We([..._, ...w])
          ;(f(j), m(!0))
        },
        [m],
      )
    return (
      a.useEffect(() => () => h(), [h]),
      a.useEffect(() => {
        if (i && d) {
          const x = (g) => u(g, d),
            v = (g) => u(g, i)
          return (
            i.addEventListener('pointerleave', x),
            d.addEventListener('pointerleave', v),
            () => {
              ;(i.removeEventListener('pointerleave', x), d.removeEventListener('pointerleave', v))
            }
          )
        }
      }, [i, d, u, h]),
      a.useEffect(() => {
        if (l) {
          const x = (v) => {
            const g = v.target,
              b = { x: v.clientX, y: v.clientY },
              y = (i == null ? void 0 : i.contains(g)) || (d == null ? void 0 : d.contains(g)),
              _ = !Xe(b, l)
            y ? h() : _ && (h(), p())
          }
          return (
            document.addEventListener('pointermove', x),
            () => document.removeEventListener('pointermove', x)
          )
        }
      }, [i, d, l, p, h]),
      r.jsx(me, { ...e, ref: c })
    )
  }),
  [Ge, qe] = L(k, { isInside: !1 }),
  Ue = Le('TooltipContent'),
  me = a.forwardRef((e, o) => {
    const {
        __scopeTooltip: t,
        children: n,
        'aria-label': s,
        onEscapeKeyDown: c,
        onPointerDownOutside: l,
        ...f
      } = e,
      i = M(C, t),
      p = H(t),
      { onClose: d } = i
    return (
      a.useEffect(
        () => (document.addEventListener(B, d), () => document.removeEventListener(B, d)),
        [d],
      ),
      a.useEffect(() => {
        if (i.trigger) {
          const m = (h) => {
            const u = h.target
            u != null && u.contains(i.trigger) && d()
          }
          return (
            window.addEventListener('scroll', m, { capture: !0 }),
            () => window.removeEventListener('scroll', m, { capture: !0 })
          )
        }
      }, [i.trigger, d]),
      r.jsx(_e, {
        asChild: !0,
        disableOutsidePointerEvents: !1,
        onEscapeKeyDown: c,
        onPointerDownOutside: l,
        onFocusOutside: (m) => m.preventDefault(),
        onDismiss: d,
        children: r.jsxs(Ie, {
          'data-state': i.stateAttribute,
          ...p,
          ...f,
          ref: o,
          style: {
            ...f.style,
            '--radix-tooltip-content-transform-origin': 'var(--radix-popper-transform-origin)',
            '--radix-tooltip-content-available-width': 'var(--radix-popper-available-width)',
            '--radix-tooltip-content-available-height': 'var(--radix-popper-available-height)',
            '--radix-tooltip-trigger-width': 'var(--radix-popper-anchor-width)',
            '--radix-tooltip-trigger-height': 'var(--radix-popper-anchor-height)',
          },
          children: [
            r.jsx(Ue, { children: n }),
            r.jsx(Ge, {
              scope: t,
              isInside: !0,
              children: r.jsx(we, { id: i.contentId, role: 'tooltip', children: s || n }),
            }),
          ],
        }),
      })
    )
  })
pe.displayName = C
var fe = 'TooltipArrow',
  Ye = a.forwardRef((e, o) => {
    const { __scopeTooltip: t, ...n } = e,
      s = H(t)
    return qe(fe, t).isInside ? null : r.jsx(Ae, { ...s, ...n, ref: o })
  })
Ye.displayName = fe
function $e(e, o) {
  const t = Math.abs(o.top - e.y),
    n = Math.abs(o.bottom - e.y),
    s = Math.abs(o.right - e.x),
    c = Math.abs(o.left - e.x)
  switch (Math.min(t, n, s, c)) {
    case c:
      return 'left'
    case s:
      return 'right'
    case t:
      return 'top'
    case n:
      return 'bottom'
    default:
      throw new Error('unreachable')
  }
}
function ze(e, o, t = 5) {
  const n = []
  switch (o) {
    case 'top':
      n.push({ x: e.x - t, y: e.y + t }, { x: e.x + t, y: e.y + t })
      break
    case 'bottom':
      n.push({ x: e.x - t, y: e.y - t }, { x: e.x + t, y: e.y - t })
      break
    case 'left':
      n.push({ x: e.x + t, y: e.y - t }, { x: e.x + t, y: e.y + t })
      break
    case 'right':
      n.push({ x: e.x - t, y: e.y - t }, { x: e.x - t, y: e.y + t })
      break
  }
  return n
}
function Je(e) {
  const { top: o, right: t, bottom: n, left: s } = e
  return [
    { x: s, y: o },
    { x: t, y: o },
    { x: t, y: n },
    { x: s, y: n },
  ]
}
function Xe(e, o) {
  const { x: t, y: n } = e
  let s = !1
  for (let c = 0, l = o.length - 1; c < o.length; l = c++) {
    const f = o[c],
      i = o[l],
      p = f.x,
      d = f.y,
      m = i.x,
      h = i.y
    d > n != h > n && t < ((m - p) * (n - d)) / (h - d) + p && (s = !s)
  }
  return s
}
function We(e) {
  const o = e.slice()
  return (
    o.sort((t, n) => (t.x < n.x ? -1 : t.x > n.x ? 1 : t.y < n.y ? -1 : t.y > n.y ? 1 : 0)),
    Qe(o)
  )
}
function Qe(e) {
  if (e.length <= 1) return e.slice()
  const o = []
  for (let n = 0; n < e.length; n++) {
    const s = e[n]
    for (; o.length >= 2; ) {
      const c = o[o.length - 1],
        l = o[o.length - 2]
      if ((c.x - l.x) * (s.y - l.y) >= (c.y - l.y) * (s.x - l.x)) o.pop()
      else break
    }
    o.push(s)
  }
  o.pop()
  const t = []
  for (let n = e.length - 1; n >= 0; n--) {
    const s = e[n]
    for (; t.length >= 2; ) {
      const c = t[t.length - 1],
        l = t[t.length - 2]
      if ((c.x - l.x) * (s.y - l.y) >= (c.y - l.y) * (s.x - l.x)) t.pop()
      else break
    }
    t.push(s)
  }
  return (
    t.pop(),
    o.length === 1 && t.length === 1 && o[0].x === t[0].x && o[0].y === t[0].y ? o : o.concat(t)
  )
}
var Ze = ce,
  et = de,
  tt = ue,
  he = pe
const V = Ze,
  F = et,
  G = tt,
  O = a.forwardRef(({ className: e, sideOffset: o = 8, ...t }, n) =>
    r.jsx(he, {
      ref: n,
      sideOffset: o,
      className: D(
        'z-50 overflow-hidden rounded-xl border border-border/70 bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-lg backdrop-blur-lg data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in',
        e,
      ),
      ...t,
    }),
  )
O.displayName = he.displayName
try {
  ;((F.displayName = 'Tooltip'),
    (F.__docgenInfo = {
      description: '',
      displayName: 'Tooltip',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/tooltip.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((G.displayName = 'TooltipTrigger'),
    (G.__docgenInfo = {
      description: '',
      displayName: 'TooltipTrigger',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/tooltip.tsx',
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
  ;((O.displayName = 'TooltipContent'),
    (O.__docgenInfo = {
      description: '',
      displayName: 'TooltipContent',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/tooltip.tsx',
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
  ;((V.displayName = 'TooltipProvider'),
    (V.__docgenInfo = {
      description: '',
      displayName: 'TooltipProvider',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/tooltip.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
const dt = { title: 'Design System/Feedback' },
  E = {
    render: () =>
      r.jsx(V, {
        children: r.jsxs('div', {
          className: 'flex items-center gap-4',
          children: [
            r.jsxs(F, {
              children: [
                r.jsx(G, {
                  asChild: !0,
                  children: r.jsx($, { variant: 'ghost', children: 'Hover for guidance' }),
                }),
                r.jsx(O, {
                  children: r.jsx('p', {
                    children:
                      'Use this action to share anonymized bronchoscopy outcomes with the community.',
                  }),
                }),
              ],
            }),
            r.jsx($, {
              onClick: () =>
                je({
                  title: 'Analytics exported',
                  description: 'A JSON snapshot has been saved to your downloads folder.',
                }),
              children: 'Trigger toast',
            }),
          ],
        }),
      }),
  },
  R = {
    render: () =>
      r.jsxs('div', {
        className: 'space-y-4',
        children: [
          r.jsx(P, {
            title: 'Open education license',
            children:
              'All simulation assets are shared under CC-BY so you can remix and translate for your own training programs.',
          }),
          r.jsx(P, {
            variant: 'success',
            title: 'Contributors matched',
            children:
              '12 clinicians have volunteered for the upcoming navigation lab. Coordinate scheduling in the contributors area.',
          }),
          r.jsx(P, {
            variant: 'warning',
            title: 'Checklist update pending',
            children:
              'Review the new sedation protocol before your next case. The workflow has been updated to include bedside ultrasound verification.',
          }),
        ],
      }),
  },
  I = {
    render: () =>
      r.jsxs('div', {
        className: 'space-y-3',
        children: [
          r.jsx(N, { className: 'h-12 w-full' }),
          r.jsx(N, { className: 'h-12 w-2/3' }),
          r.jsx(N, { className: 'h-36 w-full rounded-3xl' }),
        ],
      }),
  },
  A = {
    render: () =>
      r.jsxs('div', {
        className:
          'flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground',
        children: [
          r.jsx('span', { children: 'Open global search' }),
          r.jsxs('span', {
            className: 'flex items-center gap-1 text-foreground',
            children: [r.jsx(S, { children: '⌘' }), r.jsx(S, { children: 'K' })],
          }),
          r.jsx(Pe, { variant: 'outline', children: 'Available soon' }),
        ],
      }),
  }
var z, J, X
E.parameters = {
  ...E.parameters,
  docs: {
    ...((z = E.parameters) == null ? void 0 : z.docs),
    source: {
      originalSource: `{
  render: () => <TooltipProvider>
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost">Hover for guidance</Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Use this action to share anonymized bronchoscopy outcomes with the community.</p>
          </TooltipContent>
        </Tooltip>
        <Button onClick={() => toast({
        title: 'Analytics exported',
        description: 'A JSON snapshot has been saved to your downloads folder.'
      })}>
          Trigger toast
        </Button>
      </div>
    </TooltipProvider>
}`,
      ...((X = (J = E.parameters) == null ? void 0 : J.docs) == null ? void 0 : X.source),
    },
  },
}
var W, Q, Z
R.parameters = {
  ...R.parameters,
  docs: {
    ...((W = R.parameters) == null ? void 0 : W.docs),
    source: {
      originalSource: `{
  render: () => <div className="space-y-4">
      <Callout title="Open education license">
        All simulation assets are shared under CC-BY so you can remix and translate for your own training
        programs.
      </Callout>
      <Callout variant="success" title="Contributors matched">
        12 clinicians have volunteered for the upcoming navigation lab. Coordinate scheduling in the
        contributors area.
      </Callout>
      <Callout variant="warning" title="Checklist update pending">
        Review the new sedation protocol before your next case. The workflow has been updated to include
        bedside ultrasound verification.
      </Callout>
    </div>
}`,
      ...((Z = (Q = R.parameters) == null ? void 0 : Q.docs) == null ? void 0 : Z.source),
    },
  },
}
var ee, te, oe
I.parameters = {
  ...I.parameters,
  docs: {
    ...((ee = I.parameters) == null ? void 0 : ee.docs),
    source: {
      originalSource: `{
  render: () => <div className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-36 w-full rounded-3xl" />
    </div>
}`,
      ...((oe = (te = I.parameters) == null ? void 0 : te.docs) == null ? void 0 : oe.source),
    },
  },
}
var re, ne, se
A.parameters = {
  ...A.parameters,
  docs: {
    ...((re = A.parameters) == null ? void 0 : re.docs),
    source: {
      originalSource: `{
  render: () => <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <span>Open global search</span>
      <span className="flex items-center gap-1 text-foreground">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
      <Badge variant="outline">Available soon</Badge>
    </div>
}`,
      ...((se = (ne = A.parameters) == null ? void 0 : ne.docs) == null ? void 0 : se.source),
    },
  },
}
const ut = ['TooltipAndToast', 'CalloutVariants', 'SkeletonStates', 'KeyboardHint']
export {
  R as CalloutVariants,
  A as KeyboardHint,
  I as SkeletonStates,
  E as TooltipAndToast,
  ut as __namedExportsOrder,
  dt as default,
}
