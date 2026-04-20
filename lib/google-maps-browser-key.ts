function trimSurroundingQuotes(value: string): string {
  let v = value.trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim()
  }
  return v
}

/**
 * Clave del Maps JavaScript API (autocomplete + mapa).
 * - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: válida en local y si está en build time.
 * - GOOGLE_MAPS_BROWSER_API_KEY: solo servidor; se inyecta al cliente vía props (útil en DO con vars solo en runtime).
 */
export function getGoogleMapsBrowserApiKey(): string {
  const raw =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_BROWSER_API_KEY ||
    ''
  return trimSurroundingQuotes(raw)
}
