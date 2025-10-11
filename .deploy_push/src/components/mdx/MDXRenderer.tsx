'use client'

import { useMDXComponent } from 'next-contentlayer/hooks'

import { mdxComponents } from './mdx-components'

interface MDXRendererProps {
  code: string
}

export function MDXRenderer({ code }: MDXRendererProps) {
  const Component = useMDXComponent(code)

  return <Component components={mdxComponents} />
}
