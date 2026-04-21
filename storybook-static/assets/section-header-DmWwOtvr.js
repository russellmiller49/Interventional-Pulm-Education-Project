import { j as e, c as t } from './iframe-AbuOJf2D.js'
function o({
  eyebrow: s,
  title: c,
  description: a,
  actions: n,
  align: r = 'left',
  className: l,
  ...d
}) {
  const i = r === 'center' ? 'items-center text-center' : 'items-start text-left'
  return e.jsxs('div', {
    className: t('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', l),
    ...d,
    children: [
      e.jsxs('div', {
        className: t('flex flex-col gap-2', i),
        children: [
          s
            ? e.jsx('span', {
                className:
                  'inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary',
                children: s,
              })
            : null,
          e.jsxs('div', {
            className: 'space-y-2',
            children: [
              e.jsx('h2', {
                className: t('text-3xl font-semibold tracking-tight text-foreground', i),
                children: c,
              }),
              a
                ? e.jsx('p', {
                    className: t(
                      'max-w-2xl text-sm text-muted-foreground',
                      r === 'center' ? 'mx-auto' : '',
                    ),
                    children: a,
                  })
                : null,
            ],
          }),
        ],
      }),
      n ? e.jsx('div', { className: 'flex shrink-0 items-center gap-3', children: n }) : null,
    ],
  })
}
try {
  ;((o.displayName = 'SectionHeader'),
    (o.__docgenInfo = {
      description: '',
      displayName: 'SectionHeader',
      filePath: '/home/rjm/projects/IP_website/src/components/ui/section-header.tsx',
      methods: [],
      props: {
        eyebrow: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/src/components/ui/section-header.tsx',
              name: 'SectionHeaderProps',
            },
          ],
          description: '',
          name: 'eyebrow',
          parent: {
            fileName: 'IP_website/src/components/ui/section-header.tsx',
            name: 'SectionHeaderProps',
          },
          required: !1,
          tags: {},
          type: { name: 'string' },
        },
        title: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/src/components/ui/section-header.tsx',
              name: 'SectionHeaderProps',
            },
          ],
          description: '',
          name: 'title',
          parent: {
            fileName: 'IP_website/src/components/ui/section-header.tsx',
            name: 'SectionHeaderProps',
          },
          required: !0,
          tags: {},
          type: { name: 'ReactNode' },
        },
        description: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/src/components/ui/section-header.tsx',
              name: 'SectionHeaderProps',
            },
          ],
          description: '',
          name: 'description',
          parent: {
            fileName: 'IP_website/src/components/ui/section-header.tsx',
            name: 'SectionHeaderProps',
          },
          required: !1,
          tags: {},
          type: { name: 'ReactNode' },
        },
        actions: {
          defaultValue: null,
          declarations: [
            {
              fileName: 'IP_website/src/components/ui/section-header.tsx',
              name: 'SectionHeaderProps',
            },
          ],
          description: '',
          name: 'actions',
          parent: {
            fileName: 'IP_website/src/components/ui/section-header.tsx',
            name: 'SectionHeaderProps',
          },
          required: !1,
          tags: {},
          type: { name: 'ReactNode' },
        },
        align: {
          defaultValue: { value: 'left' },
          declarations: [
            {
              fileName: 'IP_website/src/components/ui/section-header.tsx',
              name: 'SectionHeaderProps',
            },
          ],
          description: '',
          name: 'align',
          parent: {
            fileName: 'IP_website/src/components/ui/section-header.tsx',
            name: 'SectionHeaderProps',
          },
          required: !1,
          tags: {},
          type: {
            name: 'enum',
            raw: '"center" | "left"',
            value: [{ value: '"center"' }, { value: '"left"' }],
          },
        },
      },
      tags: {},
    }))
} catch {}
export { o as S }
