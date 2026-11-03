'use client'

import { ArrowUpRight, BookOpen, Boxes, ClipboardList, Stethoscope } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import { DOLPHIN_BOUNDARY_STATEMENT } from '../content/boundary'
import { DOLPHIN_OBJECTIVES } from '../content/objectives'
import { dolphinCompositionLine } from '../content/pathwayResolver'
import {
  DOLPHIN_ANATOMY_HREF,
  DOLPHIN_ASSESS_HREF,
  DOLPHIN_PRACTICE_HREF,
  DOLPHIN_REFERENCE_HREF,
  DOLPHIN_SIMULATOR_HREF,
} from '../content/routes'
import {
  DolphinContinueCta,
  DolphinProgressNotes,
  DolphinStartAtFirstSectionLink,
  DolphinStoredPathwayAccordion,
} from './hub/DolphinPathwayAccordion'
import styles from './dolphin-hub.module.css'

/**
 * The Overview: what the module is for, the one door, the pathway map, the other three tabs, the
 * two dolphin sandboxes it was built on, and the module's one boundary statement.
 */
export function DolphinHub() {
  const t = useTranslations('dolphinBronchoscopy.hub')
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-4" data-dolphin-hub-hero>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          For veterinarians
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Bronchoscopy of the bottlenose dolphin, from the blowhole to a numbered branch
        </h1>
        <p className="max-w-3xl text-base" data-hub-lede>
          You already scope other species. This module adds what is different in the dolphin: an
          airway that never crosses the mouth, a glottis at the tip of a spout in the nasopharynx, a
          tracheal bronchus, and branches numbered in order rather than named by lobe. Then the
          procedure as the U.S. Navy Marine Mammal Program teaches it: the plan, sedation and
          topical lidocaine, passing the spout with the breaths, the survey and its record,
          sampling, and what to do first when something changes.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <DolphinContinueCta />
          <DolphinStartAtFirstSectionLink />
        </div>
        <DolphinProgressNotes className="grid gap-3" />
        <figure className="grid max-w-xl gap-2" data-hub-hero>
          {/* eslint-disable-next-line @next/next/no-img-element -- a static render of the module's own simulator */}
          <img
            src="/dolphin-bronchoscopy/frames/carina.png"
            width={960}
            height={720}
            loading="lazy"
            className="h-auto w-full rounded-xl border"
            alt="The carina of the CT dolphin as the scope sees it: two nearly parallel openings, the right main bronchus on the screen left and the left main bronchus on the screen right."
          />
          <figcaption className="text-sm opacity-80">
            The carina of this module’s dolphin, rendered from its CT. The animal lies in sternal
            recumbency, so the dorsal wall is at the top and the animal’s right is on the screen
            left.
          </figcaption>
        </figure>
      </section>

      <section className="grid gap-3" aria-labelledby="dolphin-pathway-heading">
        <h2 id="dolphin-pathway-heading" className="text-xl font-semibold">
          The pathway
        </h2>
        <p className={styles.composition} data-pathway-composition>
          {dolphinCompositionLine()} · every section open, in any order
        </p>
        <DolphinStoredPathwayAccordion id="dolphin-hub-map" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="More of the module">
        <Link href={DOLPHIN_PRACTICE_HREF} className={styles.chip} data-kind="practice">
          <Stethoscope aria-hidden="true" />
          {t('practiceLink')}
        </Link>
        <Link href={DOLPHIN_ASSESS_HREF} className={styles.chip} data-kind="assess">
          <ClipboardList aria-hidden="true" />
          {t('integratedLink')}
        </Link>
        <Link href={DOLPHIN_REFERENCE_HREF} className={styles.chip} data-kind="reference">
          <BookOpen aria-hidden="true" />
          {t('referenceLink')}
        </Link>
      </section>

      <section className="grid gap-3" aria-labelledby="dolphin-objectives-heading">
        <h2 id="dolphin-objectives-heading" className="text-xl font-semibold">
          By the end you can
        </h2>
        <ul className="grid list-disc gap-2 pl-5">
          {DOLPHIN_OBJECTIVES.map((objective) => (
            <li key={objective.id}>{objective.text}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3" aria-labelledby="dolphin-sandboxes-heading">
        <h2 id="dolphin-sandboxes-heading" className="text-xl font-semibold">
          The two models the module is built on
        </h2>
        <p>
          Both open on their own, with every control, for free exploration. The sections embed the
          same airway with only the controls each step needs.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={DOLPHIN_SIMULATOR_HREF}
            className={styles.startFirst}
            data-sandbox="simulator"
          >
            <ArrowUpRight aria-hidden="true" />
            {t('simulatorLink')}
          </Link>
          <Link href={DOLPHIN_ANATOMY_HREF} className={styles.startFirst} data-sandbox="anatomy">
            <Boxes aria-hidden="true" />
            {t('anatomyLink')}
          </Link>
        </div>
      </section>

      <section
        className="rounded-2xl border p-5 text-sm"
        aria-label="About this module"
        data-boundary-statement
      >
        <p className="font-semibold">About this module</p>
        <p className="mt-2">{DOLPHIN_BOUNDARY_STATEMENT}</p>
      </section>
    </div>
  )
}
