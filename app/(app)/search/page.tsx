import { SearchPageClient } from './search-page-client'
import { getGoogleMapsBrowserApiKey } from '@/lib/google-maps-browser-key'

export default function SearchPage() {
  const googleMapsApiKey = getGoogleMapsBrowserApiKey()
  return <SearchPageClient googleMapsApiKey={googleMapsApiKey} />
}
