'use client'
import { useState } from 'react'
import type { NodeAnnotationLabel } from '../content/node-feature-annotations.generated'
import {
  FEATURE_TABS,
  NODE_FEATURE_IMAGE_BASE,
  NODE_FEATURE_IMAGES,
  OUTLINE_NAMES,
  READING_ITEMS,
  annotationsFor,
  type FeatureTab,
} from '../content/node-features'
import { QuestionBody } from './QuestionBody'
import course from './course.module.css'
import styles from './node-features.module.css'

/**
 * Lesson 16's two figures: an atlas of the six sonographic features on real EBUS images with the
 * owner's outlines, and an image-reading task that hides the outlines until the learner answers.
 * The outlines are drawn over the image in its own pixel space, so each crop (`view`) is only a
 * viewBox and the CVAT coordinates are used unchanged.
 */

const ORDER: NodeAnnotationLabel[] = [
  'node',
  'chs',
  'cns',
  'distinct-margin',
  'indistinct-margin',
  'long-axis',
  'short-axis',
]

function Outline({
  label,
  kind,
  points,
}: {
  label: NodeAnnotationLabel
  kind: 'polygon' | 'polyline'
  points: [number, number][]
}) {
  const d = points.map(([x, y]) => x + ',' + y).join(' ')
  if (label === 'long-axis' || label === 'short-axis') {
    const [[x1, y1], [x2, y2]] = [points[0], points[points.length - 1]]
    return (
      <g data-outline={label}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" />
        <circle cx={x1} cy={y1} r={3} />
        <circle cx={x2} cy={y2} r={3} />
      </g>
    )
  }
  return kind === 'polygon' ? (
    <polygon data-outline={label} points={d} vectorEffect="non-scaling-stroke" />
  ) : (
    <polyline data-outline={label} points={d} vectorEffect="non-scaling-stroke" />
  )
}

export function NodeImage({
  slug,
  layers,
  outlines,
  label,
}: {
  slug: string
  layers: NodeAnnotationLabel[]
  outlines: boolean
  label: string
}) {
  const image = NODE_FEATURE_IMAGES[slug]
  const annotation = annotationsFor(slug)
  const [x, y, w, h] = image.view
  const shapes = annotation.shapes
    .filter((shape) => layers.includes(shape.label))
    .sort((a, b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label))
  return (
    <svg
      className={styles.image}
      viewBox={`${x} ${y} ${w} ${h}`}
      role="img"
      aria-label={label}
      data-node-image={slug}
      data-outlines={outlines ? 'shown' : 'hidden'}
    >
      <image
        href={NODE_FEATURE_IMAGE_BASE + slug + '.jpg'}
        x={0}
        y={0}
        width={annotation.width}
        height={annotation.height}
      />
      {outlines && shapes.map((shape, i) => <Outline key={shape.label + i} {...shape} />)}
    </svg>
  )
}

function Legend({ layers }: { layers: NodeAnnotationLabel[] }) {
  const shown = ORDER.filter((label) => layers.includes(label))
  return (
    <ul className={styles.legend} data-node-legend>
      {shown.map((label) => (
        <li key={label}>
          <span className={styles.swatch} data-swatch={label} aria-hidden="true" />
          {OUTLINE_NAMES[label]}
        </li>
      ))}
    </ul>
  )
}

function OutlineToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      className={course.secondary}
      aria-pressed={on}
      data-outline-toggle
      onClick={() => onChange(!on)}
    >
      {on ? 'Hide outlines' : 'Show outlines'}
    </button>
  )
}

