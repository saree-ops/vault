import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { uploadToR2 } from '../../lib/r2'
import { SAREE_TYPES } from '../../lib/constants'

function ext(name) {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : 'bin'
}

export default function AddProductModal({ onClose, onSaved }) {
  const [designNumber, setDesignNumber] = useState('')
  const [sareeType, setSareeType] = useState(SAREE_TYPES[0])
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState([]) // [{ file, url }]
  const [video, setVideo] = useState(null) // { file, url } | null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Revoke local preview URLs on unmount so we don't leak memory.
  useEffect(() => {
    return () => {
      images.forEach((i) => URL.revokeObjectURL(i.url))
      if (video) URL.revokeObjectURL(video.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addImages(files) {
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setImages((prev) => [...prev, ...next])
  }
  function removeImage(idx) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].url)
      return prev.filter((_, i) => i !== idx)
    })
  }
  function setVideoFile(file) {
    if (!file) return
    if (video) URL.revokeObjectURL(video.url)
    setVideo({ file, url: URL.createObjectURL(file) })
  }
  function removeVideo() {
    if (video) URL.revokeObjectURL(video.url)
    setVideo(null)
  }

  async function create() {
    if (!designNumber.trim()) return setError('Design number is required.')
    setBusy(true); setError('')
    try {
      // 1. Create the product row first — we need its id to build R2 keys.
      const { data: product, error: e } = await supabase.from('products').insert({
        design_number: designNumber.trim(),
        saree_type: sareeType,
        price_inr: price === '' ? 0 : Number(price),
        description: description.trim() || null,
      }).select().single()
      if (e) throw new Error(e.code === '23505' ? 'That design number is already used.' : e.message)

      // 2. Upload every staged file to R2, building product_media rows as we go.
      const rows = []
      let order = 0
      for (const { file } of images) {
        const key = `products/${product.id}/${crypto.randomUUID()}.${ext(file.name)}`
        await uploadToR2(file, key)
        rows.push({ product_id: product.id, kind: 'image', r2_key: key, sort_order: order++ })
      }
      if (video) {
        const key = `products/${product.id}/${crypto.randomUUID()}.${ext(video.file.name)}`
        await uploadToR2(video.file, key)
        rows.push({ product_id: product.id, kind: 'video', r2_key: key, sort_order: order++ })
      }

      // 3. Record the media rows (skip the call entirely if nothing was attached).
      if (rows.length) {
        const { error: mediaErr } = await supabase.from('product_media').insert(rows)
        if (mediaErr) throw new Error(mediaErr.message)
      }

      onSaved()
    } catch (err) {
      // Note: if upload/media-insert fails after the product row was created,
      // the product still exists (with partial or no media) — open it from the
      // grid afterwards to finish attaching images rather than losing the entry.
      setError(err.message || 'Could not create product.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white text-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h3 className="font-display text-2xl">Add product</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-full text-ink/40 transition hover:bg-black/5 hover:text-ink disabled:opacity-40"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto px-6 py-5">
          <Field label="Design number">
            <input value={designNumber} onChange={(e) => setDesignNumber(e.target.value)} className="input" autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Saree type">
              <select value={sareeType} onChange={(e) => setSareeType(e.target.value)} className="input">
                {SAREE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Price (₹)">
              <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input resize-none" />
          </Field>

          <div className="border-t border-black/10 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ink/40">Images</p>
            {images.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div
                    key={img.url}
                    className="relative h-16 w-16 overflow-hidden rounded border border-black/10 bg-cover bg-center"
                    style={{ backgroundImage: `url("${img.url}")` }}
                  >
                    {i === 0 && <span className="absolute left-0 top-0 bg-zari px-1 text-[9px] font-bold uppercase text-ink">Cover</span>}
                    <button
                      onClick={() => removeImage(i)}
                      disabled={busy}
                      className="absolute right-0 top-0 grid h-5 w-5 place-items-center bg-black/60 text-xs text-white hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-black/20 bg-ivory/40 px-3 py-2 text-sm hover:border-zari">
              <span className="rounded bg-ink px-2 py-1 text-xs uppercase text-parchment">Add images</span>
              <span className="text-ink/50">first image becomes the cover</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addImages(Array.from(e.target.files || [])); e.target.value = '' }}
              />
            </label>

            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-widest text-ink/40">Video (optional)</p>
            {video ? (
              <div className="flex items-center gap-2 rounded-md border border-black/10 bg-ivory/40 px-3 py-2 text-sm">
                <span className="truncate">{video.file.name}</span>
                <button onClick={removeVideo} disabled={busy} className="ml-auto text-ink/50 hover:text-red-600">✕</button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-black/20 bg-ivory/40 px-3 py-2 text-sm hover:border-zari">
                <span className="rounded bg-ink px-2 py-1 text-xs uppercase text-parchment">Add video</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0])} />
              </label>
            )}
          </div>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-black/10 px-6 py-4">
          <button onClick={onClose} disabled={busy} className="text-sm text-ink/60 transition hover:text-ink disabled:opacity-40">Cancel</button>
          <button
            onClick={create}
            disabled={busy}
            className="rounded-md bg-zari px-6 py-2 text-sm font-medium uppercase tracking-widest text-ink transition hover:bg-zari-bright disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create product'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-widest text-ink/50">{label}</span>
      {children}
    </label>
  )
}