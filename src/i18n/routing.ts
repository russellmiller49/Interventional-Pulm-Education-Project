import { defineRouting } from 'next-intl/routing'

import { activeLocales, defaultLocale, localeCookieName } from './locale'

export const routing = defineRouting({
  locales: activeLocales,
  defaultLocale,
  localeCookie: {
    name: localeCookieName,
  },
  localePrefix: 'always',
})
