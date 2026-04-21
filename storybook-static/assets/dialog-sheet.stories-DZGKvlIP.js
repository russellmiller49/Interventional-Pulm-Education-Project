import {
  r as n,
  j as t,
  p as Ie,
  n as Se,
  m as U,
  P as _,
  i as h,
  s as Z,
  t as we,
  k as Re,
  D as Te,
  v as Ee,
  C as ne,
  c as m,
} from './iframe-AbuOJf2D.js'
import { B as b } from './button-DgRBlQDr.js'
import { h as Oe, R as Ae, u as Fe, F as Le, I as Me, T as ke } from './index-DeEvNLmc.js'
import { u as F } from './index-CH_5SHUt.js'
import './preload-helper-Dp1pzeXC.js'
import './index-DuT5EQq1.js'
function qe(e) {
  const o = Ve(e),
    s = n.forwardRef((r, a) => {
      const { children: i, ...l } = r,
        c = n.Children.toArray(i),
        d = c.find(We)
      if (d) {
        const p = d.props.children,
          f = c.map((x) =>
            x === d
              ? n.Children.count(p) > 1
                ? n.Children.only(null)
                : n.isValidElement(p)
                  ? p.props.children
                  : null
              : x,
          )
        return t.jsx(o, {
          ...l,
          ref: a,
          children: n.isValidElement(p) ? n.cloneElement(p, void 0, f) : null,
        })
      }
      return t.jsx(o, { ...l, ref: a, children: i })
    })
  return ((s.displayName = `${e}.Slot`), s)
}
function Ve(e) {
  const o = n.forwardRef((s, r) => {
    const { children: a, ...i } = s
    if (n.isValidElement(a)) {
      const l = He(a),
        c = $e(i, a.props)
      return (a.type !== n.Fragment && (c.ref = r ? Ie(r, l) : l), n.cloneElement(a, c))
    }
    return n.Children.count(a) > 1 ? n.Children.only(null) : null
  })
  return ((o.displayName = `${e}.SlotClone`), o)
}
var Be = Symbol('radix.slottable')
function We(e) {
  return (
    n.isValidElement(e) &&
    typeof e.type == 'function' &&
    '__radixId' in e.type &&
    e.type.__radixId === Be
  )
}
function $e(e, o) {
  const s = { ...o }
  for (const r in o) {
    const a = e[r],
      i = o[r]
    ;/^on[A-Z]/.test(r)
      ? a && i
        ? (s[r] = (...c) => {
            const d = i(...c)
            return (a(...c), d)
          })
        : a && (s[r] = a)
      : r === 'style'
        ? (s[r] = { ...a, ...i })
        : r === 'className' && (s[r] = [a, i].filter(Boolean).join(' '))
  }
  return { ...e, ...s }
}
function He(e) {
  var r, a
  let o = (r = Object.getOwnPropertyDescriptor(e.props, 'ref')) == null ? void 0 : r.get,
    s = o && 'isReactWarning' in o && o.isReactWarning
  return s
    ? e.ref
    : ((o = (a = Object.getOwnPropertyDescriptor(e, 'ref')) == null ? void 0 : a.get),
      (s = o && 'isReactWarning' in o && o.isReactWarning),
      s ? e.props.ref : e.props.ref || e.ref)
}
var T = 'Dialog',
  [le] = Re(T),
  [ze, u] = le(T),
  ce = (e) => {
    const {
        __scopeDialog: o,
        children: s,
        open: r,
        defaultOpen: a,
        onOpenChange: i,
        modal: l = !0,
      } = e,
      c = n.useRef(null),
      d = n.useRef(null),
      [p, f] = Se({ prop: r, defaultProp: a ?? !1, onChange: i, caller: T })
    return t.jsx(ze, {
      scope: o,
      triggerRef: c,
      contentRef: d,
      contentId: F(),
      titleId: F(),
      descriptionId: F(),
      open: p,
      onOpenChange: f,
      onOpenToggle: n.useCallback(() => f((x) => !x), [f]),
      modal: l,
      children: s,
    })
  }
