'use client'

import dynamic from 'next/dynamic'

import styles from './stage/hemodynamics-stage.module.css'

/**
 * The 3D heart, loaded only where a step asks for it.
 *
 * The lesson stage renders every section through one host, and three.js is the largest thing
 * this module can put in a bundle. The Practice cases import the heart statically because every
 * case shows it; the stage shows it on one section, so it arrives with that section. Never
 * server-rendered: the component reads WebGL support on the client and shows a text fallback
 * without it.
 */
export const HemodynamicHeart3DDynamic = dynamic(
  () => import('./HemodynamicHeart3D').then((module) => module.HemodynamicHeart3D),
  {
    ssr: false,
    loading: () => (
      <div className={styles.heartLoading} role="status">
        Loading the heart…
      </div>
    ),
  },
)
