import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { watermarkedUrl } from '../../lib/r2'
import { BRAND_NAME } from '../../lib/constants'

export default function Catalogue() {
  const { slug } = useParams()
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [filterType, setFilterType] = useState('ALL')
  const [sortKey, setSortKey] = useState('newest')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let alive = true
    supabase.rpc('get_public_catalogue', { p_slug: slug }).then(({ data, error }) => {
      if (!alive) return
      if (error) setState({ loading: false, data: null, error: error.message })
      else setState({ loading: false, data, error: null })
    })
    return () => { alive = false }
  }, [slug])

  useEffect(() => {
    const block = (e) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    document.addEventListener('dragstart', block)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('dragstart', block)
    }
  }, [])

  const data = state.data
  const showPrice = !!data?.show_price
  const products = data?.products || []

  const types = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.saree_type))).sort()
  }, [products])

  const sorts = useMemo(() => {
    const base = { newest: 'Newest first', oldest: 'Oldest first' }
    return showPrice
      ? { ...base, price_desc: 'Price: high to low', price_asc: 'Price: low to high' }
      : base
  }, [showPrice])

  const visible = useMemo(() => {
    let list = filterType === 'ALL' ? products : products.filter((p) => p.saree_type === filterType)
    list = [...list]
    if (sortKey === 'oldest') list.reverse()
    else if (sortKey === 'price_desc') list.sort((a, b) => (b.price_inr || 0) - (a.price_inr || 0))
    else if (sortKey === 'price_asc') list.sort((a, b) => (a.price_inr || 0) - (b.price_inr || 0))
    return list
  }, [products, filterType, sortKey])

  if (state.loading) return <Centered>Loading…</Centered>
  if (state.error) return <Centered>Something went wrong.</Centered>
  if (!data) return <Centered>This catalogue isn’t available.</Centered>

  return (
    <div className="no-save min-h-screen bg-[#FAF8F4] text-ink">
      <header className="border-b border-black/5 py-10 text-center">
        <div className="font-display text-4xl tracking-wide">{BRAND_NAME}</div>
        <div className="mx-auto mt-3 h-px w-10 bg-zari/60" />
        <div className="mt-3 text-sm uppercase tracking-[0.3em] text-ink/50">{data.name}</div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-zari"
              style={{ colorScheme: 'light' }}
            >
              <option value="ALL">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-zari"
              style={{ colorScheme: 'light' }}
            >
              {Object.entries(sorts).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <span className="text-sm text-ink/40">{visible.length} designs</span>
        </div>

        {visible.length === 0 ? (
          <p className="py-16 text-center text-ink/40">No designs to show.</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((p) => (
              <Card key={p.id} product={p} showPrice={showPrice} onClick={() => setSelected(p)} />
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-black/5 py-8 text-center text-xs uppercase tracking-[0.3em] text-ink/30">
        {BRAND_NAME}
      </footer>

      {selected && <ProductModal product={selected} showPrice={showPrice} onClose={() => setSelected(null)} />}
    </div>
  )
}

function Photo({ url, className }) {
  return (
    <div
      role="img"
      className={`bg-cover bg-center ${className || ''}`}
      style={{ backgroundImage: `url("${url}")` }}
    />
  )
}

function Card({ product, showPrice, onClick }) {
  const media = [...(product.media || [])].sort((a, b) => a.sort_order - b.sort_order)
  const cover = media.find((m) => m.kind === 'image') || media[0]
  return (
    <button onClick={onClick} className="group text-left">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-sm bg-ivory">
        {cover ? (
          <Photo url={watermarkedUrl(cover.r2_key)} className="h-full w-full transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-ink/30">No image</div>
        )}
      </div>
            <div className="mt-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-ink">{product.saree_type}</div>
        {showPrice && product.price_inr != null && (
          <div className="mt-0.5 text-base font-medium text-ink">₹{Number(product.price_inr).toLocaleString('en-IN')}</div>
        )}
        <div className="mt-1 text-xs uppercase tracking-wide text-ink/40">{product.design_number}</div>
      </div>
    </button>
  )
}

function ProductModal({ product, showPrice, onClose }) {
  const media = [...(product.media || [])].sort((a, b) => a.sort_order - b.sort_order)
  const images = media.filter((m) => m.kind === 'image')
  const video = media.find((m) => m.kind === 'video')
  const [active, setActive] = useState(images[0] || null)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white text-ink shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
       <div className="flex flex-col bg-ivory md:w-1/2">
          <div className="h-80 w-full bg-contain bg-center bg-no-repeat md:h-[28rem]"
            style={active ? { backgroundImage: `url("${watermarkedUrl(active.r2_key)}")` } : undefined} role="img">
            {!active && <div className="grid h-full place-items-center text-ink/30">No image</div>}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3">
              {images.map((m) => (
                <button
                  key={m.r2_key}
                  onClick={() => setActive(m)}
                  className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded border-2 transition ${
                    active?.r2_key === m.r2_key ? 'border-zari' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <Photo url={watermarkedUrl(m.r2_key)} className="h-full w-full" />
                </button>
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
            {showPrice && product.price_inr != null && (
              <div className="text-lg font-medium">₹{Number(product.price_inr).toLocaleString('en-IN')}</div>
            )}
            {product.description && <p className="text-sm leading-relaxed text-ink/70">{product.description}</p>}
            {video && (
              <video
                src={watermarkedUrl(video.r2_key)}
                controls
                controlsList="nodownload"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                className="w-full rounded-md"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="grid min-h-screen place-items-center bg-[#FAF8F4] text-ink/50">{children}</div>
}