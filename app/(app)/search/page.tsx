import { SearchPageClient } from './search-page-client'
import { getGoogleMapsBrowserApiKey } from '@/lib/google-maps-browser-key'

/** Sin esto, Next puede pre-renderizar /search en el build con la clave vacía (p. ej. en DigitalOcean). */
export const dynamic = 'force-dynamic'

export default function SearchPage() {
  const googleMapsApiKey = getGoogleMapsBrowserApiKey()
  return <SearchPageClient googleMapsApiKey={googleMapsApiKey} />
}
