'use client'

import { useEffect, useRef } from 'react'
import type { Route } from 'next'
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  Boxes,
  BrainCircuit,
  ClipboardCheck,
  FlaskConical,
  HeartPulse,
  MonitorDot,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { recordSiteModuleEvent } from '@/lib/analytics'
import {
  ICU_SIMULATION_ANALYTICS_MODULE_ID,
  expectedIcuSimulationAnalyticsEventType,
  validateIcuSimulationAnalyticsEventPayload,
} from '@/lib/icu-simulation-analytics'

import styles from './icu-simulation.module.css'

const learningModes = [
  {
    id: 'learn',
    title: 'Learn the integrated system',
    description:
      'Use visible causal coaching to connect shock physiology, ventilation, extracorporeal support, and renal replacement therapy.',
    eyebrow: 'Guided orientation',
    Icon: BookOpenCheck,
  },
  {
    id: 'practice',
    title: 'Practice full ICU courses',
    description:
      'Assess, intervene, advance time, and reassess through evolving cases with checkpoints and focused hints.',
    eyebrow: 'Coached scenarios',
    Icon: Stethoscope,
  },
  {
    id: 'assess',
    title: 'Demonstrate clinical reasoning',
    description:
      'Run seeded scenario variants without answer cues, then review a causal debrief and safety-critical decisions.',
    eyebrow: 'Scored assessment',
    Icon: ClipboardCheck,
  },
  {
    id: 'sandbox',
    title: 'Explore the physiology sandbox',
    description:
      'Start from a reviewed synthetic patient preset and explore bounded support changes without a mastery score.',
    eyebrow: 'Unscored exploration',
    Icon: FlaskConical,
  },
] as const

const integratedSystems = [
  {
    label: 'Hemodynamics',
    detail: 'Pressure, flow, perfusion, and PAC observations',
    Icon: Activity,
  },
  {
    label: 'Ventilation',
    detail: 'Gas exchange, mechanics, waveforms, and PEEP interactions',
    Icon: MonitorDot,
  },
  {
    label: 'ECMO & MCS',
    detail: 'VV/VA support, unloading, circuit state, and alarms',
    Icon: HeartPulse,
  },
  {
    label: 'CRRT',
    detail: 'Fluid balance, solute clearance, downtime, and filter safety',
    Icon: Boxes,
  },
] as const

export function IcuSimulatorHub({ locale = 'en' }: { locale?: string }) {
  const opened = useRef(false)

  useEffect(() => {
    if (opened.current) return
    opened.current = true
    const parsed = validateIcuSimulationAnalyticsEventPayload({
      interaction: 'section_opened',
      section: 'overview',
    })
    if (!parsed.success) return
    recordSiteModuleEvent({
      eventType: expectedIcuSimulationAnalyticsEventType(parsed.data.interaction),
      moduleId: ICU_SIMULATION_ANALYTICS_MODULE_ID,
      eventPayload: parsed.data,
    })
  }, [])

  return (
    <main className={styles.hubShell}>
      <header className={styles.hubHero}>
        <div className={styles.hubHeroCopy}>
          <div className={styles.heroBadges} aria-label="Module status">
            <span>Adult critical care</span>
            <span data-preview="true">Private development</span>
            <span>Six longitudinal scenarios</span>
          </div>
          <p className={styles.eyebrow}>One patient · one clock · every support system</p>
          <h1>ICU Simulator</h1>
          <p className={styles.heroLead}>
            Run an evolving ICU course from first assessment through rescue support and
            reassessment. Every monitor, intervention, and device acts on the same synthetic
            patient.
          </p>
          <div className={styles.hubHeroActions}>
            <Link href={'/icu-simulation/learn' as Route} className={styles.primaryLink}>
              Start guided orientation
              <ArrowRight aria-hidden="true" />
            </Link>
            <a href="#simulation-paths" className={styles.secondaryLink}>
              Compare learning paths
            </a>
          </div>
        </div>

        <aside className={styles.systemMap} aria-labelledby="integrated-systems-title">
          <div className={styles.systemMapHeader}>
            <BrainCircuit aria-hidden="true" />
            <div>
              <span>Shared physiology</span>
              <h2 id="integrated-systems-title">Integrated bedside systems</h2>
            </div>
          </div>
          <ul>
            {integratedSystems.map(({ label, detail, Icon }) => (
              <li key={label}>
                <Icon aria-hidden="true" />
                <div>
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </header>

      <section className={styles.safetyBanner} role="note" aria-label="Educational safety boundary">
        <ShieldAlert aria-hidden="true" />
        <p>
          <strong>Educational simulation—not a clinical device or treatment protocol.</strong> The
          cases are synthetic and use bounded, simplified interventions. Apply bedside examination,
          current evidence, institutional protocols, manufacturer instructions, multidisciplinary
          expertise, and patient-specific judgment in real care.
        </p>
      </section>

      {locale !== 'en' ? (
        <p className={styles.languageFallback} role="status">
          Reviewed-English fallback: this private preview remains English-first while localized
          clinical review is pending.
        </p>
      ) : null}

      <section className={styles.modeSection} id="simulation-paths" aria-labelledby="paths-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Choose your level of support</p>
            <h2 id="paths-title">Four ways into the same bedside</h2>
          </div>
          <p>Learn and Practice reveal coaching. Assess withholds it. Sandbox is never scored.</p>
        </div>

        <div className={styles.modeGrid}>
          {learningModes.map(({ id, title, description, eyebrow, Icon }, index) => (
            <article className={styles.modeCard} key={id}>
              <div className={styles.modeCardTop}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Icon aria-hidden="true" />
              </div>
              <p>{eyebrow}</p>
              <h3>{title}</h3>
              <p>{description}</p>
              <Link
                href={`/icu-simulation/${id}` as Route}
                aria-label={`Open ${title}`}
                className={styles.cardLink}
              >
                Open {id}
                <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.coursePreview} aria-labelledby="course-preview-title">
        <div>
          <p className={styles.eyebrow}>Longitudinal reasoning</p>
          <h2 id="course-preview-title">The case changes after every choice</h2>
          <p>
            The simulator rewards a repeatable ICU loop rather than a single target number. Device
            escalation never substitutes for diagnosing and treating the underlying shock state.
          </p>
        </div>
        <ol aria-label="Simulation workflow">
          {[
            ['01', 'Assess', 'Read the examination, monitor, labs, imaging, and device state.'],
            ['02', 'Classify', 'Commit to a working mechanism and immediate priorities.'],
            ['03', 'Intervene', 'Start or adjust bounded therapies through supervised workflows.'],
            ['04', 'Advance', 'Move the shared clock and observe delayed, coupled effects.'],
            ['05', 'Reassess', 'Reclassify shock, safety, organ support, and the next decision.'],
          ].map(([number, title, detail]) => (
            <li key={number}>
              <span>{number}</span>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.hubFooterNote}>
        <span>Designed for adult critical care residents and fellows</span>
        <span aria-hidden="true">·</span>
        <span>No real-patient data entry</span>
        <span aria-hidden="true">·</span>
        <span>VR-ready architecture; no XR experience in this release</span>
      </footer>
    </main>
  )
}
