import {
  r as n,
  j as o,
  s as Xe,
  P,
  n as me,
  m as E,
  i as R,
  k as ye,
  B as Ze,
  c as re,
  F as eo,
  p as to,
  u as $,
  l as oo,
  V as ro,
  t as no,
  g as Je,
  o as so,
  D as ao,
  w as io,
} from './iframe-AbuOJf2D.js'
import { B as lo } from './button-DgRBlQDr.js'
import { u as Qe, R as co, c as et, A as uo, C as po, a as mo } from './index-JLQ5BAH0.js'
import { h as fo, u as ho, R as xo, F as go, I as vo, T as yo } from './index-DeEvNLmc.js'
import { u as tt, R as bo, c as ot, I as So } from './index-DKPo23kZ.js'
import { u as Be } from './index-CH_5SHUt.js'
import { S as wo } from './section-header-DmWwOtvr.js'
import './preload-helper-Dp1pzeXC.js'
import './index-DuT5EQq1.js'
function Ge(e) {
  const r = n.useRef({ value: e, previous: e })
  return n.useMemo(
    () => (
      r.current.value !== e && ((r.current.previous = r.current.value), (r.current.value = e)),
      r.current.previous
    ),
    [e],
  )
}
var be = 'Checkbox',
  [_o] = ye(be),
  [Co, He] = _o(be)
function Io(e) {
  const {
      __scopeCheckbox: r,
      checked: t,
      children: a,
      defaultChecked: s,
      disabled: i,
      form: c,
      name: d,
      onCheckedChange: l,
      required: u,
      value: f = 'on',
      internal_do_not_use_render: h,
    } = e,
    [S, y] = me({ prop: t, defaultProp: s ?? !1, onChange: l, caller: be }),
    [b, p] = n.useState(null),
    [x, w] = n.useState(null),
    m = n.useRef(!1),
    g = b ? !!c || !!b.closest('form') : !0,
    j = {
      checked: S,
      disabled: i,
      setChecked: y,
      control: b,
      setControl: p,
      name: d,
      form: c,
      value: f,
      hasConsumerStoppedPropagationRef: m,
      required: u,
      defaultChecked: q(s) ? !1 : s,
      isFormControl: g,
      bubbleInput: x,
      setBubbleInput: w,
    }
  return o.jsx(Co, { scope: r, ...j, children: No(h) ? h(j) : a })
}
var rt = 'CheckboxTrigger',
  nt = n.forwardRef(({ __scopeCheckbox: e, onKeyDown: r, onClick: t, ...a }, s) => {
    const {
        control: i,
        value: c,
        disabled: d,
        checked: l,
        required: u,
        setControl: f,
        setChecked: h,
        hasConsumerStoppedPropagationRef: S,
        isFormControl: y,
        bubbleInput: b,
      } = He(rt, e),
      p = E(s, f),
      x = n.useRef(l)
    return (
      n.useEffect(() => {
        const w = i == null ? void 0 : i.form
        if (w) {
          const m = () => h(x.current)
          return (w.addEventListener('reset', m), () => w.removeEventListener('reset', m))
        }
      }, [i, h]),
      o.jsx(P.button, {
        type: 'button',
        role: 'checkbox',
        'aria-checked': q(l) ? 'mixed' : l,
        'aria-required': u,
        'data-state': ct(l),
        'data-disabled': d ? '' : void 0,
        disabled: d,
        value: c,
        ...a,
        ref: p,
        onKeyDown: R(r, (w) => {
          w.key === 'Enter' && w.preventDefault()
        }),
        onClick: R(t, (w) => {
          ;(h((m) => (q(m) ? !0 : !m)),
            b && y && ((S.current = w.isPropagationStopped()), S.current || w.stopPropagation()))
        }),
      })
    )
  })
nt.displayName = rt
var Fe = n.forwardRef((e, r) => {
  const {
    __scopeCheckbox: t,
    name: a,
    checked: s,
    defaultChecked: i,
    required: c,
    disabled: d,
    value: l,
    onCheckedChange: u,
    form: f,
    ...h
  } = e
  return o.jsx(Io, {
    __scopeCheckbox: t,
    checked: s,
    defaultChecked: i,
    disabled: d,
    required: c,
    onCheckedChange: u,
    name: a,
    form: f,
    value: l,
    internal_do_not_use_render: ({ isFormControl: S }) =>
      o.jsxs(o.Fragment, {
        children: [
          o.jsx(nt, { ...h, ref: r, __scopeCheckbox: t }),
          S && o.jsx(lt, { __scopeCheckbox: t }),
        ],
      }),
  })
})
Fe.displayName = be
var st = 'CheckboxIndicator',
  at = n.forwardRef((e, r) => {
    const { __scopeCheckbox: t, forceMount: a, ...s } = e,
      i = He(st, t)
    return o.jsx(Xe, {
      present: a || q(i.checked) || i.checked === !0,
      children: o.jsx(P.span, {
        'data-state': ct(i.checked),
        'data-disabled': i.disabled ? '' : void 0,
        ...s,
        ref: r,
        style: { pointerEvents: 'none', ...e.style },
      }),
    })
  })
at.displayName = st
var it = 'CheckboxBubbleInput',
  lt = n.forwardRef(({ __scopeCheckbox: e, ...r }, t) => {
    const {
        control: a,
        hasConsumerStoppedPropagationRef: s,
        checked: i,
        defaultChecked: c,
        required: d,
        disabled: l,
        name: u,
        value: f,
        form: h,
        bubbleInput: S,
        setBubbleInput: y,
      } = He(it, e),
      b = E(t, y),
      p = Ge(i),
      x = Qe(a)
    n.useEffect(() => {
      const m = S
      if (!m) return
      const g = window.HTMLInputElement.prototype,
        k = Object.getOwnPropertyDescriptor(g, 'checked').set,
        X = !s.current
      if (p !== i && k) {
        const T = new Event('click', { bubbles: X })
        ;((m.indeterminate = q(i)), k.call(m, q(i) ? !1 : i), m.dispatchEvent(T))
      }
    }, [S, p, i, s])
    const w = n.useRef(q(i) ? !1 : i)
    return o.jsx(P.input, {
      type: 'checkbox',
      'aria-hidden': !0,
      defaultChecked: c ?? w.current,
      required: d,
      disabled: l,
      name: u,
      value: f,
      form: h,
      ...r,
      tabIndex: -1,
      ref: b,
      style: {
        ...r.style,
        ...x,
        position: 'absolute',
        pointerEvents: 'none',
        opacity: 0,
        margin: 0,
        transform: 'translateX(-100%)',
      },
    })
  })
