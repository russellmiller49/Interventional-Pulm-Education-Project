import { Link } from '@/i18n/navigation'

import { airwayDisplayName, TEACHING_TREE } from '../../content/airwayTree'
import { SCOPE_CONTROL_PANEL } from '../../content/controlPanel'
import { BRONCH_GRAMMAR, GRAMMAR_TREND_RULE } from '../../content/grammar'
import { LOCAL_POLICIES, LOCAL_POLICY_NOT_CONFIGURED } from '../../content/localPolicies'
import { bronchSection } from '../../content/pathway'
import { bronchSectionLinkTarget } from '../../content/pathwayResolver'
import { BRONCHOSCOPY_FOUNDATIONS_ATLAS_HREF } from '../../content/routes'
import { SPINE_STOPS } from '../../content/spine'
import { SOURCES } from '../../data/sources'
import styles from '../bronchoscopy-foundations-hub.module.css'

const KICKER = 'text-xs font-bold uppercase tracking-[0.18em] text-primary'
const CARD = 'rounded-3xl border bg-card p-6 shadow-sm lg:p-8'

const REFERENCE_SECTIONS = [
  { id: 'airway-names', title: 'Airway names' },
  { id: 'airway-spine', title: 'The airway map' },
  { id: 'five-controls', title: 'The five controls' },
  { id: 'reading-the-view', title: 'Reading the view' },
  { id: 'local-policies', title: 'Local policies' },
  { id: 'sources', title: 'Sources' },
] as const

/**
 * The reference: the tables a learner wants beside the procedure, read straight from the
 * registries. Server-safe — no hooks, no record — so it renders the same for everyone. Every
 * section is anchored, and the atlas of endoscopic stills has a page of its own.
 */
