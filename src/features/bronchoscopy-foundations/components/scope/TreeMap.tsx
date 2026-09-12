'use client'

import type { Vec3 } from '@/lib/airway-anatomy/types'

import styles from './scope-fallback.module.css'
import { treePinLayout, MAP_WIDTH, MAP_HEIGHT } from './treePinLayout'
import {
  SCOPE_DOM,
  treeChoiceInputId,
  type AirwayLabel,
  type AirwayMapGeometry,
  type TreeAnswer,
} from './types'

/**
 * The airway map: the case's coronal projection as SVG, lit per step, with one pin per airway
 * over it and a marker where the tip is.
 *
 * The SVG is decoration (`aria-hidden`); the pins and the caption strip carry the meaning. A pin
 * is an HTML element positioned over the drawing by its map coordinate as a share of the viewBox,
 * so the box keeps the viewBox's aspect and the pins stay on their airways at any width. When a
 * prediction is open on the tree, the pin of an airway a choice names becomes a `<label>` for
 * that choice's radio (which lives in `TreeAnswerFieldset`); the pin points at it and nothing
 * more. The y axis is the projection's own: superior is already at the top.
 */
export interface TreeMapProps {
  readonly map: AirwayMapGeometry | null
  readonly lit: readonly AirwayLabel[]
  readonly current: AirwayLabel | null
  readonly tipLps: Vec3 | null
  readonly treeAnswer?: TreeAnswer
}

const TIP_RADIUS = 2.5

export function TreeMap({ map, lit, current, tipLps, treeAnswer }: TreeMapProps) {
  if (!map) {
    return (
      <div
        className={styles.map}
        role="group"
        aria-label="The airway map"
        {...{ [SCOPE_DOM.map]: '' }}
      >
        <p className={styles.loading} role="status">
          The airway map is loading…
        </p>
      </div>
    )
  }
  const layout = treePinLayout(map)
  const litSet = new Set<AirwayLabel>(lit)
  const tip = tipLps ? map.project(tipLps) : null
  return (
    <div
      className={styles.map}
      role="group"
      aria-label="The airway map"
      {...{ [SCOPE_DOM.map]: '' }}
    >
      <div className={styles.mapBox} style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>
        <svg
          className={styles.mapSvg}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          <g transform={layout.transform}>
            {map.paths.map((path, index) => (
              <path
                key={`${path.label ?? 'unlabeled'}-${index}`}
                d={path.d}
                strokeWidth={path.widthMm}
                data-airway-path={path.label ?? 'unlabeled'}
                data-lit={path.label && litSet.has(path.label) ? 'true' : undefined}
              />
            ))}
            {tip ? (
              <circle
                className={styles.mapTip}
                cx={tip[0]}
                cy={tip[1]}
                r={TIP_RADIUS}
                data-scope-tip=""
              />
            ) : null}
          </g>
          {layout.pins.map((pin) => (
            <path
              key={pin.label}
              className={styles.mapLeader}
              d={`M${pin.anchor[0]},${pin.anchor[1]} L${pin.x},${pin.y}`}
            />
          ))}
        </svg>
        {layout.pins.map(({ label, x, y }) => {
          const choice = treeAnswer?.choices.find((candidate) => candidate.airway === label)
          const shared = {
            className: styles.mapPin,
            style: { left: `${(x / MAP_WIDTH) * 100}%`, top: `${(y / MAP_HEIGHT) * 100}%` },
            'aria-current': label === current ? ('location' as const) : undefined,
            'data-lit': litSet.has(label) ? 'true' : undefined,
            [SCOPE_DOM.pin]: label,
          }
          return choice ? (
            <label key={label} htmlFor={treeChoiceInputId(treeAnswer!.name, choice.id)} {...shared}>
              {label}
            </label>
          ) : (
            <span key={label} {...shared}>
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
