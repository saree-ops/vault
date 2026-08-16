import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const { keys } = body
  if (!Array.isArray(keys) || keys.length === 0) return Response.json({ ok: true })

  await s3.send(new DeleteObjectsCommand({
    Bucket: process.env.R2_BUCKET,
    Delete: { Objects: keys.map((Key) => ({ Key })) },
  }))

  return Response.json({ ok: true })
}