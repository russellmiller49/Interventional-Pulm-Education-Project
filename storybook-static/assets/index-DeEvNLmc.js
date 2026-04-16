import { r as i, j as I, c as q, o as ee, m as we, P as Se } from './iframe-AbuOJf2D.js'
const z = i.forwardRef(
  ({ className: e, type: t = 'text', leadingIcon: r, trailingIcon: n, ...c }, u) =>
    I.jsxs('div', {
      className: q(
        'group relative flex items-center rounded-full border border-border/70 bg-background transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
        e,
      ),
      children: [
        r
          ? I.jsx('span', {
              className: 'pl-4 text-muted-foreground group-focus-within:text-primary',
              children: r,
            })
          : null,
        I.jsx('input', {
          type: t,
          className: q(
            'flex-1 bg-transparent px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            r ? 'pl-2' : 'pl-4',
            n ? 'pr-2' : 'pr-4',
          ),
          ref: u,
          ...c,
        }),
        n
          ? I.jsx('span', {
              className: 'pr-4 text-muted-foreground group-focus-within:text-primary',
              children: n,
            })
          : null,
      ],
    }),
)
z.displayName = 'Input'
try {
  ;((z.displayName = 'Input'),
    (z.__docgenInfo = {
      description: '',
      displayName: 'Input',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/input.tsx',
      methods: [],
      props: {
        leadingIcon: {
          defaultValue: null,
          declarations: [
            { fileName: 'IP_website/src/components/ui/input.tsx', name: 'InputProps' },
          ],
          description: '',
          name: 'leadingIcon',
          parent: { fileName: 'IP_website/src/components/ui/input.tsx', name: 'InputProps' },
          required: !1,
          tags: {},
          type: { name: 'ReactNode' },
        },
        trailingIcon: {
          defaultValue: null,
          declarations: [
            { fileName: 'IP_website/src/components/ui/input.tsx', name: 'InputProps' },
          ],
          description: '',
          name: 'trailingIcon',
          parent: { fileName: 'IP_website/src/components/ui/input.tsx', name: 'InputProps' },
          required: !1,
          tags: {},
          type: { name: 'ReactNode' },
        },
      },
      tags: {},
    }))
} catch {}
const Z = i.forwardRef(({ className: e, ...t }, r) =>
  I.jsx('textarea', {
    ref: r,
    className: q(
      'min-h-[120px] w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      e,
    ),
    ...t,
  }),
)
Z.displayName = 'Textarea'
try {
  ;((Z.displayName = 'Textarea'),
    (Z.__docgenInfo = {
      description: '',
      displayName: 'Textarea',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/textarea.tsx',
      methods: [],
      props: {},
      tags: {},
    }))
} catch {}
var U = 'focusScope.autoFocusOnMount',
  V = 'focusScope.autoFocusOnUnmount',
  te = { bubbles: !1, cancelable: !0 },
  Ce = 'FocusScope',
  xe = i.forwardRef((e, t) => {
    const { loop: r = !1, trapped: n = !1, onMountAutoFocus: c, onUnmountAutoFocus: u, ...l } = e,
      [a, w] = i.useState(null),
      b = ee(c),
      g = ee(u),
      f = i.useRef(null),
      v = we(t, (o) => w(o)),
      m = i.useRef({
        paused: !1,
        pause() {
          this.paused = !0
        },
        resume() {
          this.paused = !1
        },
      }).current
    ;(i.useEffect(() => {
      if (n) {
        let o = function (p) {
            if (m.paused || !a) return
            const y = p.target
            a.contains(y) ? (f.current = y) : R(f.current, { select: !0 })
          },
          s = function (p) {
            if (m.paused || !a) return
            const y = p.relatedTarget
            y !== null && (a.contains(y) || R(f.current, { select: !0 }))
          },
          d = function (p) {
            if (document.activeElement === document.body)
              for (const E of p) E.removedNodes.length > 0 && R(a)
          }
        ;(document.addEventListener('focusin', o), document.addEventListener('focusout', s))
        const h = new MutationObserver(d)
        return (
          a && h.observe(a, { childList: !0, subtree: !0 }),
          () => {
            ;(document.removeEventListener('focusin', o),
              document.removeEventListener('focusout', s),
              h.disconnect())
          }
        )
      }
    }, [n, a, m.paused]),
      i.useEffect(() => {
        if (a) {
          ne.add(m)
          const o = document.activeElement
          if (!a.contains(o)) {
            const d = new CustomEvent(U, te)
            ;(a.addEventListener(U, b),
              a.dispatchEvent(d),
              d.defaultPrevented ||
                (Ne(Ie(fe(a)), { select: !0 }), document.activeElement === o && R(a)))
          }
          return () => {
            ;(a.removeEventListener(U, b),
              setTimeout(() => {
                const d = new CustomEvent(V, te)
                ;(a.addEventListener(V, g),
                  a.dispatchEvent(d),
                  d.defaultPrevented || R(o ?? document.body, { select: !0 }),
                  a.removeEventListener(V, g),
                  ne.remove(m))
              }, 0))
          }
        }
      }, [a, b, g, m]))
    const S = i.useCallback(
      (o) => {
        if ((!r && !n) || m.paused) return
        const s = o.key === 'Tab' && !o.altKey && !o.ctrlKey && !o.metaKey,
          d = document.activeElement
        if (s && d) {
          const h = o.currentTarget,
            [p, y] = Re(h)
          p && y
            ? !o.shiftKey && d === y
              ? (o.preventDefault(), r && R(p, { select: !0 }))
              : o.shiftKey && d === p && (o.preventDefault(), r && R(y, { select: !0 }))
            : d === h && o.preventDefault()
        }
      },
      [r, n, m.paused],
    )
    return I.jsx(Se.div, { tabIndex: -1, ...l, ref: v, onKeyDown: S })
  })
