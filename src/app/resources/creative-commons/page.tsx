import Link from 'next/link'
import type { Metadata } from 'next'
import { AlertCircle, BookOpen, Search } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { getCreativeCommonsImageCount, listCreativeCommonsCategories } from '@/lib/creative-commons'

export const metadata: Metadata = {
  title: 'Creative Commons Medical Images',
  description:
    'Curated Creative Commons medical images from peer-reviewed publications for educational use.',
}

export default function CreativeCommonsPage() {
  const categories = listCreativeCommonsCategories()
  const totalImages = getCreativeCommonsImageCount()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-4 text-4xl font-bold">Creative Commons Medical Images</h1>
        <p className="mb-6 text-lg text-gray-600">
          A curated collection of medical images from peer-reviewed publications for educational use
        </p>
      </div>

      <section className="mb-8 rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
        <div className="mb-4 flex items-start gap-3">
          <AlertCircle className="mt-1 text-blue-600" size={24} />
          <h2 className="text-2xl font-semibold text-blue-900">
            Image Use and Licensing Disclaimer
          </h2>
        </div>

        <p className="mb-4 text-gray-700">
          The images in this section are sourced from open-access, peer-reviewed medical
          publications released under Creative Commons licenses. These images are provided for
          educational and non-commercial purposes only.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold text-green-800">Permitted use</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>
                Download, display, and incorporate images into educational presentations, lectures,
                manuscripts, or non-commercial publications.
              </li>
              <li>
                Proper attribution to the original article, author, and journal must be included.
              </li>
              <li>
                Adapt or modify images only if the original license permits derivatives, such as CC
                BY or CC BY-SA.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-red-800">Prohibited use</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>
                Commercial promotion, advertising, resale, or paid online courses without additional
                permission.
              </li>
              <li>Removing or obscuring author names, figure legends, or copyright notices.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-4 flex items-center text-xl font-semibold">
          <BookOpen className="mr-2" size={20} />
          How to Use Images Properly
        </h3>
        <ol className="space-y-2 text-sm text-gray-700">
          <li>1. Check the license noted under each figure.</li>
          <li>2. Provide citation and link to the original article or DOI whenever possible.</li>
          <li>3. Include attribution on or below the image in presentations or online material.</li>
          <li>
            4. If unsure, assume non-commercial educational use only and include full citation.
          </li>
        </ol>
      </section>

      <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-xs text-gray-700">
          <span className="font-semibold">Disclaimer:</span> All images remain the property of their
          respective authors and publishers under the applicable Creative Commons license.
          InterventionalPulm.com hosts them solely for medical education.
        </p>
      </div>

      <div className="mb-8">
        <Link
          href="/resources/creative-commons/search"
          className="flex items-center rounded-lg border-2 border-gray-300 bg-white p-4 transition-colors hover:border-blue-500"
        >
          <Search className="mr-3 text-gray-500" size={24} />
          <span className="text-gray-600">Search all images by keywords...</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link key={category.slug} href={`/resources/creative-commons/${category.slug}`}>
            <Card className="relative cursor-pointer overflow-hidden border-2 p-6 transition-shadow hover:border-blue-500 hover:shadow-lg">
              <div className="absolute left-0 right-0 top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-white">
                <h3 className="truncate text-base font-semibold">{category.name}</h3>
              </div>
              <div className="mt-8">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {category.icon}
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                    {category.count} images
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Browse {category.count} curated images in this category
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center text-gray-600">
        <p className="text-lg">
          Total: <span className="font-semibold">{totalImages} medical images</span> from
          peer-reviewed publications
        </p>
      </div>
    </div>
  )
}
