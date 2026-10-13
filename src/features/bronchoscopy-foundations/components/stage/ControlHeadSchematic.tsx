import { useId } from 'react'
import styles from './bronch-stage.module.css'

/** Paired views expose the rear thumb lever without implying it is on the front face. */
export function ControlHeadSchematic() {
  const prefix = useId().replace(/:/g, '')
  return (
    <div className={styles.controlSchematic} data-control-schematic>
      {(['rear', 'front'] as const).map((side) => {
        const id = `${prefix}-${side}`
        const rear = side === 'rear'
        return (
          <figure key={side} className={styles.controlSchematicView}>
            <figcaption>{rear ? 'Rear · thumb side' : 'Front · index-finger side'}</figcaption>
            <svg viewBox="0 0 360 305" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
              <title id={`${id}-title`}>
                {rear
                  ? 'Angulation lever on the rear of the control section'
                  : 'Suction valve and working-channel port on the front'}
              </title>
              <desc id={`${id}-desc`}>
                {rear
                  ? 'Rear view of a bronchoscope handle. The highlighted paddle is the thumb-operated angulation lever on the back of the scope.'
                  : 'Front view of the same handle. The index finger presses the suction valve near the top. Instruments enter the working-channel port farther down the handle.'}
              </desc>
              <defs>
                <linearGradient id={`${id}-body`} x1="0" x2="1">
                  <stop offset="0" stopColor="#26343d" />
                  <stop offset="0.35" stopColor="#53616a" />
                  <stop offset="0.7" stopColor="#34434d" />
                  <stop offset="1" stopColor="#18262f" />
                </linearGradient>
                <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#d5dfe3" />
                  <stop offset="0.48" stopColor="#82959f" />
                  <stop offset="1" stopColor="#465b66" />
                </linearGradient>
                <linearGradient id={`${id}-control`} x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#aedbdb" />
                  <stop offset="1" stopColor="#377d86" />
                </linearGradient>
              </defs>
              {/* Universal cord exits the upper shoulder; insertion tube exits the grip below. */}
              <path
                d={rear ? 'M134 78 C110 66 122 27 78 20' : 'M223 78 C247 66 235 27 279 20'}
                fill="none"
                stroke="#25343e"
                strokeWidth="19"
              />
              <path
                d={rear ? 'M134 74 C110 64 120 27 78 17' : 'M223 74 C247 64 237 27 279 17'}
                fill="none"
                stroke="#6b7a84"
                strokeWidth="3"
              />
              <path
                d="M195 255 C196 269 204 277 207 289"
                fill="none"
                stroke="#24343e"
                strokeWidth="12"
              />
              <path
                d="M129 73 Q133 51 157 45 L194 45 Q214 47 225 66 L229 104 Q226 124 215 136 L207 236 Q207 252 193 258 L175 257 Q164 253 162 237 L153 149 Q151 135 139 121 Q124 103 129 73Z"
                fill={`url(#${id}-body)`}
                stroke="#1a2c37"
                strokeWidth="2"
              />
              <path
                d="M155 143 L166 235 Q168 250 179 251"
                fill="none"
                stroke="#8b9ba5"
                strokeWidth="2"
                opacity="0.75"
              />
              <path
                d="M210 144 L200 235"
                fill="none"
                stroke="#101f29"
                strokeWidth="3"
                opacity="0.55"
              />
              <path
                d="M167 236 Q185 243 206 237 L204 251 Q185 260 172 252Z"
                fill="#1c2c36"
                stroke="#647781"
              />
              <path
                d="M173 241 L175 251 M181 243 L182 254 M189 244 L189 255 M198 242 L196 253"
                stroke="#566a77"
                strokeWidth="2"
              />
              {rear ? (
                <>
                  <path
                    d="M145 65 Q174 52 206 68 L213 103 Q191 124 151 105Z"
                    fill="#283b47"
                    stroke="#728691"
                  />
                  <ellipse
                    cx="178"
                    cy="94"
                    rx="23"
                    ry="19"
                    fill={`url(#${id}-rim)`}
                    stroke="#142731"
                    strokeWidth="2"
                  />
                  <ellipse cx="178" cy="94" rx="15" ry="12" fill="#243842" />
                  <path
                    d="M169 101 L150 84 L135 64 Q131 57 137 52 L150 48 Q156 47 160 55 L174 76 L188 88 Q194 95 186 102 Q178 108 169 101Z"
                    fill={`url(#${id}-control)`}
                    stroke="#175c68"
                    strokeWidth="2"
                  />
                  <path
                    d="M141 58 L151 55 M144 64 L155 61 M148 70 L159 67"
                    stroke="#ecf7f6"
                    strokeWidth="2"
                  />
                  <path d="M151 131 Q179 140 213 129" fill="none" stroke="#7f929b" opacity="0.5" />
                  <path d="M141 67 H91" fill="none" stroke="#257c87" strokeWidth="1.5" />
                  <circle cx="141" cy="67" r="3.5" fill="#fff" stroke="#257c87" strokeWidth="2" />
                  <circle cx="74" cy="67" r="16" fill="#f2f7f8" stroke="#257c87" strokeWidth="2" />
                  <text
                    x="74"
                    y="73"
                    textAnchor="middle"
                    fill="#163e4a"
                    fontSize="18"
                    fontWeight="600"
                  >
                    1
                  </text>
                </>
              ) : (
                <>
                  <path
                    d="M160 53 Q188 46 212 63 L218 96 Q193 111 163 94Z"
                    fill="#344852"
                    stroke="#6e828d"
                  />
                  <rect
                    x="176"
                    y="61"
                    width="18"
                    height="13"
                    rx="4"
                    fill="#1b2e38"
                    stroke="#6e828d"
                  />
                  <rect
                    x="198"
                    y="66"
                    width="13"
                    height="13"
                    rx="4"
                    fill="#1b2e38"
                    stroke="#6e828d"
                  />
                  {/* Suction valve protrudes from the upper front; the rear lever is not drawn here. */}
                  <path
                    d="M136 85 L120 77 Q107 76 103 89 L108 109 Q115 120 130 119 L149 111Z"
                    fill={`url(#${id}-rim)`}
                    stroke="#243c48"
                    strokeWidth="2"
                  />
                  <ellipse
                    cx="117"
                    cy="94"
                    rx="20"
                    ry="22"
                    transform="rotate(-24 117 94)"
                    fill="#293e49"
                    stroke="#142d38"
                    strokeWidth="2"
                  />
                  <ellipse
                    cx="113"
                    cy="91"
                    rx="13"
                    ry="15"
                    transform="rotate(-24 113 91)"
                    fill={`url(#${id}-control)`}
                    stroke="#9ac8cc"
                    strokeWidth="2"
                  />
                  {/* Separate instrument entry on the lower front of the grip. */}
                  <path
                    d="M176 177 L157 169 Q145 175 150 190 L170 211 L189 203Z"
                    fill={`url(#${id}-rim)`}
                    stroke="#1b3541"
                    strokeWidth="2"
                  />
                  <ellipse
                    cx="159"
                    cy="181"
                    rx="18"
                    ry="20"
                    transform="rotate(-26 159 181)"
                    fill="#233c46"
                    stroke="#599da5"
                    strokeWidth="3"
                  />
                  <ellipse
                    cx="156"
                    cy="178"
                    rx="8"
                    ry="10"
                    transform="rotate(-26 156 178)"
                    fill="#0c242f"
                    stroke="#a4c9cc"
                    strokeWidth="2"
                  />
                  <path
                    d="M105 91 H66 M157 178 H278"
                    fill="none"
                    stroke="#257c87"
                    strokeWidth="1.5"
                  />
                  <circle cx="105" cy="91" r="3.5" fill="#fff" stroke="#257c87" strokeWidth="2" />
                  <circle cx="157" cy="178" r="3.5" fill="#fff" stroke="#257c87" strokeWidth="2" />
                  <circle cx="49" cy="91" r="16" fill="#f2f7f8" stroke="#257c87" strokeWidth="2" />
                  <circle
                    cx="295"
                    cy="178"
                    r="16"
                    fill="#f2f7f8"
                    stroke="#257c87"
                    strokeWidth="2"
                  />
                  <text
                    x="49"
                    y="97"
                    textAnchor="middle"
                    fill="#163e4a"
                    fontSize="18"
                    fontWeight="600"
                  >
                    2
                  </text>
                  <text
                    x="295"
                    y="184"
                    textAnchor="middle"
                    fill="#163e4a"
                    fontSize="18"
                    fontWeight="600"
                  >
                    3
                  </text>
                </>
              )}
            </svg>
            <dl className={styles.controlSchematicKey}>
              {(rear
                ? [{ number: 1, label: 'Angulation lever', action: 'Thumb controls tip bend' }]
                : [
                    { number: 2, label: 'Suction valve', action: 'Index finger applies suction' },
                    { number: 3, label: 'Working-channel port', action: 'Entry for instruments' },
                  ]
              ).map(({ number, label, action }) => (
                <div key={number}>
                  <dt>
                    <span aria-hidden="true">{number}</span>
                    {label}
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </figure>
        )
      })}
    </div>
  )
}