ce.displayName = T
var de = 'DialogTrigger',
  pe = n.forwardRef((e, o) => {
    const { __scopeDialog: s, ...r } = e,
      a = u(de, s),
      i = U(o, a.triggerRef)
    return t.jsx(_.button, {
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-expanded': a.open,
      'aria-controls': a.contentId,
      'data-state': J(a.open),
      ...r,
      ref: i,
      onClick: h(e.onClick, a.onOpenToggle),
    })
  })
pe.displayName = de
var K = 'DialogPortal',
  [Ge, me] = le(K, { forceMount: void 0 }),
  ue = (e) => {
    const { __scopeDialog: o, forceMount: s, children: r, container: a } = e,
      i = u(K, o)
    return t.jsx(Ge, {
      scope: o,
      forceMount: s,
      children: n.Children.map(r, (l) =>
        t.jsx(Z, {
          present: s || i.open,
          children: t.jsx(we, { asChild: !0, container: a, children: l }),
        }),
      ),
    })
  }
ue.displayName = K
var j = 'DialogOverlay',
  ge = n.forwardRef((e, o) => {
    const s = me(j, e.__scopeDialog),
      { forceMount: r = s.forceMount, ...a } = e,
      i = u(j, e.__scopeDialog)
    return i.modal
      ? t.jsx(Z, { present: r || i.open, children: t.jsx(Ze, { ...a, ref: o }) })
      : null
  })
ge.displayName = j
var Ue = qe('DialogOverlay.RemoveScroll'),
  Ze = n.forwardRef((e, o) => {
    const { __scopeDialog: s, ...r } = e,
      a = u(j, s)
    return t.jsx(Ae, {
      as: Ue,
      allowPinchZoom: !0,
      shards: [a.contentRef],
      children: t.jsx(_.div, {
        'data-state': J(a.open),
        ...r,
        ref: o,
        style: { pointerEvents: 'auto', ...r.style },
      }),
    })
  }),
  g = 'DialogContent',
  fe = n.forwardRef((e, o) => {
    const s = me(g, e.__scopeDialog),
      { forceMount: r = s.forceMount, ...a } = e,
      i = u(g, e.__scopeDialog)
    return t.jsx(Z, {
      present: r || i.open,
      children: i.modal ? t.jsx(Ke, { ...a, ref: o }) : t.jsx(Ye, { ...a, ref: o }),
    })
  })
fe.displayName = g
var Ke = n.forwardRef((e, o) => {
    const s = u(g, e.__scopeDialog),
      r = n.useRef(null),
      a = U(o, s.contentRef, r)
    return (
      n.useEffect(() => {
        const i = r.current
        if (i) return Oe(i)
      }, []),
      t.jsx(he, {
        ...e,
        ref: a,
        trapFocus: s.open,
        disableOutsidePointerEvents: !0,
        onCloseAutoFocus: h(e.onCloseAutoFocus, (i) => {
          var l
          ;(i.preventDefault(), (l = s.triggerRef.current) == null || l.focus())
        }),
        onPointerDownOutside: h(e.onPointerDownOutside, (i) => {
          const l = i.detail.originalEvent,
            c = l.button === 0 && l.ctrlKey === !0
          ;(l.button === 2 || c) && i.preventDefault()
        }),
        onFocusOutside: h(e.onFocusOutside, (i) => i.preventDefault()),
      })
    )
  }),
  Ye = n.forwardRef((e, o) => {
    const s = u(g, e.__scopeDialog),
      r = n.useRef(!1),
      a = n.useRef(!1)
    return t.jsx(he, {
      ...e,
      ref: o,
      trapFocus: !1,
      disableOutsidePointerEvents: !1,
      onCloseAutoFocus: (i) => {
        var l, c
        ;((l = e.onCloseAutoFocus) == null || l.call(e, i),
          i.defaultPrevented ||
            (r.current || (c = s.triggerRef.current) == null || c.focus(), i.preventDefault()),
          (r.current = !1),
          (a.current = !1))
      },
      onInteractOutside: (i) => {
        var d, p
        ;((d = e.onInteractOutside) == null || d.call(e, i),
          i.defaultPrevented ||
            ((r.current = !0), i.detail.originalEvent.type === 'pointerdown' && (a.current = !0)))
        const l = i.target
        ;(((p = s.triggerRef.current) == null ? void 0 : p.contains(l)) && i.preventDefault(),
          i.detail.originalEvent.type === 'focusin' && a.current && i.preventDefault())
      },
    })
  }),
  he = n.forwardRef((e, o) => {
    const { __scopeDialog: s, trapFocus: r, onOpenAutoFocus: a, onCloseAutoFocus: i, ...l } = e,
      c = u(g, s),
      d = n.useRef(null),
      p = U(o, d)
    return (
      Fe(),
      t.jsxs(t.Fragment, {
        children: [
          t.jsx(Le, {
            asChild: !0,
            loop: !0,
            trapped: r,
            onMountAutoFocus: a,
            onUnmountAutoFocus: i,
            children: t.jsx(Te, {
              role: 'dialog',
              id: c.contentId,
              'aria-describedby': c.descriptionId,
              'aria-labelledby': c.titleId,
              'data-state': J(c.open),
              ...l,
              ref: p,
              onDismiss: () => c.onOpenChange(!1),
            }),
          }),
          t.jsxs(t.Fragment, {
            children: [
              t.jsx(Je, { titleId: c.titleId }),
              t.jsx(Xe, { contentRef: d, descriptionId: c.descriptionId }),
            ],
          }),
        ],
      })
    )
  }),
  Y = 'DialogTitle',
  _e = n.forwardRef((e, o) => {
    const { __scopeDialog: s, ...r } = e,
      a = u(Y, s)
    return t.jsx(_.h2, { id: a.titleId, ...r, ref: o })
  })
