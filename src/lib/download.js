import JSZip from 'jszip'

function proxyUrl(key) {
  return `/.netlify/functions/download?key=${encodeURIComponent(key)}`
}
async function fetchThroughProxy(key) {
  const res = await fetch(proxyUrl(key))
  if (!res.ok) throw new Error(`Fetch failed for ${key}`)
  return res
}
async function fetchBlob(key) {
  const res = await fetchThroughProxy(key)
  return await res.blob()
}
function extFromKey(key) {
  return (String(key).split('.').pop() || 'bin').toLowerCase()
}
function sanitize(s) {
  return String(s).replace(/[^a-zA-Z0-9-_ ]/g, '_').trim() || 'design'
}
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
function canStream() {
  try {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof WritableStream !== 'undefined' &&
      typeof ReadableStream !== 'undefined'
    )
  } catch {
    return false
  }
}
function mediaOf(p) {
  return [...(p.product_media || [])].sort((a, b) => a.sort_order - b.sort_order)
}

// single product (in-memory zip, small by definition)
export async function downloadProductZip(product) {
  const media = mediaOf(product)
  const zip = new JSZip()
  const safe = sanitize(product.design_number)
  let i = 1
  for (const m of media) {
    const blob = await fetchBlob(m.r2_key)
    const ext = extFromKey(m.r2_key)
    zip.file(m.kind === 'video' ? `${safe}-video.${ext}` : `${safe}-${i++}.${ext}`, blob)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  saveBlob(out, `${safe}.zip`)
}

// bulk: stream to disk if possible, else chunked fallback
export async function downloadMany(products, zipName, onProgress) {
  const withMedia = (products || []).filter((p) => (p.product_media?.length ?? 0) > 0)
  if (withMedia.length === 0) throw new Error('None of these products have media to download.')
  const total = withMedia.reduce((s, p) => s + p.product_media.length, 0)

  if (canStream()) {
    try {
      await streamManyToDisk(withMedia, zipName, total, onProgress)
      return
    } catch (err) {
      console.warn('Streaming download failed, falling back to chunks:', err)
    }
  }
  await chunkedMany(withMedia, zipName, total, onProgress)
}

async function streamManyToDisk(products, zipName, total, onProgress) {
  const streamSaver = (await import('streamsaver')).default
  streamSaver.mitm = '/mitm.html'
  const { default: ZipStream } = await import('./zip-stream')

  const fileStream = streamSaver.createWriteStream(`${zipName}.zip`)
  const writer = fileStream.getWriter()
  const zip = new ZipStream({ onData: (chunk) => writer.write(chunk) })

  let done = 0
  for (const p of products) {
    const media = mediaOf(p)
    const folder = sanitize(p.design_number)
    let i = 1
    for (const m of media) {
      const res = await fetchThroughProxy(m.r2_key)
      const buf = new Uint8Array(await res.arrayBuffer())
      const ext = extFromKey(m.r2_key)
      const name = m.kind === 'video' ? `${folder}/video.${ext}` : `${folder}/${i++}.${ext}`
      zip.addFile(name, buf)
      done++
      onProgress?.(done, total)
    }
  }
  zip.finish()
  await writer.close()
}

async function chunkedMany(products, zipName, total, onProgress) {
  const CHUNK = 25
  const parts = Math.ceil(products.length / CHUNK)
  let done = 0
  for (let part = 0; part < parts; part++) {
    const slice = products.slice(part * CHUNK, part * CHUNK + CHUNK)
    const zip = new JSZip()
    for (const p of slice) {
      const media = mediaOf(p)
      const folder = zip.folder(sanitize(p.design_number))
      let i = 1
      for (const m of media) {
        const blob = await fetchBlob(m.r2_key)
        const ext = extFromKey(m.r2_key)
        folder?.file(m.kind === 'video' ? `video.${ext}` : `${i++}.${ext}`, blob)
        done++
        onProgress?.(done, total)
      }
    }
    const out = await zip.generateAsync({ type: 'blob' })
    const suffix = parts > 1 ? `-part${part + 1}of${parts}` : ''
    saveBlob(out, `${zipName}${suffix}.zip`)
  }
}