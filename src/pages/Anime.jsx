import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'

// Sección Anime (aislada): catálogo + buscador + géneros propios (fuente AnimeAV1).
// No usa TMDB ni los componentes del flujo pelis/series.

// Géneros de respaldo si /anime/genres falla (el mapa real viene de la API).
const FALLBACK_GENRES = [
  { slug: 'accion', label: 'Acción' },
  { slug: 'aventura', label: 'Aventura' },
  { slug: 'comedia', label: 'Comedia' },
  { slug: 'drama', label: 'Drama' },
  { slug: 'fantasia', label: 'Fantasía' },
  { slug: 'romance', label: 'Romance' },
  { slug: 'shounen', label: 'Shounen' },
  { slug: 'seinen', label: 'Seinen' },
  { slug: 'shojo', label: 'Shojo' },
  { slug: 'terror', label: 'Terror' },
  { slug: 'misterio', label: 'Misterio' },
  { slug: 'ciencia-ficcion', label: 'Ciencia ficción' },
]

function AnimeCard({ item }) {
  return (
    <Link to={`/anime/${item.slug}`} className="group w-full cursor-pointer">
      <div
        className="mb-2.5 aspect-[2/3] w-full overflow-hidden rounded-[10px] bg-cover bg-center transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:scale-[1.02] group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.5),0_0_0_1px_rgba(127,231,212,0.35)]"
        style={{
          backgroundImage: item.cover ? `url(${item.cover})` : undefined,
          backgroundColor: item.cover ? undefined : '#101319',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <p className="truncate text-[0.87rem] font-medium text-dimtext transition group-hover:text-white">
        {item.title}
      </p>
      {item.type && <p className="text-xs text-dimtext/70">{item.type}</p>}
    </Link>
  )
}

export default function Anime() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const genre = params.get('genre') || ''
  const page = Math.max(parseInt(params.get('page') || '1', 10) || 1, 1)

  const [input, setInput] = useState(q)
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [genres, setGenres] = useState(FALLBACK_GENRES)
  const [latest, setLatest] = useState([])

  useEffect(() => {
    setInput(q)
  }, [q])

  // Géneros dinámicos + últimos episodios (una sola vez; si fallan, hay respaldo).
  useEffect(() => {
    api.anime
      .genres()
      .then((d) => {
        if (d.genres?.length) setGenres(d.genres)
      })
      .catch(() => {})
    api.anime
      .latest()
      .then((d) => setLatest(d.items || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const req = q
      ? api.anime.search(q).then((d) => ({ items: d.items || [], hasMore: false }))
      : api.anime.catalog(page, genre)
    req
      .then((d) => {
        setItems(d.items || [])
        setHasMore(!!d.hasMore)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [q, genre, page])

  function submit(e) {
    e.preventDefault()
    setParams(input.trim() ? { q: input.trim() } : {})
  }

  function setGenre(g) {
    setParams(g ? { genre: g } : {})
  }

  function setPage(p) {
    const next = { ...(genre ? { genre } : {}), ...(q ? { q } : {}) }
    if (p > 1) next.page = String(p)
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="px-6 pb-20 pt-24">
      <h1 className="mb-1 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight max-md:text-[1.4rem]">
        Anime
      </h1>
      <p className="mb-6 text-[0.95rem] text-dimtext">
        Catálogo en español, subtitulado en HD.
      </p>

      {/* Buscador propio */}
      <form onSubmit={submit} className="mb-5 flex max-w-xl gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Buscar anime..."
          className="w-full rounded-[10px] border border-white/10 bg-surface-2 px-4 py-2.5 text-[0.9rem] text-white outline-none transition placeholder:text-dimtext focus:border-spectral-dim"
        />
        <button
          type="submit"
          className="shrink-0 rounded-[10px] border border-spectral-dim bg-spectral-dim/20 px-5 py-2.5 text-[0.9rem] font-semibold text-spectral transition hover:bg-spectral-dim/30"
        >
          Buscar
        </button>
      </form>

      {/* Géneros dinámicos (solo sin búsqueda activa) */}
      {!q && (
        <div className="mb-6 flex flex-wrap gap-2">
          {[{ slug: '', label: 'Todos' }, ...genres].map((g) => (
            <button
              key={g.slug || 'all'}
              onClick={() => setGenre(g.slug)}
              className={`rounded-full border px-4 py-1.5 text-[0.82rem] font-semibold transition ${
                genre === g.slug
                  ? 'border-spectral-dim bg-spectral-dim/20 text-spectral'
                  : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {/* Últimos episodios (vista principal sin filtros) */}
      {!q && !genre && page === 1 && latest.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 font-display text-[1.15rem] font-bold">
            Últimos episodios
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {latest.map((l) => (
              <Link
                key={`${l.slug}-${l.episode}`}
                to={`/anime/${l.slug}/${l.episode}`}
                className="group w-44 shrink-0 overflow-hidden rounded-[10px] border border-white/10 bg-surface-2 transition hover:border-spectral/30"
              >
                {l.screenshot ? (
                  <img
                    src={l.screenshot}
                    alt={`${l.title} ${l.episode}`}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                    className="aspect-video w-full object-cover"
                  />
                ) : null}
                <div className="px-3 py-2">
                  <p className="truncate text-[0.82rem] font-semibold text-dimtext transition group-hover:text-white">
                    {l.title}
                  </p>
                  <p className="text-xs text-dimtext/70">Episodio {l.episode}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}

      {loading ? (
        <p className="text-dimtext">Cargando anime…</p>
      ) : items.length === 0 && !error ? (
        <p className="text-gray-500">Sin resultados.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((item) => (
              <AnimeCard key={item.slug} item={item} />
            ))}
          </div>

          {!q && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-[0.85rem] font-semibold text-dimtext transition enabled:hover:text-white disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-[0.85rem] text-dimtext">Página {page}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!hasMore}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-[0.85rem] font-semibold text-dimtext transition enabled:hover:text-white disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
