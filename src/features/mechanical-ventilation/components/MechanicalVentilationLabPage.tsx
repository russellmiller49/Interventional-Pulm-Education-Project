'use client'

import type { Route } from 'next'
import { ArrowLeft } from 'lucide-react'

import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { MECHANICAL_VENTILATION_LAB_SUMMARY } from '../content/ventilationLab'
import MechanicalVentilationLab from './MechanicalVentilationLab'
import { MechanicalVentilationModuleFrame } from './MechanicalVentilationModuleFrame'
import styles from './mechanical-ventilation-hub.module.css'

/**
 * The open lab, routed under Practice (`content/ventilationLab.ts`). The module frame carries the
 * module's name, sections and safety boundary, so the lab is shown without its own stand-alone
 * header; Practice stays the active section.
 */
export function MechanicalVentilationLabPage({ locale = 'en' }: { readonly locale?: string }) {
  return (
    <MechanicalVentilationModuleFrame
      locale={locale}
      activeHref={`${mechanicalVentilationNavBase}/practice`}
    >
      <header className={styles.hero} data-ventilation-lab-header>
        <h1>Ventilator lab</h1>
        <p>{MECHANICAL_VENTILATION_LAB_SUMMARY}</p>
        <div className={styles.entryActions}>
          <Link className={styles.chip} href={`${mechanicalVentilationNavBase}/practice` as Route}>
            <ArrowLeft aria-hidden="true" />
            Back to Practice
          </Link>
        </div>
      </header>
      <MechanicalVentilationLab locale={locale} hosted />
    </MechanicalVentilationModuleFrame>
  )
}
