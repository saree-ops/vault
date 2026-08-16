import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BRAND_NAME } from '../../lib/constants'

export default function AdminLayout() {
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-black/10 bg-ink px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="font-display text-2xl tracking-wide text-parchment">{BRAND_NAME}</span>
          <nav className="flex gap-1">
            <Tab to="/admin">Products</Tab>
            <Tab to="/admin/catalogues">Catalogues</Tab>
          </nav>
        </div>
        <button
          onClick={signOut}
          className="text-xs uppercase tracking-widest text-muted transition hover:text-parchment"
        >
          Sign out
        </button>
      </header>

      <main className="flex-1 overflow-auto bg-white p-6 text-ink">
        <Outlet />
      </main>
    </div>
  )
}

function Tab({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/admin'}
      className={({ isActive }) =>
        `rounded-sm px-3 py-1.5 text-sm tracking-wide transition ${
          isActive ? 'bg-zari/20 text-zari-bright' : 'text-muted hover:text-parchment'
        }`
      }
    >
      {children}
    </NavLink>
  )
}