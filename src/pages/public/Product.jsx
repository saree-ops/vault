import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { watermarkedUrl } from '../../lib/r2'
import { BRAND_NAME } from '../../lib/constants'

export default function Product() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [active, setActive] = useState(null)

  useEffect(() => {
    let alive = true
    supabase.rpc('get_public_product', { p_id: id }).then(({ data, error }) => {
      if (!alive) return
      if (error) setState({ loading: false, data: null, error: error.message })
      else setState({ loading: false, data, error: null })
    })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    const imgs = (state.data?.media || [])
      .filter((m) => m.kind === 'image')
      .sort((a, b) => a.sort_order - b.sort_order)
    setActive(imgs[0] || null)
  }, [state.data])

  useEffect(() => {
    const block = (e) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    document.addEventListener('dragstart', block)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('dragstart', block)
    }
  }, [])

  if (state.loading) return <Centered>Loading…</Centered>
  if (state.error) return <Centered>Something went wrong.</Centered>
  if (!state.data) return <Centered>This product isn’t available.</Centered>

  const product = state.data
  const media = [...(product.media || [])].sort((a, b) => a.sort_order - b.sort_order)
  const images = media.filter((m) => m.kind === 'image')
  const video = media.find((m) => m.kind === 'video')

  return (
    <div className="no-save min-h-screen bg-[#FAF8F4] text-ink">
      <header className="border-b border-black/5 py-10 text-center">
        <div className="font-display text-4xl tracking-wide">{BRAND_NAME}</div>
        <div className="mx-auto mt-3 h-px w-10 bg-zari/60" />
        <div className="mt-3 text-sm uppercase tracking-[0.3em] text-ink/50">{product.saree_type}</div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-col overflow-hidden rounded-lg border border-black/5 bg-white shadow-sm md:flex-row">
          <div className="flex flex-col bg-ivory md:w-1/2">
            <div className="h-96 w-full bg-contain bg-center bg-no-repeat md:h-[32rem]"
              style={active ? { backgroundImage: `url("${watermarkedUrl(active.r2_key)}")` } : undefined} role="img">
              {!active && <div className="grid h-full place-items-center text-ink/30">No image</div>}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((m) => (
                  <button
                    key={m.r2_key}
                    onClick={() => setActive(m)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2 bg-cover bg-center transition ${
                      active?.r2_key === m.r2_key ? 'border-zari' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundImage: `url("${watermarkedUrl(m.r2_key)}")` }}
                    aria-label="Preview image"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col md:w-1/2">
            <div className="border-b border-black/10 px-6 py-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-ink">{product.saree_type}</div>
              {product.price_inr != null && (
                <div className="mt-1 text-2xl font-semibold text-ink">₹{Number(product.price_inr).toLocaleString('en-IN')}</div>
              )}
              <div className="mt-1 text-xs uppercase tracking-wide text-ink/40">Design {product.design_number}</div>
            </div>

            <div className="flex-1 space-y-4 px-6 py-5">
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

      <footer className="border-t border-black/5 py-8 text-center text-xs uppercase tracking-[0.3em] text-ink/30">
        {BRAND_NAME}
      </footer>
    </div>
  )
}

function Centered({ children }) {
  return <div className="grid min-h-screen place-items-center bg-[#FAF8F4] text-ink/50">{children}</div>
}