_e.displayName = Y
var xe = 'DialogDescription',
  ye = n.forwardRef((e, o) => {
    const { __scopeDialog: s, ...r } = e,
      a = u(xe, s)
    return t.jsx(_.p, { id: a.descriptionId, ...r, ref: o })
  })
ye.displayName = xe
var Ne = 'DialogClose',
  be = n.forwardRef((e, o) => {
    const { __scopeDialog: s, ...r } = e,
      a = u(Ne, s)
    return t.jsx(_.button, {
      type: 'button',
      ...r,
      ref: o,
      onClick: h(e.onClick, () => a.onOpenChange(!1)),
    })
  })
be.displayName = Ne
function J(e) {
  return e ? 'open' : 'closed'
}
var je = 'DialogTitleWarning',
  [lt, ve] = Ee(je, { contentName: g, titleName: Y, docsSlug: 'dialog' }),
  Je = ({ titleId: e }) => {
    const o = ve(je),
      s = `\`${o.contentName}\` requires a \`${o.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${o.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${o.docsSlug}`
    return (
      n.useEffect(() => {
        e && (document.getElementById(e) || console.error(s))
      }, [s, e]),
      null
    )
  },
  Qe = 'DialogDescriptionWarning',
  Xe = ({ contentRef: e, descriptionId: o }) => {
    const r = `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${ve(Qe).contentName}}.`
    return (
      n.useEffect(() => {
        var i
        const a = (i = e.current) == null ? void 0 : i.getAttribute('aria-describedby')
        o && a && (document.getElementById(o) || console.warn(r))
      }, [r, e, o]),
      null
    )
  },
  De = ce,
  Ce = pe,
  Pe = ue,
  E = ge,
  Q = fe,
  O = _e,
  A = ye,
  X = be
const L = De,
  M = Ce,
  k = Pe,
  ee = X,
  v = n.forwardRef(({ className: e, ...o }, s) =>
    t.jsx(E, {
      ref: s,
      className: m(
        'fixed inset-0 z-40 bg-background/70 backdrop-blur-lg transition-opacity data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
        e,
      ),
      ...o,
    }),
  )
