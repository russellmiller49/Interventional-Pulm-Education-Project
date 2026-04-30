import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

type EmailEventType = 'signup_received' | 'account_approved'

interface EmailEventRow {
  id: string
  learner_id: string
  event_type: EmailEventType
  recipient_email: string
  recipient_name: string | null
  payload: Record<string, unknown> | null
  webhook_token: string
  status: 'pending' | 'processing' | 'sent' | 'failed'
  attempt_count: number
}

interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
}

const defaultCourseUrl = 'https://interventionalpulm.org/socal-ebus-course'
const defaultFromAddress = 'SoCal EBUS Course <no-reply@interventionalpulm.org>'
const jsonHeaders = { 'Content-Type': 'application/json' }

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  })
}

function readEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  return value && value.length > 0 ? value : null
}

function readPayloadString(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function tokensMatch(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)

  if (leftBytes.length !== rightBytes.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index]
  }

  return diff === 0
}

function courseUrlFor(event: EmailEventRow) {
  return (
    readPayloadString(event.payload, 'courseUrl') ??
    readEnv('SOCAL_EBUS_COURSE_URL') ??
    defaultCourseUrl
  )
}

function displayNameFor(event: EmailEventRow) {
  const name = event.recipient_name?.trim()
  return name && name.length > 0 ? name : null
}

function buildEmail(event: EmailEventRow): EmailMessage {
  const courseUrl = courseUrlFor(event)
  const courseName = readPayloadString(event.payload, 'courseName') ?? 'SoCal EBUS Course'
  const name = displayNameFor(event)
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const escapedGreeting = escapeHtml(greeting)
  const escapedCourseName = escapeHtml(courseName)
  const escapedCourseUrl = escapeHtml(courseUrl)

  if (event.event_type === 'account_approved') {
    const subject = 'Your SoCal EBUS Course account is approved'
    const text = [
      greeting,
      '',
      `Your ${courseName} account has been approved. You can now sign in and access the course modules.`,
      '',
      `Open the course: ${courseUrl}`,
    ].join('\n')

    const html = `
      <p>${escapedGreeting}</p>
      <p>Your ${escapedCourseName} account has been approved. You can now sign in and access the course modules.</p>
      <p><a href="${escapedCourseUrl}">Open the course</a></p>
    `

    return { html, subject, text, to: event.recipient_email }
  }

  const subject = 'SoCal EBUS Course signup received'
  const text = [
    greeting,
    '',
    `Thanks for signing up for the ${courseName}. Your account is pending review by course leadership.`,
    'You will receive another email as soon as your account is approved.',
    '',
    `Course page: ${courseUrl}`,
  ].join('\n')

  const html = `
    <p>${escapedGreeting}</p>
    <p>Thanks for signing up for the ${escapedCourseName}. Your account is pending review by course leadership.</p>
    <p>You will receive another email as soon as your account is approved.</p>
    <p><a href="${escapedCourseUrl}">Course page</a></p>
  `

  return { html, subject, text, to: event.recipient_email }
}

function parseAddress(value: string) {
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/)

  if (!match) {
    return { email: value.trim() }
  }

  const name = match[1].trim()
  return {
    email: match[2].trim(),
    ...(name ? { name } : {}),
  }
}

async function sendWithResend(message: EmailMessage, apiKey: string) {
  const payload: Record<string, unknown> = {
    from: readEnv('SOCAL_EBUS_EMAIL_FROM') ?? defaultFromAddress,
    html: message.html,
    subject: message.subject,
    text: message.text,
    to: [message.to],
  }
  const replyTo = readEnv('SOCAL_EBUS_EMAIL_REPLY_TO')

  if (replyTo) {
    payload.reply_to = replyTo
  }

  const response = await fetch('https://api.resend.com/emails', {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Resend email failed (${response.status}): ${await response.text()}`)
  }

  return 'resend'
}

async function sendWithSendGrid(message: EmailMessage, apiKey: string) {
  const replyTo = readEnv('SOCAL_EBUS_EMAIL_REPLY_TO')
  const payload: Record<string, unknown> = {
    content: [
      { type: 'text/plain', value: message.text },
      { type: 'text/html', value: message.html },
    ],
    from: parseAddress(readEnv('SOCAL_EBUS_EMAIL_FROM') ?? defaultFromAddress),
    personalizations: [{ to: [{ email: message.to }] }],
    subject: message.subject,
  }

  if (replyTo) {
    payload.reply_to = parseAddress(replyTo)
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`SendGrid email failed (${response.status}): ${await response.text()}`)
  }

  return 'sendgrid'
}

async function sendEmail(message: EmailMessage) {
  const resendApiKey = readEnv('RESEND_API_KEY')
  if (resendApiKey) {
    return sendWithResend(message, resendApiKey)
  }

  const sendGridApiKey = readEnv('SENDGRID_API_KEY')
  if (sendGridApiKey) {
    return sendWithSendGrid(message, sendGridApiKey)
  }

  throw new Error('No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY.')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId : ''
  const token = typeof body.token === 'string' ? body.token : ''

  if (!eventId || !token) {
    return jsonResponse({ error: 'Missing eventId or token' }, 400)
  }

  const supabaseUrl = readEnv('SUPABASE_URL')
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase function environment is incomplete' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: event, error: readError } = await supabase
    .from('socal_ebus_email_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle<EmailEventRow>()

  if (readError) {
    return jsonResponse({ error: 'Unable to read notification event' }, 500)
  }

  if (!event || !tokensMatch(event.webhook_token, token)) {
    return jsonResponse({ error: 'Notification event not found' }, 404)
  }

  if (event.status === 'sent') {
    return jsonResponse({ ok: true, status: 'already_sent' })
  }

  const startedAt = new Date().toISOString()
  const { data: claimedEvent, error: claimError } = await supabase
    .from('socal_ebus_email_events')
    .update({
      attempt_count: (event.attempt_count ?? 0) + 1,
      error_message: null,
      last_attempt_at: startedAt,
      status: 'processing',
    })
    .eq('id', event.id)
    .in('status', ['pending', 'failed'])
    .select('*')
    .maybeSingle<EmailEventRow>()

  if (claimError) {
    return jsonResponse({ error: 'Unable to claim notification event' }, 500)
  }

  if (!claimedEvent) {
    return jsonResponse({ ok: true, status: event.status })
  }

  try {
    const provider = await sendEmail(buildEmail(claimedEvent))
    const sentAt = new Date().toISOString()
    await supabase
      .from('socal_ebus_email_events')
      .update({
        error_message: null,
        sent_at: sentAt,
        status: 'sent',
      })
      .eq('id', claimedEvent.id)

    return jsonResponse({ ok: true, provider })
  } catch (error) {
    const message = errorMessage(error).slice(0, 1000)
    console.error('SoCal EBUS notification email failed', {
      error: message,
      eventId: claimedEvent.id,
      eventType: claimedEvent.event_type,
    })

    await supabase
      .from('socal_ebus_email_events')
      .update({
        error_message: message,
        status: 'failed',
      })
      .eq('id', claimedEvent.id)

    return jsonResponse({ error: 'Email delivery failed' }, 502)
  }
})
