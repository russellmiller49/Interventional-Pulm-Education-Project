import styles from './mcs-flow.module.css'

/** Conceptual aligned reference, never a rendering of an independent placement fault. */
export function McsPumpCutaway() {
  return (
    <figure data-pump-cutaway tabIndex={0} aria-label="Conceptual pump cutaway scroll area">
      <svg
        viewBox="0 0 600 300"
        className={styles.cutaway}
        role="img"
        aria-label="Conceptual cutaway of aligned left pump: inlet in the LV cavity, across the aortic valve, outlet in the ascending aorta. Solid arrows show blood flow; the dashed arrow shows the opposite catheter insertion direction."
      >
        <defs>
          <marker
            id="mcs-cutaway-flow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 Z" fill="#71e1e5" />
          </marker>
        </defs>
        <path
          d="M225 112 C125 150 140 265 240 277 C338 274 350 178 291 111"
          fill="#17343a"
          stroke="#e6969a"
          strokeWidth="12"
        />
        <path
          d="M225 112 L225 50 Q227 25 252 25 H360 M291 112 V88 Q292 76 310 76 H360"
          fill="none"
          stroke="#e6969a"
          strokeWidth="12"
        />
        <path d="M228 112 L250 126 M291 112 L272 126" stroke="#eaf4f4" strokeWidth="4" />
        <path d="M250 224 V158 Q250 73 321 51" stroke="#ffbf62" strokeWidth="12" fill="none" />
        <path
          d="M241 217 V159 Q241 82 305 62"
          stroke="#71e1e5"
          strokeWidth="3"
          fill="none"
          markerEnd="url(#mcs-cutaway-flow)"
        />
        <path
          d="M374 56 Q287 70 273 211"
          stroke="#b8cccf"
          strokeWidth="2"
          strokeDasharray="7 5"
          fill="none"
          markerEnd="url(#mcs-cutaway-flow)"
        />
        <g fill="#eaf4f4" fontSize="16">
          <text x="32" y="209">
            LV cavity
          </text>
          <text x="28" y="236">
            Inlet →
          </text>
          <text x="378" y="41">
            Ascending aorta
          </text>
          <text x="378" y="75">
            ← Outlet
          </text>
          <text x="352" y="133">
            ← Aortic valve
          </text>
          <text x="350" y="236">
            Dashed: insertion direction
          </text>
        </g>
      </svg>
      <figcaption>
        Aligned conceptual reference · not to scale. Blood flow and catheter insertion run in
        different directions. No insertion depth or manipulation technique is represented.
      </figcaption>
    </figure>
  )
}
