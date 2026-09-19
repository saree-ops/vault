import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mediaUrl, deleteFromR2, uploadToR2 } from '../../lib/r2'
import { SAREE_TYPES } from '../../lib/constants'

function ext(name) {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : 'bin'
}

export default function ProductDetailModal({ product, onClose, onChanged, onDeleted }) {
  const media = [...(product.product_media || [])].sort((a, b) => a.sort_order - b.sort_order)
  const images = media.filter((m) => m.kind === 'image')
  const video = media.find((m) => m.kind === 'video')

  const [activeKey, setActiveKey] = useState(images[0]?.r2_key || null)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
    const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const [designNumber, setDesignNumber] = useState('')
  const [sareeType, setSareeType] = useState(SAREE_TYPES[0])
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!images.find((m) => m.r2_key === activeKey)) {
      setActiveKey(images[0]?.r2_key || null)
    }
  }, [images, activeKey])
  const active = images.find((m) => m.r2_key === activeKey) || images[0] || null

    async function copyShareLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${product.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function enterEdit() {
    setDesignNumber(product.design_number)
    setSareeType(product.saree_type)
    setPrice(String(product.price_inr ?? ''))
    setDescription(product.description || '')
    setError('')
    setEditing(true)
  }

  async function saveFields() {
    if (!designNumber.trim()) return setError('Design number is required.')
    setBusy(true); setError('')
    try {
      const { error: e } = await supabase.from('products').update({
        design_number: designNumber.trim(),
        saree_type: sareeType,
        price_inr: price === '' ? 0 : Number(price),
        description: description.trim() || null,
      }).eq('id', product.id)
      if (e) throw new Error(e.code === '23505' ? 'That design number is already used.' : e.message)
      onChanged()
      setEditing(false)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function removeImage(m) {
    setBusy(true); setError('')
    try {
      await deleteFromR2([m.r2_key])
      const { error: e } = await supabase.from('product_media')
        .delete().eq('product_id', product.id).eq('r2_key', m.r2_key)
      if (e) throw new Error(e.message)
      onChanged()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function setCover(m) {
    setBusy(true); setError('')
    try {
      const minOrder = Math.min(...media.map((x) => x.sort_order))
      const { error: e } = await supabase.from('product_media')
        .update({ sort_order: minOrder - 1 }).eq('product_id', product.id).eq('r2_key', m.r2_key)
      if (e) throw new Error(e.message)
      onChanged()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function addFiles(files, kind) {
    if (!files || files.length === 0) return
    setBusy(true); setError('')
    try {
      let order = media.length ? Math.max(...media.map((x) => x.sort_order)) + 1 : 0
      const rows = []
      for (const f of files) {
        const key = `products/${product.id}/${crypto.randomUUID()}.${ext(f.name)}`
        await uploadToR2(f, key)
        rows.push({ product_id: product.id, kind, r2_key: key, sort_order: order++ })
      }
      const { error: e } = await supabase.from('product_media').insert(rows)
      if (e) throw new Error(e.message)
      onChanged()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true); setError('')
    try {
      await deleteFromR2(media.map((m) => m.r2_key))
      const { error: e } = await supabase.from('products').delete().eq('id', product.id)
      if (e) throw new Error(e.message)
      onDeleted()
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white text-ink shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col bg-ivory md:w-1/2">
          <div
            className="h-80 w-full bg-contain bg-center bg-no-repeat md:h-[28rem]"
            style={active ? { backgroundImage: `url("${mediaUrl(active.r2_key)}")` } : undefined}
            role="img"
          >
            {!active && <div className="grid h-full place-items-center text-ink/30">No image</div>}
          </div>
          {images.length > 1 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-black/5 bg-white/50 p-3">
              {images.map((m) => (
                <button
                  key={m.r2_key}
                  onClick={() => setActiveKey(m.r2_key)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2 bg-cover bg-center transition ${
                    active?.r2_key === m.r2_key ? 'border-zari' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundImage: `url("${mediaUrl(m.r2_key)}")` }}
                  aria-label="Preview image"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col md:w-1/2">
          <div className="flex items-start justify-between border-b border-black/10 px-6 py-4">
            <div>
              <h3 className="font-display text-2xl">{product.design_number}</h3>
              <p className="text-xs uppercase tracking-widest text-ink/50">{product.saree_type}</p>
            </div>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-ink/40 transition hover:bg-black/5 hover:text-ink" aria-label="Close">✕</button>
          </div>

          <div className="flex-1 space-y-4 overflow-auto px-6 py-5">
            {!editing ? (
              <>
                               <div className="text-lg font-medium">₹{Number(product.price_inr).toLocaleString('en-IN')}</div>
                {product.description && <p className="text-sm leading-relaxed text-ink/70">{product.description}</p>}
                {video && <video src={mediaUrl(video.r2_key)} controls className="w-full rounded-md" />}
                <div>
                  <button
                    onClick={copyShareLink}
                    className="inline-flex items-center gap-2 rounded-md border border-black/15 px-3 py-1.5 text-sm text-ink transition hover:border-zari"
                  >
                    {copied ? 'Link copied!' : 'Copy share link'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Field label="Design number">
                  <input value={designNumber} onChange={(e) => setDesignNumber(e.target.value)} className="input" />
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
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ink/40">Images — ✕ remove, ☆ set cover</p>
                  <div className="flex flex-wrap gap-2">
                    {images.map((m, i) => (
                      <div key={m.r2_key} className="relative h-16 w-16 overflow-hidden rounded border border-black/10 bg-cover bg-center"
                        style={{ backgroundImage: `url("${mediaUrl(m.r2_key)}")` }}>
                        {i === 0 && <span className="absolute left-0 top-0 bg-zari px-1 text-[9px] font-bold uppercase text-ink">Cover</span>}
                        <button onClick={() => removeImage(m)} disabled={busy}
                          className="absolute right-0 top-0 grid h-5 w-5 place-items-center bg-black/60 text-xs text-white hover:bg-red-600">✕</button>
                        {i !== 0 && (
                          <button onClick={() => setCover(m)} disabled={busy}
                            className="absolute bottom-0 left-0 right-0 bg-black/50 text-[10px] text-white hover:bg-zari hover:text-ink">Set cover</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-black/20 bg-ivory/40 px-3 py-2 text-sm hover:border-zari">
                      <span className="rounded bg-ink px-2 py-1 text-xs uppercase text-parchment">Add images</span>
                      <span className="text-ink/50">upload more colour variants</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(Array.from(e.target.files || []), 'image')} />
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-black/20 bg-ivory/40 px-3 py-2 text-sm hover:border-zari">
                      <span className="rounded bg-ink px-2 py-1 text-xs uppercase text-parchment">Add video</span>
                      <span className="text-ink/50">optional</span>
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => addFiles(Array.from(e.target.files || []), 'video')} />
                    </label>
                  </div>
                </div>
              </>
            )}

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {busy && <p className="text-sm text-ink/50">Working…</p>}
          </div>

          <div className="flex items-center justify-between border-t border-black/10 px-6 py-4">
            {!editing ? (
              <>
                {!confirming ? (
                  <button onClick={() => setConfirming(true)} className="text-sm font-medium text-red-600 transition hover:text-red-700">Delete</button>
                ) : (
                  <span className="flex items-center gap-2 text-sm">
                    <button onClick={remove} disabled={busy} className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50">{busy ? '…' : 'Confirm'}</button>
                    <button onClick={() => setConfirming(false)} disabled={busy} className="text-ink/50 hover:text-ink">Cancel</button>
                  </span>
                )}
                <button onClick={enterEdit} className="rounded-md bg-zari px-5 py-2 text-sm font-medium uppercase tracking-widest text-ink transition hover:bg-zari-bright">Edit</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(false)} disabled={busy} className="text-sm text-ink/60 hover:text-ink disabled:opacity-40">Done</button>
                <button onClick={saveFields} disabled={busy} className="rounded-md bg-zari px-5 py-2 text-sm font-medium uppercase tracking-widest text-ink transition hover:bg-zari-bright disabled:opacity-50">{busy ? 'Saving…' : 'Save details'}</button>
              </>
            )}
          </div>
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