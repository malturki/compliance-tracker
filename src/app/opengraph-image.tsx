import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'FAST Compliance Tracker'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(132deg, #F6F8FA 0%, #C8CFD8 18%, #A1B0CF 38%, #F6F8FA 56%, #C8CFD8 76%, #5F6672 100%)',
          color: '#2B2C2F',
          padding: 80,
        }}
      >
        <div style={{ fontSize: 160, fontWeight: 700, letterSpacing: '-0.04em', fontFamily: 'system-ui' }}>FAST</div>
        <div style={{ fontSize: 44, fontWeight: 400, color: '#5F6672', marginTop: 16, fontFamily: 'system-ui' }}>
          Compliance Tracker
        </div>
      </div>
    ),
    { ...size }
  )
}
