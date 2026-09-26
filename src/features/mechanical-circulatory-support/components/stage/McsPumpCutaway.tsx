import styles from './mcs-flow.module.css'

/*
 * Where the labels point. Every label is drawn in a clear column beside the drawing and joined to
 * its part by a leader line that ends on the part's own coordinates, which are the same numbers the
 * parts below are drawn from. The inlet and outlet are the two ends of the pump, and the valve is
 * the pair of leaflets at the ventricle–aorta junction.
 *
 * The labels used to float: "LV cavity / Inlet →" sat far to the left of the inlet, "← Outlet" and
 * "← Aortic valve" pointed at open space, and "Dashed: insertion direction" — a legend — sat where a
 * part label would, while the orange and teal lines were explained nowhere (F23). The line meanings
 * are now a legend under the drawing, in line style, colour and words.
 */
const INLET = { x: 250, y: 224 } as const
const OUTLET = { x: 321, y: 51 } as const
const VALVE = { x: 238, y: 119 } as const

export function McsPumpCutaway() {
  return (
    <figure data-pump-cutaway tabIndex={0} aria-label="Conceptual pump cutaway scroll area">
      <svg
        viewBox="0 0 600 300"
        className={styles.cutaway}
        role="img"
        aria-label="Conceptual cutaway of an aligned left-sided microaxial pump. The pump lies across the aortic valve: its inlet is inside the left ventricular cavity and its outlet is in the ascending aorta. Blood flows from the inlet up through the pump to the outlet; the catheter was inserted in the opposite direction, from the aorta."
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
          <marker
            id="mcs-cutaway-insertion"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 Z" fill="#b8cccf" />
          </marker>
        </defs>
        <path
          d="M225 112 C125 150 140 265 240 277 C338 274 350 178 291 111"
          fill="#17343a"
          stroke="#e6969a"
          strokeWidth="12"
          data-cutaway-part="ventricle"
        />
        <path
          d="M225 112 L225 50 Q227 25 252 25 H360 M291 112 V88 Q292 76 310 76 H360"
          fill="none"
          stroke="#e6969a"
          strokeWidth="12"
          data-cutaway-part="aorta"
        />
        <path
          d="M228 112 L250 126 M291 112 L272 126"
          stroke="#eaf4f4"
          strokeWidth="4"
          data-cutaway-part="valve"
        />
        <path
          d="M250 224 V158 Q250 73 321 51"
          stroke="#ffbf62"
          strokeWidth="12"
          fill="none"
          data-cutaway-part="pump"
        />
        <path
          d="M241 217 V159 Q241 82 305 62"
          stroke="#71e1e5"
          strokeWidth="3"
          fill="none"
          markerEnd="url(#mcs-cutaway-flow)"
          data-cutaway-part="blood-flow"
        />
        <path
          d="M374 56 Q287 70 273 211"
          stroke="#b8cccf"
          strokeWidth="2"
          strokeDasharray="7 5"
          fill="none"
          markerEnd="url(#mcs-cutaway-insertion)"
          data-cutaway-part="insertion-direction"
        />
        <circle cx={INLET.x} cy={INLET.y} r="7" fill="#061519" stroke="#ffbf62" strokeWidth="3" />
        <circle cx={OUTLET.x} cy={OUTLET.y} r="7" fill="#ffbf62" />
        <g stroke="#eaf4f4" strokeWidth="1.5" fill="none" data-cutaway-leaders>
          <path d={`M104 48 L${OUTLET.x - 9} ${OUTLET.y}`} data-leader="outlet" />
          <path d={`M112 116 L${VALVE.x - 6} ${VALVE.y}`} data-leader="valve" />
          <path d={`M104 226 L${INLET.x - 9} ${INLET.y}`} data-leader="inlet" />
        </g>
        <g fill="#eaf4f4" fontSize="16" data-cutaway-labels>
          <text x="10" y="44" data-label-for="outlet">
            Outlet
          </text>
          <text x="10" y="63" fontSize="13" fill="#b8cccf">
            in the aorta
          </text>
          <text x="10" y="121" data-label-for="valve">
            Aortic valve
          </text>
          <text x="10" y="222" data-label-for="inlet">
            Inlet
          </text>
          <text x="10" y="241" fontSize="13" fill="#b8cccf">
            in the LV cavity
          </text>
          <text x="372" y="18" data-label-for="aorta">
            Ascending aorta
          </text>
          <text x="352" y="262" data-label-for="ventricle">
            Left ventricle
          </text>
        </g>
      </svg>
      <ul className={styles.cutawayLegend} aria-label="What the lines mean" data-cutaway-legend>
        <li>
          <svg viewBox="0 0 40 12" aria-hidden="true" focusable="false">
            <path d="M2 6 H38" stroke="#ffbf62" strokeWidth="6" />
          </svg>
          Thick orange line: the pump, open circle its inlet, filled circle its outlet
        </li>
        <li>
          <svg viewBox="0 0 40 12" aria-hidden="true" focusable="false">
            <path d="M2 6 H32" stroke="#71e1e5" strokeWidth="2.5" />
            <path d="M31 2 L38 6 L31 10 Z" fill="#71e1e5" />
          </svg>
          Thin teal line with arrow: blood flow, from inlet to outlet
        </li>
        <li>
          <svg viewBox="0 0 40 12" aria-hidden="true" focusable="false">
            <path d="M2 6 H32" stroke="#b8cccf" strokeWidth="2" strokeDasharray="5 4" />
            <path d="M31 2 L38 6 L31 10 Z" fill="#b8cccf" />
          </svg>
          Dashed grey line with arrow: the direction the catheter was inserted, from the aorta
        </li>
      </ul>
      <figcaption>
        Aligned conceptual reference · not to scale. Blood flow and catheter insertion run in
        different directions. No insertion depth or manipulation technique is represented.
      </figcaption>
    </figure>
  )
}
