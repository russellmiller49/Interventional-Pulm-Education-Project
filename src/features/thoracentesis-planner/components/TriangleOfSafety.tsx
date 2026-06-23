'use client'

import { useTranslations } from 'next-intl'

export function TriangleOfSafety() {
  const t = useTranslations('thoracentesisPlanner.triangle')

  return (
    <svg
      role="img"
      aria-labelledby="triangle-title triangle-description"
      viewBox="0 0 420 320"
      className="h-auto w-full"
    >
      <title id="triangle-title">{t('title')}</title>
      <desc id="triangle-description">{t('desc')}</desc>
      <rect width="420" height="320" rx="18" fill="hsl(var(--muted))" />
      <path
        d="M210 45 C132 58 74 126 72 216 C120 254 301 255 348 216 C346 126 288 58 210 45Z"
        fill="#f8d7bd"
      />
      <path
        d="M119 87 C145 120 153 169 145 223"
        stroke="#9b4a3c"
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M301 87 C275 120 267 169 275 223"
        stroke="#9b4a3c"
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path d="M92 228 C154 202 266 202 328 228" stroke="#2f7f69" strokeWidth="8" fill="none" />
      <path
        d="M145 112 L276 112 L236 213 L145 213 Z"
        fill="#38bdf8"
        opacity="0.22"
        stroke="#0369a1"
        strokeWidth="3"
      />
      <circle cx="214" cy="176" r="20" fill="#0ea5e9" opacity="0.9" />
      <path
        d="M118 137 H302 M108 164 H312 M101 191 H319 M99 218 H321"
        stroke="#8a5a44"
        strokeWidth="3"
        opacity="0.55"
      />
      <text x="210" y="33" textAnchor="middle" className="fill-foreground text-sm font-semibold">
        {t('axilla')}
      </text>
      <text x="82" y="112" className="fill-foreground text-xs font-semibold">
        {t('pectoralis')}
      </text>
      <text x="278" y="112" className="fill-foreground text-xs font-semibold">
        {t('latissimus')}
      </text>
      <text x="129" y="252" className="fill-foreground text-xs font-semibold">
        {t('diaphragm')}
      </text>
      <text x="161" y="181" className="fill-foreground text-xs font-semibold">
        {t('window')}
      </text>
    </svg>
  )
}
