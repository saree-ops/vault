import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { mediaUrl } from '../../lib/r2'
import { SAREE_TYPES } from '../../lib/constants'

export default function CatalogueEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [catalogue, setCatalogue] = useState(null)
  const [products, setProducts] = useState([])
  const [memberIds, setMemberIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('ALL')
  const [copied, setCopied] = useState(false)
  const [savingName, setSavingName] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: cat }, { data: prods }, { data: members }] = await Promise.all([
      supabase.from('catalogues').select('*').eq('id', id).single(),
      supabase
        .from('products')
        .select('id, design_number, saree_type, price_inr, product_media(kind, r2_key, sort_order)')
        .order('created_at', { ascending: false }),
      supabase.from('catalogue_products').select('product_id').eq('catalogue_id', id),
    ])
    setCatalogue(cat)
    setProducts(prods || [])
    setMemberIds(new Set((members || []).map((m) => m.product_id)))
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const visible = useMemo(() => {
    if (filterType === 'ALL') return products
    return products.filter((p) => p.saree_type === filterType)
  }, [products, filterType])

  async function toggle(productId) {
    const inSet = memberIds.has(productId)
    const next = new Set(memberIds)
    if (inSet) {
      next.delete(productId)
      setMemberIds(next)
      await supabase.from('catalogue_products').delete().eq('catalogue_id', id).eq('product_id', productId)
    } else {
      next.add(productId)
      setMemberIds(next)
      await supabase.from('catalogue_products').upsert(
        { catalogue_id: id, product_id: productId },
        { onConflict: 'catalogue_id,product_id', ignoreDuplicates: true }
      )
    }
  }

  async function addAll() {
    const toAdd = visible.filter((p) => !memberIds.has(p.id))
    if (toAdd.length === 0) return
    const next = new Set(memberIds)
    toAdd.forEach((p) => next.add(p.id))
    setMemberIds(next)
    await supabase.from('catalogue_products').upsert(
      toAdd.map((p) => ({ catalogue_id: id, product_id: p.id })),
      { onConflict: 'catalogue_id,product_id', ignoreDuplicates: true }
    )
  }

  async function removeAll() {
    setMemberIds(new Set())
    await supabase.from('catalogue_products').delete().eq('catalogue_id', id)
  }

  async function updateName(name) {
    setSavingName(true)
    await supabase.from('catalogues').update({ name }).eq('id', id)
    setCatalogue((c) => ({ ...c, name }))
    setSavingName(false)
  }

  async function toggleShowPrice() {
    const v = !catalogue.show_price
    await supabase.from('catalogues').update({ show_price: v }).eq('id', id)
    setCatalogue((c) => ({ ...c, show_price: v }))
  }

  async function copyLink() {
    const link = `${window.location.origin}/c/${catalogue.slug}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <p className="text-ink/50">Loading…</p>
  if (!catalogue) return <p className="text-ink/50">Catalogue not found.</p>

  return (
    <div>
      <button onClick={() => navigate('/admin/catalogues')} className="mb-4 text-sm text-ink/50 transition hover:text-ink">← All catalogues</button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <input
            defaultValue={catalogue.name}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== catalogue.name) updateName(v)
            }}
            style={{ colorScheme: 'light' }}
            className="-ml-2 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-3xl text-ink outline-none transition hover:border-black/10 focus:border-zari focus:bg-white"
          />
          <div className="mt-1 text-sm text-ink/50">
            {memberIds.size} in this catalogue{savingName && ' · saving…'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={catalogue.show_price} onChange={toggleShowPrice} className="h-4 w-4 accent-zari" style={{ colorScheme: 'light' }} />
            Show prices
          </label>
          <button onClick={copyLink} className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-ink transition hover:border-zari">
            {copied ? 'Copied!' : 'Copy share link'}
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-zari" style={{ colorScheme: 'light' }}>
          <option value="ALL">All types</option>
          {SAREE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={addAll} className="rounded-md bg-ink px-3 py-2 text-sm text-parchment transition hover:bg-aubergine">Add all shown</button>
        <button onClick={removeAll} className="rounded-md border border-black/15 px-3 py-2 text-sm text-ink/70 transition hover:text-ink">Remove all</button>
        <span className="text-sm text-ink/40">Tap a card to add or remove</span>
      </div>

      {visible.length === 0 ? (
        <p className="text-ink/50">No products to show. Add products first from the Products tab.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p) => (
            <ProductToggle key={p.id} product={p} inCatalogue={memberIds.has(p.id)} onToggle={() => toggle(p.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductToggle({ product, inCatalogue, onToggle }) {
  const media = [...(product.product_media || [])].sort((a, b) => a.sort_order - b.sort_order)
  const cover = media.find((m) => m.kind === 'image') || media[0]
  return (
    <button
      onClick={onToggle}
      className={`group overflow-hidden rounded-md border-2 bg-white text-left shadow-sm transition ${
        inCatalogue ? 'border-zari' : 'border-transparent hover:shadow-md'
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-ivory">
        {cover ? (
          <img src={mediaUrl(cover.r2_key)} alt={product.design_number} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-ink/30">No image</div>
        )}
        <div className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
          inCatalogue ? 'bg-zari text-ink' : 'bg-white/80 text-ink/40'
        }`}>
          {inCatalogue ? '✓' : '+'}
        </div>
      </div>
            <div className="p-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-ink">{product.saree_type}</div>
        <div className="mt-0.5 text-xs uppercase tracking-wide text-ink/40">{product.design_number}</div>
      </div>
    </button>
  )
}