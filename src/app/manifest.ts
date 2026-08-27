
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StiloStack Industrial',
    short_name: 'StiloStack',
    description: 'Sistema Inteligente de Gestión Industrial',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#0296FF',
    icons: [
      {
        src: 'https://picsum.photos/seed/stilo-icon/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/stilo-icon/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
