import { defineDocumentType, makeSource } from 'contentlayer/source-files'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'

import { boardReviewChapterBySourceFile, boardReviewChapterMap } from './src/data/board-review'

const BoardModule = defineDocumentType(() => ({
  name: 'BoardModule',
  filePathPattern: 'modules/board/*.mdx',
  contentType: 'mdx',
  computedFields: {
    meta: {
      type: 'json',
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName] ?? null,
    },
    slug: {
      type: 'string',
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.slug ?? getSlug(doc),
    },
    title: {
      type: 'string',
      resolve: (doc) =>
        boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.title ??
        boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.slug ??
        getSlug(doc),
    },
    summary: {
      type: 'string',
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.summary ?? '',
    },
    description: {
      type: 'string',
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.description ?? '',
    },
    category: {
      type: 'string',
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.category ?? 'airway',
    },
    estimatedMinutes: {
      type: 'number',
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.estimatedMinutes ?? 0,
    },
    examDomains: {
      type: 'list',
      of: { type: 'string' },
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.examDomains ?? [],
    },
    tags: {
      type: 'list',
      of: { type: 'string' },
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.tags ?? [],
    },
    focus: {
      type: 'list',
      of: { type: 'string' },
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.focus ?? [],
    },
    order: {
      type: 'number',
      resolve: (doc) => boardReviewChapterBySourceFile[doc._raw.sourceFileName]?.order ?? 0,
    },
  },
}))

export default makeSource({
  contentDirPath: 'content',
  documentTypes: [BoardModule],
  mdx: {
    remarkPlugins: [],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          properties: {
            className: ['anchor'],
          },
        },
      ],
    ],
  },
})

function getSlug(doc: { _raw: { sourceFileName: string } }) {
  return doc._raw.sourceFileName.replace(/\.mdx$/, '')
}
