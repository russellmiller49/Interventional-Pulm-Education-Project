'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import {
  Activity,
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  Compass,
  EyeOff,
  FileClock,
  Gauge,
  Languages,
  Layers3,
  LockKeyhole,
  MonitorCog,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { HandoffContent } from '@/i18n/handoff'

import {
  baxterCrrtPathways,
  baxterCrrtPublicationStatus,
  getBaxterCrrtPathway,
  prismaxDraftDeviceProfile,
  type BaxterCrrtPathwayId,
} from '../content'
import { SourcesPanel } from './SourcesPanel'
import styles from './baxter-crrt.module.css'

const selectablePathwayIds = baxterCrrtPathways
  .filter((pathway) => pathway.status === 'scaffold')
  .map((pathway) => pathway.id)

const pathwayIcons = {
  orientation: Compass,
  learn: BookOpen,
  practice: ClipboardCheck,
  mastery: LockKeyhole,
} as const

const reasoningSteps = [
  'Read',
  'Define',
  'Select',
  'Predict',
  'Run',
  'Reassess',
  'Reflect',
] as const

interface BaxterCrrtLabProps {
  locale?: string
}

export default function BaxterCrrtLab({ locale = 'en' }: BaxterCrrtLabProps) {
  const [activePathwayId, setActivePathwayId] = useState<BaxterCrrtPathwayId>('orientation')
  const tabRefs = useRef<Partial<Record<BaxterCrrtPathwayId, HTMLButtonElement | null>>>({})
  const activePathway = getBaxterCrrtPathway(activePathwayId)

  function selectAndFocus(pathwayId: BaxterCrrtPathwayId) {
    setActivePathwayId(pathwayId)
    tabRefs.current[pathwayId]?.focus()
  }

  function handlePathwayKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    pathwayId: BaxterCrrtPathwayId,
  ) {
    const currentIndex = selectablePathwayIds.indexOf(pathwayId)
    if (currentIndex < 0) return

    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % selectablePathwayIds.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + selectablePathwayIds.length) % selectablePathwayIds.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = selectablePathwayIds.length - 1
    }

    if (nextIndex === null) return
    event.preventDefault()
    selectAndFocus(selectablePathwayIds[nextIndex])
  }

  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-no-handoff-translate={locale !== 'en'}
        data-publication-status={baxterCrrtPublicationStatus}
      >
        <header className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <div className={styles.heroBadges}>
              <span>
                <EyeOff aria-hidden="true" /> Authenticated draft
              </span>
              <span>
                <FileClock aria-hidden="true" /> PrisMax AW8035 Rev B
              </span>
              <span>
                <ShieldAlert aria-hidden="true" /> Review pending
              </span>
            </div>
            <p className={styles.eyebrow}>Adult ICU CRRT · independent educational scaffold</p>
            <h1>CRRT Learn &amp; Practice workspace</h1>
            <p className={styles.heroLead}>
              A source-bound workspace for learning how patient goals, circuit behavior, device
              operation, delivered therapy, and reassessment will connect. Phase 2 adds an isolated,
              deterministic draft engine beneath the scaffold; it is not connected to learner
              controls or cases.
            </p>
          </div>

          <aside className={styles.phaseGate} aria-label="Current implementation phase">
            <span>Phase 2 gate</span>
            <strong>Pure engine &amp; schemas</strong>
            <ul>
              <li>
                <span aria-hidden="true">✓</span> Draft access and source profile
              </li>
              <li>
                <span aria-hidden="true">✓</span> Pure engine and validation tests
              </li>
              <li>
                <span aria-hidden="true">○</span> Functional interface and cases not started
              </li>
            </ul>
          </aside>
        </header>

        <section className={styles.safetyBanner} aria-label="Educational safety boundary">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>Professional education only.</strong>
            <p>
              This is not a clinical device, validated digital twin, certification program,
              patient-specific treatment guide, or substitute for the current operator&apos;s
              manual, local protocol, supervised hands-on training, or multidisciplinary clinical
              judgment. This independent educational module is not manufactured, sponsored,
              validated, or endorsed by Baxter.
            </p>
            <small>
              No patient model, prescription calculator, alarm trainer, or operational device
              control is active in the learner interface in this phase.
            </small>
          </div>
        </section>

        {locale !== 'en' ? (
          <div className={styles.languageFallback} data-no-handoff-translate={true} role="note">
            <Languages aria-hidden="true" />
            <p>
              <strong>Reviewed-English fallback:</strong> CRRT clinical and device copy remains in
              English until independent translation review is complete.
            </p>
          </div>
        ) : null}

        <dl className={styles.profileStrip} aria-label="Locked draft device profile">
          <div>
            <dt>Profile</dt>
            <dd>{prismaxDraftDeviceProfile.displayName}</dd>
          </div>
          <div>
            <dt>Source revision</dt>
            <dd>
              {prismaxDraftDeviceProfile.manualNumber} · {prismaxDraftDeviceProfile.manualRevision}
            </dd>
          </div>
          <div>
            <dt>Source software</dt>
            <dd>{prismaxDraftDeviceProfile.sourceProgramFamily}</dd>
          </div>
          <div>
            <dt>Market/configuration</dt>
            <dd>{prismaxDraftDeviceProfile.marketConfiguration}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>Orientation scaffold only</dd>
          </div>
          <div>
            <dt>Review</dt>
            <dd>Device, clinical, accessibility &amp; localization pending</dd>
          </div>
        </dl>

        <section className={styles.pathwaySection} aria-labelledby="crrt-pathway-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Learning pathway</span>
              <h2 id="crrt-pathway-heading">Preview how support will fade across the curriculum</h2>
            </div>
            <span className={styles.scaffoldLabel}>
              <Sparkles aria-hidden="true" /> Scaffold only
            </span>
          </div>

          <div className={styles.pathwayTabs} role="tablist" aria-label="CRRT learning pathway">
            {baxterCrrtPathways.map((pathway) => {
              const Icon = pathwayIcons[pathway.id]
              const locked = pathway.status === 'locked'
              const selected = pathway.id === activePathwayId
              return (
                <button
                  key={pathway.id}
                  id={`baxter-crrt-pathway-tab-${pathway.id}`}
                  ref={(node) => {
                    tabRefs.current[pathway.id] = node
                  }}
                  type="button"
                  role="tab"
                  aria-controls="baxter-crrt-pathway-panel"
                  aria-selected={selected}
                  aria-disabled={locked}
                  disabled={locked}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActivePathwayId(pathway.id)}
                  onKeyDown={(event) => handlePathwayKeyDown(event, pathway.id)}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{pathway.label}</strong>
                    <small>{pathway.eyebrow}</small>
                  </span>
                  <em>{pathway.statusLabel}</em>
                </button>
              )
            })}
          </div>

          <div
            id="baxter-crrt-pathway-panel"
            className={styles.pathwayPanel}
            role="tabpanel"
            aria-labelledby={`baxter-crrt-pathway-tab-${activePathwayId}`}
            aria-live="polite"
          >
            <div>
              <span>{activePathway.label}</span>
              <strong>{activePathway.statusLabel}</strong>
            </div>
            <p>{activePathway.summary}</p>
          </div>
        </section>

        <section className={styles.workbenchSection} aria-labelledby="crrt-workbench-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Three-domain workbench</span>
              <h2 id="crrt-workbench-heading">The simulator surfaces are reserved—not connected</h2>
            </div>
            <span className={styles.scaffoldLabel}>
              <Layers3 aria-hidden="true" /> Responsive shell
            </span>
          </div>

          <div className={styles.workbench}>
            <article className={styles.workbenchPanel} aria-labelledby="reasoning-panel-heading">
              <div className={styles.panelHeading}>
                <BrainCircuit aria-hidden="true" />
                <div>
                  <span>Patient &amp; reasoning</span>
                  <h3 id="reasoning-panel-heading">No case loaded</h3>
                </div>
              </div>
              <p>
                Case findings, prediction commitment, goals, actions, hints, and communication tasks
                will enter here after authored cases and the deterministic engine are reviewed.
              </p>
              <ol className={styles.reasoningRail} aria-label="Planned CRRT reasoning sequence">
                {reasoningSteps.map((step, index) => (
                  <li key={step}>
                    <span>{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </article>

            <article
              className={[styles.workbenchPanel, styles.devicePanel].join(' ')}
              aria-labelledby="device-panel-heading"
            >
              <div className={styles.panelHeading}>
                <MonitorCog aria-hidden="true" />
                <div>
                  <span>Educational device surface</span>
                  <h3 id="device-panel-heading">PrisMax interface not connected</h3>
                </div>
              </div>
              <div
                className={styles.devicePlaceholder}
                role="img"
                aria-label="Abstract placeholder for a future original PrisMax educational facsimile"
              >
                <div className={styles.placeholderScreen}>
                  <span>Independent educational workspace</span>
                  <strong>Functional interface begins in Phase 3</strong>
                  <small>No controls or operational values are active</small>
                </div>
                <div className={styles.placeholderTopology} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
              </div>
            </article>

            <article className={styles.workbenchPanel} aria-labelledby="response-panel-heading">
              <div className={styles.panelHeading}>
                <Activity aria-hidden="true" />
                <div>
                  <span>Circuit &amp; patient response</span>
                  <h3 id="response-panel-heading">Models not connected</h3>
                </div>
              </div>
              <div className={styles.responsePlaceholders}>
                <div>
                  <Layers3 aria-hidden="true" />
                  <span>Circuit schematic</span>
                  <small>Reserved for original SVG</small>
                </div>
                <div>
                  <Gauge aria-hidden="true" />
                  <span>Pressures &amp; delivery</span>
                  <small>No values available</small>
                </div>
                <div>
                  <Activity aria-hidden="true" />
                  <span>Simulated patient</span>
                  <small>No physiology active</small>
                </div>
              </div>
            </article>
          </div>
        </section>

        <SourcesPanel />
      </main>
    </HandoffContent>
  )
}
