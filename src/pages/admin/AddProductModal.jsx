import { useState } from 'react'
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
  const [images, setImages] = useState([])
  const [video, setVideo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!designNumber.trim()) return setError('Design number is required.')
    if (images.length === 0) return setError('Add at least one image.')
    setBusy(true)

    try {
      setStatus('Saving product…')
      const { data: product, error: insErr } = await supabase
        .from('products')
        .insert({
          design_number: designNumber.trim(),
          saree_type: sareeType,
          price_inr: price === '' ? 0 : Number(price),
          description: description.trim() || null,
        })
        .select()
        .single()

      if (insErr) {
        if (insErr.code === '23505') throw new Error(`Design number "${designNumber}" already exists.`)
        throw new Error(insErr.message)
      }

      const mediaRows = []
      let order = 0
      for (const img of images) {
        setStatus(`Uploading image ${order + 1} of ${images.length}…`)
        const key = `products/${product.id}/${crypto.randomUUID()}.${ext(img.name)}`
        await uploadToR2(img, key)
        mediaRows.push({ product_id: product.id, kind: 'image', r2_key: key, sort_order: order++ })
      }
      if (video) {
        setStatus('Uploading video…')
        const key = `products/${product.id}/${crypto.randomUUID()}.${ext(video.name)}`
        await uploadToR2(video, key)
        mediaRows.push({ product_id: product.id, kind: 'video', r2_key: key, sort_order: order++ })
      }

      setStatus('Finishing…')
      const { error: mErr } = await supabase.from('product_media').insert(mediaRows)
      if (mErr) throw new Error(mErr.message)

      onSaved()
    } catch (e) {
      setError(e.message || 'Something went wrong.')
      setBusy(false)
      setStatus('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white text-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
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

        {/* body */}
        <div className="flex-1 space-y-5 overflow-auto px-6 py-5">
          <Field label="Design number" required>
            <input
              value={designNumber}
              onChange={(e) => setDesignNumber(e.target.value)}
              className="input"
              placeholder="e.g. JH-1042"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Saree type">
              <select value={sareeType} onChange={(e) => setSareeType(e.target.value)} className="input">
                {SAREE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Price (₹)">
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input"
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Description" hint="optional">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Weave, fabric, occasion…"
            />
          </Field>

          <div className="border-t border-black/10 pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink/40">Media</p>

            <div className="space-y-3">
              <FilePicker
                label="Images"
                hint="colour variants — one or many"
                accept="image/*"
                multiple
                count={images.length}
                summary={images.length ? `${images.length} image${images.length > 1 ? 's' : ''} selected` : 'No images chosen'}
                onChange={(e) => setImages(Array.from(e.target.files || []))}
              />

              <FilePicker
                label="Video"
                hint="optional"
                accept="video/*"
                count={video ? 1 : 0}
                summary={video ? video.name : 'No video chosen'}
                onChange={(e) => setVideo(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          {busy && status && (
            <p className="rounded-md bg-zari/10 px-3 py-2 text-sm text-ink/70">{status}</p>
          )}
        </div>

        {/* footer */}
        <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-4 py-2.5 text-sm font-medium text-ink/60 transition hover:text-ink disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-md bg-zari px-6 py-2.5 text-sm font-medium uppercase tracking-widest text-ink transition hover:bg-zari-bright disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-ink/50">
        {label}
        {required && <span className="text-zari">*</span>}
        {hint && <span className="normal-case tracking-normal text-ink/30">— {hint}</span>}
      </span>
      {children}
    </label>
  )
}

function FilePicker({ label, hint, accept, multiple, count, summary, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-black/20 bg-ivory/40 px-4 py-3 transition hover:border-zari hover:bg-zari/5">
      <span className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-parchment">
        Choose
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">
          {label} <span className="font-normal text-ink/30">— {hint}</span>
        </span>
        <span className={`block truncate text-xs ${count ? 'text-zari' : 'text-ink/40'}`}>{summary}</span>
      </span>
      <input type="file" accept={accept} multiple={multiple} onChange={onChange} className="hidden" />
    </label>
  )
}