xe.displayName = Ce
function Ne(e, { select: t = !1 } = {}) {
  const r = document.activeElement
  for (const n of e) if ((R(n, { select: t }), document.activeElement !== r)) return
}
function Re(e) {
  const t = fe(e),
    r = re(t, e),
    n = re(t.reverse(), e)
  return [r, n]
}
function fe(e) {
  const t = [],
    r = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => {
        const c = n.tagName === 'INPUT' && n.type === 'hidden'
        return n.disabled || n.hidden || c
          ? NodeFilter.FILTER_SKIP
          : n.tabIndex >= 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP
      },
    })
  for (; r.nextNode(); ) t.push(r.currentNode)
  return t
}
function re(e, t) {
  for (const r of e) if (!Pe(r, { upTo: t })) return r
}
function Pe(e, { upTo: t }) {
  if (getComputedStyle(e).visibility === 'hidden') return !0
  for (; e; ) {
    if (t !== void 0 && e === t) return !1
    if (getComputedStyle(e).display === 'none') return !0
    e = e.parentElement
  }
  return !1
}
function Te(e) {
  return e instanceof HTMLInputElement && 'select' in e
}
function R(e, { select: t = !1 } = {}) {
  if (e && e.focus) {
    const r = document.activeElement
    ;(e.focus({ preventScroll: !0 }), e !== r && Te(e) && t && e.select())
  }
}
var ne = ke()
function ke() {
  let e = []
  return {
    add(t) {
      const r = e[0]
      ;(t !== r && (r == null || r.pause()), (e = ae(e, t)), e.unshift(t))
    },
    remove(t) {
      var r
      ;((e = ae(e, t)), (r = e[0]) == null || r.resume())
    },
  }
}
function ae(e, t) {
  const r = [...e],
    n = r.indexOf(t)
  return (n !== -1 && r.splice(n, 1), r)
}
function Ie(e) {
  return e.filter((t) => t.tagName !== 'A')
}
var K = 0
function yt() {
  i.useEffect(() => {
    const e = document.querySelectorAll('[data-radix-focus-guard]')
    return (
      document.body.insertAdjacentElement('afterbegin', e[0] ?? oe()),
      document.body.insertAdjacentElement('beforeend', e[1] ?? oe()),
      K++,
      () => {
        ;(K === 1 &&
          document.querySelectorAll('[data-radix-focus-guard]').forEach((t) => t.remove()),
          K--)
      }
    )
  }, [])
}
function oe() {
  const e = document.createElement('span')
  return (
    e.setAttribute('data-radix-focus-guard', ''),
    (e.tabIndex = 0),
    (e.style.outline = 'none'),
    (e.style.opacity = '0'),
    (e.style.position = 'fixed'),
    (e.style.pointerEvents = 'none'),
    e
  )
}
var C = function () {
  return (
    (C =
      Object.assign ||
      function (t) {
        for (var r, n = 1, c = arguments.length; n < c; n++) {
          r = arguments[n]
          for (var u in r) Object.prototype.hasOwnProperty.call(r, u) && (t[u] = r[u])
        }
        return t
      }),
    C.apply(this, arguments)
  )
}
function de(e, t) {
  var r = {}
  for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && t.indexOf(n) < 0 && (r[n] = e[n])
  if (e != null && typeof Object.getOwnPropertySymbols == 'function')
    for (var c = 0, n = Object.getOwnPropertySymbols(e); c < n.length; c++)
      t.indexOf(n[c]) < 0 &&
        Object.prototype.propertyIsEnumerable.call(e, n[c]) &&
        (r[n[c]] = e[n[c]])
  return r
}
function Ae(e, t, r) {
  if (r || arguments.length === 2)
    for (var n = 0, c = t.length, u; n < c; n++)
      (u || !(n in t)) && (u || (u = Array.prototype.slice.call(t, 0, n)), (u[n] = t[n]))
  return e.concat(u || Array.prototype.slice.call(t))
}
var j = 'right-scroll-bar-position',
  W = 'width-before-scroll-bar',
  Me = 'with-scroll-bars-hidden',
  Oe = '--removed-body-scroll-bar-size'