/** The briefing figure: one tab per feature, one or two real examples each. */
export function NodeFeatureAtlas() {
  const [tabId, setTabId] = useState<FeatureTab['id']>(FEATURE_TABS[0].id)
  const [exampleIndex, setExampleIndex] = useState(0)
  const [outlines, setOutlines] = useState(true)
  const tab = FEATURE_TABS.find((entry) => entry.id === tabId)!
  const example = tab.examples[Math.min(exampleIndex, tab.examples.length - 1)]
  const station = NODE_FEATURE_IMAGES[example.slug].station
  return (
    <figure className={styles.atlas} data-node-atlas>
      <div className={styles.tabs} role="tablist" aria-label="Sonographic features">
        {FEATURE_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={'node-feature-tab-' + entry.id}
            aria-selected={entry.id === tabId}
            aria-controls="node-feature-panel"
            data-feature-tab={entry.id}
            onClick={() => {
              setTabId(entry.id)
              setExampleIndex(0)
            }}
          >
            {entry.title}
          </button>
        ))}
      </div>
      <div
        id="node-feature-panel"
        role="tabpanel"
        aria-labelledby={'node-feature-tab-' + tab.id}
        className={styles.panel}
        data-feature-panel={tab.id}
      >
        <p className={styles.definition}>
          <strong>{tab.title}.</strong> {tab.definition}
        </p>
        <p className={styles.meaning}>{tab.meaning}</p>
        <div className={styles.toolbar}>
          {tab.examples.length > 1 && (
            <div className={styles.examples} role="group" aria-label="Examples">
              {tab.examples.map((entry, i) => (
                <button
                  key={entry.slug}
                  type="button"
                  className={course.secondary}
                  aria-pressed={entry === example}
                  data-example={entry.slug}
                  onClick={() => setExampleIndex(i)}
                >
                  {exampleName(tab, i)}
                </button>
              ))}
            </div>
          )}
          <OutlineToggle on={outlines} onChange={setOutlines} />
        </div>
        <NodeImage
          key={example.slug}
          slug={example.slug}
          layers={example.layers}
          outlines={outlines}
          label={`Linear EBUS image at station ${station}, transducer at the top. ${example.caption}`}
        />
        <figcaption className={styles.caption}>{example.caption}</figcaption>
        {outlines && <Legend layers={example.layers} />}
      </div>
    </figure>
  )
}

/** Short names for the example buttons, from what each example shows. */
function exampleName(tab: FeatureTab, index: number) {
  const names: Partial<Record<FeatureTab['id'], string[]>> = {
    'size-shape': ['Oval', 'Round'],
    margin: ['Distinct', 'Indistinct'],
    echogenicity: ['Homogeneous', 'Heterogeneous'],
  }
  return names[tab.id]?.[index] ?? 'Example ' + (index + 1)
}

/**
 * The image-reading task: eight real nodes, one question each about the feature the image was
 * chosen to show. Outlines appear once the learner checks an answer or opens the explanation.
 * Nothing here is recorded or required; the lesson's own Continue stays available throughout.
 */
export function NodeFeatureReading() {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [committed, setCommitted] = useState<Record<string, string | undefined>>({})
  const [explained, setExplained] = useState<Record<string, boolean>>({})
  const item = READING_ITEMS[index]
  const id = item.question.id
  const revealed = !!committed[id] || !!explained[id]
  const station = NODE_FEATURE_IMAGES[item.slug].station
  const answeredCount = READING_ITEMS.filter((entry) => committed[entry.question.id]).length
  const last = index === READING_ITEMS.length - 1
  return (
    <section className={styles.reading} data-node-reading aria-label="Read the features">
      <header className={styles.readingHeader}>
        <p>
          <strong>
            Image {index + 1} of {READING_ITEMS.length}
          </strong>
          <span className={course.muted}> · {answeredCount} answered</span>
        </p>
        <div className={styles.readingNav}>
          <button
            type="button"
            className={course.secondary}
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            Previous image
          </button>
          <button
            type="button"
            className={revealed && !last ? course.button : course.secondary}
            disabled={last}
            data-next-image
            onClick={() => setIndex(index + 1)}
          >
            Next image
          </button>
        </div>
      </header>
      <div className={styles.readingBody}>
        <div className={styles.readingImage}>
          <NodeImage
            key={item.slug}
            slug={item.slug}
            layers={item.layers}
            outlines={revealed}
            label={`Linear EBUS image at station ${station}, transducer at the top.`}
          />
          {revealed ? (
            <Legend layers={item.layers} />
          ) : (
            <p className={course.muted} data-outlines-hidden>
              The outlines appear when you check your answer.
            </p>
          )}
        </div>
        <div className={styles.readingQuestion}>
          <QuestionBody
            key={id}
            question={item.question}
            selected={selected[id] ?? ''}
            committed={committed[id]}
            onSelect={(choice) => setSelected((all) => ({ ...all, [id]: choice }))}
            onCheck={() => setCommitted((all) => ({ ...all, [id]: selected[id] }))}
            onRetry={() => {
              setCommitted((all) => ({ ...all, [id]: undefined }))
              setSelected((all) => ({ ...all, [id]: '' }))
            }}
            onExplanationChange={(open) => setExplained((all) => ({ ...all, [id]: open }))}
            verdictFrames={{
              best: 'That is what this image shows',
              'incorrect-mechanism': 'Look at the image again',
              unsafe: 'Look at the image again',
            }}
          />
          {last && revealed && (
            <p className={course.muted} data-reading-done>
              That was the last image. Continue below when you are ready.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
