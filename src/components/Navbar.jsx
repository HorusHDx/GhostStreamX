import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'

const MENU = [
  { label: 'Inicio', to: '/', scrollTop: true },
  { label: 'Series', to: { pathname: '/', hash: '#top-series' } },
  { label: 'Películas', to: { pathname: '/', hash: '#top-peliculas' } },
  { label: 'Géneros', to: { pathname: '/', hash: '#generos' } },
  { label: 'Anime', to: '/anime' },
  { label: 'Historial', to: '/historial' },
]

export default function Navbar() {
  const [q, setQ] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Cierra el menú móvil al navegar.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  function submit(e) {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  const goTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-[100] flex items-center justify-between px-5 py-5 transition-all duration-300 md:px-12 ${
        scrolled
          ? 'bg-[#08090c]/75 shadow-[0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl'
          : 'bg-gradient-to-b from-[rgba(8,9,12,0.7)] to-transparent'
      }`}
    >
      <Logo />

      <nav className="hidden items-center gap-9 text-[0.94rem] text-dimtext md:flex">
        {MENU.map((m) => (
          <Link
            key={m.label}
            to={m.to}
            onClick={m.scrollTop ? goTop : undefined}
            className="relative py-1.5 transition hover:text-white"
          >
            {m.label}
          </Link>
        ))}
      </nav>

      <form
        onSubmit={submit}
        className="ml-3 flex min-w-0 max-w-[220px] flex-1 items-center gap-2.5 rounded-[20px] border border-white/10 bg-white/5 px-3.5 py-2 text-[0.88rem] text-dimtext transition focus-within:border-spectral-dim focus-within:bg-white/10 md:ml-0 md:max-w-none md:flex-none md:min-w-[200px]"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 opacity-70"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar títulos..."
          className="w-full bg-transparent text-white outline-none placeholder:text-dimtext"
        />
      </form>

      {/* Botón hamburguesa (solo móvil) */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {/* Panel desplegable (solo móvil) */}
      {open && (
        <nav className="absolute inset-x-0 top-full flex flex-col border-b border-white/10 bg-[#08090c]/95 px-5 pb-2 pt-1 backdrop-blur-2xl md:hidden">
          {MENU.map((m) => (
            <Link
              key={m.label}
              to={m.to}
              onClick={m.scrollTop ? goTop : undefined}
              className="border-b border-white/5 py-3 text-[0.95rem] text-dimtext transition last:border-0 hover:text-white"
            >
              {m.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
