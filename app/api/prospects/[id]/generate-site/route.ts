import { NextRequest } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import { randomBytes } from 'crypto'
import { mkdir, readdir, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import prisma from '@/lib/prisma'
import { uploadToStorage, CDN_BASE, deletePrefix } from '@/lib/storage'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

async function getAllFiles(dir: string, base: string = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relative = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(path.join(dir, entry.name), relative)))
    } else {
      files.push(relative)
    }
  }
  return files
}

/** Env for Claude Code: uses ANTHROPIC_API_KEY from the app. */
function claudeCodeEnv(configDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  env.CLAUDE_CODE_ENTRYPOINT = 'api'
  env.CLAUDE_CONFIG_DIR = configDir
  if (process.env.ANTHROPIC_API_KEY) {
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
    delete env.ANTHROPIC_AUTH_TOKEN
  }
  return env
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── In-memory build tracking ──────────────────────────────────────────────────

interface BuildState {
  status: 'running' | 'done' | 'error'
  log: string
  slug: string
  startedAt: number
  child?: ChildProcess
  /** Public URL on DO Spaces after successful deploy */
  publicUrl?: string
}

/** Active and recent builds, keyed by prospectId */
const builds = new Map<string, BuildState>()

/** Clean up finished builds after 10 minutes */
function scheduleCleanup(prospectId: string) {
  setTimeout(() => {
    const build = builds.get(prospectId)
    if (build && build.status !== 'running') {
      builds.delete(prospectId)
    }
  }, 10 * 60 * 1000)
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPTS (previously in prompt/route.ts)
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT_RENOVATION = `Eres un diseñador y desarrollador web experto en pymes locales. Tu tarea es generar el HTML completo y final de una landing page renovada para un negocio, a partir de los datos de su web actual y el diagnóstico previo.

═══════════════════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════════════════

Genera un sitio web completo con archivos separados: index.html, styles.css, y script.js (si hace falta JS). Crea todos los archivos en tu directorio de trabajo.

Stack: HTML + CSS + JS vanilla. Sin frameworks, sin librerías externas (salvo Google Fonts). Archivos separados y bien organizados.

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

Genera un sitio web completo con archivos separados: index.html, styles.css, y script.js (si hace falta JS). Crea todos los archivos en tu directorio de trabajo.

Stack: HTML + CSS + JS vanilla. Sin frameworks, sin librerías externas (salvo Google Fonts). Archivos separados y bien organizados.

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
// Context builders — build deterministic context from prospect data
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

  // Extracted web content (from research route)
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
      // ignore parse errors
    }
  }

  // Web analysis — the diagnosis that drives improvement directives
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

// ── POST — launch Claude Code to generate the site directly ─────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // If already running, return immediately
  const existing = builds.get(id)
  if (existing?.status === 'running') {
    return Response.json({ message: 'Build ya en progreso', slug: existing.slug })
  }

  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: { reviews: { take: 10 } },
  })

  if (!prospect) {
    return Response.json({ error: 'Prospect not found' }, { status: 404 })
  }

  if (!prospect.description && !prospect.services) {
    return Response.json(
      { error: 'Añade al menos una descripción o servicios del negocio antes de generar.' },
      { status: 400 }
    )
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return Response.json(
      { error: 'Falta ANTHROPIC_API_KEY en el entorno.' },
      { status: 500 }
    )
  }

  if (
    !process.env.DO_ACCESS_KEY?.trim() ||
    !process.env.DO_SECRET_KEY?.trim() ||
    !process.env.DO_ENDPOINT?.trim()
  ) {
    return Response.json(
      {
        error:
          'Configura DO_ENDPOINT, DO_ACCESS_KEY y DO_SECRET_KEY para publicar la landing en DigitalOcean Spaces.',
      },
      { status: 500 }
    )
  }

  // Build context deterministically from prospect data
  const isRenovation = !!prospect.website?.trim()
  const systemPrompt = isRenovation ? SYSTEM_PROMPT_RENOVATION : SYSTEM_PROMPT_NEW
  const context = isRenovation
    ? buildRenovationContext(prospect as unknown as Record<string, unknown>)
    : buildNewWebContext(prospect as unknown as Record<string, unknown>)

  // Append real reviews
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

  const slug = slugify(prospect.name)
  const projectRoot = process.cwd()
  const s3Prefix = `site/${id}`
  const baseHref = `${CDN_BASE}/${s3Prefix}/`
  const siteDir = path.join(tmpdir(), 'prospect-finder-claude-site', id)
  await mkdir(siteDir, { recursive: true })

  const fullPrompt = [
    systemPrompt,
    '',
    '═══════════════════════════════════════',
    'CONFIGURACIÓN DEL PROYECTO:',
    '═══════════════════════════════════════',
    '',
    `Tu directorio de trabajo es: ${siteDir}`,
    `Crea todos los archivos de la web aquí.`,
    '',
    `La web se publicará en DigitalOcean Spaces. URL base pública: ${baseHref}`,
    `En index.html, dentro de <head>, inmediatamente después de <meta charset>, incluye exactamente:`,
    `<base href="${baseHref}">`,
    `Así funcionan rutas relativas (styles.css, script.js, img/...) contra el CDN. Una sola etiqueta <base>.`,
    '',
    `Nombre del negocio: ${prospect.name}`,
    prospect.website ? `Web actual del negocio: ${prospect.website}` : '(No tiene web actual)',
    '',
    '═══════════════════════════════════════',
    'DATOS E INSTRUCCIONES:',
    '═══════════════════════════════════════',
    '',
    isRenovation
      ? `Genera la landing page renovada para este negocio. Usa el contenido extraído y el diagnóstico para mejorar radicalmente diseño, copy, SEO y conversión.`
      : `Genera la landing page para este negocio (web nueva desde cero). Escribe TODO el copy real basándote en los datos del negocio.`,
    '',
    fullContext,
  ].join('\n')

  // Initialize build state BEFORE spawning
  const buildState: BuildState = {
    status: 'running',
    log: `--- Generando landing (temporal) y publicación en Spaces: ${s3Prefix}/ ---\n`,
    slug,
    startedAt: Date.now(),
  }
  builds.set(id, buildState)

  // Spawn Claude Code CLI — runs detached from the HTTP request
  let claudeConfigDir: string
  try {
    claudeConfigDir = path.join(tmpdir(), 'prospect-finder-claude', randomBytes(8).toString('hex'))
    await mkdir(claudeConfigDir, { recursive: true })
  } catch {
    buildState.status = 'error'
    buildState.log += '--- Error al preparar directorio de config ---\n'
    return Response.json(
      { error: 'No se pudo preparar el directorio de configuración de Claude Code.' },
      { status: 500 }
    )
  }

  const child = spawn('claude', [
    '-p',
    '--output-format', 'text',
    '--allowedTools', 'Read', 'Write', 'Edit', 'Bash(npm:*)', 'Bash(npx:*)', 'Bash(mkdir:*)', 'Bash(ls:*)', 'Bash(cp:*)', 'Glob', 'Grep', 'WebFetch',
    '--add-dir', projectRoot,
  ], {
    cwd: siteDir,
    env: claudeCodeEnv(claudeConfigDir),
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  })

  buildState.child = child

  child.stdin.write(fullPrompt)
  child.stdin.end()

  child.stdout.on('data', (chunk: Buffer) => {
    buildState.log += chunk.toString()
  })

  child.stderr.on('data', (chunk: Buffer) => {
    buildState.log += chunk.toString()
  })

  child.on('error', (err) => {
    buildState.status = 'error'
    buildState.log += `\n--- Error: ${err.message} ---\n`
    delete buildState.child
    scheduleCleanup(id)
  })

  child.on('close', (code) => {
    void (async () => {
      if (code !== 0) {
        buildState.status = 'error'
        buildState.log += `\n--- Claude Code terminó con código ${code} ---\n`
        delete buildState.child
        await rm(siteDir, { recursive: true, force: true }).catch(() => {})
        scheduleCleanup(id)
        return
      }

      try {
        const allFiles = (await getAllFiles(siteDir)).filter((f) => !f.startsWith('.'))
        if (allFiles.length === 0) {
          buildState.status = 'error'
          buildState.log +=
            '\n--- Error: no se generó ningún archivo en el directorio de trabajo ---\n'
          delete buildState.child
          await rm(siteDir, { recursive: true, force: true }).catch(() => {})
          scheduleCleanup(id)
          return
        }

        const hasIndex = allFiles.some(
          (f) => f === 'index.html' || f.endsWith('/index.html')
        )
        if (!hasIndex) {
          buildState.status = 'error'
          buildState.log +=
            '\n--- Error: falta index.html en la salida generada ---\n'
          delete buildState.child
          await rm(siteDir, { recursive: true, force: true }).catch(() => {})
          scheduleCleanup(id)
          return
        }

        await deletePrefix(`${s3Prefix}/`)

        for (const relPath of allFiles) {
          const filePath = path.join(siteDir, relPath)
          const buf = await readFile(filePath)
          const key = `${s3Prefix}/${relPath.replace(/\\/g, '/')}`
          await uploadToStorage(key, buf, getMimeType(relPath))
        }

        const publicUrl = `${CDN_BASE}/${s3Prefix}/index.html`
        buildState.publicUrl = publicUrl

        const siteSlug = `cc-${id}`
        const existingSite = await prisma.prospectSite.findFirst({
          where: { prospectId: id, source: 'claude-code' },
        })

        if (existingSite) {
          await prisma.prospectSite.update({
            where: { id: existingSite.id },
            data: {
              publicUrl,
              fileCount: allFiles.length,
              label: 'Landing (Claude Code)',
              slug: siteSlug,
            },
          })
        } else {
          await prisma.prospectSite.create({
            data: {
              prospectId: id,
              label: 'Landing (Claude Code)',
              slug: siteSlug,
              publicUrl,
              source: 'claude-code',
              fileCount: allFiles.length,
            },
          })
        }

        buildState.status = 'done'
        buildState.log += `\n--- Publicado en Spaces: ${publicUrl} ---\n`
      } catch (err) {
        buildState.status = 'error'
        const msg = err instanceof Error ? err.message : String(err)
        buildState.log += `\n--- Error al subir a Spaces: ${msg} ---\n`
      } finally {
        delete buildState.child
        await rm(siteDir, { recursive: true, force: true }).catch(() => {})
        scheduleCleanup(id)
      }
    })()
  })

  return Response.json({ message: 'Build iniciado', slug })
}

// ── GET — poll build status OR check if site exists ──────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const poll = searchParams.get('poll')

  // If polling for build status
  if (poll === 'true') {
    const build = builds.get(id)
    if (!build) {
      return Response.json({ status: 'idle', log: '' })
    }
    return Response.json({
      status: build.status,
      log: build.log,
      slug: build.slug,
      elapsed: Math.round((Date.now() - build.startedAt) / 1000),
      publicUrl: build.publicUrl,
    })
  }

  // Otherwise: landing generada con Claude Code publicada en DO Spaces
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    select: { name: true },
  })

  if (!prospect) {
    return Response.json({ error: 'Prospect not found' }, { status: 404 })
  }

  const slug = slugify(prospect.name)
  const claudeSite = await prisma.prospectSite.findFirst({
    where: { prospectId: id, source: 'claude-code' },
  })

  if (claudeSite) {
    return Response.json({
      exists: true,
      slug,
      path: null,
      publicUrl: claudeSite.publicUrl,
      files: [],
      fileCount: claudeSite.fileCount,
      siteId: claudeSite.id,
    })
  }

  return Response.json({
    exists: false,
    slug,
    path: null,
    publicUrl: null,
    files: [],
  })
}

// ── DELETE — cancel a running build ──────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const build = builds.get(id)

  if (!build || build.status !== 'running') {
    return Response.json({ message: 'No hay build en progreso' })
  }

  if (build.child) {
    build.child.kill('SIGTERM')
  }
  build.status = 'error'
  build.log += '\n--- Build cancelado por el usuario ---\n'
  delete build.child
  scheduleCleanup(id)

  return Response.json({ message: 'Build cancelado' })
}
