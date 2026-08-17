const BASE = process.env.VITE_R2_PUBLIC_BASE

export default async (req) => {
  const key = new URL(req.url).searchParams.get('key')
  if (!key) return new Response('Missing key', { status: 400 })

  if (key.startsWith('/') || key.includes('..')) {
    return new Response('Bad key', { status: 400 })
  }

  const src = await fetch(`${BASE}/${key}`)
  if (!src.ok) return new Response('Not found', { status: 404 })

  const contentType = src.headers.get('content-type') || 'application/octet-stream'
  const buf = Buffer.from(await src.arrayBuffer())

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}