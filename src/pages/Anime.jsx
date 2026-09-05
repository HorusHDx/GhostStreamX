import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import AnimeHero from '../components/AnimeHero.jsx'
import AnimeRail from '../components/AnimeRail.jsx'

// Sección Anime (aislada): home propio con sub-pestañas Inicio / Catálogo.
// Diseño adaptado de anime.html con datos reales (AnimeAV1).
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

const GENRE_RAILS = [
  { slug: 'isekai', title: 'Isekai y fantasía' },
  { slug: 'shounen', title: 'Shonen y acción' },
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

// Tarjeta de riel: póster + badges + nombre (diseño adaptado).
function RailPosterCard({ item, ribbon, addedAt, episodes }) {
  const ago = timeAgo(addedAt)
  return (
    <Link to={`/anime/${item.slug}`} className="group w-[175px] shrink-0 cursor-pointer">
      <div
        className="relative mb-2.5 aspect-[2/3] w-full overflow-hidden rounded-[10px] bg-cover bg-center transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.5),0_0_0_1px_rgba(127,231,212,0.35)]"
        style={{
          backgroundImage: item.cover ? `url(${item.cover})` : undefined,
          backgroundColor: item.cover ? undefined : '#101319',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {ribbon && (
          <span className="absolute left-2 top-2 z-[2] rounded-md bg-spectral px-2 py-1 text-[0.68rem] font-bold tracking-wide text-[#08090C]">
            {ribbon}
          </span>
        )}
        {item.type && (
          <span className="absolute right-2 top-2 z-[2] rounded-md border border-white/15 bg-black/65 px-2 py-[3px] text-[0.68rem] font-semibold text-dimtext">
            {item.type}
          </span>
        )}
      </div>
      <p className="truncate text-[0.87rem] font-medium text-dimtext transition group-hover:text-white">
        {item.title}
      </p>
      {episodes ? (
        <p className="text-xs text-dimtext/70">{episodes}</p>
      ) : (
        ago && <p className="text-xs text-dimtext/70">Agregado {ago}</p>
      )}
    </Link>
  )
}

// Tarjeta de episodio reciente con play-overlay (diseño adaptado).
function LatestCard({ item }) {
  const ago = timeAgo(item.publishedAt)
  return (
    <Link to={`/anime/${item.slug}/${item.episode}`} className="group">
      <div className="relative overflow-hidden rounded-[10px] transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_14px_28px_rgba(0,0,0,0.5),0_0_0_1px_rgba(127,231,212,0.35)]">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-80" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/55">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
        <span className="absolute bottom-2 left-2.5 z-[2] text-[0.78rem] font-semibold text-white">
          Episodio {item.episode}
        </span>
        {ago && (
          <span className="absolute bottom-2 right-2.5 z-[2] text-[0.72rem] text-dimtext">
            {ago}
          </span>
        )}
      </div>
      <p
        title={item.title}
        className="mt-2 line-clamp-2 min-h-[2.4em] text-[0.85rem] font-semibold leading-snug text-dimtext transition group-hover:text-white"
      >
        {item.title}
      </p>
    </Link>
  )
}

// Tarjeta Top con número gigante (diseño adaptado).
function TopCard({ item, rank }) {
  return (
    <Link to={`/anime/${item.slug}`} className="group flex shrink-0 cursor-pointer items-end">
      <span
        aria-hidden
        className="z-[1] -mr-[18px] select-none font-display text-[6.5rem] font-extrabold leading-[0.8] tracking-tight text-transparent transition-all duration-200 [-webkit-text-stroke:2px_rgba(255,255,255,0.18)] group-hover:text-spectral/10 group-hover:[-webkit-text-stroke:2px_rgba(127,231,212,0.35)]"
      >
        {rank}
      </span>
      <span className="z-[2] flex w-[150px] flex-col gap-2">
        <span
          className="aspect-[2/3] w-full rounded-[10px] bg-cover bg-center shadow-[0_10px_24px_rgba(0,0,0,0.4)] transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_34px_rgba(0,0,0,0.55),0_0_0_1px_rgba(127,231,212,0.35)]"
          style={{
            backgroundImage: item.cover ? `url(${item.cover})` : undefined,
            backgroundColor: item.cover ? undefined : '#101319',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <span className="flex gap-1.5">
          {item.score && (
            <span className="rounded-xl border border-[#E3BE6B]/25 bg-[#E3BE6B]/10 px-2 py-[3px] text-[0.72rem] text-[#E3BE6B]">
              ★ {item.score}
            </span>
          )}
        </span>
      </span>
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
  const [heroItems, setHeroItems] = useState([])
  const [top, setTop] = useState([])
  const [genreRails, setGenreRails] = useState([])
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

  // Home del anime: novedades + hero + top + rieles de género (en paralelo).
  useEffect(() => {
    if (tab !== 'inicio') return
    setLoadingHome(true)
    let alive = true
    api.anime
      .latest()
      .then((d) => {
        if (!alive) return
        setLatest(d.items || [])
        setRecent(d.recent || [])
        // Hero: ficha completa de los 5 primeros agregados (cache 1h).
        const picks = (d.recent || []).slice(0, 5)
        if (picks.length) {
          Promise.allSettled(picks.map((r) => api.anime.info(r.slug))).then((rs) => {
            if (!alive) return
            setHeroItems(rs.filter((r) => r.status === 'fulfilled').map((r) => r.value))
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingHome(false)
      })
    api.anime
      .top()
      .then((d) => {
        if (alive) setTop(d.items || [])
      })
      .catch(() => {})
    Promise.allSettled(GENRE_RAILS.map((g) => api.anime.catalog(1, g.slug))).then((rs) => {
      if (!alive) return
      setGenreRails(
        GENRE_RAILS.map((g, i) => ({
          ...g,
          items: rs[i].status === 'fulfilled' ? rs[i].value.items || [] : [],
        })).filter((r) => r.items.length > 0)
      )
    })
    return () => {
      alive = false
    }
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

  if (tab === 'inicio') {
    return (
      <div className="pb-20">
        <div className="px-6 pt-24 md:px-12">
          <h1 className="sr-only">Anime</h1>
          <div className="mb-6 flex gap-2">
            <button onClick={() => goTab('inicio')} className={pill(true)}>
              Inicio
            </button>
            <button onClick={() => goTab('catalogo')} className={pill(false)}>
              Catálogo
            </button>
          </div>
        </div>

        {heroItems.length > 0 && <AnimeHero items={heroItems} />}

        <div className="mt-11">
          <div className="mb-[18px] px-6 md:px-12">
            <h2 className="font-display text-[1.4rem] font-bold tracking-tight">
              Episodios recientemente actualizados
            </h2>
          </div>
          {loadingHome ? (
            <p className="px-6 text-dimtext md:px-12">Cargando novedades…</p>
          ) : latest.length === 0 ? (
            <p className="px-6 text-gray-500 md:px-12">Sin novedades por ahora.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 px-6 sm:grid-cols-3 lg:grid-cols-4 md:px-12">
              {latest.slice(0, 12).map((l) => (
                <LatestCard key={`${l.slug}-${l.episode}`} item={l} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-[52px]">
          {recent.length > 0 && (
            <AnimeRail
              title="Animes recientemente agregados"
              moreTo="/anime?tab=catalogo"
            >
              {recent.map((item) => (
                <RailPosterCard
                  key={item.slug}
                  item={item}
                  ribbon="NUEVO"
                  addedAt={item.addedAt}
                />
              ))}
            </AnimeRail>
          )}

          {top.length > 0 && (
            <AnimeRail title="Top anime" sub="Los mejor valorados">
              {top.map((item, i) => (
                <TopCard key={item.slug} item={item} rank={i + 1} />
              ))}
            </AnimeRail>
          )}

          {genreRails.map((rail) => (
            <AnimeRail
              key={rail.slug}
              title={rail.title}
              moreTo={`/anime?tab=catalogo&genre=${rail.slug}`}
            >
              {rail.items.slice(0, 12).map((item) => (
                <RailPosterCard key={item.slug} item={item} />
              ))}
            </AnimeRail>
          ))}
        </div>
      </div>
    )
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
        <button onClick={() => goTab('inicio')} className={pill(false)}>
          Inicio
        </button>
        <button onClick={() => goTab('catalogo')} className={pill(true)}>
          Catálogo
        </button>
      </div>

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
    </div>
  )
}
