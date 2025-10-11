interface VideoEmbedProps {
  url: string
  title?: string
  aspectRatio?: number
}

export function VideoEmbed({ url, title = 'Embedded video', aspectRatio = 16 / 9 }: VideoEmbedProps) {
  const paddingTop = `${(1 / aspectRatio) * 100}%`

  return (
    <div className="not-prose overflow-hidden rounded-3xl border border-border/60 bg-background/70">
      <div className="relative w-full" style={{ paddingTop }}>
        <iframe
          src={url}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}

