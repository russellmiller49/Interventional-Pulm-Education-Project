export function preferenceCardsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_PREFERENCE_CARDS === 'true'
  )
}
