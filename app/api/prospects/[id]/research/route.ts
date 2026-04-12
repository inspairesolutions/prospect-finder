import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/prisma'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Extract signals useful for web design and content from raw HTML */
function extractWebSignals(html: string) {
  const get = (re: RegExp) => { const m = html.match(re); return m ? m[1].trim() : '' }

  // Meta
  const title = get(/<title[^>]*>([^<]{1,150})<\/title>/i)
  const metaDesc =
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i) ||
    get(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i)
  const metaKeywords =
    get(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']{1,200})["']/i) ||
    get(/<meta[^>]+content=["']([^"']{1,200})["'][^>]+name=["']keywords["']/i)

  // All headings h1–h3
  const headings: string[] = []
  const headingMatches = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]{1,250}?)<\/h[1-3]>/gi))
  for (const m of headingMatches) {
    const t = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (t.length > 3 && headings.length < 20) headings.push(t)
  }

  // Visible text from <p>, <li>, <blockquote> — up to ~3000 chars
  const texts: string[] = []
  const textMatches = Array.from(html.matchAll(/<(?:p|li|blockquote)[^>]*>([\s\S]{20,600}?)<\/(?:p|li|blockquote)>/gi))
  for (const m of textMatches) {
    const t = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (t.length > 20 && texts.join(' ').length < 3000) texts.push(t)
  }

  // Hex colors from CSS (filter near-white, near-black, and grays)
  const colorSet = new Set<string>()
  for (const m of Array.from(html.matchAll(/#([0-9a-fA-F]{6})\b/g))) {
    const hex = m[0].toUpperCase()
    const r = parseInt(m[1].slice(0, 2), 16)
    const g = parseInt(m[1].slice(2, 4), 16)
    const b = parseInt(m[1].slice(4, 6), 16)
    const brightness = (r + g + b) / 3
    const maxCh = Math.max(r, g, b)
    const minCh = Math.min(r, g, b)
    const saturation = maxCh - minCh
    // Keep colors with some saturation (not grays) and mid brightness
    if (brightness > 25 && brightness < 230 && saturation > 20) colorSet.add(hex)
    if (colorSet.size >= 15) break
  }

  // Emails from mailto links and text patterns
  const emailSet = new Set<string>()
  for (const m of Array.from(html.matchAll(/href=["']mailto:([^"'?\s]{3,80})["']/gi))) {
    emailSet.add(m[1].toLowerCase())
  }

  // Social media links
  const socialLinks: string[] = []
  for (const m of Array.from(html.matchAll(/href=["'](https?:\/\/(?:www\.)?(?:facebook|instagram|linkedin|twitter|x)\.com[^"'\s>]{0,100})/gi))) {
    if (!socialLinks.includes(m[1])) socialLinks.push(m[1])
  }

  return {
    title,
    metaDesc,
    metaKeywords,
    headings,
    bodyText: texts.slice(0, 20).join('\n'),
    colors: Array.from(colorSet),
    emails: Array.from(emailSet).slice(0, 3),
    socialLinks: socialLinks.slice(0, 6),
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        website: true,
        phone: true,
        formattedAddress: true,
        types: true,
        webAnalysis: true,
      },
    })

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }

    // Fetch and parse website signals
    let signals: ReturnType<typeof extractWebSignals> | null = null
    if (prospect.website) {
      try {
        let url = prospect.website.trim()
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`
        }
        const res = await fetch(url, {
          signal: AbortSignal.timeout(12000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)' },
        })
        signals = extractWebSignals(await res.text())
      } catch {
        // Unreachable — continue without it
      }
    }

    // Supplement with web analysis emails/socials if not found in HTML
    if (prospect.webAnalysis) {
      try {
        const wa = JSON.parse(prospect.webAnalysis)
        if (signals) {
          if (signals.emails.length === 0 && wa.content?.emails?.length > 0) {
            signals.emails = wa.content.emails.slice(0, 3)
          }
          if (signals.socialLinks.length === 0) {
            const social = wa.content?.social_media ?? {}
            signals.socialLinks = Object.values(social).filter(Boolean).slice(0, 6) as string[]
          }
        }
      } catch { /* ignore */ }
    }

    const types = JSON.parse(prospect.types || '[]') as string[]

    // Build compact context
    const ctx: string[] = [
      `Negocio: ${prospect.name}`,
      `Dirección: ${prospect.formattedAddress ?? 'N/A'}`,
      `Teléfono: ${prospect.phone ?? 'N/A'}`,
      `Web: ${prospect.website ?? 'Sin sitio web'}`,
      `Categorías: ${types.join(', ') || 'N/A'}`,
    ]

    if (signals) {
      if (signals.title) ctx.push(`Título web: ${signals.title}`)
      if (signals.metaDesc) ctx.push(`Meta descripción: ${signals.metaDesc}`)
      if (signals.metaKeywords) ctx.push(`Keywords: ${signals.metaKeywords}`)
      if (signals.headings.length) ctx.push(`Headings del sitio:\n${signals.headings.map(h => `  - ${h}`).join('\n')}`)
      if (signals.bodyText) ctx.push(`Contenido del sitio:\n${signals.bodyText}`)
      if (signals.colors.length) ctx.push(`Colores detectados en CSS: ${signals.colors.join(', ')}`)
      if (signals.emails.length) ctx.push(`Emails: ${signals.emails.join(', ')}`)
      if (signals.socialLinks.length) ctx.push(`Redes sociales: ${signals.socialLinks.join(', ')}`)
    }

    // Build renovation-only fields for the schema (only when website exists)
    const hasWebsite = !!prospect.website
    const renovationSchema = hasWebsite ? `,
  "heroHeading": "El H1 o titular principal de la web actual, extraído literalmente.",
  "heroSubheading": "El subtítulo o copy de apoyo del hero, extraído literalmente o null.",
  "heroCopy": "El párrafo introductorio del hero si existe, extraído literalmente o null.",
  "servicesContent": [{"name": "Nombre del servicio tal como aparece", "description": "Descripción tal como aparece en la web"}],
  "existingSections": ["Hero", "Servicios", "Contacto"],
  "toneAndVoice": "Descripción breve del tono actual de la web: formal/informal, técnico/cercano, etc."` : ''

    const userMessage = `Eres un especialista en crear contenido para landing pages. A partir de los datos de este negocio, extrae y elabora la información necesaria para construir una web de calidad.

${ctx.join('\n')}

Responde SOLO con JSON válido, sin texto extra:

{
  "description": "3-5 frases en español que describan el negocio con personalidad: qué hace, para quién, cómo lo hace diferente y dónde. Suficientemente rico para usarse como copy del hero de la web.",
  "services": "Lista detallada de servicios/productos. Cada uno en una línea, con una breve descripción si se puede extraer. Ejemplo: 'Diseño web personalizado — creación de sitios a medida para pymes'. Basado en datos reales del sitio.",
  "uniqueSellingPoints": "3-5 diferenciadores clave listos para usar en secciones '¿Por qué elegirnos?' o beneficios. Incluye el tono del negocio (cercano/profesional/artesanal) y a quién va dirigido si se puede inferir.",
  "contactEmail": "Email real encontrado en el sitio o null.",
  "facebookUrl": "URL completa de Facebook o null.",
  "instagramUrl": "URL completa de Instagram o null.",
  "linkedinUrl": "URL completa de LinkedIn o null.",
  "twitterUrl": "URL completa de Twitter/X o null.",
  "primaryColor": "Color principal de marca en HEX (#XXXXXX). Si hay colores CSS detectados, elige el más usado en botones, links o elementos destacados. Si no hay web, elige uno apropiado para el sector y estilo.",
  "secondaryColor": "Color secundario en HEX (#XXXXXX).",
  "accentColor": "Color de acento en HEX (#XXXXXX). Diferente y complementario a los anteriores.",
  "preferredWebStyle": "moderno-minimalista | corporativo-profesional | creativo-artístico | local-tradicional | premium-lujoso | tecnológico-innovador | amigable-cercano"${renovationSchema}
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: hasWebsite ? 2000 : 1200,
      messages: [{ role: 'user', content: userMessage }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extracted: Record<string, any>
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      extracted = JSON.parse(jsonMatch[0])
    } catch {
      console.error('Failed to parse Claude response:', content.text)
      throw new Error('Claude devolvió una respuesta inválida')
    }

    const allowedFields = [
      'description', 'services', 'uniqueSellingPoints', 'contactEmail',
      'facebookUrl', 'instagramUrl', 'linkedinUrl', 'twitterUrl',
      'primaryColor', 'secondaryColor', 'accentColor', 'preferredWebStyle',
    ]
    const updateData: Record<string, string> = {}
    for (const field of allowedFields) {
      const val = extracted[field]
      if (val && typeof val === 'string' && val.trim()) {
        updateData[field] = val.trim()
      }
    }

    // Save renovation-specific extracted content as JSON
    if (hasWebsite) {
      const renovationFields = ['heroHeading', 'heroSubheading', 'heroCopy', 'servicesContent', 'existingSections', 'toneAndVoice']
      const webContent: Record<string, unknown> = {}
      for (const field of renovationFields) {
        if (extracted[field] !== undefined && extracted[field] !== null) {
          webContent[field] = extracted[field]
        }
      }
      if (Object.keys(webContent).length > 0) {
        updateData.webContentExtract = JSON.stringify(webContent)
      }
    }

    await prisma.prospect.update({ where: { id }, data: updateData })

    return NextResponse.json({
      success: true,
      filledFields: Object.keys(updateData),
      usedWebsite: !!signals,
    })
  } catch (error) {
    console.error('Research error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al investigar' },
      { status: 500 }
    )
  }
}