export function BronchoscopyFoundationsReference() {
  const nodeById = new Map(TEACHING_TREE.map((node) => [node.id, node] as const))
  return (
    <div
      className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:px-8"
      data-reference
    >
      <div className="grid gap-3">
        <p className={KICKER}>Reference</p>
        <h1 className="text-3xl font-bold tracking-tight">Tables, template, glossary, sources</h1>
        <p className="text-sm text-muted-foreground" data-review-status>
          Authored teaching content, pending clinical review.
        </p>
        <nav aria-label="Reference sections" className="flex flex-wrap gap-2 text-sm">
          {REFERENCE_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border px-3 py-1 font-semibold"
            >
              {section.title}
            </a>
          ))}
          <Link
            href={BRONCHOSCOPY_FOUNDATIONS_ATLAS_HREF}
            className="rounded-full border px-3 py-1 font-semibold text-primary"
            data-atlas-link
          >
            Airway atlas →
          </Link>
        </nav>
      </div>

      <section id="airway-names" aria-labelledby="ref-names-heading" className={CARD}>
        <p className={KICKER}>Airway names</p>
        <h2 id="ref-names-heading" className="mt-2 text-2xl font-bold">
          One label, one name, one parent
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The teaching tree, in the order the model lists it. The two basal groups are teaching
          groupings and carry no label.
        </p>
        <div className={`${styles.tableWrap} mt-5`}>
          <table data-airway-names>
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Name</th>
                <th scope="col">Parent</th>
              </tr>
            </thead>
            <tbody>
              {TEACHING_TREE.map((node) => {
                const parent = node.parentId ? nodeById.get(node.parentId) : null
                return (
                  <tr key={node.id} data-airway-row={node.id}>
                    <td className="font-semibold">{node.label ?? '—'}</td>
                    <td>{node.label ? airwayDisplayName(node.label) : node.requiredName}</td>
                    <td className="text-muted-foreground">{parent?.requiredName ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="airway-spine" aria-labelledby="ref-spine-heading" className={CARD}>
        <p className={KICKER}>The airway map</p>
        <h2 id="ref-spine-heading" className="mt-2 text-2xl font-bold">
          From the larynx to the segments
        </h2>
        <ol className="mt-5 grid gap-4">
          {SPINE_STOPS.map((stop) => (
            <li
              key={stop.id}
              className="rounded-2xl border bg-muted/20 p-4"
              data-spine-stop={stop.id}
            >
              <p className="font-semibold">{stop.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{stop.precise}</p>
              <p className="mt-2 text-sm font-semibold">{stop.checklistLabel}</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                {stop.checklist.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section id="five-controls" aria-labelledby="ref-controls-heading" className={CARD}>
        <p className={KICKER}>The five controls</p>
        <h2 id="ref-controls-heading" className="mt-2 text-2xl font-bold">
          What you control, and what is only monitoring
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {SCOPE_CONTROL_PANEL.sentence}
        </p>
        <div className={`${styles.tableWrap} mt-5`}>
          <table data-control-panel>
            <thead>
              <tr>
                <th scope="col">Control</th>
                <th scope="col">Changes</th>
                <th scope="col">Does not change</th>
              </tr>
            </thead>
            <tbody>
              {SCOPE_CONTROL_PANEL.controls.map((control) => (
                <tr key={control.id} data-control={control.id}>
                  <td className="font-semibold">{control.plainName}</td>
                  <td>{control.changes}</td>
                  <td className="text-muted-foreground">{control.doesNotChange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
          {SCOPE_CONTROL_PANEL.monitoring.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border bg-muted/20 p-4"
              data-monitoring={entry.id}
            >
              <dt className="font-semibold">{entry.plainName}</dt>
              <dd className="mt-1 text-muted-foreground">{entry.sentence}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="reading-the-view" aria-labelledby="ref-view-heading" className={CARD}>
        <p className={KICKER}>Reading the view</p>
        <h2 id="ref-view-heading" className="mt-2 text-2xl font-bold">
          What you see, where it lives, what to check
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-grammar-trend-rule>
          {GRAMMAR_TREND_RULE}
        </p>
        <div className={`${styles.tableWrap} mt-5`}>
          <table data-grammar>
            <thead>
              <tr>
                <th scope="col">You see</th>
                <th scope="col">Where it lives</th>
                <th scope="col">Shortlist</th>
                <th scope="col">Taught in</th>
              </tr>
            </thead>
            <tbody>
              {BRONCH_GRAMMAR.map((row) => (
                <tr key={row.id} data-grammar-row={row.id}>
                  <td className="font-semibold">{row.see}</td>
                  <td>{row.lives}</td>
                  <td className="text-muted-foreground">{row.shortlist.join(' · ')}</td>
                  <td>
                    <Link
                      className="font-semibold text-primary"
                      href={bronchSectionLinkTarget(row.taughtIn)}
                    >
                      {bronchSection(row.taughtIn).shortTitle}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="local-policies" aria-labelledby="ref-policies-heading" className={CARD}>
        <p className={KICKER}>Local policies</p>
        <h2 id="ref-policies-heading" className="mt-2 text-2xl font-bold">
          What this course leaves to your institution
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-policy-not-configured>
          {LOCAL_POLICY_NOT_CONFIGURED}
        </p>
        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
          {LOCAL_POLICIES.map((policy) => (
            <div
              key={policy.id}
              className="rounded-2xl border bg-muted/20 p-4"
              data-local-policy={policy.id}
            >
              <dt className="font-semibold">{policy.title}</dt>
              <dd className="mt-1 text-muted-foreground">{policy.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="sources" aria-labelledby="ref-sources-heading" className={CARD}>
        <p className={KICKER}>Sources</p>
        <h2 id="ref-sources-heading" className="mt-2 text-2xl font-bold">
          What each source supports, and where it stops
        </h2>
        <ol className="mt-5 grid gap-3 text-sm leading-6">
          {SOURCES.map((source, index) => (
            <li
              key={source.id}
              className="rounded-2xl border bg-muted/20 p-4"
              data-source-id={source.id}
            >
              <p>
                <span className="mr-2 text-xs font-bold text-primary">{index + 1}</span>
                <span className="font-semibold">{source.title}</span>
                {source.byline ? ` ${source.byline}` : ''}
                {source.year ? ` ${source.year}.` : ''}{' '}
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-primary"
                  >
                    Open
                  </a>
                ) : null}
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong>{source.kindLabel}.</strong>
                {source.usedFor ? ` Used for: ${source.usedFor}` : ''}{' '}
                {source.limitation ? (
                  <>
                    <strong>Limit.</strong> {source.limitation}
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
