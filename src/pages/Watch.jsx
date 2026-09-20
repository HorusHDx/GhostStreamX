import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import Player from '../components/Player.jsx'
import PosterCard from '../components/PosterCard.jsx'

const HISTORY_KEY = 'ghoststreamx_history'
const STILL = 'https://image.tmdb.org/t/p/w300'

function saveProgress(key, seconds, meta = {}) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[key] = {
      t: Date.now(),
      position: Math.round(seconds),
      ...meta,
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

const prettyLang = (l) => {
  if (!l || l === 'server') return 'Servidores'
  const map = {
    latino: 'Latino',
    castellano: 'Castellano',
    subtitulado: 'Subtitulado',
    english: 'English',
  }
  return map[l] || l
}

// Etiquetas genéricas de los grupos: solo "Servidor N", sin revelar el
// proveedor real de cada grupo.
const GROUP_LABELS = { P1: 'Servidor 1', P2: 'Servidor 2' }

// Convierte la URL de un servidor en su enlace directo de descarga cuando el
// hoster expone una página dedicada para eso (la misma convención que usan
// los reproductores conocidos). Si no hay página de descarga, se devuelve la
// misma URL: al abrirla el usuario ve el embed con sus opciones.
const downloadUrlFor = (u) => {
  if (!u) return ''
  const low = u.toLowerCase()
  // Archivos directos: abrir ya es descargar.
  if (/\.(mp4|mkv|webm|mov|m3u8)(\?|$)/i.test(u)) return u
  // Streamwish / EmbedWish / HgPlay: /e/ (player) -> /f/ (descarga).
  if (low.includes('streamwish') || low.includes('embedwish') || low.includes('hgplay')) {
    return u.replace(/\/e\//i, '/f/')
  }
  // VidHide / Minochinos: /v/ (player) -> /d/ (descarga).
  if (low.includes('vidhide') || low.includes('minochinos')) {
    return u.replace(/\/v\//i, '/d/')
  }
  // Filemoon / MyVidPlay: /e/ -> /d/.
  if (low.includes('filemoon') || low.includes('myvidplay')) {
    return u.replace(/\/e\//i, '/d/')
  }
  // Doodstream: /e/ -> /d/.
  if (low.includes('doodstream') || low.includes('dood.')) {
    return u.replace(/\/e\//i, '/d/')
  }
  return u
}

export default function Watch({ type }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const seasonParam = params.get('season') || ''
  const episodeParam = params.get('episode') || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sources, setSources] = useState([])
  const [selected, setSelected] = useState(null)
  const [resolveError, setResolveError] = useState('')
  const [meta, setMeta] = useState({})
  const [seasons, setSeasons] = useState([])
  const [seasonNum, setSeasonNum] = useState(Number(seasonParam) || 1)
  const [episodes, setEpisodes] = useState([])
  const [recs, setRecs] = useState([])
  const [dlOpen, setDlOpen] = useState(false) // panel de descarga visible

  const epTrackRef = useRef(null)
  const recTrackRef = useRef(null)
  const scrollRail = (ref, dir) =>
    ref.current?.scrollBy({ left: dir * 420, behavior: 'smooth' })

  // Elige una fuente del grupo activo. Todas llegan con URL lista (embeds
  // resueltos en el backend), así que no hay resolución bajo demanda.
  const pickSource = useCallback((s) => {
    if (!s) return
    setResolveError('')
    setSelected(s)
  }, [])

  // Mantiene la temporada del selector sincronizada con la URL.
  useEffect(() => {
    if (seasonParam) setSeasonNum(Number(seasonParam))
  }, [seasonParam])

  useEffect(() => {
    setLoading(true)
    setError('')
    setResolveError('')
    setSources([])
    setSelected(null)
    setMeta({})
    setSeasons([])
    setEpisodes([])

    const p =
      type === 'movie'
        ? api.watchMovie(id)
        : seasonParam && episodeParam
          ? api.watchEpisode(id, seasonParam, episodeParam)
          : Promise.resolve({ sources: [], message: 'Faltan temporada/episodio' })

    p.then((data) => {
      const list = data.sources || []
      if (list.length === 0) {
        setError(data.message || 'No se encontró una fuente disponible.')
        return
      }
      setSources(list)
      pickSource(list[0])
    })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    // Metadata completa para el encabezado y "Continuar viendo",
    // + temporadas (una sola llamada para series, antes eran dos).
    const metaP = type === 'movie' ? api.movie(id) : api.tv(id)
    metaP
      .then((d) => {
        setMeta({
          title: d.title || d.name,
          overview: d.overview,
          genres: (d.genres || []).map((g) => g.name),
          year: (d.release_date || d.first_air_date || '').slice(0, 4),
          runtime: d.runtime || (d.episode_run_time && d.episode_run_time[0]),
          poster: d.poster_path,
        })
        if (type === 'tv') {
          setSeasons((d.seasons || []).filter((s) => s.season_number > 0))
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, seasonParam, episodeParam])

  // Episodios de la temporada visible (solo series).
  useEffect(() => {
    if (type !== 'tv') return
    api
      .tvSeason(id, seasonNum)
      .then((d) => setEpisodes(d.episodes || []))
      .catch(() => setEpisodes([]))
  }, [type, id, seasonNum])

  // Auto-scroll: centra el episodio actual en el carrusel al cargar.
  useEffect(() => {
    if (type !== 'tv' || episodes.length === 0) return
    const idx = episodes.findIndex((e) => String(e.episode_number) === String(episodeParam))
    if (idx < 0) return
    const card = epTrackRef.current?.children[idx]
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [type, episodes, episodeParam])

  // Recomendados reales: secuelas, misma saga y similares (TMDB).
  useEffect(() => {
    const p = type === 'movie' ? api.movieRecs(id) : api.tvRecs(id)
    p.then((d) =>
      setRecs(
        (d.items || []).filter((t) => String(t.id) !== String(id)).slice(0, 12)
      )
    ).catch(() => {})
  }, [type, id])

  // Todas las fuentes agrupadas por proveedor (P1, P2, ...) en orden.
  const groupedSources = useMemo(() => {
    const map = new Map()
    for (const s of sources) {
      const g = s.group || 'P1'
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(s)
    }
    return map
  }, [sources])

  const effective = selected && selected.url ? selected : null

  const currentEpisode =
    type === 'tv'
      ? episodes.find((e) => String(e.episode_number) === String(episodeParam))
      : null
  const nextEpisode =
    type === 'tv' && episodeParam
      ? episodes.find((e) => e.episode_number === Number(episodeParam) + 1)
      : null
  // El botón "Siguiente" siempre está disponible: el avance automático real
  // no es posible dentro de un iframe externo (no se detecta el fin del video).
  const showNext = !!nextEpisode

  const genresText = (meta.genres || []).join(', ')
  const sub =
    type === 'movie'
      ? [meta.year, meta.runtime ? `${meta.runtime} min` : '', genresText]
          .filter(Boolean)
          .join(' · ')
      : [
          currentEpisode?.runtime || meta.runtime
            ? `${currentEpisode?.runtime || meta.runtime} min`
            : '',
          genresText,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1240px] px-5 pb-20 pt-24 md:px-12">
      <Link
        to={type === 'movie' ? `/movie/${id}` : `/tv/${id}`}
        className="mb-5 inline-flex items-center gap-2 text-[0.9rem] text-dimtext transition hover:text-spectral"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Volver al detalle
      </Link>

      <ProgressTracker enabled={!!selected} getPosition={() => 0} meta={meta} />

      {error && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] border border-red-900 bg-red-950/40 p-4 text-red-300">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-full border border-red-400/30 bg-white/5 px-4 py-1.5 text-[0.82rem] font-semibold text-red-200 transition hover:bg-white/10"
          >
            Reintentar
          </button>
        </div>
      )}

      {resolveError && !loading && (
        <div className="mb-5 rounded-[10px] border border-yellow-900 bg-yellow-950/40 p-4 text-yellow-200">
          {resolveError}
        </div>
      )}

      {/* ---------- FRAME DEL REPRODUCTOR ---------- */}
      <div className="relative overflow-hidden rounded-[14px] border border-white/10 bg-gradient-to-br from-[#1a1e28] to-[#0a0b10] shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
        {selected && (
          <div className="pointer-events-none absolute right-[18px] top-[18px] z-[3] flex gap-2">
            <span className="rounded-[20px] border border-white/15 bg-black/55 px-3 py-1 text-[0.75rem] text-dimtext backdrop-blur-md">
              HD
            </span>
            <span className="rounded-[20px] border border-white/15 bg-black/55 px-3 py-1 text-[0.75rem] text-dimtext backdrop-blur-md">
              {GROUP_LABELS[selected.group || 'P1']}
            </span>
          </div>
        )}
        {loading ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-4">
            <div className="flex h-[82px] w-[82px] items-center justify-center rounded-full border border-white/25 bg-white/5">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" className="ml-1 animate-pulse">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <p className="text-[0.85rem] text-dimtext">Resolviendo fuentes…</p>
          </div>
        ) : effective ? (
          <Player source={effective} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-[0.9rem] text-dimtext">
            Sin fuentes disponibles para este título.
          </div>
        )}
      </div>

      {/* ---------- ACCIONES DEL REPRODUCTOR ---------- */}
      {!loading && effective && (
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={() => setDlOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[0.82rem] font-semibold transition ${
              dlOpen
                ? 'border-spectral-dim bg-spectral-dim/20 text-spectral'
                : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
            }`}
          >
            {dlOpen ? '✕ Volver' : '⬇ Descargar'}
          </button>
        </div>
      )}

      {/* ---------- SERVIDORES (justo debajo del reproductor) ---------- */}
      {!loading && !error && selected && (
        <div id="servidores" className="mt-5 mb-6">
          {dlOpen ? (
            <div className="rounded-[14px] border border-white/10 bg-surface-2 p-4">
              <p className="mb-1 text-[0.95rem] font-semibold">⬇ Descargar</p>
              <p className="mb-3 text-[0.78rem] text-dimtext">
                La descarga se abre en la página oficial del servidor, en otra pestaña.
              </p>
              {[...groupedSources.entries()].map(([g, gSources]) => (
                <div key={g} className="mb-4 last:mb-0">
                  <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-wider text-spectral">
                    {GROUP_LABELS[g] || g}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {gSources.map((s, i) => (
                      <div
                        key={`${s.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2.5"
                      >
                        <p className="min-w-0 truncate text-[0.85rem] font-semibold">
                          {s.name || `Servidor ${i + 1}`}
                        </p>
                        <button
                          onClick={() =>
                            window.open(downloadUrlFor(s.url), '_blank', 'noopener')
                          }
                          className="shrink-0 rounded-full border border-spectral-dim bg-spectral-dim/15 px-3 py-1.5 text-[0.78rem] font-bold text-spectral transition hover:bg-spectral-dim/30"
                        >
                          ⬇
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            [...groupedSources.entries()].map(([g, gSources]) => {
              const label = GROUP_LABELS[g] || g
              return (
                <div key={g} className="mb-4 last:mb-0">
                  <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wider text-spectral">
                    {label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {gSources.map((s, i) => {
                      const isActive =
                        effective &&
                        (s.url || '') === (effective.url || '') &&
                        (s.name || '') === (effective.name || '')
                      return (
                        <button
                          key={`${s.name}-${i}`}
                          onClick={() => pickSource(s)}
                          className={`flex items-center gap-2.5 rounded-[10px] border px-4 py-2.5 text-left transition ${
                            isActive
                              ? 'border-spectral bg-spectral-dim/15 text-white'
                              : 'border-white/10 bg-white/5 text-dimtext hover:border-white/25 hover:text-white'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              isActive ? 'bg-spectral' : 'bg-white/20'
                            }`}
                          />
                          <span className="text-[0.85rem] font-semibold">
                            {s.name || `Servidor ${i + 1}`}
                          </span>
                          {isActive && (
                            <span className="ml-1 rounded-full border border-spectral/40 bg-spectral/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-spectral">
                              Reproduciendo
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ---------- TÍTULO + META ---------- */}
      {!loading && !error && selected && (
        <div>
          <p className="mb-2 text-[0.85rem] font-semibold text-spectral">
            {type === 'movie' ? 'Película' : meta.title || 'Serie'}
          </p>
          <h1 className="mb-1.5 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight max-md:text-[1.4rem]">
            {type === 'movie'
              ? meta.title || 'Reproduciendo'
              : `Temporada ${seasonParam} · Episodio ${episodeParam}${currentEpisode?.name ? ` — "${currentEpisode.name}"` : ''}`}
          </h1>
          {sub && <p className="mb-5 text-[0.95rem] text-dimtext">{sub}</p>}

          {(currentEpisode?.overview || (type === 'movie' && meta.overview)) && (
            <p className="mb-5 max-w-[760px] text-[0.95rem] leading-relaxed text-[#C7CBD4]">
              {type === 'movie' ? meta.overview : currentEpisode?.overview || meta.overview}
            </p>
          )}

          {showNext && (
            <Link
              to={`/watch/tv/${id}?season=${seasonNum}&episode=${nextEpisode.episode_number}`}
              className="group relative mt-1 mb-6 block overflow-hidden rounded-[14px] border border-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: nextEpisode.still_path
                    ? `url(https://image.tmdb.org/t/p/w780${nextEpisode.still_path})`
                    : 'linear-gradient(150deg,#2a3450,#10141f)',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/30" />

              <div className="relative z-[2] flex items-center gap-4 px-5 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition group-hover:border-transparent group-hover:bg-spectral">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" className="ml-[1px] transition group-hover:fill-bg">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-spectral">
                    A continuación · Temporada {seasonNum}
                  </p>
                  <p className="mt-0.5 truncate text-[1.02rem] font-bold">
                    E{nextEpisode.episode_number}
                    {nextEpisode.name ? ` — ${nextEpisode.name}` : ''}
                  </p>
                  <p className="mt-0.5 truncate text-[0.8rem] text-dimtext">
                    {nextEpisode.runtime ? `${nextEpisode.runtime} min` : 'Episodio'}
                    {nextEpisode.overview
                      ? ` · ${nextEpisode.overview.slice(0, 80).trim()}${nextEpisode.overview.length > 80 ? '…' : ''}`
                      : ''}
                  </p>
                </div>

                <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[0.85rem] font-semibold whitespace-nowrap backdrop-blur-sm transition group-hover:border-transparent group-hover:bg-spectral group-hover:text-bg md:inline-flex">
                  ▶ Reproducir
                </span>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ---------- EPISODIOS (solo series) ---------- */}
      {type === 'tv' && seasons.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-[1.25rem] font-bold tracking-tight">
              Episodios — Temporada {seasonNum}
            </h2>
            <div className="hidden gap-2 md:flex">
              <button
                onClick={() => scrollRail(epTrackRef, -1)}
                aria-label="Anterior"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={() => scrollRail(epTrackRef, 1)}
                aria-label="Siguiente"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          {seasons.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  onClick={() => setSeasonNum(s.season_number)}
                  className={`rounded-full border px-4 py-1.5 text-[0.85rem] transition ${
                    seasonNum === s.season_number
                      ? 'border-spectral-dim bg-spectral-dim/20 font-semibold text-spectral'
                      : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
                  }`}
                >
                  T{s.season_number}
                </button>
              ))}
            </div>
          )}

          <div ref={epTrackRef} className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
            {episodes.map((ep) => {
              const isCurrent =
                String(seasonNum) === String(seasonParam) &&
                String(ep.episode_number) === String(episodeParam)
              const still = ep.still_path ? `${STILL}${ep.still_path}` : null
              return (
                <Link
                  key={ep.episode_number}
                  to={`/watch/tv/${id}?season=${seasonNum}&episode=${ep.episode_number}`}
                  className={`w-[280px] shrink-0 rounded-[10px] border p-2 transition ${
                    isCurrent
                      ? 'border-spectral-dim bg-spectral/5'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div
                    className="relative mb-2.5 aspect-video w-full overflow-hidden rounded-lg bg-cover bg-center"
                    style={{
                      backgroundImage: still ? `url(${still})` : 'linear-gradient(160deg,#233047,#0e1420)',
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span
                      className={`absolute left-2 top-2 z-[2] rounded-md border px-2 py-0.5 text-[0.72rem] font-semibold ${
                        isCurrent
                          ? 'border-transparent bg-spectral text-bg'
                          : 'border-white/15 bg-black/70 text-white'
                      }`}
                    >
                      E{ep.episode_number}
                    </span>
                    <span className="absolute inset-0 z-[1] flex items-center justify-center opacity-0 transition hover:opacity-100">
                      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/30 bg-black/55">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" className="ml-[1px]">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </span>
                  </div>
                  <p className="mb-0.5 truncate text-[0.87rem] font-semibold">
                    {ep.name || `Episodio ${ep.episode_number}`}
                  </p>
                  <p className="text-[0.78rem] text-dimtext">
                    {ep.runtime ? `${ep.runtime} min` : 'Episodio'}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------- RECOMENDADOS ---------- */}
      {recs.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-[1.25rem] font-bold tracking-tight">
              También te puede interesar
            </h2>
            <div className="hidden gap-2 md:flex">
              <button
                onClick={() => scrollRail(recTrackRef, -1)}
                aria-label="Anterior"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={() => scrollRail(recTrackRef, 1)}
                aria-label="Siguiente"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
          <div ref={recTrackRef} className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
            {recs.map((item) => (
              <div key={`${item.media_type}-${item.id}`} className="w-[170px] shrink-0">
                <PosterCard item={item} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressTracker({ enabled, getPosition, meta }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const season = params.get('season') || ''
  const episode = params.get('episode') || ''
  const mediaType = window.location.pathname.includes('/movie/') ? 'movie' : 'tv'

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const key = `${mediaType}:${id}:${season}:${episode}`
    saveProgress(key, getPosition(), {
      mediaType,
      id,
      season,
      episode,
      title: meta.title,
      poster: meta.poster,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meta.title, meta.poster])

  return null
}
