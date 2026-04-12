import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/prisma'
import { uploadToStorage } from '@/lib/storage'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT_RENOVATION = `Eres un diseñador y desarrollador web experto en pymes locales. Tu tarea es generar el HTML completo y final de una landing page renovada para un negocio, a partir de los datos de su web actual y el diagnóstico previo.

═══════════════════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con el código HTML completo. Sin explicaciones, sin markdown, sin bloques de código. El output empieza con <!DOCTYPE html> y termina con </html>.

Stack: HTML + CSS (en <style>) + JS (en <script>). Sin frameworks, sin librerías externas (salvo Google Fonts). Un único archivo autocontenido.

═══════════════════════════════════════════════════════════════
FILOSOFÍA
═══════════════════════════════════════════════════════════════

Estás renovando una web existente. Tienes el contenido actual extraído — tu trabajo es mejorarlo radicalmente en todos los ejes: diseño, UX, copy, SEO y conversión. La identidad del negocio se conserva y se eleva, no se reemplaza.

═══════════════════════════════════════════════════════════════
DISEÑO VISUAL
═══════════════════════════════════════════════════════════════

- Usa los colores de marca del negocio (primaryColor, secondaryColor, accentColor) como base de la paleta. Si no hay colores definidos, elige una paleta coherente con el sector y el estilo web indicado.
- Tipografía: usa Google Fonts (una sola familia, máximo dos pesos). Elige según el tono: negocios locales tradicionales → serif humanista o sans-serif clásica; negocios modernos → sans-serif geométrica limpia.
- Layout: diseño de una columna con secciones bien delimitadas. Espaciado generoso. Jerarquía visual clara.
- El diseño debe sentirse como una evolución premium del sitio original, no como una web diferente.
- Responsive obligatorio: el layout funciona perfectamente en móvil, tablet y escritorio.
- Estilo visual según \`preferredWebStyle\`:
  - moderno-minimalista → mucho espacio en blanco, tipografía grande, pocos elementos
  - corporativo-profesional → estructura sólida, colores sobrios, confianza visual
  - creativo-artístico → más libertad en layout, uso expresivo del color
  - local-tradicional → calidez, cercanía, elementos visuales familiares
  - premium-lujoso → oscuro o muy claro, tipografía elegante, detalles finos
  - tecnológico-innovador → dark mode o neutros fríos, elementos técnicos, modernidad
  - amigable-cercano → colores cálidos, redondez, tono conversacional

═══════════════════════════════════════════════════════════════
COPY Y CONTENIDO
═══════════════════════════════════════════════════════════════

- Usa el contenido extraído de la web actual (heroHeading, heroCopy, servicesContent, etc.) como base.
- Mejora todo el copy: más orientado a beneficios del cliente, más persuasivo, más claro. Elimina jerga del sector que el cliente no entiende.
- Reescribe los headings débiles con enfoque en el beneficio del cliente.
- Añade secciones que falten según el negocio: testimonios, FAQ, por qué elegirnos, proceso de trabajo, etc.
- Usa las reseñas reales de Google como testimonios, atribuidas con nombre y puntuación.
- Todo el copy en español.

═══════════════════════════════════════════════════════════════
SEO
═══════════════════════════════════════════════════════════════

- <title>: nombre del negocio + servicio principal + ciudad (50-60 caracteres)
- <meta name="description">: propuesta de valor clara + ciudad (150-160 caracteres)
- Un solo H1 con la keyword principal + ubicación
- H2s para cada sección principal con keywords secundarias relevantes
- Schema.org: incluir JSON-LD con el tipo apropiado (LocalBusiness o subtipo específico) con name, address, telephone, url, geo, openingHours si están disponibles
- Keywords locales integradas de forma natural en el copy

═══════════════════════════════════════════════════════════════
CONVERSIÓN (CRO)
═══════════════════════════════════════════════════════════════

- El visitante debe entender qué ofrece el negocio y por qué elegirlo en menos de 5 segundos.
- CTA principal visible above the fold, con texto orientado al valor (no "Enviar" sino "Pedir cita", "Solicitar presupuesto", "Reservar mesa" según el negocio).
- Repetir el CTA en puntos de decisión a lo largo de la página.
- 1-2 banners CTA entre secciones, tras secciones que generen confianza (testimonios, servicios). Naturales, no agresivos.
- Señales de confianza cerca de los CTAs: reseñas, años de experiencia, certificaciones si las hay.
- Teléfono clicable en móvil (<a href="tel:...">).
- Formulario de contacto simple: máximo 3-4 campos (nombre, teléfono/email, mensaje).
- Datos de contacto visibles sin necesidad de scroll.

═══════════════════════════════════════════════════════════════
ESTRUCTURA DE SECCIONES
═══════════════════════════════════════════════════════════════

Incluye las secciones que apliquen al negocio en este orden:
1. Header con logo/nombre y navegación simple
2. Hero con H1, copy de apoyo y CTA principal
3. Servicios (mejorados respecto a los actuales)
4. Banner CTA intermedio
5. Por qué elegirnos / diferenciadores
6. Testimonios (reseñas reales de Google)
7. FAQ (3-5 preguntas reales del sector)
8. Banner CTA final
9. Contacto con formulario, teléfono y dirección
10. Footer con datos legales básicos y redes sociales si las hay

Omite secciones que no apliquen al negocio sin avisar.

═══════════════════════════════════════════════════════════════
RENDIMIENTO
═══════════════════════════════════════════════════════════════

- CSS mínimo y sin redundancias. Sin librerías externas salvo Google Fonts.
- JS solo si aporta funcionalidad necesaria (menú móvil, smooth scroll, formulario). Sin efectos innecesarios.
- Imágenes: no incluyas imágenes que no sean URLs reales del negocio. Usa fondos de color o gradientes CSS donde harían falta imágenes.
- El HTML debe cargar rápido en conexiones lentas.`