function H(e, t) {
  return (typeof e == 'function' ? e(t) : e && (e.current = t), e)
}
function Fe(e, t) {
  var r = i.useState(function () {
    return {
      value: e,
      callback: t,
      facade: {
        get current() {
          return r.value
        },
        set current(n) {
          var c = r.value
          c !== n && ((r.value = n), r.callback(n, c))
        },
      },
    }
  })[0]
  return ((r.callback = t), r.facade)
}
var _e = typeof window < 'u' ? i.useLayoutEffect : i.useEffect,
  ce = new WeakMap()
function Le(e, t) {
  var r = Fe(null, function (n) {
    return e.forEach(function (c) {
      return H(c, n)
    })
  })
  return (
    _e(
      function () {
        var n = ce.get(r)
        if (n) {
          var c = new Set(n),
            u = new Set(e),
            l = r.current
          ;(c.forEach(function (a) {
            u.has(a) || H(a, null)
          }),
            u.forEach(function (a) {
              c.has(a) || H(a, l)
            }))
        }
        ce.set(r, e)
      },
      [e],
    ),
    r
  )
}
function je(e) {
  return e
}
function We(e, t) {
  t === void 0 && (t = je)
  var r = [],
    n = !1,
    c = {
      read: function () {
        if (n)
          throw new Error(
            'Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.',
          )
        return r.length ? r[r.length - 1] : e
      },
      useMedium: function (u) {
        var l = t(u, n)
        return (
          r.push(l),
          function () {
            r = r.filter(function (a) {
              return a !== l
            })
          }
        )
      },
      assignSyncMedium: function (u) {
        for (n = !0; r.length; ) {
          var l = r
          ;((r = []), l.forEach(u))
        }
        r = {
          push: function (a) {
            return u(a)
          },
          filter: function () {
            return r
          },
        }
      },
      assignMedium: function (u) {
        n = !0
        var l = []
        if (r.length) {
          var a = r
          ;((r = []), a.forEach(u), (l = r))
        }
        var w = function () {
            var g = l
            ;((l = []), g.forEach(u))
          },
          b = function () {
            return Promise.resolve().then(w)
          }
        ;(b(),
          (r = {
            push: function (g) {
              ;(l.push(g), b())
            },
            filter: function (g) {
              return ((l = l.filter(g)), r)
            },
          }))
      },
    }
  return c
}
function Be(e) {
  e === void 0 && (e = {})
  var t = We(null)
  return ((t.options = C({ async: !0, ssr: !1 }, e)), t)
}
var ve = function (e) {
  var t = e.sideCar,
    r = de(e, ['sideCar'])
  if (!t) throw new Error('Sidecar: please provide `sideCar` property to import the right car')
  var n = t.read()
  if (!n) throw new Error('Sidecar medium not found')
  return i.createElement(n, C({}, r))
}
ve.isSideCarExport = !0
function De(e, t) {
  return (e.useMedium(t), ve)
}
var me = Be(),
  X = function () {},
  B = i.forwardRef(function (e, t) {
    var r = i.useRef(null),
      n = i.useState({ onScrollCapture: X, onWheelCapture: X, onTouchMoveCapture: X }),
      c = n[0],
      u = n[1],
      l = e.forwardProps,
      a = e.children,
      w = e.className,
      b = e.removeScrollBar,
      g = e.enabled,
      f = e.shards,
      v = e.sideCar,
      m = e.noRelative,
      S = e.noIsolation,
      o = e.inert,
      s = e.allowPinchZoom,
      d = e.as,
      h = d === void 0 ? 'div' : d,
      p = e.gapMode,
      y = de(e, [
        'forwardProps',
        'children',
        'className',
        'removeScrollBar',
        'enabled',
        'shards',
        'sideCar',
        'noRelative',
        'noIsolation',
        'inert',
        'allowPinchZoom',
        'as',
        'gapMode',
      ]),
      E = v,
      x = Le([r, t]),
      N = C(C({}, y), c)
    return i.createElement(
      i.Fragment,
      null,
      g &&
        i.createElement(E, {
          sideCar: me,
          removeScrollBar: b,
          shards: f,
          noRelative: m,
          noIsolation: S,
          inert: o,
          setCallbacks: u,
          allowPinchZoom: !!s,
          lockRef: r,
          gapMode: p,
        }),
      l
        ? i.cloneElement(i.Children.only(a), C(C({}, N), { ref: x }))
        : i.createElement(h, C({}, N, { className: w, ref: x }), a),
    )
  })
