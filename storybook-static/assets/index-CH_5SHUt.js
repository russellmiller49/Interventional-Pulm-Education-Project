import { r as s, u, R as o } from './iframe-AbuOJf2D.js'
var c = o[' useId '.trim().toString()] || (() => {}),
  n = 0
function i(t) {
  const [r, a] = s.useState(c())
  return (
    u(() => {
      a((e) => e ?? String(n++))
    }, [t]),
    t || (r ? `radix-${r}` : '')
  )
}
export { i as u }
