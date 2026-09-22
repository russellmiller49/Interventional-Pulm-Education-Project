// Local synthetic identity/HTTP adapter over the real rehearsal PostgreSQL/RLS.
// No application code branches on this adapter, and no remote database is touched.
import { createServer } from 'node:http'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { writeFileSync } from 'node:fs'
const { container, ids, cid, testCaseId, studyId, sql, lit, run, root, cleanup } =
  globalThis.rehearsal
const secret = 'socrates-disposable-rehearsal-secret-not-a-production-key'
const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
function token(claims) {
  const unsigned = `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ ...claims, exp: Math.floor(Date.now() / 1000) + 86400 })}`
  return unsigned + '.' + createHmac('sha256', secret).update(unsigned).digest('base64url')
}
const anon = token({ role: 'anon' }),
  service = token({ role: 'service_role' })
const sessions = Object.fromEntries(
  Object.entries(ids).map(([name, id]) => [
    name,
    {
      access_token: token({ sub: id, role: 'authenticated', is_anonymous: false }),
      refresh_token: 'synthetic-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      expires_in: 86400,
      token_type: 'bearer',
      user: {
        id,
        aud: 'authenticated',
        role: 'authenticated',
        email: `${name}@synthetic.invalid`,
        email_confirmed_at: new Date().toISOString(),
        is_anonymous: false,
        app_metadata: { provider: 'email' },
        user_metadata: {},
      },
    },
  ]),
)
// Fresh browser journeys start with empty own-user progress/attempts; the SQL suite above proved finalization.
sql('delete from public.socrates_test_attempts;delete from public.socrates_training_progress;')
function verify(value) {
  const [head, payload, signature] = value.split('.')
  const expected = createHmac('sha256', secret).update(`${head}.${payload}`).digest('base64url')
  if (signature !== expected) throw new Error('Invalid test token')
  return JSON.parse(Buffer.from(payload, 'base64url'))
}
function query(claims, source) {
  const role =
    claims.role === 'service_role' ? 'service_role' : claims.sub ? 'authenticated' : 'anon'
  const output = sql(
    `begin;set local role ${role};select set_config('request.jwt.claims',${lit(JSON.stringify(claims))},true);${source};commit;`,
  )
  const lines = output
    .trim()
    .split('\n')
    .filter((l) => !['BEGIN', 'SET', 'COMMIT', ''].includes(l) && l !== JSON.stringify(claims))
  return JSON.parse(lines.at(-1) || 'null')
}
const allowedTables = new Set([
  'site_entitlements',
  'socrates_slides',
  'socrates_annotations',
  'socrates_revisions',
  'socrates_case_content',
  'socrates_case_readiness',
  'socrates_case_legend',
  'socrates_studies',
  'socrates_study_rounds',
  'socrates_study_cases',
  'socrates_study_participants',
  'socrates_test_attempts',
  'socrates_training_progress',
])
const identifier = (value) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Invalid identifier')
  return value
}
const server = createServer(async (req, res) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
  }
  function send(status, value) {
    res.writeHead(status, headers)
    res.end(JSON.stringify(value))
  }
  try {
    if (req.method === 'OPTIONS') {
      send(200, {})
      return
    }
    const url = new URL(req.url, 'http://127.0.0.1')
    const claims = verify((req.headers.authorization ?? `Bearer ${anon}`).replace(/^Bearer /, ''))
    if (url.pathname === '/auth/v1/user') {
      const session = Object.values(sessions).find((s) => s.user.id === claims.sub)
      send(session ? 200 : 401, session ? session.user : { message: 'No synthetic user' })
      return
    }
    let body = ''
    for await (const chunk of req) body += chunk
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = identifier(url.pathname.split('/').at(-1))
      const args = body ? JSON.parse(body) : {}
      const argumentsSql = Object.entries(args)
        .map(
          ([key, value]) =>
            `${identifier(key)} => ${value === null ? 'null' : typeof value === 'object' ? lit(JSON.stringify(value)) + '::jsonb' : lit(value)}`,
        )
        .join(',')
      const composite = [
        'socrates_start_attempt',
        'socrates_submit_attempt',
        'socrates_record_training',
      ].includes(name)
      const value = query(
        claims,
        composite
          ? `select row_to_json(x) from public.${name}(${argumentsSql}) x`
          : `select coalesce(to_jsonb(public.${name}(${argumentsSql})),'null'::jsonb)`,
      )
      send(200, value)
      return
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = identifier(url.pathname.split('/').at(-1))
      if (!allowedTables.has(table)) {
        send(200, [])
        return
      }
      if (req.method !== 'GET') {
        send(403, { message: 'Only RPC writes supported in rehearsal' })
        return
      }
      const clauses = []
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'offset', 'limit'].includes(key)) continue
        if (key === 'or') {
          clauses.push('(expires_at is null or expires_at>now())')
          continue
        }
        identifier(key)
        if (value.startsWith('eq.')) clauses.push(`${key}=${lit(value.slice(3))}`)
        else if (value.startsWith('in.('))
          clauses.push(
            `${key} in (${value
              .slice(4, -1)
              .split(',')
              .map((v) => lit(v.replaceAll('"', '')))
              .join(',')})`,
          )
        else throw new Error('Unsupported rehearsal filter')
      }
      const order = url.searchParams
        .get('order')
        ?.split(',')
        .map((value) => {
          const [key, dir] = value.split('.')
          return `${identifier(key)} ${dir === 'desc' ? 'desc' : 'asc'}`
        })
        .join(',')
      const range = req.headers.range?.split('-').map(Number)
      const offset = Number(url.searchParams.get('offset') ?? range?.[0] ?? 0),
        limit = Number(url.searchParams.get('limit') ?? (range ? range[1] - range[0] + 1 : 1000))
      const expression =
        table === 'socrates_slides' &&
        url.searchParams.get('select')?.includes('socrates_annotations')
          ? "to_jsonb(t)||jsonb_build_object('socrates_annotations',(select coalesce(jsonb_agg(a),'[]'::jsonb) from public.socrates_annotations a where a.slide_id=t.id))"
          : 'to_jsonb(t)'
      const rows = query(
        claims,
        `select coalesce(jsonb_agg(value),'[]'::jsonb) from(select ${expression} value from public.${table} t ${clauses.length ? 'where ' + clauses.join(' and ') : ''} ${order ? 'order by ' + order : ''} offset ${offset} limit ${limit}) rows`,
      )
      if (req.headers.accept?.includes('application/vnd.pgrst.object+json')) {
        send(
          rows.length === 1 ? 200 : 406,
          rows.length === 1 ? rows[0] : { code: 'PGRST116', message: 'No rows' },
        )
        return
      }
      send(200, rows)
      return
    }
    send(404, { error: 'Not found' })
  } catch (error) {
    send(400, { code: 'REHEARSAL', message: String(error.stderr ?? error.message) })
  }
})
await new Promise((resolve) => server.listen(54339, '127.0.0.1', resolve))
writeFileSync(
  '/tmp/socrates-rehearsal.json',
  JSON.stringify({
    url: 'http://127.0.0.1:54339',
    anon,
    service,
    sessions,
    ids,
    cid,
    testCaseId,
    studyId,
    container,
  }),
)
process.stdout.write(
  'Synthetic browser fixture listening at 127.0.0.1:54339. Disposable PostgreSQL remains isolated.\n',
)
