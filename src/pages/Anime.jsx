import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'

// Sección Anime (aislada): home propio con sub-pestañas Inicio / Catálogo.
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

// "2026-09-04 18:41:07.295121+00" -> Date (UTC). Null si no parsea.
function parseAv1Date(s) {
  if (!s) return null
  const norm = String(s)
    .trim()
    .replace(' ', 'T')
    .replace(/\.(\d{3})\d+/, '.$1')
    .replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(norm)
  return Number.isNaN(d.getTime()) ? null : d
}

function timeAgo(iso) {
  const d = parseAv1Date(iso)
  if (!d) return ''
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000)
  const m = Math.floor(s / 60)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return h === 1 ? 'hace una hora' : `hace ${h} horas`
  const days = Math.floor(h / 24)
  if (days === 1) return 'hace un día'
  if (days < 7) return `hace ${days} días`
  const w = Math.floor(days / 7)
  return w === 1 ? 'hace una semana' : `hace ${w} semanas`
}

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

function LatestCard({ item }) {
  const ago = timeAgo(item.publishedAt)
  return (
    <Link
      to={`/anime/${item.slug}/${item.episode}`}
      className="group"
    >
      <div className="relative overflow-hidden rounded-[10px] border border-white/10 transition group-hover:border-spectral/40">
        {item.screenshot ? (
          <img
            src={item.screenshot}
            alt={`${item.title} ${item.episode}`}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            className="aspect-video w-full bg-[#101319] object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-[#101319] text-[1.2rem] font-bold text-dimtext">
            {item.episode}
          </div>
        )}
        <span className="absolute bottom-2 left-2 rounded-md bg-black/75 px-2 py-0.5 text-[0.75rem] font-bold text-white">
          Episodio {item.episode}
        </span>
        {ago && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-0.5 text-[0.72rem] text-dimtext">
            {ago}
          </span>
        )}
      </div>
      <p
        title={item.title}
        className="mt-1.5 line-clamp-2 min-h-[2.4em] text-[0.85rem] font-medium uppercase leading-snug text-dimtext transition group-hover:text-white"
      >
        {item.title}
      </p>
    </Link>
  )
}

const pill = (active) =>
  `rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition ${
    active
      ? 'border-spectral-dim bg-spectral-dim/20 text-spectral'
      : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
  }`

export default function Anime() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'catalogo' ? 'catalogo' : 'inicio'
  const q = params.get('q') || ''
  const genre = params.get('genre') || ''
  const page = Math.max(parseInt(params.get('page') || '1', 10) || 1, 1)

  const [input, setInput] = useState(q)
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(tab === 'catalogo')
  const [error, setError] = useState('')
  const [genres, setGenres] = useState(FALLBACK_GENRES)
  const [latest, setLatest] = useState([])
  const [recent, setRecent] = useState([])
  const [loadingHome, setLoadingHome] = useState(tab === 'inicio')

  useEffect(() => {
    setInput(q)
  }, [q])

  // Géneros dinámicos (una sola vez; si fallan, queda el respaldo).
  useEffect(() => {
    api.anime
      .genres()
      .then((d) => {
        if (d.genres?.length) setGenres(d.genres)
      })
      .catch(() => {})
  }, [])

  // Home del anime: últimos episodios + recién agregados.
  useEffect(() => {
    if (tab !== 'inicio') return
    setLoadingHome(true)
    api.anime
      .latest()
      .then((d) => {
        setLatest(d.items || [])
        setRecent(d.recent || [])
      })
      .catch(() => {})
      .finally(() => setLoadingHome(false))
  }, [tab])

  // Catálogo / búsqueda.
  useEffect(() => {
    if (tab !== 'catalogo') return
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
  }, [tab, q, genre, page])

  function goTab(t, extra = {}) {
    setParams({ tab: t, ...extra })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function submit(e) {
    e.preventDefault()
    goTab('catalogo', input.trim() ? { q: input.trim() } : {})
  }

  function setGenre(g) {
    goTab('catalogo', g ? { genre: g } : {})
  }

  function setPage(p) {
    const next = { tab: 'catalogo', ...(genre ? { genre } : {}), ...(q ? { q } : {}) }
    if (p > 1) next.page = String(p)
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="px-6 pb-20 pt-24">
      <h1 className="mb-1 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight max-md:text-[1.4rem]">
        Anime
      </h1>
      <p className="mb-5 text-[0.95rem] text-dimtext">
        Catálogo en español, subtitulado en HD.
      </p>

      {/* Sub-pestañas de la sección */}
      <div className="mb-6 flex gap-2">
        <button onClick={() => goTab('inicio')} className={pill(tab === 'inicio')}>
          Inicio
        </button>
        <button onClick={() => goTab('catalogo')} className={pill(tab === 'catalogo')}>
          Catálogo
        </button>
      </div>

      {tab === 'inicio' ? (
        <>
          <h2 className="mb-1 font-display text-[1.15rem] font-bold">Episodios</h2>
          <p className="mb-4 text-[0.75rem] font-semibold uppercase tracking-widest text-dimtext/70">
            Recientemente actualizado
          </p>
          {loadingHome ? (
            <p className="text-dimtext">Cargando novedades…</p>
          ) : latest.length === 0 ? (
            <p className="text-gray-500">Sin novedades por ahora.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {latest.map((l) => (
                <LatestCard key={`${l.slug}-${l.episode}`} item={l} />
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <>
              <div className="mb-4 mt-10 flex items-center justify-between">
                <h2 className="font-display text-[1.15rem] font-bold">
                  Recién agregados
                </h2>
                <button
                  onClick={() => goTab('catalogo')}
                  className="text-[0.85rem] font-semibold text-spectral hover:underline"
                >
                  Ver catálogo →
                </button>
              </div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {recent.slice(0, 12).map((item) => (
                  <AnimeCard key={item.slug} item={item} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
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

          {/* Géneros (solo sin búsqueda activa) */}
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
        </>
      )}
    </div>
  )
}