B.defaultProps = { enabled: !0, removeScrollBar: !0, inert: !1 }
B.classNames = { fullWidth: W, zeroRight: j }
var Ue = function () {
  if (typeof __webpack_nonce__ < 'u') return __webpack_nonce__
}
function Ve() {
  if (!document) return null
  var e = document.createElement('style')
  e.type = 'text/css'
  var t = Ue()
  return (t && e.setAttribute('nonce', t), e)
}
function Ke(e, t) {
  e.styleSheet ? (e.styleSheet.cssText = t) : e.appendChild(document.createTextNode(t))
}
function He(e) {
  var t = document.head || document.getElementsByTagName('head')[0]
  t.appendChild(e)
}
var Xe = function () {
    var e = 0,
      t = null
    return {
      add: function (r) {
        ;(e == 0 && (t = Ve()) && (Ke(t, r), He(t)), e++)
      },
      remove: function () {
        ;(e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), (t = null)))
      },
    }
  },
  Ye = function () {
    var e = Xe()
    return function (t, r) {
      i.useEffect(
        function () {
          return (
            e.add(t),
            function () {
              e.remove()
            }
          )
        },
        [t && r],
      )
    }
  },
  he = function () {
    var e = Ye(),
      t = function (r) {
        var n = r.styles,
          c = r.dynamic
        return (e(n, c), null)
      }
    return t
  },
  Ge = { left: 0, top: 0, right: 0, gap: 0 },
  Y = function (e) {
    return parseInt(e || '', 10) || 0
  },
  qe = function (e) {
    var t = window.getComputedStyle(document.body),
      r = t[e === 'padding' ? 'paddingLeft' : 'marginLeft'],
      n = t[e === 'padding' ? 'paddingTop' : 'marginTop'],
      c = t[e === 'padding' ? 'paddingRight' : 'marginRight']
    return [Y(r), Y(n), Y(c)]
  },
  ze = function (e) {
    if ((e === void 0 && (e = 'margin'), typeof window > 'u')) return Ge
    var t = qe(e),
      r = document.documentElement.clientWidth,
      n = window.innerWidth
    return { left: t[0], top: t[1], right: t[2], gap: Math.max(0, n - r + t[2] - t[0]) }
  },
  Ze = he(),
  A = 'data-scroll-locked',
  Qe = function (e, t, r, n) {
    var c = e.left,
      u = e.top,
      l = e.right,
      a = e.gap
    return (
      r === void 0 && (r = 'margin'),
      `
  .`
        .concat(
          Me,
          ` {
   overflow: hidden `,
        )
        .concat(
          n,
          `;
   padding-right: `,
        )
        .concat(a, 'px ')
        .concat(
          n,
          `;
  }
  body[`,
        )
        .concat(
          A,
          `] {
    overflow: hidden `,
        )
        .concat(
          n,
          `;
    overscroll-behavior: contain;
    `,
        )
        .concat(
          [
            t && 'position: relative '.concat(n, ';'),
            r === 'margin' &&
              `
    padding-left: `
                .concat(
                  c,
                  `px;
    padding-top: `,
                )
                .concat(
                  u,
                  `px;
    padding-right: `,
                )
                .concat(
                  l,
                  `px;
    margin-left:0;
    margin-top:0;
    margin-right: `,
                )
                .concat(a, 'px ')
                .concat(
                  n,
                  `;
    `,
                ),
            r === 'padding' && 'padding-right: '.concat(a, 'px ').concat(n, ';'),
          ]
            .filter(Boolean)
            .join(''),
          `
  }
  
  .`,
        )
        .concat(
          j,
          ` {
    right: `,
        )
        .concat(a, 'px ')
        .concat(
          n,
          `;
  }
  
  .`,
        )
        .concat(
          W,
          ` {
    margin-right: `,
        )
        .concat(a, 'px ')
        .concat(
          n,
          `;
  }
  
  .`,
        )
        .concat(j, ' .')
        .concat(
          j,
          ` {
    right: 0 `,
        )
        .concat(
          n,
          `;
  }
  
  .`,
        )
        .concat(W, ' .')
        .concat(
          W,
          ` {
    margin-right: 0 `,
        )
        .concat(
          n,
          `;
  }
  
  body[`,
        )
        .concat(
          A,
          `] {
    `,
        )
        .concat(Oe, ': ')
        .concat(
          a,
          `px;
  }
`,
        )
    )
  },
  ie = function () {
    var e = parseInt(document.body.getAttribute(A) || '0', 10)
    return isFinite(e) ? e : 0
  },
  $e = function () {
    i.useEffect(function () {
      return (
        document.body.setAttribute(A, (ie() + 1).toString()),
        function () {
          var e = ie() - 1
          e <= 0 ? document.body.removeAttribute(A) : document.body.setAttribute(A, e.toString())
        }
      )
    }, [])
  },
  Je = function (e) {
    var t = e.noRelative,
      r = e.noImportant,
      n = e.gapMode,
      c = n === void 0 ? 'margin' : n
    $e()
    var u = i.useMemo(
      function () {
        return ze(c)
      },
      [c],
    )
    return i.createElement(Ze, { styles: Qe(u, !t, c, r ? '' : '!important') })
  },
  Q = !1
