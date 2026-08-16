import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BRAND_NAME } from '../lib/constants'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function signIn() {
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setError('Those details don’t match. Try again.')
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-4">
      {/* signature: a single zari thread down the left edge */}
      <div className="pointer-events-none absolute inset-y-0 left-8 hidden w-px bg-gradient-to-b from-transparent via-zari/40 to-transparent md:block" />

      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mb-3 text-xs uppercase tracking-[0.35em] text-zari">The Vault</div>
          <h1 className="font-display text-5xl font-medium tracking-wide text-parchment">
            {BRAND_NAME}
          </h1>
          <div className="mx-auto mt-4 h-px w-12 bg-zari/50" />
        </div>

        <div className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} onEnter={signIn} />
          <Field label="Password" type="password" value={password} onChange={setPassword} onEnter={signIn} />

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            onClick={signIn}
            disabled={busy || !email || !password}
            className="mt-2 w-full rounded-sm bg-zari px-4 py-3 text-sm font-medium uppercase tracking-widest text-ink transition hover:bg-zari-bright disabled:opacity-40"
          >
            {busy ? 'Signing in…' : 'Enter'}
          </button>
        </div>

        <p className="mt-8 text-center text-xs tracking-wide text-muted">Authorised access only</p>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, onEnter }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-widest text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        className="w-full rounded-sm border border-white/10 bg-aubergine px-3 py-2.5 text-parchment outline-none transition focus:border-zari/60"
      />
    </label>
  )
}
