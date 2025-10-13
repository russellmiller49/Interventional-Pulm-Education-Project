'use client'

import { useMDXComponent } from 'next-contentlayer2/hooks'

import { mdxComponents } from './mdx-components'

interface MDXRendererProps {
  code: string
}

export function MDXRenderer({ code }: MDXRendererProps) {
  const Component = useMDXComponent(code)

  return <Component components={mdxComponents} />
}