lt.displayName = it
function No(e) {
  return typeof e == 'function'
}
function q(e) {
  return e === 'indeterminate'
}
function ct(e) {
  return q(e) ? 'indeterminate' : e ? 'checked' : 'unchecked'
}
const fe = n.forwardRef(({ className: e, ...r }, t) =>
  o.jsx(Fe, {
    ref: t,
    className: re(
      'peer flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-background shadow-sm transition-colors hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
      e,
    ),
    ...r,
    children: o.jsx(at, {
      className: 'flex items-center justify-center text-current',
      children: o.jsx(Ze, { className: 'h-3.5 w-3.5' }),
    }),
  }),
)
fe.displayName = Fe.displayName
try {
  ;((fe.displayName = 'Checkbox'),
    (fe.__docgenInfo = {
      description: '',
      displayName: 'Checkbox',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/checkbox.tsx',
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
var We = 'Radio',
  [Ro, dt] = ye(We),
  [Po, To] = Ro(We),
  ut = n.forwardRef((e, r) => {
    const {
        __scopeRadio: t,
        name: a,
        checked: s = !1,
        required: i,
        disabled: c,
        value: d = 'on',
        onCheck: l,
        form: u,
        ...f
      } = e,
      [h, S] = n.useState(null),
      y = E(r, (x) => S(x)),
      b = n.useRef(!1),
      p = h ? u || !!h.closest('form') : !0
    return o.jsxs(Po, {
      scope: t,
      checked: s,
      disabled: c,
      children: [
        o.jsx(P.button, {
          type: 'button',
          role: 'radio',
          'aria-checked': s,
          'data-state': ht(s),
          'data-disabled': c ? '' : void 0,
          disabled: c,
          value: d,
          ...f,
          ref: y,
          onClick: R(e.onClick, (x) => {
            ;(s || l == null || l(),
              p && ((b.current = x.isPropagationStopped()), b.current || x.stopPropagation()))
          }),
        }),
        p &&
          o.jsx(ft, {
            control: h,
            bubbles: !b.current,
            name: a,
            value: d,
            checked: s,
            required: i,
            disabled: c,
            form: u,
            style: { transform: 'translateX(-100%)' },
          }),
      ],
    })
  })
ut.displayName = We
var pt = 'RadioIndicator',
  mt = n.forwardRef((e, r) => {
    const { __scopeRadio: t, forceMount: a, ...s } = e,
      i = To(pt, t)
    return o.jsx(Xe, {
      present: a || i.checked,
      children: o.jsx(P.span, {
        'data-state': ht(i.checked),
        'data-disabled': i.disabled ? '' : void 0,
        ...s,
        ref: r,
      }),
    })
  })
mt.displayName = pt
var jo = 'RadioBubbleInput',
  ft = n.forwardRef(({ __scopeRadio: e, control: r, checked: t, bubbles: a = !0, ...s }, i) => {
    const c = n.useRef(null),
      d = E(c, i),
      l = Ge(t),
      u = Qe(r)
    return (
      n.useEffect(() => {
        const f = c.current
        if (!f) return
        const h = window.HTMLInputElement.prototype,
          y = Object.getOwnPropertyDescriptor(h, 'checked').set
        if (l !== t && y) {
          const b = new Event('click', { bubbles: a })
          ;(y.call(f, t), f.dispatchEvent(b))
        }
      }, [l, t, a]),
      o.jsx(P.input, {
        type: 'radio',
        'aria-hidden': !0,
        defaultChecked: t,
        ...s,
        tabIndex: -1,
        ref: d,
        style: {
          ...s.style,
          ...u,
          position: 'absolute',
          pointerEvents: 'none',
          opacity: 0,
          margin: 0,
        },
      })
    )
  })
ft.displayName = jo
function ht(e) {
  return e ? 'checked' : 'unchecked'
}
var Eo = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  Se = 'RadioGroup',
  [ko] = ye(Se, [ot, dt]),
  xt = ot(),
  gt = dt(),
  [Ao, Mo] = ko(Se),
  vt = n.forwardRef((e, r) => {
    const {
        __scopeRadioGroup: t,
        name: a,
        defaultValue: s,
        value: i,
        required: c = !1,
        disabled: d = !1,
        orientation: l,
        dir: u,
        loop: f = !0,
        onValueChange: h,
        ...S
      } = e,
      y = xt(t),
      b = tt(u),
      [p, x] = me({ prop: i, defaultProp: s ?? null, onChange: h, caller: Se })
    return o.jsx(Ao, {
      scope: t,
      name: a,
      required: c,
      disabled: d,
      value: p,
      onValueChange: x,
      children: o.jsx(bo, {
        asChild: !0,
        ...y,
        orientation: l,
        dir: b,
        loop: f,
        children: o.jsx(P.div, {
          role: 'radiogroup',
          'aria-required': c,
          'aria-orientation': l,
          'data-disabled': d ? '' : void 0,
          dir: b,
          ...S,
          ref: r,
        }),
      }),
    })
  })
vt.displayName = Se
var yt = 'RadioGroupItem',
  bt = n.forwardRef((e, r) => {
    const { __scopeRadioGroup: t, disabled: a, ...s } = e,
      i = Mo(yt, t),
      c = i.disabled || a,
      d = xt(t),
      l = gt(t),
      u = n.useRef(null),
      f = E(r, u),
      h = i.value === s.value,
      S = n.useRef(!1)
    return (
      n.useEffect(() => {
        const y = (p) => {
            Eo.includes(p.key) && (S.current = !0)
          },
          b = () => (S.current = !1)
        return (
          document.addEventListener('keydown', y),
          document.addEventListener('keyup', b),
          () => {
            ;(document.removeEventListener('keydown', y), document.removeEventListener('keyup', b))
          }
        )
      }, []),
      o.jsx(So, {
        asChild: !0,
        ...d,
        focusable: !c,
        active: h,
        children: o.jsx(ut, {
          disabled: c,
          required: i.required,
          checked: h,
          ...l,
          ...s,
          name: i.name,
          ref: f,
          onCheck: () => i.onValueChange(s.value),
          onKeyDown: R((y) => {
            y.key === 'Enter' && y.preventDefault()
          }),
          onFocus: R(s.onFocus, () => {
            var y
            S.current && ((y = u.current) == null || y.click())
          }),
        }),
      })
    )
  })
bt.displayName = yt
var Lo = 'RadioGroupIndicator',
  St = n.forwardRef((e, r) => {
    const { __scopeRadioGroup: t, ...a } = e,
      s = gt(t)
    return o.jsx(mt, { ...s, ...a, ref: r })
  })
St.displayName = Lo
var Do = vt,
  wt = bt,
  Oo = St
const Ee = Do,
  le = n.forwardRef(({ className: e, ...r }, t) =>
    o.jsx(wt, {
      ref: t,
      className: re(
        'aspect-square h-5 w-5 rounded-full border border-border bg-background shadow-sm transition-colors hover:border-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary/10',
        e,
      ),
      ...r,
      children: o.jsx(Oo, {
        className: 'flex items-center justify-center',
        children: o.jsx(eo, { className: 'h-3 w-3 text-primary' }),
      }),
    }),
  )
le.displayName = wt.displayName
try {
  ;((Ee.displayName = 'RadioGroup'),
    (Ee.__docgenInfo = {
      description: '',
      displayName: 'RadioGroup',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/radio-group.tsx',
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
  ;((le.displayName = 'RadioGroupItem'),
    (le.__docgenInfo = {
      description: '',
      displayName: 'RadioGroupItem',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/radio-group.tsx',
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
function Ke(e, [r, t]) {
  return Math.min(t, Math.max(r, e))
}
function Vo(e) {
  const r = Bo(e),
    t = n.forwardRef((a, s) => {
      const { children: i, ...c } = a,
        d = n.Children.toArray(i),
        l = d.find(Ho)
      if (l) {
        const u = l.props.children,
          f = d.map((h) =>
            h === l
              ? n.Children.count(u) > 1
                ? n.Children.only(null)
                : n.isValidElement(u)
                  ? u.props.children
                  : null
              : h,
          )
        return o.jsx(r, {
          ...c,
          ref: s,
          children: n.isValidElement(u) ? n.cloneElement(u, void 0, f) : null,
        })
      }
      return o.jsx(r, { ...c, ref: s, children: i })
    })
  return ((t.displayName = `${e}.Slot`), t)
}
function Bo(e) {
  const r = n.forwardRef((t, a) => {
    const { children: s, ...i } = t
    if (n.isValidElement(s)) {
      const c = Wo(s),
        d = Fo(i, s.props)
      return (s.type !== n.Fragment && (d.ref = a ? to(a, c) : c), n.cloneElement(s, d))
    }
    return n.Children.count(s) > 1 ? n.Children.only(null) : null
  })
  return ((r.displayName = `${e}.SlotClone`), r)
}
var Go = Symbol('radix.slottable')
function Ho(e) {
  return (
    n.isValidElement(e) &&
    typeof e.type == 'function' &&
    '__radixId' in e.type &&
    e.type.__radixId === Go
  )
}
function Fo(e, r) {
  const t = { ...r }
  for (const a in r) {
    const s = e[a],
      i = r[a]
    ;/^on[A-Z]/.test(a)
      ? s && i
        ? (t[a] = (...d) => {
            const l = i(...d)
            return (s(...d), l)
          })
        : s && (t[a] = s)
      : a === 'style'
        ? (t[a] = { ...s, ...i })
        : a === 'className' && (t[a] = [s, i].filter(Boolean).join(' '))
  }
  return { ...e, ...t }
}
function Wo(e) {
  var a, s
  let r = (a = Object.getOwnPropertyDescriptor(e.props, 'ref')) == null ? void 0 : a.get,
    t = r && 'isReactWarning' in r && r.isReactWarning
  return t
    ? e.ref
    : ((r = (s = Object.getOwnPropertyDescriptor(e, 'ref')) == null ? void 0 : s.get),
      (t = r && 'isReactWarning' in r && r.isReactWarning),
      t ? e.props.ref : e.props.ref || e.ref)
}
var Uo = [' ', 'Enter', 'ArrowUp', 'ArrowDown'],
  Ko = [' ', 'Enter'],
  te = 'Select',
  [we, _e, qo] = oo(te),
  [se] = ye(te, [qo, et]),
  Ce = et(),
  [$o, z] = se(te),
  [zo, Yo] = se(te),
  _t = (e) => {
    const {
        __scopeSelect: r,
        children: t,
        open: a,
        defaultOpen: s,
        onOpenChange: i,
        value: c,
        defaultValue: d,
        onValueChange: l,
        dir: u,
        name: f,
        autoComplete: h,
        disabled: S,
        required: y,
        form: b,
      } = e,
      p = Ce(r),
      [x, w] = n.useState(null),
      [m, g] = n.useState(null),
      [j, k] = n.useState(!1),
      X = tt(u),
      [T, D] = me({ prop: a, defaultProp: s ?? !1, onChange: i, caller: te }),
      [W, Z] = me({ prop: c, defaultProp: d, onChange: l, caller: te }),
      V = n.useRef(null),
      B = x ? b || !!x.closest('form') : !0,
      [U, G] = n.useState(new Set()),
      H = Array.from(U)
        .map((A) => A.props.value)
        .join(';')
    return o.jsx(co, {
      ...p,
      children: o.jsxs($o, {
        required: y,
        scope: r,
        trigger: x,
        onTriggerChange: w,
        valueNode: m,
        onValueNodeChange: g,
        valueNodeHasChildren: j,
        onValueNodeHasChildrenChange: k,
        contentId: Be(),
        value: W,
        onValueChange: Z,
        open: T,
        onOpenChange: D,
        dir: X,
        triggerPointerDownPosRef: V,
        disabled: S,
        children: [
          o.jsx(we.Provider, {
            scope: r,
            children: o.jsx(zo, {
              scope: e.__scopeSelect,
              onNativeOptionAdd: n.useCallback((A) => {
                G((O) => new Set(O).add(A))
              }, []),
              onNativeOptionRemove: n.useCallback((A) => {
                G((O) => {
                  const F = new Set(O)
                  return (F.delete(A), F)
                })
              }, []),
              children: t,
            }),
          }),
          B
            ? o.jsxs(
                Kt,
                {
                  'aria-hidden': !0,
                  required: y,
                  tabIndex: -1,
                  name: f,
                  autoComplete: h,
                  value: W,
                  onChange: (A) => Z(A.target.value),
                  disabled: S,
                  form: b,
                  children: [W === void 0 ? o.jsx('option', { value: '' }) : null, Array.from(U)],
                },
                H,
              )
            : null,
        ],
      }),
    })
  }
_t.displayName = te
var Ct = 'SelectTrigger',
  It = n.forwardRef((e, r) => {
    const { __scopeSelect: t, disabled: a = !1, ...s } = e,
      i = Ce(t),
      c = z(Ct, t),
      d = c.disabled || a,
      l = E(r, c.onTriggerChange),
      u = _e(t),
      f = n.useRef('touch'),
      [h, S, y] = $t((p) => {
        const x = u().filter((g) => !g.disabled),
          w = x.find((g) => g.value === c.value),
          m = zt(x, p, w)
        m !== void 0 && c.onValueChange(m.value)
      }),
      b = (p) => {
        ;(d || (c.onOpenChange(!0), y()),
          p &&
            (c.triggerPointerDownPosRef.current = {
              x: Math.round(p.pageX),
              y: Math.round(p.pageY),
            }))
      }
    return o.jsx(uo, {
      asChild: !0,
      ...i,
      children: o.jsx(P.button, {
        type: 'button',
        role: 'combobox',
        'aria-controls': c.contentId,
        'aria-expanded': c.open,
        'aria-required': c.required,
        'aria-autocomplete': 'none',
        dir: c.dir,
        'data-state': c.open ? 'open' : 'closed',
        disabled: d,
        'data-disabled': d ? '' : void 0,
        'data-placeholder': qt(c.value) ? '' : void 0,
        ...s,
        ref: l,
        onClick: R(s.onClick, (p) => {
          ;(p.currentTarget.focus(), f.current !== 'mouse' && b(p))
        }),
        onPointerDown: R(s.onPointerDown, (p) => {
          f.current = p.pointerType
          const x = p.target
          ;(x.hasPointerCapture(p.pointerId) && x.releasePointerCapture(p.pointerId),
            p.button === 0 &&
              p.ctrlKey === !1 &&
              p.pointerType === 'mouse' &&
              (b(p), p.preventDefault()))
        }),
        onKeyDown: R(s.onKeyDown, (p) => {
          const x = h.current !== ''
          ;(!(p.ctrlKey || p.altKey || p.metaKey) && p.key.length === 1 && S(p.key),
            !(x && p.key === ' ') && Uo.includes(p.key) && (b(), p.preventDefault()))
        }),
      }),
    })
  })
It.displayName = Ct
var Nt = 'SelectValue',
  Rt = n.forwardRef((e, r) => {
    const { __scopeSelect: t, className: a, style: s, children: i, placeholder: c = '', ...d } = e,
      l = z(Nt, t),
      { onValueNodeHasChildrenChange: u } = l,
      f = i !== void 0,
      h = E(r, l.onValueNodeChange)
    return (
      $(() => {
        u(f)
      }, [u, f]),
      o.jsx(P.span, {
        ...d,
        ref: h,
        style: { pointerEvents: 'none' },
        children: qt(l.value) ? o.jsx(o.Fragment, { children: c }) : i,
      })
    )
  })
Rt.displayName = Nt
var Xo = 'SelectIcon',
  Pt = n.forwardRef((e, r) => {
    const { __scopeSelect: t, children: a, ...s } = e
    return o.jsx(P.span, { 'aria-hidden': !0, ...s, ref: r, children: a || '▼' })
  })
Pt.displayName = Xo
var Zo = 'SelectPortal',
  Tt = (e) => o.jsx(no, { asChild: !0, ...e })
Tt.displayName = Zo
var oe = 'SelectContent',
  jt = n.forwardRef((e, r) => {
    const t = z(oe, e.__scopeSelect),
      [a, s] = n.useState()
    if (
      ($(() => {
        s(new DocumentFragment())
      }, []),
      !t.open)
    ) {
      const i = a
      return i
        ? Je.createPortal(
            o.jsx(Et, {
              scope: e.__scopeSelect,
              children: o.jsx(we.Slot, {
                scope: e.__scopeSelect,
                children: o.jsx('div', { children: e.children }),
              }),
            }),
            i,
          )
        : null
    }
    return o.jsx(kt, { ...e, ref: r })
  })
jt.displayName = oe
var L = 10,
  [Et, Y] = se(oe),
  Jo = 'SelectContentImpl',
  Qo = Vo('SelectContent.RemoveScroll'),
  kt = n.forwardRef((e, r) => {
    const {
        __scopeSelect: t,
        position: a = 'item-aligned',
        onCloseAutoFocus: s,
        onEscapeKeyDown: i,
        onPointerDownOutside: c,
        side: d,
        sideOffset: l,
        align: u,
        alignOffset: f,
        arrowPadding: h,
        collisionBoundary: S,
        collisionPadding: y,
        sticky: b,
        hideWhenDetached: p,
        avoidCollisions: x,
        ...w
      } = e,
      m = z(oe, t),
      [g, j] = n.useState(null),
      [k, X] = n.useState(null),
      T = E(r, (v) => j(v)),
      [D, W] = n.useState(null),
      [Z, V] = n.useState(null),
      B = _e(t),
      [U, G] = n.useState(!1),
      H = n.useRef(!1)
    ;(n.useEffect(() => {
      if (g) return fo(g)
    }, [g]),
      ho())
    const A = n.useCallback(
        (v) => {
          const [N, ...M] = B().map((C) => C.ref.current),
            [I] = M.slice(-1),
            _ = document.activeElement
          for (const C of v)
            if (
              C === _ ||
              (C == null || C.scrollIntoView({ block: 'nearest' }),
              C === N && k && (k.scrollTop = 0),
              C === I && k && (k.scrollTop = k.scrollHeight),
              C == null || C.focus(),
              document.activeElement !== _)
            )
              return
        },
        [B, k],
      ),
      O = n.useCallback(() => A([D, g]), [A, D, g])
    n.useEffect(() => {
      U && O()
    }, [U, O])
    const { onOpenChange: F, triggerPointerDownPosRef: K } = m
    ;(n.useEffect(() => {
      if (g) {
        let v = { x: 0, y: 0 }
        const N = (I) => {
            var _, C
            v = {
              x: Math.abs(Math.round(I.pageX) - (((_ = K.current) == null ? void 0 : _.x) ?? 0)),
              y: Math.abs(Math.round(I.pageY) - (((C = K.current) == null ? void 0 : C.y) ?? 0)),
            }
          },
          M = (I) => {
            ;(v.x <= 10 && v.y <= 10 ? I.preventDefault() : g.contains(I.target) || F(!1),
              document.removeEventListener('pointermove', N),
              (K.current = null))
          }
        return (
          K.current !== null &&
            (document.addEventListener('pointermove', N),
            document.addEventListener('pointerup', M, { capture: !0, once: !0 })),
          () => {
            ;(document.removeEventListener('pointermove', N),
              document.removeEventListener('pointerup', M, { capture: !0 }))
          }
        )
      }
    }, [g, F, K]),
      n.useEffect(() => {
        const v = () => F(!1)
        return (
          window.addEventListener('blur', v),
          window.addEventListener('resize', v),
          () => {
            ;(window.removeEventListener('blur', v), window.removeEventListener('resize', v))
          }
        )
      }, [F]))
    const [Ie, de] = $t((v) => {
        const N = B().filter((_) => !_.disabled),
          M = N.find((_) => _.ref.current === document.activeElement),
          I = zt(N, v, M)
        I && setTimeout(() => I.ref.current.focus())
      }),
      Ne = n.useCallback(
        (v, N, M) => {
          const I = !H.current && !M
          ;((m.value !== void 0 && m.value === N) || I) && (W(v), I && (H.current = !0))
        },
        [m.value],
      ),
      Re = n.useCallback(() => (g == null ? void 0 : g.focus()), [g]),
      ne = n.useCallback(
        (v, N, M) => {
          const I = !H.current && !M
          ;((m.value !== void 0 && m.value === N) || I) && V(v)
        },
        [m.value],
      ),
      ue = a === 'popper' ? ke : At,
      ae =
        ue === ke
          ? {
              side: d,
              sideOffset: l,
              align: u,
              alignOffset: f,
              arrowPadding: h,
              collisionBoundary: S,
              collisionPadding: y,
              sticky: b,
              hideWhenDetached: p,
              avoidCollisions: x,
            }
          : {}
    return o.jsx(Et, {
      scope: t,
      content: g,
      viewport: k,
      onViewportChange: X,
      itemRefCallback: Ne,
      selectedItem: D,
      onItemLeave: Re,
      itemTextRefCallback: ne,
      focusSelectedItem: O,
      selectedItemText: Z,
      position: a,
      isPositioned: U,
      searchRef: Ie,
      children: o.jsx(xo, {
        as: Qo,
        allowPinchZoom: !0,
        children: o.jsx(go, {
          asChild: !0,
          trapped: m.open,
          onMountAutoFocus: (v) => {
            v.preventDefault()
          },
          onUnmountAutoFocus: R(s, (v) => {
            var N
            ;((N = m.trigger) == null || N.focus({ preventScroll: !0 }), v.preventDefault())
          }),
          children: o.jsx(ao, {
            asChild: !0,
            disableOutsidePointerEvents: !0,
            onEscapeKeyDown: i,
            onPointerDownOutside: c,
            onFocusOutside: (v) => v.preventDefault(),
            onDismiss: () => m.onOpenChange(!1),
            children: o.jsx(ue, {
              role: 'listbox',
              id: m.contentId,
              'data-state': m.open ? 'open' : 'closed',
              dir: m.dir,
              onContextMenu: (v) => v.preventDefault(),
              ...w,
              ...ae,
              onPlaced: () => G(!0),
              ref: T,
              style: { display: 'flex', flexDirection: 'column', outline: 'none', ...w.style },
              onKeyDown: R(w.onKeyDown, (v) => {
                const N = v.ctrlKey || v.altKey || v.metaKey
                if (
                  (v.key === 'Tab' && v.preventDefault(),
                  !N && v.key.length === 1 && de(v.key),
                  ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(v.key))
                ) {
                  let I = B()
                    .filter((_) => !_.disabled)
                    .map((_) => _.ref.current)
                  if (
                    (['ArrowUp', 'End'].includes(v.key) && (I = I.slice().reverse()),
                    ['ArrowUp', 'ArrowDown'].includes(v.key))
                  ) {
                    const _ = v.target,
                      C = I.indexOf(_)
                    I = I.slice(C + 1)
                  }
                  ;(setTimeout(() => A(I)), v.preventDefault())
                }
              }),
            }),
          }),
        }),
      }),
    })
  })
kt.displayName = Jo
var er = 'SelectItemAlignedPosition',
  At = n.forwardRef((e, r) => {
    const { __scopeSelect: t, onPlaced: a, ...s } = e,
      i = z(oe, t),
      c = Y(oe, t),
      [d, l] = n.useState(null),
      [u, f] = n.useState(null),
      h = E(r, (T) => f(T)),
      S = _e(t),
      y = n.useRef(!1),
      b = n.useRef(!0),
      { viewport: p, selectedItem: x, selectedItemText: w, focusSelectedItem: m } = c,
      g = n.useCallback(() => {
        if (i.trigger && i.valueNode && d && u && p && x && w) {
          const T = i.trigger.getBoundingClientRect(),
            D = u.getBoundingClientRect(),
            W = i.valueNode.getBoundingClientRect(),
            Z = w.getBoundingClientRect()
          if (i.dir !== 'rtl') {
            const _ = Z.left - D.left,
              C = W.left - _,
              J = T.left - C,
              Q = T.width + J,
              Pe = Math.max(Q, D.width),
              Te = window.innerWidth - L,
              je = Ke(C, [L, Math.max(L, Te - Pe)])
            ;((d.style.minWidth = Q + 'px'), (d.style.left = je + 'px'))
          } else {
            const _ = D.right - Z.right,
              C = window.innerWidth - W.right - _,
              J = window.innerWidth - T.right - C,
              Q = T.width + J,
              Pe = Math.max(Q, D.width),
              Te = window.innerWidth - L,
              je = Ke(C, [L, Math.max(L, Te - Pe)])
            ;((d.style.minWidth = Q + 'px'), (d.style.right = je + 'px'))
          }
          const V = S(),
            B = window.innerHeight - L * 2,
            U = p.scrollHeight,
            G = window.getComputedStyle(u),
            H = parseInt(G.borderTopWidth, 10),
            A = parseInt(G.paddingTop, 10),
            O = parseInt(G.borderBottomWidth, 10),
            F = parseInt(G.paddingBottom, 10),
            K = H + A + U + F + O,
            Ie = Math.min(x.offsetHeight * 5, K),
            de = window.getComputedStyle(p),
            Ne = parseInt(de.paddingTop, 10),
            Re = parseInt(de.paddingBottom, 10),
            ne = T.top + T.height / 2 - L,
            ue = B - ne,
            ae = x.offsetHeight / 2,
            v = x.offsetTop + ae,
            N = H + A + v,
            M = K - N
          if (N <= ne) {
            const _ = V.length > 0 && x === V[V.length - 1].ref.current
            d.style.bottom = '0px'
            const C = u.clientHeight - p.offsetTop - p.offsetHeight,
              J = Math.max(ue, ae + (_ ? Re : 0) + C + O),
              Q = N + J
            d.style.height = Q + 'px'
          } else {
            const _ = V.length > 0 && x === V[0].ref.current
            d.style.top = '0px'
            const J = Math.max(ne, H + p.offsetTop + (_ ? Ne : 0) + ae) + M
            ;((d.style.height = J + 'px'), (p.scrollTop = N - ne + p.offsetTop))
          }
          ;((d.style.margin = `${L}px 0`),
            (d.style.minHeight = Ie + 'px'),
            (d.style.maxHeight = B + 'px'),
            a == null || a(),
            requestAnimationFrame(() => (y.current = !0)))
        }
      }, [S, i.trigger, i.valueNode, d, u, p, x, w, i.dir, a])
    $(() => g(), [g])
    const [j, k] = n.useState()
    $(() => {
      u && k(window.getComputedStyle(u).zIndex)
    }, [u])
    const X = n.useCallback(
      (T) => {
        T && b.current === !0 && (g(), m == null || m(), (b.current = !1))
      },
      [g, m],
    )
    return o.jsx(or, {
      scope: t,
      contentWrapper: d,
      shouldExpandOnScrollRef: y,
      onScrollButtonChange: X,
      children: o.jsx('div', {
        ref: l,
        style: { display: 'flex', flexDirection: 'column', position: 'fixed', zIndex: j },
        children: o.jsx(P.div, {
          ...s,
          ref: h,
          style: { boxSizing: 'border-box', maxHeight: '100%', ...s.style },
        }),
      }),
    })
  })
At.displayName = er
var tr = 'SelectPopperPosition',
  ke = n.forwardRef((e, r) => {
    const { __scopeSelect: t, align: a = 'start', collisionPadding: s = L, ...i } = e,
      c = Ce(t)
    return o.jsx(po, {
      ...c,
      ...i,
      ref: r,
      align: a,
      collisionPadding: s,
      style: {
        boxSizing: 'border-box',
        ...i.style,
        '--radix-select-content-transform-origin': 'var(--radix-popper-transform-origin)',
        '--radix-select-content-available-width': 'var(--radix-popper-available-width)',
        '--radix-select-content-available-height': 'var(--radix-popper-available-height)',
        '--radix-select-trigger-width': 'var(--radix-popper-anchor-width)',
        '--radix-select-trigger-height': 'var(--radix-popper-anchor-height)',
      },
    })
  })
ke.displayName = tr
var [or, Ue] = se(oe, {}),
  Ae = 'SelectViewport',
  Mt = n.forwardRef((e, r) => {
    const { __scopeSelect: t, nonce: a, ...s } = e,
      i = Y(Ae, t),
      c = Ue(Ae, t),
      d = E(r, i.onViewportChange),
      l = n.useRef(0)
    return o.jsxs(o.Fragment, {
      children: [
        o.jsx('style', {
          dangerouslySetInnerHTML: {
            __html:
              '[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}',
          },
          nonce: a,
        }),
        o.jsx(we.Slot, {
          scope: t,
          children: o.jsx(P.div, {
            'data-radix-select-viewport': '',
            role: 'presentation',
            ...s,
            ref: d,
            style: { position: 'relative', flex: 1, overflow: 'hidden auto', ...s.style },
            onScroll: R(s.onScroll, (u) => {
              const f = u.currentTarget,
                { contentWrapper: h, shouldExpandOnScrollRef: S } = c
              if (S != null && S.current && h) {
                const y = Math.abs(l.current - f.scrollTop)
                if (y > 0) {
                  const b = window.innerHeight - L * 2,
                    p = parseFloat(h.style.minHeight),
                    x = parseFloat(h.style.height),
                    w = Math.max(p, x)
                  if (w < b) {
                    const m = w + y,
                      g = Math.min(b, m),
                      j = m - g
                    ;((h.style.height = g + 'px'),
                      h.style.bottom === '0px' &&
                        ((f.scrollTop = j > 0 ? j : 0), (h.style.justifyContent = 'flex-end')))
                  }
                }
              }
              l.current = f.scrollTop
            }),
          }),
        }),
      ],
    })
  })
Mt.displayName = Ae
var Lt = 'SelectGroup',
  [rr, nr] = se(Lt),
  Dt = n.forwardRef((e, r) => {
    const { __scopeSelect: t, ...a } = e,
      s = Be()
    return o.jsx(rr, {
      scope: t,
      id: s,
      children: o.jsx(P.div, { role: 'group', 'aria-labelledby': s, ...a, ref: r }),
    })
  })
Dt.displayName = Lt
var Ot = 'SelectLabel',
  Vt = n.forwardRef((e, r) => {
    const { __scopeSelect: t, ...a } = e,
      s = nr(Ot, t)
    return o.jsx(P.div, { id: s.id, ...a, ref: r })
  })
Vt.displayName = Ot
var he = 'SelectItem',
  [sr, Bt] = se(he),
  Gt = n.forwardRef((e, r) => {
    const { __scopeSelect: t, value: a, disabled: s = !1, textValue: i, ...c } = e,
      d = z(he, t),
      l = Y(he, t),
      u = d.value === a,
      [f, h] = n.useState(i ?? ''),
      [S, y] = n.useState(!1),
      b = E(r, (m) => {
        var g
        return (g = l.itemRefCallback) == null ? void 0 : g.call(l, m, a, s)
      }),
      p = Be(),
      x = n.useRef('touch'),
      w = () => {
        s || (d.onValueChange(a), d.onOpenChange(!1))
      }
    if (a === '')
      throw new Error(
        'A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.',
      )
    return o.jsx(sr, {
      scope: t,
      value: a,
      disabled: s,
      textId: p,
      isSelected: u,
      onItemTextChange: n.useCallback((m) => {
        h((g) => g || ((m == null ? void 0 : m.textContent) ?? '').trim())
      }, []),
      children: o.jsx(we.ItemSlot, {
        scope: t,
        value: a,
        disabled: s,
        textValue: f,
        children: o.jsx(P.div, {
          role: 'option',
          'aria-labelledby': p,
          'data-highlighted': S ? '' : void 0,
          'aria-selected': u && S,
          'data-state': u ? 'checked' : 'unchecked',
          'aria-disabled': s || void 0,
          'data-disabled': s ? '' : void 0,
          tabIndex: s ? void 0 : -1,
          ...c,
          ref: b,
          onFocus: R(c.onFocus, () => y(!0)),
          onBlur: R(c.onBlur, () => y(!1)),
          onClick: R(c.onClick, () => {
            x.current !== 'mouse' && w()
          }),
          onPointerUp: R(c.onPointerUp, () => {
            x.current === 'mouse' && w()
          }),
          onPointerDown: R(c.onPointerDown, (m) => {
            x.current = m.pointerType
          }),
          onPointerMove: R(c.onPointerMove, (m) => {
            var g
            ;((x.current = m.pointerType),
              s
                ? (g = l.onItemLeave) == null || g.call(l)
                : x.current === 'mouse' && m.currentTarget.focus({ preventScroll: !0 }))
          }),
          onPointerLeave: R(c.onPointerLeave, (m) => {
            var g
            m.currentTarget === document.activeElement && ((g = l.onItemLeave) == null || g.call(l))
          }),
          onKeyDown: R(c.onKeyDown, (m) => {
            var j
            ;(((j = l.searchRef) == null ? void 0 : j.current) !== '' && m.key === ' ') ||
              (Ko.includes(m.key) && w(), m.key === ' ' && m.preventDefault())
          }),
        }),
      }),
    })
  })
Gt.displayName = he
var ie = 'SelectItemText',
  ar = n.forwardRef((e, r) => {
    const { __scopeSelect: t, className: a, style: s, ...i } = e,
      c = z(ie, t),
      d = Y(ie, t),
      l = Bt(ie, t),
      u = Yo(ie, t),
      [f, h] = n.useState(null),
      S = E(
        r,
        (w) => h(w),
        l.onItemTextChange,
        (w) => {
          var m
          return (m = d.itemTextRefCallback) == null ? void 0 : m.call(d, w, l.value, l.disabled)
        },
      ),
      y = f == null ? void 0 : f.textContent,
      b = n.useMemo(
        () => o.jsx('option', { value: l.value, disabled: l.disabled, children: y }, l.value),
        [l.disabled, l.value, y],
      ),
      { onNativeOptionAdd: p, onNativeOptionRemove: x } = u
    return (
      $(() => (p(b), () => x(b)), [p, x, b]),
      o.jsxs(o.Fragment, {
        children: [
          o.jsx(P.span, { id: l.textId, ...i, ref: S }),
          l.isSelected && c.valueNode && !c.valueNodeHasChildren
            ? Je.createPortal(i.children, c.valueNode)
            : null,
        ],
      })
    )
  })
ar.displayName = ie
var Ht = 'SelectItemIndicator',
  Ft = n.forwardRef((e, r) => {
    const { __scopeSelect: t, ...a } = e
    return Bt(Ht, t).isSelected ? o.jsx(P.span, { 'aria-hidden': !0, ...a, ref: r }) : null
  })
Ft.displayName = Ht
var Me = 'SelectScrollUpButton',
  ir = n.forwardRef((e, r) => {
    const t = Y(Me, e.__scopeSelect),
      a = Ue(Me, e.__scopeSelect),
      [s, i] = n.useState(!1),
      c = E(r, a.onScrollButtonChange)
    return (
      $(() => {
        if (t.viewport && t.isPositioned) {
          let d = function () {
            const u = l.scrollTop > 0
            i(u)
          }
          const l = t.viewport
          return (d(), l.addEventListener('scroll', d), () => l.removeEventListener('scroll', d))
        }
      }, [t.viewport, t.isPositioned]),
      s
        ? o.jsx(Wt, {
            ...e,
            ref: c,
            onAutoScroll: () => {
              const { viewport: d, selectedItem: l } = t
              d && l && (d.scrollTop = d.scrollTop - l.offsetHeight)
            },
          })
        : null
    )
  })
ir.displayName = Me
var Le = 'SelectScrollDownButton',
  lr = n.forwardRef((e, r) => {
    const t = Y(Le, e.__scopeSelect),
      a = Ue(Le, e.__scopeSelect),
      [s, i] = n.useState(!1),
      c = E(r, a.onScrollButtonChange)
    return (
      $(() => {
        if (t.viewport && t.isPositioned) {
          let d = function () {
            const u = l.scrollHeight - l.clientHeight,
              f = Math.ceil(l.scrollTop) < u
            i(f)
          }
          const l = t.viewport
          return (d(), l.addEventListener('scroll', d), () => l.removeEventListener('scroll', d))
        }
      }, [t.viewport, t.isPositioned]),
      s
        ? o.jsx(Wt, {
            ...e,
            ref: c,
            onAutoScroll: () => {
              const { viewport: d, selectedItem: l } = t
              d && l && (d.scrollTop = d.scrollTop + l.offsetHeight)
            },
          })
        : null
    )
  })
lr.displayName = Le
var Wt = n.forwardRef((e, r) => {
    const { __scopeSelect: t, onAutoScroll: a, ...s } = e,
      i = Y('SelectScrollButton', t),
      c = n.useRef(null),
      d = _e(t),
      l = n.useCallback(() => {
        c.current !== null && (window.clearInterval(c.current), (c.current = null))
      }, [])
    return (
      n.useEffect(() => () => l(), [l]),
      $(() => {
        var f
        const u = d().find((h) => h.ref.current === document.activeElement)
        ;(f = u == null ? void 0 : u.ref.current) == null || f.scrollIntoView({ block: 'nearest' })
      }, [d]),
      o.jsx(P.div, {
        'aria-hidden': !0,
        ...s,
        ref: r,
        style: { flexShrink: 0, ...s.style },
        onPointerDown: R(s.onPointerDown, () => {
          c.current === null && (c.current = window.setInterval(a, 50))
        }),
        onPointerMove: R(s.onPointerMove, () => {
          var u
          ;((u = i.onItemLeave) == null || u.call(i),
            c.current === null && (c.current = window.setInterval(a, 50)))
        }),
        onPointerLeave: R(s.onPointerLeave, () => {
          l()
        }),
      })
    )
  }),
  cr = 'SelectSeparator',
  Ut = n.forwardRef((e, r) => {
    const { __scopeSelect: t, ...a } = e
    return o.jsx(P.div, { 'aria-hidden': !0, ...a, ref: r })
  })
Ut.displayName = cr
var De = 'SelectArrow',
  dr = n.forwardRef((e, r) => {
    const { __scopeSelect: t, ...a } = e,
      s = Ce(t),
      i = z(De, t),
      c = Y(De, t)
    return i.open && c.position === 'popper' ? o.jsx(mo, { ...s, ...a, ref: r }) : null
  })
dr.displayName = De
var ur = 'SelectBubbleInput',
  Kt = n.forwardRef(({ __scopeSelect: e, value: r, ...t }, a) => {
    const s = n.useRef(null),
      i = E(a, s),
      c = Ge(r)
    return (
      n.useEffect(() => {
        const d = s.current
        if (!d) return
        const l = window.HTMLSelectElement.prototype,
          f = Object.getOwnPropertyDescriptor(l, 'value').set
        if (c !== r && f) {
          const h = new Event('change', { bubbles: !0 })
          ;(f.call(d, r), d.dispatchEvent(h))
        }
      }, [c, r]),
      o.jsx(P.select, { ...t, style: { ...ro, ...t.style }, ref: i, defaultValue: r })
    )
  })
Kt.displayName = ur
function qt(e) {
  return e === '' || e === void 0
}
function $t(e) {
  const r = so(e),
    t = n.useRef(''),
    a = n.useRef(0),
    s = n.useCallback(
      (c) => {
        const d = t.current + c
        ;(r(d),
          (function l(u) {
            ;((t.current = u),
              window.clearTimeout(a.current),
              u !== '' && (a.current = window.setTimeout(() => l(''), 1e3)))
          })(d))
      },
      [r],
    ),
    i = n.useCallback(() => {
      ;((t.current = ''), window.clearTimeout(a.current))
    }, [])
  return (n.useEffect(() => () => window.clearTimeout(a.current), []), [t, s, i])
}
function zt(e, r, t) {
  const s = r.length > 1 && Array.from(r).every((u) => u === r[0]) ? r[0] : r,
    i = t ? e.indexOf(t) : -1
  let c = pr(e, Math.max(i, 0))
  s.length === 1 && (c = c.filter((u) => u !== t))
  const l = c.find((u) => u.textValue.toLowerCase().startsWith(s.toLowerCase()))
  return l !== t ? l : void 0
}
function pr(e, r) {
  return e.map((t, a) => e[(r + a) % e.length])
}
var mr = _t,
  Yt = It,
  fr = Rt,
  hr = Pt,
  xr = Tt,
  Xt = jt,
  gr = Mt,
  vr = Dt,
  Zt = Vt,
  Jt = Gt,
  yr = Ft,
  Qt = Ut
const Oe = mr,
  qe = vr,
  Ve = fr,
  xe = n.forwardRef(({ className: e, children: r, ...t }, a) =>
    o.jsxs(Yt, {
      ref: a,
      className: re(
        'inline-flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        e,
      ),
      ...t,
      children: [
        r,
        o.jsx(hr, { children: o.jsx(io, { className: 'h-4 w-4 text-muted-foreground' }) }),
      ],
    }),
  )
xe.displayName = Yt.displayName
const ge = n.forwardRef(
  ({ className: e, children: r, position: t = 'popper', sideOffset: a = 8, ...s }, i) =>
    o.jsx(xr, {
      children: o.jsx(Xt, {
        ref: i,
        position: t,
        sideOffset: a,
        className: re(
          'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-xl shadow-primary/10 backdrop-blur-lg data-[side=bottom]:animate-slide-in-from-top data-[side=top]:animate-slide-in-from-bottom',
          e,
        ),
        ...s,
        children: o.jsx(gr, { className: 'p-2', children: r }),
      }),
    }),
)
ge.displayName = Xt.displayName
const ce = n.forwardRef(({ className: e, ...r }, t) =>
  o.jsx(Zt, {
    ref: t,
    className: re(
      'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
      e,
    ),
    ...r,
  }),
)
ce.displayName = Zt.displayName
const ee = n.forwardRef(({ className: e, children: r, ...t }, a) =>
  o.jsxs(Jt, {
    ref: a,
    className: re(
      'relative flex w-full cursor-pointer select-none items-center rounded-xl px-3 py-2 text-sm text-foreground outline-none transition focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      e,
    ),
    ...t,
    children: [
      o.jsx('span', { className: 'flex-1 leading-none', children: r }),
      o.jsx(yr, { children: o.jsx(Ze, { className: 'h-3.5 w-3.5 text-primary' }) }),
    ],
  }),
)
ee.displayName = Jt.displayName
const ve = n.forwardRef(({ className: e, ...r }, t) =>
  o.jsx(Qt, { ref: t, className: re('my-2 h-px bg-border/60', e), ...r }),
)
ve.displayName = Qt.displayName
try {
  ;((Oe.displayName = 'Select'),
    (Oe.__docgenInfo = {
      description: '',
      displayName: 'Select',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/select.tsx',
      methods: [],
      props: {
        value: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-select/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'value',
          required: !1,
          tags: {},
          type: { name: 'string' },
        },
        defaultValue: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-select/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'defaultValue',
          required: !1,
          tags: {},
          type: { name: 'string' },
        },
        onValueChange: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/node_modules/@radix-ui/react-select/dist/index.d.mts',
              name: 'TypeLiteral',
            },
          ],
          description: '',
          name: 'onValueChange',
          required: !1,
          tags: {},
          type: { name: '((value: string) => void)' },
        },
      },
      tags: {},
    }))
} catch {}
try {
  ;((qe.displayName = 'SelectGroup'),
    (qe.__docgenInfo = {
      description: '',
      displayName: 'SelectGroup',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/select.tsx',
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
  ;((Ve.displayName = 'SelectValue'),
    (Ve.__docgenInfo = {
      description: '',
      displayName: 'SelectValue',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/select.tsx',
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
  ;((xe.displayName = 'SelectTrigger'),
    (xe.__docgenInfo = {
      description: '',
      displayName: 'SelectTrigger',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/select.tsx',
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
  ;((ge.displayName = 'SelectContent'),
    (ge.__docgenInfo = {
      description: '',
      displayName: 'SelectContent',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/select.tsx',
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
  ;((ce.displayName = 'SelectLabel'),
    (ce.__docgenInfo = {
      description: '',
      displayName: 'SelectLabel',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/select.tsx',
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
  ;((ee.displayName = 'SelectItem'),
    (ee.__docgenInfo = {
      description: '',
      displayName: 'SelectItem',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/select.tsx',
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
  ;((ve.displayName = 'SelectSeparator'),
    (ve.__docgenInfo = {
      description: '',
      displayName: 'SelectSeparator',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/select.tsx',
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
const Tr = { title: 'Design System/Form Controls' },
  pe = {
    render: () => {
      const [e, r] = n.useState('research'),
        [t, a] = n.useState(!0)
      return o.jsxs('form', {
        className:
          'mx-auto grid w-full max-w-xl gap-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm',
        children: [
          o.jsx(wo, {
            eyebrow: 'Team setup',
            title: 'Create a workspace',
            description:
              'Invite collaborators and configure which track this workspace should focus on.',
          }),
          o.jsx(vo, { placeholder: 'Workspace name', autoComplete: 'off' }),
          o.jsx(yo, { placeholder: 'Goals for this workspace' }),
          o.jsxs('div', {
            className: 'space-y-2 text-sm',
            children: [
              o.jsx('label', {
                className: 'block font-medium text-foreground',
                children: 'Focus area',
              }),
              o.jsxs(Oe, {
                value: e,
                onValueChange: r,
                children: [
                  o.jsx(xe, { children: o.jsx(Ve, { placeholder: 'Choose a track' }) }),
                  o.jsxs(ge, {
                    children: [
                      o.jsx(ce, { children: 'Clinical' }),
                      o.jsx(ee, { value: 'bronchoscopy', children: 'Bronchoscopy bootcamp' }),
                      o.jsx(ee, { value: 'airway', children: 'Airway stenting practice' }),
                      o.jsx(ve, {}),
                      o.jsx(ce, { children: 'Research & innovation' }),
                      o.jsx(ee, { value: 'research', children: 'AI assisted navigation' }),
                      o.jsx(ee, { value: 'hardware', children: 'DIY hardware labs' }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          o.jsxs('div', {
            className: 'space-y-2 text-sm',
            children: [
              o.jsx('p', { className: 'font-medium text-foreground', children: 'Access level' }),
              o.jsxs(Ee, {
                value: t ? 'team' : 'private',
                onValueChange: (s) => a(s === 'team'),
                className: 'flex flex-col gap-2',
                children: [
                  o.jsxs('label', {
                    className:
                      'flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3',
                    children: [
                      o.jsx(le, { value: 'team' }),
                      o.jsxs('div', {
                        children: [
                          o.jsx('p', {
                            className: 'font-medium text-foreground',
                            children: 'Team visibility',
                          }),
                          o.jsx('p', {
                            className: 'text-xs text-muted-foreground',
                            children:
                              'Share analytics and notes with invited collaborators automatically.',
                          }),
                        ],
                      }),
                    ],
                  }),
                  o.jsxs('label', {
                    className:
                      'flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3',
                    children: [
                      o.jsx(le, { value: 'private' }),
                      o.jsxs('div', {
                        children: [
                          o.jsx('p', {
                            className: 'font-medium text-foreground',
                            children: 'Private draft',
                          }),
                          o.jsx('p', {
                            className: 'text-xs text-muted-foreground',
                            children:
                              'Keep everything private while you iterate on early concepts.',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          o.jsxs('label', {
            className: 'flex items-center gap-3 text-sm text-muted-foreground',
            children: [
              o.jsx(fe, { checked: t, onCheckedChange: (s) => a(s === !0) }),
              'Send weekly summary to maintainers',
            ],
          }),
          o.jsx(lo, { type: 'submit', className: 'w-full', children: 'Create workspace' }),
        ],
      })
    },
  }
var $e, ze, Ye
pe.parameters = {
  ...pe.parameters,
  docs: {
    ...(($e = pe.parameters) == null ? void 0 : $e.docs),
    source: {
      originalSource: `{
  render: () => {
    const [setting, setSetting] = useState('research');
    const [notifications, setNotifications] = useState(true);
    return <form className="mx-auto grid w-full max-w-xl gap-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <SectionHeader eyebrow="Team setup" title="Create a workspace" description="Invite collaborators and configure which track this workspace should focus on." />
        <Input placeholder="Workspace name" autoComplete="off" />
        <Textarea placeholder="Goals for this workspace" />
        <div className="space-y-2 text-sm">
          <label className="block font-medium text-foreground">Focus area</label>
          <Select value={setting} onValueChange={setSetting}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a track" />
            </SelectTrigger>
            <SelectContent>
              <SelectLabel>Clinical</SelectLabel>
              <SelectItem value="bronchoscopy">Bronchoscopy bootcamp</SelectItem>
              <SelectItem value="airway">Airway stenting practice</SelectItem>
              <SelectSeparator />
              <SelectLabel>Research & innovation</SelectLabel>
              <SelectItem value="research">AI assisted navigation</SelectItem>
              <SelectItem value="hardware">DIY hardware labs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">Access level</p>
          <RadioGroup value={notifications ? 'team' : 'private'} onValueChange={value => setNotifications(value === 'team')} className="flex flex-col gap-2">
            <label className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
              <RadioGroupItem value="team" />
              <div>
                <p className="font-medium text-foreground">Team visibility</p>
                <p className="text-xs text-muted-foreground">
                  Share analytics and notes with invited collaborators automatically.
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
              <RadioGroupItem value="private" />
              <div>
                <p className="font-medium text-foreground">Private draft</p>
                <p className="text-xs text-muted-foreground">
                  Keep everything private while you iterate on early concepts.
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>
        <label className="flex items-center gap-3 text-sm text-muted-foreground">
          <Checkbox checked={notifications} onCheckedChange={value => setNotifications(value === true)} />
          Send weekly summary to maintainers
        </label>
        <Button type="submit" className="w-full">
          Create workspace
        </Button>
      </form>;
  }
}`,
      ...((Ye = (ze = pe.parameters) == null ? void 0 : ze.docs) == null ? void 0 : Ye.source),
    },
  },
}
const jr = ['Example']
export { pe as Example, jr as __namedExportsOrder, Tr as default }
