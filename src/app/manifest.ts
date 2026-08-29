import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KLEYS KIDS',
    short_name: 'KLEYS KIDS',
    description: 'Sistema de Gestión Industrial KLEYS KIDS',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: 'https://drive.google.com/thumbnail?id=15o8oqYnmbOjXUIBgPFzl-SDi78SdTo2O&sz=w192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: 'https://drive.google.com/thumbnail?id=15o8oqYnmbOjXUIBgPFzl-SDi78SdTo2O&sz=w512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
    ],
  }
}
