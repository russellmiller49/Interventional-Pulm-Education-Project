import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '96px',
          background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase' }}>
          Interventional Pulmonology
        </span>
        <div style={{ height: 24 }} />
        <strong style={{ fontSize: 72, lineHeight: 1.1 }}>
          Education & Innovation for Airway Specialists
        </strong>
      </div>
    ),
    size,
  )
}
