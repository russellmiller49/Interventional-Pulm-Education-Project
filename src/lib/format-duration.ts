export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours && remainingMinutes) {
    return `${hours}h ${remainingMinutes}m`
  }

  if (hours) {
    return `${hours}h`
  }

  return `${remainingMinutes}m`
}

