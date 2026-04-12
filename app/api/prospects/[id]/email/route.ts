import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/prisma'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres un generador de emails comerciales para presentar landings/webs a prospectos.
Generas emails cortos (150-250 palabras) con tono profesional cercano (tuteo).

FIRMA SIEMPRE:
Freddy Delgado
Inspaire Solutions - WebExpress
Tel: 635673348

ESTRUCTURA RENOVACIÓN (si el prospecto ya tiene web actual):
Subject: "Nueva propuesta web para [Negocio]"
P1: Saludo + "he revisado [web] y preparé rediseño" (2-3 líneas)
P2: Problemas web actual: 2-3 issues
P3: Solución - 3-5 mejoras en bullets
P4: "Ver: [URL propuesta]. ¿Qué te parece?"
Firma

ESTRUCTURA NUEVA (si no tiene web):
Subject: "Propuesta web profesional para [Negocio]"
P1: Saludo + "noté que no tienes web" (2-3 líneas)
P2: Consecuencias: 3-4 bullets
P3: Solución - 4-5 beneficios en bullets
P4: "Ver: [URL propuesta]. ¿Hablamos?"
Firma

FORMATO HTML: usa <p>, <ul><li>, <br>, <strong>, <a href="URL">texto</a>

TONO: tú (no usted), conversacional, específico, beneficios > features
EVITAR: jerga técnica, superlativos, presión de venta, >250 palabras

Genera EXACTAMENTE 2 variantes y responde en JSON con esta estructura:
{
  "type": "renovation" | "new",
  "variants": [
    {
      "id": "direct",
      "name": "Variante 1 - Directo",
      "subject": "...",
      "body": "<html del email>"
    },
    {
      "id": "consultive",
      "name": "Variante 2 - Consultivo",
      "subject": "...",
      "body": "<html del email>"
    }
  ]
}`

function buildProspectContext(prospect: Record<string, unknown>): string {
  const lines: string[] = [
    `NEGOCIO: ${prospect.name}`,
    `DIRECCIÓN: ${prospect.formattedAddress}`,
  ]

  if (prospect.phone) lines.push(`TELÉFONO: ${prospect.phone}`)
  if (prospect.website) lines.push(`WEB ACTUAL: ${prospect.website}`)
  if (prospect.proposedWebUrl) lines.push(`WEB PROPUESTA (nueva): ${prospect.proposedWebUrl}`)
  if (prospect.googleRating) lines.push(`VALORACIÓN GOOGLE: ${prospect.googleRating}/5 (${prospect.googleReviewCount} reseñas)`)
  if (prospect.description) lines.push(`DESCRIPCIÓN: ${prospect.description}`)
  if (prospect.services) lines.push(`SERVICIOS: ${prospect.services}`)
  if (prospect.uniqueSellingPoints) lines.push(`PROPUESTA DE VALOR: ${prospect.uniqueSellingPoints}`)
  if (prospect.notes) lines.push(`NOTAS: ${prospect.notes}`)

  const socials: string[] = []
  if (prospect.facebookUrl) socials.push(`Facebook: ${prospect.facebookUrl}`)
  if (prospect.instagramUrl) socials.push(`Instagram: ${prospect.instagramUrl}`)
  if (prospect.linkedinUrl) socials.push(`LinkedIn: ${prospect.linkedinUrl}`)
  if (socials.length > 0) lines.push(`REDES SOCIALES: ${socials.join(', ')}`)

  lines.push('')
  lines.push(prospect.website
    ? `TIPO DE EMAIL: Renovación (tiene web actual, se propone mejorarla)`
    : `TIPO DE EMAIL: Nueva web (no tiene web, se propone una desde cero)`)

  if (!prospect.proposedWebUrl) {
    lines.push('NOTA: No hay URL de web propuesta registrada aún.')
  }

  return lines.join('\n')
}

// GET - listar propuestas guardadas
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const proposals = await prisma.emailProposal.findMany({
      where: { prospectId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(proposals)
  } catch (error) {
    console.error('Get email proposals error:', error)
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 })
  }
}

// POST - generar email con Claude
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const prospect = await prisma.prospect.findUnique({
      where: { id },
    })

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    const context = buildProspectContext(prospect as unknown as Record<string, unknown>)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Genera los emails para este prospecto:\n\n${context}`,
        },
      ],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON from response (Claude may wrap it in markdown)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON in Claude response:', rawText)
      return NextResponse.json({ error: 'Respuesta inválida de Claude' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (error) {
    console.error('Generate email error:', error)
    return NextResponse.json({ error: 'Error al generar email' }, { status: 500 })
  }
}

// PUT - guardar una propuesta generada
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { subject, body: emailBody, variant } = body

    if (!subject || !emailBody || !variant) {
      return NextResponse.json({ error: 'subject, body y variant son requeridos' }, { status: 400 })
    }

    const proposal = await prisma.emailProposal.create({
      data: {
        prospectId: id,
        subject,
        body: emailBody,
        variant,
      },
    })

    return NextResponse.json(proposal)
  } catch (error) {
    console.error('Save email proposal error:', error)
    return NextResponse.json({ error: 'Error al guardar propuesta' }, { status: 500 })
  }
}