const SYSTEM_PROMPT_NEW = `Eres un diseñador y desarrollador web experto en pymes locales. Tu tarea es generar el HTML completo y final de una landing page para un negocio que no tiene web, construyendo todo desde cero.

═══════════════════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con el código HTML completo. Sin explicaciones, sin markdown, sin bloques de código. El output empieza con <!DOCTYPE html> y termina con </html>.

Stack: HTML + CSS (en <style>) + JS (en <script>). Sin frameworks, sin librerías externas (salvo Google Fonts). Un único archivo autocontenido.

═══════════════════════════════════════════════════════════════
DISEÑO VISUAL
═══════════════════════════════════════════════════════════════

- Usa los colores de marca si están definidos (primaryColor, secondaryColor, accentColor). Si no, elige una paleta coherente con el sector y el estilo web indicado.
- Tipografía: Google Fonts, una familia, máximo dos pesos.
- Layout de una columna, espaciado generoso, jerarquía visual clara. Responsive obligatorio.
- Estilo visual según \`preferredWebStyle\` (mismos criterios que en renovación).

═══════════════════════════════════════════════════════════════
COPY Y CONTENIDO
═══════════════════════════════════════════════════════════════

- Todo el copy se crea desde cero con los datos del negocio. No hay web de referencia.
- Copy orientado a beneficios del cliente, en español, en el tono del negocio.
- Usa las reseñas reales de Google como testimonios.
- Nada de placeholders. Todo el texto es el texto final real de la web.

═══════════════════════════════════════════════════════════════
SEO, CONVERSIÓN Y ESTRUCTURA
═══════════════════════════════════════════════════════════════

Aplica exactamente los mismos criterios de SEO, CRO y estructura de secciones que en el prompt de renovación.`

// ═══════════════════════════════════════════════════════════════
// Context builders
// ═══════════════════════════════════════════════════════════════

