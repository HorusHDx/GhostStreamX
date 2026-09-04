import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  function submit(e) {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="fixed top-0 z-50 w-full bg-gradient-to-b from-black/90 to-transparent px-6 py-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-3xl font-black tracking-tight text-netflix">
          GhostStreamX
        </Link>

        <nav className="hidden gap-6 text-sm text-gray-300 md:flex">
          <Link to="/" className="hover:text-white">Inicio</Link>
          <Link to="/" className="hover:text-white">Películas</Link>
          <Link to="/" className="hover:text-white">Series</Link>
        </nav>

        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="rounded border border-gray-700 bg-black/70 px-3 py-1.5 text-sm text-white placeholder-gray-400 outline-none focus:border-white"
          />
          <button
            type="submit"
            className="rounded bg-netflix px-3 py-1.5 text-sm font-semibold hover:bg-red-700"
          >
            Buscar
          </button>
        </form>
      </div>
    </header>
  )
}