if (typeof window < 'u')
  try {
    var O = Object.defineProperty({}, 'passive', {
      get: function () {
        return ((Q = !0), !0)
      },
    })
    ;(window.addEventListener('test', O, O), window.removeEventListener('test', O, O))
  } catch {
    Q = !1
  }
var P = Q ? { passive: !1 } : !1,
  et = function (e) {
    return e.tagName === 'TEXTAREA'
  },
  pe = function (e, t) {
    if (!(e instanceof Element)) return !1
    var r = window.getComputedStyle(e)
    return r[t] !== 'hidden' && !(r.overflowY === r.overflowX && !et(e) && r[t] === 'visible')
  },
  tt = function (e) {
    return pe(e, 'overflowY')
  },
  rt = function (e) {
    return pe(e, 'overflowX')
  },
  ue = function (e, t) {
    var r = t.ownerDocument,
      n = t
    do {
      typeof ShadowRoot < 'u' && n instanceof ShadowRoot && (n = n.host)
      var c = ge(e, n)
      if (c) {
        var u = ye(e, n),
          l = u[1],
          a = u[2]
        if (l > a) return !0
      }
      n = n.parentNode
    } while (n && n !== r.body)
    return !1
  },
  nt = function (e) {
    var t = e.scrollTop,
      r = e.scrollHeight,
      n = e.clientHeight
    return [t, r, n]
  },
  at = function (e) {
    var t = e.scrollLeft,
      r = e.scrollWidth,
      n = e.clientWidth
    return [t, r, n]
  },
  ge = function (e, t) {
    return e === 'v' ? tt(t) : rt(t)
  },
  ye = function (e, t) {
    return e === 'v' ? nt(t) : at(t)
  },
  ot = function (e, t) {
    return e === 'h' && t === 'rtl' ? -1 : 1
  },
  ct = function (e, t, r, n, c) {
    var u = ot(e, window.getComputedStyle(t).direction),
      l = u * n,
      a = r.target,
      w = t.contains(a),
      b = !1,
      g = l > 0,
      f = 0,
      v = 0
    do {
      if (!a) break
      var m = ye(e, a),
        S = m[0],
        o = m[1],
        s = m[2],
        d = o - s - u * S
      ;(S || d) && ge(e, a) && ((f += d), (v += S))
      var h = a.parentNode
      a = h && h.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? h.host : h
    } while ((!w && a !== document.body) || (w && (t.contains(a) || t === a)))
    return (((g && Math.abs(f) < 1) || (!g && Math.abs(v) < 1)) && (b = !0), b)
  },
  F = function (e) {
    return 'changedTouches' in e
      ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY]
      : [0, 0]
  },
  se = function (e) {
    return [e.deltaX, e.deltaY]
  },
  le = function (e) {
    return e && 'current' in e ? e.current : e
  },
  it = function (e, t) {
    return e[0] === t[0] && e[1] === t[1]
  },
  ut = function (e) {
    return `
  .block-interactivity-`
      .concat(
        e,
        ` {pointer-events: none;}
  .allow-interactivity-`,
      )
      .concat(
        e,
        ` {pointer-events: all;}
`,
      )
  },
  st = 0,
  T = []