function buildRenovationContext(prospect: Record<string, unknown>): string {
  const lines: string[] = [
    '═══════════════════════════════════',
    'DATOS DEL NEGOCIO',
    '═══════════════════════════════════',
    '',
    `Nombre: ${prospect.name}`,
    `Web actual: ${prospect.website}`,
    `Dirección: ${prospect.formattedAddress}`,
  ]

  if (prospect.phone) lines.push(`Teléfono: ${prospect.phone}`)
  if (prospect.proposedWebUrl) lines.push(`URL web propuesta: ${prospect.proposedWebUrl}`)
  if (prospect.contactEmail) lines.push(`Email de contacto: ${prospect.contactEmail}`)
  if (prospect.googleRating) lines.push(`Valoración Google: ${prospect.googleRating}/5 (${prospect.googleReviewCount} reseñas)`)

  const types = JSON.parse((prospect.types as string) || '[]') as string[]
  if (types.length > 0) lines.push(`Categorías: ${types.join(', ')}`)

  if (prospect.description) {
    lines.push('', `Descripción del negocio (puede incluir info no publicada en la web):`)
    lines.push(String(prospect.description))
  }

  if (prospect.services) {
    lines.push('', `Servicios conocidos (pueden incluir servicios no listados en la web):`)
    lines.push(String(prospect.services))
  }

  if (prospect.uniqueSellingPoints) {
    lines.push('', `Diferenciadores conocidos (pueden no estar en la web):`)
    lines.push(String(prospect.uniqueSellingPoints))
  }

  const colors: string[] = []
  if (prospect.primaryColor) colors.push(`Primario: ${prospect.primaryColor}`)
  if (prospect.secondaryColor) colors.push(`Secundario: ${prospect.secondaryColor}`)
  if (prospect.accentColor) colors.push(`Acento: ${prospect.accentColor}`)
  if (colors.length > 0) lines.push('', `Colores de marca: ${colors.join(' | ')}`)

  if (prospect.preferredWebStyle) lines.push(`Estilo web: ${prospect.preferredWebStyle}`)

  const socials: string[] = []
  if (prospect.facebookUrl) socials.push(`Facebook: ${prospect.facebookUrl}`)
  if (prospect.instagramUrl) socials.push(`Instagram: ${prospect.instagramUrl}`)
  if (prospect.linkedinUrl) socials.push(`LinkedIn: ${prospect.linkedinUrl}`)
  if (prospect.twitterUrl) socials.push(`Twitter: ${prospect.twitterUrl}`)
  if (socials.length > 0) lines.push('', `Redes sociales:\n${socials.map(s => `  • ${s}`).join('\n')}`)

  if (prospect.notes) {
    lines.push('', `Notas adicionales (contexto interno, no público):`)
    lines.push(String(prospect.notes))
  }

  if (prospect.webContentExtract) {
    try {
      const wc = JSON.parse(prospect.webContentExtract as string)
      lines.push('', '═══════════════════════════════════')
      lines.push('CONTENIDO EXTRAÍDO DE LA WEB ACTUAL')
      lines.push('═══════════════════════════════════')
      if (wc.heroHeading) lines.push(`Hero H1: "${wc.heroHeading}"`)
      if (wc.heroSubheading) lines.push(`Hero subtítulo: "${wc.heroSubheading}"`)
      if (wc.heroCopy) lines.push(`Hero copy: "${wc.heroCopy}"`)
      if (wc.toneAndVoice) lines.push(`Tono y voz: ${wc.toneAndVoice}`)
      if (wc.existingSections?.length) lines.push(`Secciones actuales: ${wc.existingSections.join(', ')}`)
      if (wc.servicesContent?.length) {
        lines.push('', 'Servicios en la web actual:')
        for (const svc of wc.servicesContent) {
          lines.push(`  • ${svc.name}${svc.description ? ` — ${svc.description}` : ''}`)
        }
      }
    } catch {
      // ignore
    }
  }

  if (prospect.webAnalysis) {
    try {
      const wa = JSON.parse(prospect.webAnalysis as string)
      lines.push('', '═══════════════════════════════════')
      lines.push('DIAGNÓSTICO DE LA WEB ACTUAL (del análisis previo)')
      lines.push('═══════════════════════════════════')
      lines.push(`Puntuación general: ${wa.scoring?.total_score ?? 'N/A'}/100 (${wa.scoring?.category ?? ''})`)

      if (wa.seo) {
        lines.push('', 'SEO actual:')
        if (wa.seo.title) lines.push(`  Título: "${wa.seo.title}"`)
        if (wa.seo.meta_description) lines.push(`  Meta: "${wa.seo.meta_description}"`)
        if (wa.seo.issues?.length) lines.push(`  Problemas: ${wa.seo.issues.join('; ')}`)
        if (wa.seo.recommendations?.length) lines.push(`  Mejoras sugeridas: ${wa.seo.recommendations.join('; ')}`)
      }

      if (wa.content) {
        lines.push('', 'Contenido:')
        lines.push(`  Páginas estimadas: ${wa.content.estimated_pages ?? 'N/A'}`)
        lines.push(`  Tiene blog: ${wa.content.has_blog ? 'Sí' : 'No'}`)
        lines.push(`  Tiene tienda: ${wa.content.has_shop ? 'Sí' : 'No'}`)
      }

      if (wa.performance?.issues?.length) {
        lines.push('', `Problemas de rendimiento: ${wa.performance.issues.join('; ')}`)
      }
      if (wa.responsive?.issues?.length) {
        lines.push(`Problemas mobile: ${wa.responsive.issues.join('; ')}`)
      }
      if (wa.scoring?.negative_factors?.length) {
        lines.push('', `Factores negativos: ${wa.scoring.negative_factors.join('; ')}`)
      }
      if (wa.scoring?.positive_factors?.length) {
        lines.push(`Puntos fuertes a conservar: ${wa.scoring.positive_factors.join('; ')}`)
      }
    } catch {
      // ignore
    }
  }

  return lines.join('\n')
}

