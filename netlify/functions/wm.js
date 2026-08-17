import sharp from 'sharp'

const BASE = process.env.VITE_R2_PUBLIC_BASE
const MARK = 'JeniHouse'

export default async (req) => {
  const key = new URL(req.url).searchParams.get('key')
  if (!key) return new Response('Missing key', { status: 400 })

  try {
    const src = await fetch(`${BASE}/${key}`)
    if (!src.ok) return new Response('Not found', { status: 404 })
    const buf = Buffer.from(await src.arrayBuffer())

    const img = sharp(buf, { failOn: 'none' })
    const meta = await img.metadata()
    const w = meta.width || 1000
    const h = meta.height || 1000
    const fontSize = Math.round(Math.min(w, h) / 9)

    const svg = `<svg width="${w}" height="${h}">
      <style>.wm{fill:rgba(255,255,255,0.5);font-family:'DejaVu Serif',Georgia,'Times New Roman',serif;font-size:${fontSize}px;font-weight:600;letter-spacing:${Math.round(fontSize * 0.04)}px;}</style>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="wm">${MARK}</text>
    </svg>`

    const out = await img
      .composite([{ input: Buffer.from(svg), gravity: 'center' }])
      .jpeg({ quality: 82 })
      .toBuffer()

    return new Response(out, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    return new Response('Error', { status: 500 })
  }
}