function lt(e) {
  var t = i.useRef([]),
    r = i.useRef([0, 0]),
    n = i.useRef(),
    c = i.useState(st++)[0],
    u = i.useState(he)[0],
    l = i.useRef(e)
  ;(i.useEffect(
    function () {
      l.current = e
    },
    [e],
  ),
    i.useEffect(
      function () {
        if (e.inert) {
          document.body.classList.add('block-interactivity-'.concat(c))
          var o = Ae([e.lockRef.current], (e.shards || []).map(le), !0).filter(Boolean)
          return (
            o.forEach(function (s) {
              return s.classList.add('allow-interactivity-'.concat(c))
            }),
            function () {
              ;(document.body.classList.remove('block-interactivity-'.concat(c)),
                o.forEach(function (s) {
                  return s.classList.remove('allow-interactivity-'.concat(c))
                }))
            }
          )
        }
      },
      [e.inert, e.lockRef.current, e.shards],
    ))
  var a = i.useCallback(function (o, s) {
      if (('touches' in o && o.touches.length === 2) || (o.type === 'wheel' && o.ctrlKey))
        return !l.current.allowPinchZoom
      var d = F(o),
        h = r.current,
        p = 'deltaX' in o ? o.deltaX : h[0] - d[0],
        y = 'deltaY' in o ? o.deltaY : h[1] - d[1],
        E,
        x = o.target,
        N = Math.abs(p) > Math.abs(y) ? 'h' : 'v'
      if ('touches' in o && N === 'h' && x.type === 'range') return !1
      var $ = window.getSelection(),
        D = $ && $.anchorNode,
        Ee = D ? D === x || D.contains(x) : !1
      if (Ee) return !1
      var M = ue(N, x)
      if (!M) return !0
      if ((M ? (E = N) : ((E = N === 'v' ? 'h' : 'v'), (M = ue(N, x))), !M)) return !1
      if ((!n.current && 'changedTouches' in o && (p || y) && (n.current = E), !E)) return !0
      var J = n.current || E
      return ct(J, s, o, J === 'h' ? p : y)
    }, []),
    w = i.useCallback(function (o) {
      var s = o
      if (!(!T.length || T[T.length - 1] !== u)) {
        var d = 'deltaY' in s ? se(s) : F(s),
          h = t.current.filter(function (E) {
            return (
              E.name === s.type &&
              (E.target === s.target || s.target === E.shadowParent) &&
              it(E.delta, d)
            )
          })[0]
        if (h && h.should) {
          s.cancelable && s.preventDefault()
          return
        }
        if (!h) {
          var p = (l.current.shards || [])
              .map(le)
              .filter(Boolean)
              .filter(function (E) {
                return E.contains(s.target)
              }),
            y = p.length > 0 ? a(s, p[0]) : !l.current.noIsolation
          y && s.cancelable && s.preventDefault()
        }
      }
    }, []),
    b = i.useCallback(function (o, s, d, h) {
      var p = { name: o, delta: s, target: d, should: h, shadowParent: ft(d) }
      ;(t.current.push(p),
        setTimeout(function () {
          t.current = t.current.filter(function (y) {
            return y !== p
          })
        }, 1))
    }, []),
    g = i.useCallback(function (o) {
      ;((r.current = F(o)), (n.current = void 0))
    }, []),
    f = i.useCallback(function (o) {
      b(o.type, se(o), o.target, a(o, e.lockRef.current))
    }, []),
    v = i.useCallback(function (o) {
      b(o.type, F(o), o.target, a(o, e.lockRef.current))
    }, [])
  i.useEffect(function () {
    return (
      T.push(u),
      e.setCallbacks({ onScrollCapture: f, onWheelCapture: f, onTouchMoveCapture: v }),
      document.addEventListener('wheel', w, P),
      document.addEventListener('touchmove', w, P),
      document.addEventListener('touchstart', g, P),
      function () {
        ;((T = T.filter(function (o) {
          return o !== u
        })),
          document.removeEventListener('wheel', w, P),
          document.removeEventListener('touchmove', w, P),
          document.removeEventListener('touchstart', g, P))
      }
    )
  }, [])
  var m = e.removeScrollBar,
    S = e.inert
  return i.createElement(
    i.Fragment,
    null,
    S ? i.createElement(u, { styles: ut(c) }) : null,
    m ? i.createElement(Je, { noRelative: e.noRelative, gapMode: e.gapMode }) : null,
  )
}
function ft(e) {
  for (var t = null; e !== null; )
    (e instanceof ShadowRoot && ((t = e.host), (e = e.host)), (e = e.parentNode))
  return t
}
const dt = De(me, lt)
var vt = i.forwardRef(function (e, t) {
  return i.createElement(B, C({}, e, { ref: t, sideCar: dt }))
})
vt.classNames = B.classNames
var mt = function (e) {
    if (typeof document > 'u') return null
    var t = Array.isArray(e) ? e[0] : e
    return t.ownerDocument.body
  },
  k = new WeakMap(),
  _ = new WeakMap(),
  L = {},
  G = 0,
  be = function (e) {
    return e && (e.host || be(e.parentNode))
  },
  ht = function (e, t) {
    return t
      .map(function (r) {
        if (e.contains(r)) return r
        var n = be(r)
        return n && e.contains(n)
          ? n
          : (console.error('aria-hidden', r, 'in not contained inside', e, '. Doing nothing'), null)
      })
      .filter(function (r) {
        return !!r
      })
  },
  pt = function (e, t, r, n) {
    var c = ht(t, Array.isArray(e) ? e : [e])
    L[r] || (L[r] = new WeakMap())
    var u = L[r],
      l = [],
      a = new Set(),
      w = new Set(c),
      b = function (f) {
        !f || a.has(f) || (a.add(f), b(f.parentNode))
      }
    c.forEach(b)
    var g = function (f) {
      !f ||
        w.has(f) ||
        Array.prototype.forEach.call(f.children, function (v) {
          if (a.has(v)) g(v)
          else
            try {
              var m = v.getAttribute(n),
                S = m !== null && m !== 'false',
                o = (k.get(v) || 0) + 1,
                s = (u.get(v) || 0) + 1
              ;(k.set(v, o),
                u.set(v, s),
                l.push(v),
                o === 1 && S && _.set(v, !0),
                s === 1 && v.setAttribute(r, 'true'),
                S || v.setAttribute(n, 'true'))
            } catch (d) {
              console.error('aria-hidden: cannot operate on ', v, d)
            }
        })
    }
    return (
      g(t),
      a.clear(),
      G++,
      function () {
        ;(l.forEach(function (f) {
          var v = k.get(f) - 1,
            m = u.get(f) - 1
          ;(k.set(f, v),
            u.set(f, m),
            v || (_.has(f) || f.removeAttribute(n), _.delete(f)),
            m || f.removeAttribute(r))
        }),
          G--,
          G || ((k = new WeakMap()), (k = new WeakMap()), (_ = new WeakMap()), (L = {})))
      }
    )
  },
  bt = function (e, t, r) {
    r === void 0 && (r = 'data-aria-hidden')
    var n = Array.from(Array.isArray(e) ? e : [e]),
      c = mt(e)
    return c
      ? (n.push.apply(n, Array.from(c.querySelectorAll('[aria-live], script'))),
        pt(n, c, r, 'aria-hidden'))
      : function () {
          return null
        }
  }
export { xe as F, z as I, vt as R, Z as T, bt as h, yt as u }
