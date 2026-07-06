import { createHash, createHmac } from 'node:crypto'

import type { PccmCourseVideo } from '@/features/pccm-intro-course/content/videos'

interface PccmS3Config {
  accessKeyId?: string
  baseUrl: string
  bucket: string
  region: string
  secretAccessKey?: string
  sessionToken?: string
}

interface PccmS3VideoUrl {
  signed: boolean
  url: string
}

export function getPccmS3ObjectKey(video: Pick<PccmCourseVideo, 'sourcePath'>) {
  return video.sourcePath
}

export function createPccmS3VideoUrl(
  video: Pick<PccmCourseVideo, 'sourcePath'>,
  expiresIn: number,
  now = new Date(),
): PccmS3VideoUrl {
  const config = loadPccmS3Config()
  const objectKey = getPccmS3ObjectKey(video)
  const publicUrl = createPccmS3PublicUrl(objectKey, config)

  if (!config.accessKeyId || !config.secretAccessKey) {
    return {
      signed: false,
      url: publicUrl,
    }
  }

  return {
    signed: true,
    url: presignS3GetObjectUrl({
      accessKeyId: config.accessKeyId,
      expiresIn,
      now,
      region: config.region,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
      url: publicUrl,
    }),
  }
}

export function loadPccmS3Config(): PccmS3Config {
  const bucket = process.env.PCCM_INTRO_COURSE_S3_BUCKET || 'pccmintro'
  const region = process.env.PCCM_INTRO_COURSE_S3_REGION || process.env.AWS_REGION || 'us-east-1'
  const baseUrl =
    process.env.PCCM_INTRO_COURSE_S3_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`

  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    bucket,
    region,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  }
}

export function createPccmS3PublicUrl(objectKey: string, config = loadPccmS3Config()) {
  return `${config.baseUrl}/${encodeS3Path(objectKey)}`
}

function presignS3GetObjectUrl({
  accessKeyId,
  expiresIn,
  now,
  region,
  secretAccessKey,
  sessionToken,
  url,
}: {
  accessKeyId: string
  expiresIn: number
  now: Date
  region: string
  secretAccessKey: string
  sessionToken?: string
  url: string
}) {
  const parsedUrl = new URL(url)
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const signedHeaders = 'host'
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.max(1, Math.min(604800, Math.floor(expiresIn)))),
    'X-Amz-SignedHeaders': signedHeaders,
  }

  if (sessionToken) {
    queryParams['X-Amz-Security-Token'] = sessionToken
  }

  const canonicalQueryString = canonicalizeQueryParams(queryParams)
  const canonicalHeaders = `host:${parsedUrl.host}\n`
  const canonicalRequest = [
    'GET',
    parsedUrl.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region)
  const signature = hmacHex(signingKey, stringToSign)

  return `${parsedUrl.origin}${parsedUrl.pathname}?${canonicalQueryString}&X-Amz-Signature=${signature}`
}

function encodeS3Path(objectKey: string) {
  return objectKey.split('/').map(encodeRfc3986).join('/')
}

function canonicalizeQueryParams(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function hmac(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

function hmacHex(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex')
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const dateRegionKey = hmac(dateKey, region)
  const dateRegionServiceKey = hmac(dateRegionKey, 's3')
  return hmac(dateRegionServiceKey, 'aws4_request')
}
