import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Catalogues() {
  const [catalogues, setCatalogues] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('catalogues')
      .select('id, slug, name, show_price, is_archived, created_at, catalogue_products(count)')
      .order('created_at', { ascending: false })
    if (!error) setCatalogues(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-3xl text-ink">Catalogues</h2>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium uppercase tracking-widest text-parchment transition hover:bg-aubergine"
        >
          New catalogue
        </button>
      </div>

      {loading ? (
        <p className="text-ink/50">Loading…</p>
      ) : catalogues.length === 0 ? (
        <p className="text-ink/50">No catalogues yet. Create your first one to share with buyers.</p>
      ) : (
        <div className="space-y-3">
          {catalogues.map((c) => (
            <CatalogueRow key={c.id} catalogue={c} onOpen={() => navigate(`/admin/catalogues/${c.id}`)} onChanged={load} />
          ))}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={(id) => navigate(`/admin/catalogues/${id}`)} />}
    </div>
  )
}

function CatalogueRow({ catalogue, onOpen, onChanged }) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const count = catalogue.catalogue_products?.[0]?.count ?? 0
  const link = `${window.location.origin}/c/${catalogue.slug}`

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  async function toggleArchive() {
    await supabase.from('catalogues').update({ is_archived: !catalogue.is_archived }).eq('id', catalogue.id)
    onChanged()
  }
  async function remove() {
    await supabase.from('catalogues').delete().eq('id', catalogue.id)
    onChanged()
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-black/10 bg-white p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <button onClick={onOpen} className="font-display text-xl text-ink transition hover:text-zari">{catalogue.name}</button>
          {catalogue.is_archived && (
            <span className="rounded bg-black/10 px-2 py-0.5 text-xs uppercase tracking-wide text-ink/50">Archived</span>
          )}
        </div>
        <div className="mt-0.5 text-sm text-ink/50">
          {count} {count === 1 ? 'product' : 'products'} · {catalogue.show_price ? 'price shown' : 'price hidden'}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
       <button onClick={copy} className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-ink transition hover:border-zari">
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <a href={link} target="_blank" rel="noreferrer" className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-ink transition hover:border-zari">
          View
        </a>
        <button onClick={onOpen} className="rounded-md bg-zari px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-zari-bright">
          Manage
        </button>
        <button onClick={toggleArchive} className="rounded-md px-3 py-1.5 text-sm text-ink/60 transition hover:text-ink">
          {catalogue.is_archived ? 'Unarchive' : 'Archive'}
        </button>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="rounded-md px-3 py-1.5 text-sm text-red-600 transition hover:text-red-700">Delete</button>
        ) : (
          <span className="flex items-center gap-2 text-sm">
            <button onClick={remove} className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white transition hover:bg-red-700">Confirm</button>
            <button onClick={() => setConfirming(false)} className="text-ink/50 transition hover:text-ink">Cancel</button>
          </span>
        )}
      </div>
    </div>
  )
}

function CreateModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [showPrice, setShowPrice] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!name.trim()) return setError('Give the catalogue a name.')
    setBusy(true)
    const { data, error } = await supabase
      .from('catalogues')
      .insert({ name: name.trim(), show_price: showPrice })
      .select()
      .single()
    if (error) { setError(error.message); setBusy(false); return }
    onCreated(data.id)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-display text-2xl">New catalogue</h3>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ink/50">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Diwali Collection 2026" autoFocus />
        </label>
        <label className="mt-4 flex items-center gap-3">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="h-4 w-4 accent-zari" style={{ colorScheme: 'light' }} />
          <span className="text-sm text-ink">Show prices to viewers</span>
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-ink/60 transition hover:text-ink disabled:opacity-40">Cancel</button>
          <button onClick={create} disabled={busy} className="rounded-md bg-zari px-6 py-2 text-sm font-medium uppercase tracking-widest text-ink transition hover:bg-zari-bright disabled:opacity-50">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}