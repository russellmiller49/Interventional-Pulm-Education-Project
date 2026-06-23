import '@testing-library/jest-dom'
import messages from './messages/en.json'

function formatMessage(message: string, values?: Record<string, unknown>) {
  if (!values) {
    return message
  }

  return Object.entries(values).reduce(
    (nextMessage, [key, value]) => nextMessage.replaceAll(`{${key}}`, String(value)),
    message,
  )
}

function createTranslator(namespace?: string) {
  function resolveMessage(key: string) {
    const path = namespace ? `${namespace}.${key}` : key
    return path.split('.').reduce<unknown>((value, segment) => {
      if (!value || typeof value !== 'object') {
        return undefined
      }

      return (value as Record<string, unknown>)[segment]
    }, messages)
  }

  const translate = (key: string, values?: Record<string, unknown>) => {
    const message = resolveMessage(key)
    return formatMessage(typeof message === 'string' ? message : key, values)
  }

  translate.rich = translate
  // next-intl's t.raw returns the unprocessed message (array/object/string) as-is.
  translate.raw = (key: string) => resolveMessage(key)

  return translate
}

jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  hasLocale: (locales: readonly string[], locale: string | undefined) =>
    locale ? locales.includes(locale) : false,
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => createTranslator(namespace),
}))

jest.mock('next-intl/server', () => ({
  getMessages: async () => messages,
  getRequestConfig: (callback: unknown) => callback,
  getTranslations: async (namespaceOrOptions?: string | { namespace?: string }) =>
    createTranslator(
      typeof namespaceOrOptions === 'string' ? namespaceOrOptions : namespaceOrOptions?.namespace,
    ),
  setRequestLocale: jest.fn(),
}))
