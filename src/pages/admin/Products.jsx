import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mediaUrl } from '../../lib/r2'
import { downloadProductZip, downloadMany } from '../../lib/download'
import { SAREE_TYPES } from '../../lib/constants'
import AddProductModal from './AddProductModal'
import ProductDetailModal from './ProductDetailModal'

const SORTS = {
  newest: { label: 'Newest first', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  oldest: { label: 'Oldest first', fn: (a, b) => new Date(a.created_at) - new Date(b.created_at) },
  price_desc: { label: 'Price: high to low', fn: (a, b) => b.price_inr - a.price_inr },
  price_asc: { label: 'Price: low to high', fn: (a, b) => a.price_inr - b.price_inr },
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [filterType, setFilterType] = useState('ALL')
  const [sortKey, setSortKey] = useState('newest')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('id, design_number, saree_type, price_inr, description, created_at, product_media(kind, r2_key, sort_order)')
      .order('created_at', { ascending: false })
    if (!error) setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null)

  async function downloadAll() {
    if (bulkBusy) return
    setBulkBusy(true)
    setBulkProgress({ done: 0, total: 0 })
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      await downloadMany(products, `jenihouse-${stamp}`, (done, total) => setBulkProgress({ done, total }))
    } catch (e) {
      alert(e?.message || 'Download failed.')
    } finally {
      setBulkBusy(false)
      setBulkProgress(null)
    }
  }

  const visible = useMemo(() => {
    let list = products
    if (filterType !== 'ALL') list = list.filter((p) => p.saree_type === filterType)
    return [...list].sort(SORTS[sortKey].fn)
  }, [products, filterType, sortKey])

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedId) || null, [products, selectedId])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-3xl text-ink">Products</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadAll}
            disabled={bulkBusy}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium uppercase tracking-widest text-ink transition hover:border-zari disabled:opacity-50"
          >
            {bulkBusy
              ? (bulkProgress && bulkProgress.total ? `Zipping ${bulkProgress.done}/${bulkProgress.total}` : 'Preparing…')
              : 'Download all'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium uppercase tracking-widest text-parchment transition hover:bg-aubergine"
          >
            Add product
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-zari" style={{ colorScheme: 'light' }}>
          <option value="ALL">All types</option>
          {SAREE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-zari" style={{ colorScheme: 'light' }}>
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <span className="text-sm text-ink/40">{visible.length} {visible.length === 1 ? 'design' : 'designs'}</span>
      </div>

      {loading ? (
        <p className="text-ink/50">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-ink/50">
          {products.length === 0 ? 'No products yet. Add your first saree.' : 'No products match this filter.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p) => <ProductCard key={p.id} product={p} onClick={() => setSelectedId(p.id)} />)}
        </div>
      )}

      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onDeleted={() => { setSelectedId(null); load() }}
        />
      )}
    </div>
  )
}

function ProductCard({ product, onClick }) {
  const [dl, setDl] = useState(false)
  const media = [...(product.product_media || [])].sort((a, b) => a.sort_order - b.sort_order)
  const cover = media.find((m) => m.kind === 'image') || media[0]
  const imageCount = media.filter((m) => m.kind === 'image').length

  async function handleDownload(e) {
    e.stopPropagation()
    setDl(true)
    try { await downloadProductZip(product) } finally { setDl(false) }
  }

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-md border border-black/5 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-ivory">
        {cover ? (
          <img src={mediaUrl(cover.r2_key)} alt={product.design_number}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-ink/30">No image</div>
        )}
        {imageCount > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-medium text-parchment">
            {imageCount}
          </span>
        )}
        <button
          onClick={handleDownload}
          disabled={dl}
          title="Download this product"
          className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink/60 text-parchment backdrop-blur-sm transition hover:bg-ink"
        >
          {dl ? (
            <span className="text-xs">…</span>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
      </div>
      <div className="p-3">
        <div className="font-medium text-ink">{product.design_number}</div>
        <div className="text-xs uppercase tracking-wide text-ink/50">{product.saree_type}</div>
        <div className="mt-1 text-sm text-ink">₹{Number(product.price_inr).toLocaleString('en-IN')}</div>
      </div>
    </div>
  )
}