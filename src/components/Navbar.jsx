import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'

export default function Navbar() {
  const [q, setQ] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function submit(e) {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-100 flex items-center justify-between px-5 py-5 transition-all duration-300 md:px-12 ${
        scrolled
          ? 'bg-[#08090c]/75 shadow-[0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl'
          : 'bg-gradient-to-b from-[rgba(8,9,12,0.7)] to-transparent'
      }`}
    >
      <Logo />

      <nav className="hidden items-center gap-9 text-[0.94rem] text-dimtext md:flex">
        <Link to="/" className="relative py-1.5 transition hover:text-white">
          Inicio
        </Link>
        <Link to="/" className="relative py-1.5 transition hover:text-white">
          Series
        </Link>
        <Link to="/" className="relative py-1.5 transition hover:text-white">
          Películas
        </Link>
        <Link to="/" className="relative py-1.5 transition hover:text-white">
          Géneros
        </Link>
      </nav>

      <form
        onSubmit={submit}
        className="flex min-w-[200px] items-center gap-2.5 rounded-[20px] border border-white/10 bg-white/5 px-3.5 py-2 text-[0.88rem] text-dimtext transition focus-within:border-spectral-dim focus-within:bg-white/10"
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
    </header>
  )
}
