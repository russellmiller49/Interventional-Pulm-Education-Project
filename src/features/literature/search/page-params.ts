export type LiteraturePageSearchParams = Record<string, string | string[] | undefined>

export function literaturePageSearchParamsToUrl(values: LiteraturePageSearchParams | undefined) {
  const searchParams = new URLSearchParams()
  if (!values) {
    return searchParams
  }

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item))
    } else if (value !== undefined) {
      searchParams.set(key, value)
    }
  }
  return searchParams
}
