import { r as a, j as f, R as b, p as h, c as v } from './iframe-AbuOJf2D.js'
import { c as x } from './index-DuT5EQq1.js'
var _ = Symbol.for('react.lazy'),
  c = b[' use '.trim().toString()]
function w(e) {
  return typeof e == 'object' && e !== null && 'then' in e
}
function y(e) {
  return (
    e != null &&
    typeof e == 'object' &&
    '$$typeof' in e &&
    e.$$typeof === _ &&
    '_payload' in e &&
    w(e._payload)
  )
}
function C(e) {
  const r = S(e),
    o = a.forwardRef((n, t) => {
      let { children: s, ...l } = n
      y(s) && typeof c == 'function' && (s = c(s._payload))
      const i = a.Children.toArray(s),
        u = i.find(P)
      if (u) {
        const d = u.props.children,
          g = i.map((m) =>
            m === u
              ? a.Children.count(d) > 1
                ? a.Children.only(null)
                : a.isValidElement(d)
                  ? d.props.children
                  : null
              : m,
          )
        return f.jsx(r, {
          ...l,
          ref: t,
          children: a.isValidElement(d) ? a.cloneElement(d, void 0, g) : null,
        })
      }
      return f.jsx(r, { ...l, ref: t, children: s })
    })
  return ((o.displayName = `${e}.Slot`), o)
}
var E = C('Slot')
function S(e) {
  const r = a.forwardRef((o, n) => {
    let { children: t, ...s } = o
    if ((y(t) && typeof c == 'function' && (t = c(t._payload)), a.isValidElement(t))) {
      const l = V(t),
        i = R(s, t.props)
      return (t.type !== a.Fragment && (i.ref = n ? h(n, l) : l), a.cloneElement(t, i))
    }
    return a.Children.count(t) > 1 ? a.Children.only(null) : null
  })
  return ((r.displayName = `${e}.SlotClone`), r)
}
var j = Symbol('radix.slottable')
function P(e) {
  return (
    a.isValidElement(e) &&
    typeof e.type == 'function' &&
    '__radixId' in e.type &&
    e.type.__radixId === j
  )
}
function R(e, r) {
  const o = { ...r }
  for (const n in r) {
    const t = e[n],
      s = r[n]
    ;/^on[A-Z]/.test(n)
      ? t && s
        ? (o[n] = (...i) => {
            const u = s(...i)
            return (t(...i), u)
          })
        : t && (o[n] = t)
      : n === 'style'
        ? (o[n] = { ...t, ...s })
        : n === 'className' && (o[n] = [t, s].filter(Boolean).join(' '))
  }
  return { ...e, ...o }
}
function V(e) {
  var n, t
  let r = (n = Object.getOwnPropertyDescriptor(e.props, 'ref')) == null ? void 0 : n.get,
    o = r && 'isReactWarning' in r && r.isReactWarning
  return o
    ? e.ref
    : ((r = (t = Object.getOwnPropertyDescriptor(e, 'ref')) == null ? void 0 : t.get),
      (o = r && 'isReactWarning' in r && r.isReactWarning),
      o ? e.props.ref : e.props.ref || e.ref)
}
const N = x(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    {
      variants: {
        variant: {
          default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
          secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
          destructive:
            'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
          outline:
            'border border-input bg-background text-foreground shadow-sm hover:bg-muted hover:text-foreground',
          ghost: 'text-foreground hover:bg-muted/70',
          link: 'text-primary underline-offset-4 hover:underline',
        },
        size: {
          default: 'h-10 px-5 py-2',
          sm: 'h-9 px-4 text-sm',
          lg: 'h-11 px-6 text-base',
          icon: 'h-10 w-10 rounded-full',
        },
        elevated: {
          true: 'shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25',
          false: null,
        },
      },
      defaultVariants: { variant: 'default', size: 'default', elevated: !1 },
    },
  ),
  p = a.forwardRef(
    ({ className: e, variant: r, size: o, elevated: n, asChild: t = !1, ...s }, l) => {
      const i = t ? E : 'button'
      return f.jsx(i, {
        className: v(N({ variant: r, size: o, elevated: n, className: e })),
        ref: l,
        ...s,
      })
    },
  )
p.displayName = 'Button'
try {
  ;((p.displayName = 'Button'),
    (p.__docgenInfo = {
      description: '',
      displayName: 'Button',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/button.tsx',
      methods: [],
      props: {
        asChild: {
          defaultValue: { value: 'false' },
          declarations: [
            { fileName: 'IP_website/src/components/ui/button.tsx', name: 'ButtonProps' },
          ],
          description: '',
          name: 'asChild',
          parent: { fileName: 'IP_website/src/components/ui/button.tsx', name: 'ButtonProps' },
          required: !1,
          tags: {},
          type: { name: 'boolean' },
        },
        variant: {
          defaultValue: null,
          declarations: [],
          description: '',
          name: 'variant',
          required: !1,
          tags: {},
          type: {
            name: '"default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | null',
          },
        },
        size: {
          defaultValue: null,
          declarations: [],
          description: '',
          name: 'size',
          required: !1,
          tags: {},
          type: { name: '"default" | "sm" | "lg" | "icon" | null' },
        },
        elevated: {
          defaultValue: null,
          declarations: [],
          description: '',
          name: 'elevated',
          required: !1,
          tags: {},
          type: { name: 'boolean | null' },
        },
      },
      tags: {},
    }))
} catch {}
export { p as B }