v.displayName = E.displayName
const D = n.forwardRef(({ className: e, children: o, ...s }, r) =>
  t.jsxs(k, {
    children: [
      t.jsx(v, {}),
      t.jsxs(Q, {
        ref: r,
        className: m(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-xl -translate-x-1/2 -translate-y-1/2 gap-6 rounded-3xl border border-border/70 bg-popover p-8 shadow-2xl outline-none data-[state=closed]:animate-dialog-hide data-[state=open]:animate-dialog-show',
          e,
        ),
        ...s,
        children: [
          o,
          t.jsxs(X, {
            className:
              'absolute right-4 top-4 rounded-full border border-transparent p-1 text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            children: [
              t.jsx(ne, { className: 'h-4 w-4' }),
              t.jsx('span', { className: 'sr-only', children: 'Close dialog' }),
            ],
          }),
        ],
      }),
    ],
  }),
)
D.displayName = Q.displayName
const q = ({ className: e, ...o }) =>
    t.jsx('div', { className: m('flex flex-col gap-2 text-center sm:text-left', e), ...o }),
  V = ({ className: e, ...o }) =>
    t.jsx('div', {
      className: m('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', e),
      ...o,
    }),
  C = n.forwardRef(({ className: e, ...o }, s) =>
    t.jsx(O, {
      ref: s,
      className: m('text-xl font-semibold tracking-tight text-foreground', e),
      ...o,
    }),
  )
