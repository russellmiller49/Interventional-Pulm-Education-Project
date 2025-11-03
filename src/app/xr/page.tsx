import Link from 'next/link'
import type { Route } from 'next'

import { MODELS } from '@/data/models'

export default function XRIndexPage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">XR Models</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {MODELS.map((model) => (
          <li key={model.slug} className="rounded border p-4">
            <h2 className="font-medium">{model.name}</h2>
            <div className="mt-2 flex gap-2">
              <Link
                className="rounded bg-black px-3 py-2 text-white"
                href={`/xr/${model.slug}` as Route}
              >
                Enter Spatial
              </Link>
              {model.usdzSrc && (
                <a className="rounded border px-3 py-2" rel="ar" href={model.usdzSrc}>
                  View in AR (iOS)
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
