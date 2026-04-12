import nodemailer from 'nodemailer'

// ─── SMTP config ────────────────────────────────────────────────────────────

function getTransport() {
  const port = Number(process.env.SMTP_PORT ?? 587)
  // Port 465 always uses SSL; otherwise respect SMTP_SECURE env var
  const secure = port === 465 || process.env.SMTP_SECURE === 'true'

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export interface SentResult {
  messageId: string
}

/**
 * Send an email via SMTP.
 * Returns the Message-ID assigned by the server.
 */
export async function sendEmail({
  to,
  toName,
  subject,
  bodyHtml,
  inReplyTo,
}: {
  to: string
  toName?: string
  subject: string
  bodyHtml: string
  inReplyTo?: string
}): Promise<SentResult> {
  const transport = getTransport()

  const recipient = toName ? `${toName} <${to}>` : to

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    subject,
    html: bodyHtml,
    ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
  })

  return { messageId: info.messageId }
}

// ─── IMAP config ─────────────────────────────────────────────────────────────

export interface InboundMessage {
  messageId: string
  inReplyTo: string
  fromEmail: string
  fromName: string
  subject: string
  bodyHtml: string
  bodyText: string
  date: Date
}

/**
 * Check IMAP for replies to known message IDs.
 * Returns new inbound messages that reply to any of `knownMessageIds`.
 */
export async function checkReplies(
  knownMessageIds: string[]
): Promise<InboundMessage[]> {
  if (knownMessageIds.length === 0) return []

  // Dynamic import to avoid bundling issues with thread-stream on Node 18
  const { ImapFlow } = await import('imapflow')

  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASS!,
    },
    logger: false,
  })

  const results: InboundMessage[] = []

  try {
    await client.connect()

    const lock = await client.getMailboxLock('INBOX')
    try {
      // Search for messages in the last 90 days to keep it manageable
      const since = new Date()
      since.setDate(since.getDate() - 90)

      // client.fetch() does NOT accept search criteria directly —
      // we must call client.search() first to get sequence numbers
      // search() returns false when mailbox is empty, or number[] of sequence numbers
      const seqNums = await client.search({ since })

      if (seqNums && seqNums.length > 0) {
        for await (const msg of client.fetch(seqNums, { envelope: true, source: true })) {
          const envelope = msg.envelope
          if (!envelope) continue

          const inReplyTo = (envelope.inReplyTo ?? '').trim()
          if (!inReplyTo) continue

          // Check if this message replies to any of our known outbound message IDs
          const matchedKnown = knownMessageIds.find((id) => {
            const normalId = id.replace(/^<|>$/g, '')
            const normalReply = inReplyTo.replace(/^<|>$/g, '')
            return normalId === normalReply
          })

          if (!matchedKnown) continue

          const from = envelope.from?.[0]
          const fromEmail = from?.address ?? ''
          const fromName = from?.name?.trim() ?? ''

          // Parse body from raw source
          const rawSource = msg.source?.toString('utf-8') ?? ''
          const { html, text } = extractBody(rawSource)

          results.push({
            messageId: envelope.messageId ?? '',
            inReplyTo: matchedKnown,
            fromEmail,
            fromName,
            subject: envelope.subject ?? '',
            bodyHtml: html,
            bodyText: text,
            date: envelope.date ?? new Date(),
          })
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }

  return results
}

/**
 * Naive body extractor from raw email source.
 * Pulls plain text and HTML parts separated by MIME boundaries.
 */
function extractBody(raw: string): { html: string; text: string } {
  let html = ''
  let text = ''

  // Try to find HTML part
  const htmlMatch = raw.match(/Content-Type: text\/html[^]*?\r?\n\r?\n([\s\S]*?)(?=--|\z)/i)
  if (htmlMatch) {
    html = decodeQuotedPrintable(htmlMatch[1].trim())
  }

  // Try to find plain text part
  const textMatch = raw.match(/Content-Type: text\/plain[^]*?\r?\n\r?\n([\s\S]*?)(?=--|\z)/i)
  if (textMatch) {
    text = decodeQuotedPrintable(textMatch[1].trim())
  }

  // Fallback: if no MIME parts found, treat everything after headers as text
  if (!html && !text) {
    const headerEnd = raw.indexOf('\r\n\r\n')
    if (headerEnd !== -1) {
      text = raw.slice(headerEnd + 4).trim()
    }
  }

  // If we have text but no HTML, wrap it
  if (!html && text) {
    html = `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</pre>`
  }

  return { html, text }
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
