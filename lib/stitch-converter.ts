/**
 * Stitch-to-Project converter.
 * Takes an extracted Stitch ZIP directory and converts it into a standard
 * web project (index.html + assets/) in the given output directory.
 */
import { mkdir, readdir, readFile, writeFile, stat, copyFile } from 'fs/promises'
import { join } from 'path'

// --- Extraction helpers ---

function extractTailwindConfig(html: string): string | null {
  const match = html.match(/<script[^>]*id=["']tailwind-config["'][^>]*>([\s\S]*?)<\/script>/)
  return match ? match[1] : null
}

function extractCustomStyles(html: string): string {
  let styles = ''
  const regex = /<style[^>]*>([\s\S]*?)<\/style>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const trimmed = match[1].trim()
    if (trimmed) styles += trimmed + '\n\n'
  }
  return styles
}

function extractTitle(html: string): string {
  const match = html.match(/<title>([\s\S]*?)<\/title>/)
  return match ? match[1].trim() : 'Stitch Project'
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/)
  return match ? match[1].trim() : ''
}

function extractHeadMeta(html: string): string {
  let meta = ''
  const charset = html.match(/<meta\s+charset=["'][^"']*["'][^>]*\/?>/)
  if (charset) meta += charset[0] + '\n'
  const viewport = html.match(/<meta\s+[^>]*name=["']viewport["'][^>]*\/?>/) ||
    html.match(/<meta\s+content=["']width=device-width[^"']*["'][^>]*\/?>/)
  if (viewport) meta += viewport[0] + '\n'
  return meta
}

function extractFontLinks(html: string): string[] {
  const links: string[] = []
  const preconnect = html.match(/<link[^>]*rel=["']preconnect["'][^>]*\/?>/g)
  if (preconnect) links.push(...preconnect)
  const fonts = html.match(/<link[^>]*href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*\/?>/g)
  if (fonts) links.push(...fonts)
  return Array.from(new Set(links))
}

function extractInlineScripts(html: string): string {
  let scripts = ''
  const regex = /<script(?![^>]*src=)(?![^>]*id=["']tailwind-config["'])[^>]*>([\s\S]*?)<\/script>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const trimmed = match[1].trim()
    if (trimmed) scripts += trimmed + '\n\n'
  }
  return scripts
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// --- File system helpers ---

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function readdirSafe(p: string): Promise<string[]> {
  try {
    return await readdir(p)
  } catch {
    return []
  }
}

interface Screen {
  path: string
  name: string
  slug: string
  html: string
  screenshot: string | null
  order?: number
}

// --- Project detection ---

export async function findProjectRoot(dir: string): Promise<string | null> {
  if (await exists(join(dir, 'code.html'))) return dir

  const entries = await readdirSafe(dir)
  for (const entry of entries) {
    if (entry === '.' || entry === '..' || entry === '__MACOSX' || entry === '.DS_Store') continue
    const p = join(dir, entry)
    const s = await stat(p).catch(() => null)
    if (!s?.isDirectory()) continue

    if (await exists(join(p, 'code.html'))) return p

    const subEntries = await readdirSafe(p)
    for (const sub of subEntries) {
      if (sub === '.' || sub === '..') continue
      const subStat = await stat(join(p, sub)).catch(() => null)
      if (subStat?.isDirectory() && await exists(join(p, sub, 'code.html'))) {
        return p
      }
    }
  }
  return null
}

async function detectScreens(projectRoot: string): Promise<Record<string, Screen>> {
  const screens: Record<string, Screen> = {}

  if (await exists(join(projectRoot, 'code.html'))) {
    let hasSubScreens = false
    const entries = await readdirSafe(projectRoot)
    for (const entry of entries) {
      if (entry === '.' || entry === '..' || entry === '__MACOSX') continue
      const s = await stat(join(projectRoot, entry)).catch(() => null)
      if (s?.isDirectory() && await exists(join(projectRoot, entry, 'code.html'))) {
        hasSubScreens = true
        break
      }
    }
    if (!hasSubScreens) {
      screens['_root'] = {
        path: projectRoot,
        name: 'Home',
        slug: 'index',
        html: join(projectRoot, 'code.html'),
        screenshot: await exists(join(projectRoot, 'screen.png')) ? join(projectRoot, 'screen.png') : null,
      }
      return screens
    }
  }

  const entries = await readdirSafe(projectRoot)
  let index = 0
  for (const entry of entries) {
    if (entry === '.' || entry === '..' || entry === '__MACOSX' || entry === '.DS_Store') continue
    const p = join(projectRoot, entry)
    const s = await stat(p).catch(() => null)
    if (s?.isDirectory() && await exists(join(p, 'code.html'))) {
      screens[entry] = {
        path: p,
        name: entry.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        slug: entry,
        html: join(p, 'code.html'),
        screenshot: await exists(join(p, 'screen.png')) ? join(p, 'screen.png') : null,
        order: index++,
      }
    }
  }

  if (await exists(join(projectRoot, 'code.html')) && Object.keys(screens).length > 0) {
    const rootScreen: Screen = {
      path: projectRoot,
      name: 'Home',
      slug: 'index',
      html: join(projectRoot, 'code.html'),
      screenshot: await exists(join(projectRoot, 'screen.png')) ? join(projectRoot, 'screen.png') : null,
      order: -1,
    }
    return { _root: rootScreen, ...screens }
  }

  return screens
}

async function findDesignSystem(projectRoot: string): Promise<string | null> {
  if (await exists(join(projectRoot, 'DESIGN.md'))) {
    return await readFile(join(projectRoot, 'DESIGN.md'), 'utf-8')
  }
  const entries = await readdirSafe(projectRoot)
  for (const entry of entries) {
    if (entry === '.' || entry === '..') continue
    const p = join(projectRoot, entry, 'DESIGN.md')
    if (await exists(p)) {
      return await readFile(p, 'utf-8')
    }
  }
  return null
}

// --- Conversion ---

async function convertSingleScreen(
  outputDir: string,
  screen: Screen,
  designSystem: string | null
) {
  const html = await readFile(screen.html, 'utf-8')
  const title = extractTitle(html)
  const tailwindConfig = extractTailwindConfig(html)
  const customStyles = extractCustomStyles(html)
  const body = extractBody(html)
  const meta = extractHeadMeta(html)
  const fontLinks = extractFontLinks(html)
  const inlineScripts = extractInlineScripts(html)

  await mkdir(join(outputDir, 'assets/css'), { recursive: true })
  await mkdir(join(outputDir, 'assets/js'), { recursive: true })
  await mkdir(join(outputDir, 'assets/images'), { recursive: true })

  if (customStyles.trim()) {
    await writeFile(join(outputDir, 'assets/css/styles.css'), customStyles)
  }
  if (tailwindConfig) {
    await writeFile(join(outputDir, 'assets/js/tailwind-config.js'), tailwindConfig)
  }
  if (inlineScripts.trim()) {
    await writeFile(join(outputDir, 'assets/js/main.js'), inlineScripts)
  }
  if (screen.screenshot) {
    await copyFile(screen.screenshot, join(outputDir, 'assets/images/screen.png'))
  }
  if (designSystem) {
    await writeFile(join(outputDir, 'DESIGN.md'), designSystem)
  }

  const fontLinksHtml = fontLinks.join('\n    ')
  const cssLink = customStyles.trim() ? '<link rel="stylesheet" href="assets/css/styles.css">' : ''
  const jsScript = inlineScripts.trim() ? '<script src="assets/js/main.js"></script>' : ''

  const indexHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    ${meta}
    <title>${title}</title>
    ${fontLinksHtml}
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <script id="tailwind-config" src="assets/js/tailwind-config.js"></script>
    ${cssLink}
</head>
<body>
${body}
${jsScript}
</body>
</html>`

  await writeFile(join(outputDir, 'index.html'), indexHtml)
}

async function convertMultiScreen(
  outputDir: string,
  screens: Record<string, Screen>,
  designSystem: string | null
) {
  await mkdir(join(outputDir, 'assets/css'), { recursive: true })
  await mkdir(join(outputDir, 'assets/js'), { recursive: true })
  await mkdir(join(outputDir, 'assets/images'), { recursive: true })
  await mkdir(join(outputDir, 'pages'), { recursive: true })

  const firstScreen = Object.values(screens)[0]
  const firstHtml = await readFile(firstScreen.html, 'utf-8')
  const tailwindConfig = extractTailwindConfig(firstHtml)
  const fontLinks = extractFontLinks(firstHtml)
  const siteTitle = extractTitle(firstHtml)

  let allStyles = ''
  let allScripts = ''
  for (const screen of Object.values(screens)) {
    const html = await readFile(screen.html, 'utf-8')
    const styles = extractCustomStyles(html)
    const scripts = extractInlineScripts(html)
    if (styles.trim()) allStyles += `/* === Styles from: ${screen.name} === */\n${styles}\n`
    if (scripts.trim()) allScripts += `/* === Scripts from: ${screen.name} === */\n${scripts}\n`
  }

  if (tailwindConfig) {
    await writeFile(join(outputDir, 'assets/js/tailwind-config.js'), tailwindConfig)
  }
  if (allStyles.trim()) {
    await writeFile(join(outputDir, 'assets/css/styles.css'), allStyles)
  }
  if (allScripts.trim()) {
    await writeFile(join(outputDir, 'assets/js/main.js'), allScripts)
  }
  if (designSystem) {
    await writeFile(join(outputDir, 'DESIGN.md'), designSystem)
  }

  let navItems = ''
  for (const [key, screen] of Object.entries(screens)) {
    const href = key === '_root' ? 'index.html' : `pages/${screen.slug}.html`
    navItems += `            <a href="${href}" class="nav-link px-4 py-2 rounded-full text-sm font-medium transition-colors hover:bg-surface-container-high">${escapeHtml(screen.name)}</a>\n`
  }

  const navHtml = `    <nav class="sticky top-0 z-50 bg-surface/80 backdrop-blur-lg border-b border-outline-variant/15">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <a href="index.html" class="font-headline text-xl font-bold text-on-surface">${escapeHtml(siteTitle)}</a>
                <div class="hidden md:flex items-center gap-2">
${navItems}                </div>
                <button id="mobile-menu-btn" class="md:hidden p-2 rounded-lg hover:bg-surface-container-high">
                    <span class="material-symbols-outlined">menu</span>
                </button>
            </div>
        </div>
        <div id="mobile-menu" class="hidden md:hidden px-4 pb-4">
            <div class="flex flex-col gap-2">
${navItems}            </div>
        </div>
    </nav>`

  const mobileMenuScript = `<script>
document.getElementById('mobile-menu-btn')?.addEventListener('click', function() {
    document.getElementById('mobile-menu').classList.toggle('hidden');
});
</script>`

  const fontLinksHtml = fontLinks.join('\n    ')
  const cssLinkTpl = allStyles.trim() ? '<link rel="stylesheet" href="{CSS_PATH}assets/css/styles.css">' : ''
  const jsMainTpl = allScripts.trim() ? '<script src="{JS_PATH}assets/js/main.js"></script>' : ''

  let isFirst = true
  for (const [key, screen] of Object.entries(screens)) {
    const html = await readFile(screen.html, 'utf-8')
    const body = extractBody(html)
    const pageTitle = extractTitle(html)
    const isRoot = key === '_root'
    const basePath = isRoot ? '' : '../'

    const pageCssLink = cssLinkTpl.replace('{CSS_PATH}', basePath)
    const pageJsMain = jsMainTpl.replace('{JS_PATH}', basePath)

    let pageNav = navHtml
    if (!isRoot) {
      pageNav = pageNav.replace(/href="index\.html"/g, 'href="../index.html"')
      pageNav = pageNav.replace(/href="pages\//g, 'href="')
    }

    const pageHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    ${fontLinksHtml}
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <script id="tailwind-config" src="${basePath}assets/js/tailwind-config.js"></script>
    ${pageCssLink}
</head>
<body class="bg-surface text-on-surface font-body">
${pageNav}
<main>
${body}
</main>
${pageJsMain}
${mobileMenuScript}
</body>
</html>`

    if (isRoot || isFirst) {
      await writeFile(join(outputDir, 'index.html'), pageHtml)
      isFirst = false
    }
    if (!isRoot) {
      await writeFile(join(outputDir, 'pages', `${screen.slug}.html`), pageHtml)
    }

    if (screen.screenshot) {
      await copyFile(screen.screenshot, join(outputDir, 'assets/images', `${screen.slug}.png`))
    }
  }
}

// --- Public API ---

/**
 * Convert an extracted Stitch project directory into a standard web project.
 * @param extractedDir - Directory where the Stitch ZIP was extracted
 * @param outputDir - Directory to write the converted project into
 * @returns true if conversion succeeded, throws on error
 */
export async function convertStitchProject(extractedDir: string, outputDir: string): Promise<void> {
  const projectRoot = await findProjectRoot(extractedDir)
  if (!projectRoot) {
    throw new Error('No se encontró un proyecto Stitch válido (no se detectaron archivos code.html)')
  }

  const screens = await detectScreens(projectRoot)
  const designSystem = await findDesignSystem(projectRoot)

  const screenKeys = Object.keys(screens)
  if (screenKeys.length === 1 && screenKeys[0] === '_root') {
    await convertSingleScreen(outputDir, screens['_root'], designSystem)
  } else {
    await convertMultiScreen(outputDir, screens, designSystem)
  }
}