function buildNewWebContext(prospect: Record<string, unknown>): string {
  const lines: string[] = [
    '═══════════════════════════════════',
    'DATOS DEL NEGOCIO',
    '═══════════════════════════════════',
    '',
    `Nombre: ${prospect.name}`,
    `Dirección: ${prospect.formattedAddress}`,
  ]

  if (prospect.phone) lines.push(`Teléfono: ${prospect.phone}`)
  if (prospect.proposedWebUrl) lines.push(`URL web propuesta: ${prospect.proposedWebUrl}`)
  if (prospect.contactEmail) lines.push(`Email de contacto: ${prospect.contactEmail}`)
  if (prospect.googleRating) lines.push(`Valoración Google: ${prospect.googleRating}/5 (${prospect.googleReviewCount} reseñas)`)

  const types = JSON.parse((prospect.types as string) || '[]') as string[]
  if (types.length > 0) lines.push(`Categorías: ${types.join(', ')}`)

  if (prospect.description) {
    lines.push('', `Descripción del negocio:`)
    lines.push(String(prospect.description))
  }

  if (prospect.services) {
    lines.push('', `Servicios:`)
    lines.push(String(prospect.services))
  }

  if (prospect.uniqueSellingPoints) {
    lines.push('', `Propuesta de valor / diferenciadores:`)
    lines.push(String(prospect.uniqueSellingPoints))
  }

  const colors: string[] = []
  if (prospect.primaryColor) colors.push(`Primario: ${prospect.primaryColor}`)
  if (prospect.secondaryColor) colors.push(`Secundario: ${prospect.secondaryColor}`)
  if (prospect.accentColor) colors.push(`Acento: ${prospect.accentColor}`)
  if (colors.length > 0) lines.push('', `Colores de marca: ${colors.join(' | ')}`)

  if (prospect.preferredWebStyle) lines.push(`Estilo web: ${prospect.preferredWebStyle}`)

  const socials: string[] = []
  if (prospect.facebookUrl) socials.push(`Facebook: ${prospect.facebookUrl}`)
  if (prospect.instagramUrl) socials.push(`Instagram: ${prospect.instagramUrl}`)
  if (prospect.linkedinUrl) socials.push(`LinkedIn: ${prospect.linkedinUrl}`)
  if (prospect.twitterUrl) socials.push(`Twitter: ${prospect.twitterUrl}`)
  if (socials.length > 0) lines.push('', `Redes sociales:\n${socials.map(s => `  • ${s}`).join('\n')}`)

  if (prospect.notes) {
    lines.push('', `Notas adicionales:`)
    lines.push(String(prospect.notes))
  }

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
// POST — streaming HTML generation via Anthropic API
// Generates a self-contained HTML file, uploads to DO Spaces,
// and saves ProspectSite record in DB.
// ═══════════════════════════════════════════════════════════════

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: { reviews: { take: 10 } },
    })

    if (!prospect) {
      return new Response(JSON.stringify({ error: 'Prospect not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!prospect.description && !prospect.services) {
      return new Response(
        JSON.stringify({ error: 'Añade al menos una descripción o servicios del negocio antes de generar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build context
    const isRenovation = !!prospect.website?.trim()
    const systemPrompt = isRenovation ? SYSTEM_PROMPT_RENOVATION : SYSTEM_PROMPT_NEW

    const context = isRenovation
      ? buildRenovationContext(prospect as unknown as Record<string, unknown>)
      : buildNewWebContext(prospect as unknown as Record<string, unknown>)

    let reviewsText = ''
    if (prospect.reviews && prospect.reviews.length > 0) {
      reviewsText = prospect.reviews
        .filter((r) => r.text)
        .map((r) => `  ★${r.rating}/5 — ${r.authorName} (${r.relativeTime ?? ''}): "${r.text}"`)
        .join('\n')
    }

    const reviewsSection = reviewsText
      ? `\n═══════════════════════════════════\nRESEÑAS REALES DE GOOGLE (usar en testimonios):\n═══════════════════════════════════\n${reviewsText}`
      : ''

    const fullContext = `${context}${reviewsSection}`

    const userMessage = isRenovation
      ? `Genera el HTML completo de la landing page renovada para este negocio. Usa el contenido extraído y el diagnóstico para mejorar radicalmente diseño, copy, SEO y conversión.\n\n${fullContext}`
      : `Genera el HTML completo de la landing page para este negocio (web nueva desde cero). Escribe TODO el copy real basándote en los datos del negocio.\n\n${fullContext}`

    // Streaming response
    const encoder = new TextEncoder()
    const slug = slugify(prospect.name)

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            system: [
              {
                type: 'text',
                text: systemPrompt,
                cache_control: { type: 'ephemeral' },
              },
            ],
            messages: [
              {
                role: 'user',
                content: userMessage,
              },
            ],
          })

          let fullText = ''
          let stopReason: string | null = null

          for await (const event of response) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              fullText += event.delta.text
              controller.enqueue(encoder.encode(event.delta.text))
            }
            if (event.type === 'message_delta' && event.delta.stop_reason) {
              stopReason = event.delta.stop_reason
            }
          }

          if (stopReason === 'max_tokens') {
            const warning = '\n\n<!-- ⚠️ HTML truncado por límite de tokens -->'
            fullText += warning
            controller.enqueue(encoder.encode(warning))
          }

          // Upload to DO Spaces + save ProspectSite
          if (fullText && fullText.includes('<!DOCTYPE') || fullText.includes('<html')) {
            try {
              const htmlBuffer = Buffer.from(fullText, 'utf-8')
              const storageKey = `site/${slug}/index.html`
              const publicUrl = await uploadToStorage(storageKey, htmlBuffer, 'text/html; charset=utf-8')

              // Upsert ProspectSite record
              const existingSite = await prisma.prospectSite.findFirst({
                where: { prospectId: id, source: 'api-generated' },
              })

              if (existingSite) {
                await prisma.prospectSite.update({
                  where: { id: existingSite.id },
                  data: { publicUrl, fileCount: 1 },
                })
              } else {
                await prisma.prospectSite.create({
                  data: {
                    prospectId: id,
                    label: 'Landing (API directa)',
                    slug: `${slug}-api`,
                    publicUrl,
                    source: 'api-generated',
                    fileCount: 1,
                  },
                })
              }

              // Send metadata as final SSE-style line so the client knows the URL
              const meta = JSON.stringify({ publicUrl, source: 'api-generated' })
              controller.enqueue(encoder.encode(`\n<!--META:${meta}-->`))
            } catch (uploadErr) {
              console.error('Failed to upload HTML to storage:', uploadErr)
            }
          }

          controller.close()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error desconocido'
          controller.enqueue(encoder.encode(`\n\nERROR: ${msg}`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Landing generation error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