C.displayName = O.displayName
const P = n.forwardRef(({ className: e, ...o }, s) =>
  t.jsx(A, { ref: s, className: m('text-sm text-muted-foreground', e), ...o }),
)
P.displayName = A.displayName
try {
  ;((L.displayName = 'Dialog'),
    (L.__docgenInfo = {
      description: '',
      displayName: 'Dialog',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((M.displayName = 'DialogTrigger'),
    (M.__docgenInfo = {
      description: '',
      displayName: 'DialogTrigger',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
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
  ;((D.displayName = 'DialogContent'),
    (D.__docgenInfo = {
      description: '',
      displayName: 'DialogContent',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
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
  ;((q.displayName = 'DialogHeader'),
    (q.__docgenInfo = {
      description: '',
      displayName: 'DialogHeader',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((V.displayName = 'DialogFooter'),
    (V.__docgenInfo = {
      description: '',
      displayName: 'DialogFooter',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((C.displayName = 'DialogTitle'),
    (C.__docgenInfo = {
      description: '',
      displayName: 'DialogTitle',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
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
  ;((P.displayName = 'DialogDescription'),
    (P.__docgenInfo = {
      description: '',
      displayName: 'DialogDescription',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
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
  ;((ee.displayName = 'DialogClose'),
    (ee.__docgenInfo = {
      description: '',
      displayName: 'DialogClose',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
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
  ;((k.displayName = 'DialogPortal'),
    (k.__docgenInfo = {
      description: '',
      displayName: 'DialogPortal',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((v.displayName = 'DialogOverlay'),
    (v.__docgenInfo = {
      description: '',
      displayName: 'DialogOverlay',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/dialog.tsx',
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
const B = De,
  W = Ce,
  $ = X,
  H = Pe,
  I = n.forwardRef(({ className: e, ...o }, s) =>
    t.jsx(E, {
      ref: s,
      className: m(
        'fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
        e,
      ),
      ...o,
    }),
  )
I.displayName = E.displayName
const et = {
    top: 'inset-x-0 top-0 mx-auto rounded-b-3xl',
    bottom: 'inset-x-0 bottom-0 mx-auto rounded-t-3xl',
    left: 'inset-y-0 left-0 h-full w-80 border-r',
    right: 'inset-y-0 right-0 h-full w-80 border-l',
  },
  tt = {
    top: 'data-[state=open]:animate-slide-in-from-top data-[state=closed]:animate-slide-out-to-top',
    bottom:
      'data-[state=open]:animate-slide-in-from-bottom data-[state=closed]:animate-slide-out-to-bottom',
    left: 'data-[state=open]:animate-slide-in-from-left data-[state=closed]:animate-slide-out-to-left',
    right:
      'data-[state=open]:animate-slide-in-from-right data-[state=closed]:animate-slide-out-to-right',
  },
  S = n.forwardRef(({ className: e, children: o, side: s = 'right', ...r }, a) =>
    t.jsxs(H, {
      children: [
        t.jsx(I, {}),
        t.jsxs(Q, {
          ref: a,
          className: m(
            'fixed z-50 flex flex-col bg-popover p-6 shadow-2xl outline-none sm:max-w-lg',
            et[s],
            tt[s],
            e,
          ),
          ...r,
          children: [
            o,
            t.jsxs($, {
              className:
                'absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              children: [
                t.jsx(ne, { className: 'h-4 w-4' }),
                t.jsx('span', { className: 'sr-only', children: 'Close sheet' }),
              ],
            }),
          ],
        }),
      ],
    }),
  )
S.displayName = 'SheetContent'
const z = ({ className: e, ...o }) =>
    t.jsx('div', { className: m('mb-4 space-y-1 text-left', e), ...o }),
  G = ({ className: e, ...o }) =>
    t.jsx('div', {
      className: m('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', e),
      ...o,
    }),
  w = n.forwardRef(({ className: e, ...o }, s) =>
    t.jsx(O, { ref: s, className: m('text-lg font-semibold text-foreground', e), ...o }),
  )
w.displayName = O.displayName
const R = n.forwardRef(({ className: e, ...o }, s) =>
  t.jsx(A, { ref: s, className: m('text-sm text-muted-foreground', e), ...o }),
)
R.displayName = A.displayName
try {
  ;((B.displayName = 'Sheet'),
    (B.__docgenInfo = {
      description: '',
      displayName: 'Sheet',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((W.displayName = 'SheetTrigger'),
    (W.__docgenInfo = {
      description: '',
      displayName: 'SheetTrigger',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
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
  ;(($.displayName = 'SheetClose'),
    ($.__docgenInfo = {
      description: '',
      displayName: 'SheetClose',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
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
  ;((H.displayName = 'SheetPortal'),
    (H.__docgenInfo = {
      description: '',
      displayName: 'SheetPortal',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((I.displayName = 'SheetOverlay'),
    (I.__docgenInfo = {
      description: '',
      displayName: 'SheetOverlay',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
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
  ;((S.displayName = 'SheetContent'),
    (S.__docgenInfo = {
      description: '',
      displayName: 'SheetContent',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
      methods: [],
      props: {
        side: {
          defaultValue: { value: 'right' },
          declarations: [
            { fileName: 'IP_website/src/components/ui/sheet.tsx', name: 'SheetContentProps' },
          ],
          description: '',
          name: 'side',
          parent: { fileName: 'IP_website/src/components/ui/sheet.tsx', name: 'SheetContentProps' },
          required: !1,
          tags: {},
          type: {
            name: 'enum',
            raw: '"top" | "right" | "bottom" | "left"',
            value: [
              { value: '"top"' },
              { value: '"right"' },
              { value: '"bottom"' },
              { value: '"left"' },
            ],
          },
        },
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
  ;((z.displayName = 'SheetHeader'),
    (z.__docgenInfo = {
      description: '',
      displayName: 'SheetHeader',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((G.displayName = 'SheetFooter'),
    (G.__docgenInfo = {
      description: '',
      displayName: 'SheetFooter',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
try {
  ;((w.displayName = 'SheetTitle'),
    (w.__docgenInfo = {
      description: '',
      displayName: 'SheetTitle',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
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
  ;((R.displayName = 'SheetDescription'),
    (R.__docgenInfo = {
      description: '',
      displayName: 'SheetDescription',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/sheet.tsx',
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
const ct = { title: 'Design System/Overlay' },
  y = {
    render: () =>
      t.jsxs(L, {
        children: [
          t.jsx(M, { asChild: !0, children: t.jsx(b, { children: 'Schedule Lab Session' }) }),
          t.jsxs(D, {
            children: [
              t.jsxs(q, {
                children: [
                  t.jsx(C, { children: 'Request a wet lab slot' }),
                  t.jsx(P, {
                    children:
                      'Choose preferred dates and include required equipment so the operations team can prepare.',
                  }),
                ],
              }),
              t.jsxs('div', {
                className: 'space-y-4',
                children: [
                  t.jsxs('label', {
                    className: 'block text-sm font-medium text-foreground',
                    children: ['Preferred date', t.jsx(Me, { type: 'date', className: 'mt-1' })],
                  }),
                  t.jsxs('label', {
                    className: 'block text-sm font-medium text-foreground',
                    children: [
                      'Notes',
                      t.jsx(ke, {
                        className: 'mt-1',
                        placeholder:
                          'List attending clinicians, learning goals, specimen preferences...',
                      }),
                    ],
                  }),
                ],
              }),
              t.jsx(V, { children: t.jsx(b, { type: 'submit', children: 'Send request' }) }),
            ],
          }),
        ],
      }),
  },
  N = {
    render: () =>
      t.jsxs(B, {
        children: [
          t.jsx(W, {
            asChild: !0,
            children: t.jsx(b, { variant: 'outline', children: 'Open progress summary' }),
          }),
          t.jsxs(S, {
            side: 'right',
            className: 'w-[360px]',
            children: [
              t.jsxs(z, {
                children: [
                  t.jsx(w, { children: 'Bronchoscopy mastery' }),
                  t.jsx(R, {
                    children: 'Track current competency targets and outstanding practice sessions.',
                  }),
                ],
              }),
              t.jsxs('div', {
                className: 'mt-4 space-y-4 text-sm',
                children: [
                  t.jsxs('div', {
                    children: [
                      t.jsx('p', {
                        className: 'font-semibold text-foreground',
                        children: 'Next milestone',
                      }),
                      t.jsx('p', {
                        className: 'text-muted-foreground',
                        children: 'Complete 3 supervised therapeutic interventions.',
                      }),
                    ],
                  }),
                  t.jsxs('div', {
                    children: [
                      t.jsx('p', {
                        className: 'font-semibold text-foreground',
                        children: 'Recommended resources',
                      }),
                      t.jsxs('ul', {
                        className: 'list-disc space-y-1 pl-4 text-muted-foreground',
                        children: [
                          t.jsx('li', { children: 'Airway stenting rehearsal checklist' }),
                          t.jsx('li', { children: 'EBUS target identification mini quiz' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              t.jsx(G, { children: t.jsx(b, { size: 'sm', children: 'Mark as reviewed' }) }),
            ],
          }),
        ],
      }),
  }
var te, oe, se
y.parameters = {
  ...y.parameters,
  docs: {
    ...((te = y.parameters) == null ? void 0 : te.docs),
    source: {
      originalSource: `{
  render: () => <Dialog>
      <DialogTrigger asChild>
        <Button>Schedule Lab Session</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a wet lab slot</DialogTitle>
          <DialogDescription>
            Choose preferred dates and include required equipment so the operations team can prepare.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Preferred date
            <Input type="date" className="mt-1" />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Notes
            <Textarea className="mt-1" placeholder="List attending clinicians, learning goals, specimen preferences..." />
          </label>
        </div>
        <DialogFooter>
          <Button type="submit">Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
}`,
      ...((se = (oe = y.parameters) == null ? void 0 : oe.docs) == null ? void 0 : se.source),
    },
  },
}
var ae, re, ie
N.parameters = {
  ...N.parameters,
  docs: {
    ...((ae = N.parameters) == null ? void 0 : ae.docs),
    source: {
      originalSource: `{
  render: () => <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open progress summary</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[360px]">
        <SheetHeader>
          <SheetTitle>Bronchoscopy mastery</SheetTitle>
          <SheetDescription>
            Track current competency targets and outstanding practice sessions.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="font-semibold text-foreground">Next milestone</p>
            <p className="text-muted-foreground">Complete 3 supervised therapeutic interventions.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Recommended resources</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Airway stenting rehearsal checklist</li>
              <li>EBUS target identification mini quiz</li>
            </ul>
          </div>
        </div>
        <SheetFooter>
          <Button size="sm">Mark as reviewed</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
}`,
      ...((ie = (re = N.parameters) == null ? void 0 : re.docs) == null ? void 0 : ie.source),
    },
  },
}
const dt = ['DialogExample', 'SheetExample']
export { y as DialogExample, N as SheetExample, dt as __namedExportsOrder, ct as default }
