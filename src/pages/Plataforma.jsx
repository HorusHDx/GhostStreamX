import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import PosterCard from '../components/PosterCard.jsx'

const FILTROS = [
  { id: 'todo', label: 'Todo' },
  { id: 'movie', label: 'Películas' },
  { id: 'tv', label: 'Series' },
]

// Página dedicada de una plataforma: películas + series de esa red.
export default function Plataforma() {
  const { id } = useParams()
  const [info, setInfo] = useState(null)
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [filtro, setFiltro] = useState('todo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    setItems([])
    setPage(1)
    setInfo(null)
    api
      .plataforma(id, 1)
      .then((d) => {
        setInfo(d)
        setItems(d.items || [])
        setHasMore((d.page || 1) < (d.total_pages || 1))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  function cargarMas() {
    const np = page + 1
    setPage(np)
    api
      .plataforma(id, np)
      .then((d) => {
        setItems((prev) => [...prev, ...(d.items || [])])
        setHasMore((d.page || np) < (d.total_pages || np))
      })
      .catch(() => {})
  }

  const visible =
    filtro === 'todo'
      ? items
      : items.filter((i) => i.media_type === filtro)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center pt-20 text-gray-500">
        Cargando plataforma…
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 pt-24 text-red-400">Error: {error}</div>
    )
  }

  return (
    <div className="px-5 pb-20 pt-28 md:px-12">
      <Link
        to="/"
        className="mb-6 inline-block text-sm text-dimtext transition hover:text-white"
      >
        ← Volver al inicio
      </Link>

      {/* Cabecera de la plataforma */}
      <div className="mb-8 flex items-center gap-4">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: info?.color }}
        />
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {info?.name}
        </h1>
      </div>

      {/* Filtro */}
      <div className="mb-6 flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              filtro === f.id
                ? 'border-spectral-dim bg-spectral-dim text-spectral'
                : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <p className="text-dimtext">No hay contenido para este filtro.</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {visible.map((item) => (
            <PosterCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
      )}

      {hasMore && filtro === 'todo' && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={cargarMas}
            className="rounded-lg border border-white/10 bg-white/5 px-8 py-3 font-semibold text-white transition hover:border-spectral-dim hover:bg-white/10"
          >
            Cargar más
          </button>
        </div>
      )}
    </div>
  )
}
