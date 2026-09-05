import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import Player from '../components/Player.jsx'
import PosterCard from '../components/PosterCard.jsx'

const HISTORY_KEY = 'ghoststreamx_history'
const STILL = 'https://image.tmdb.org/t/p/w500'

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

export default function Watch({ type }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const seasonParam = params.get('season') || ''
  const episodeParam = params.get('episode') || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sources, setSources] = useState([])
  const [selected, setSelected] = useState(null)
  const [grupo, setGrupo] = useState('S1') // 'S1' UnlimPlay | 'S2' NasriPlay
  const [resolvingToken, setResolvingToken] = useState(null)
  const [resolveError, setResolveError] = useState('')
  const resolvedRef = useRef({})
  const pickIdRef = useRef(0)
  const [meta, setMeta] = useState({})
  const [seasons, setSeasons] = useState([])
  const [seasonNum, setSeasonNum] = useState(Number(seasonParam) || 1)
  const [episodes, setEpisodes] = useState([])
  const [recs, setRecs] = useState([])

  const epTrackRef = useRef(null)
  const recTrackRef = useRef(null)
  const scrollRail = (ref, dir) =>
    ref.current?.scrollBy({ left: dir * 420, behavior: 'smooth' })

  // Elige una fuente; las S2 pendientes (server+token) se resuelven
  // bajo demanda contra /watch/nsr/resolve (con cache en memoria).
  // Guarda el error para mostrarlo en vez de quedarse en silencio.
  const pickSource = useCallback(async (s) => {
    if (!s) return
    setResolveError('')
    if (!s.needsResolve) {
      setSelected(s)
      return
    }
    const cacheKey = `${s.server}::${s.token}`
    const hit = resolvedRef.current[cacheKey]
    if (hit) {
      setSelected({ ...s, url: hit.url, kind: hit.kind, needsResolve: false })
      return
    }
    const myId = ++pickIdRef.current
    setSelected({ ...s })
    setResolvingToken(s.token)
    try {
      const d = await api.nsrResolve(s.server, s.token)
      if (d && d.url) {
        resolvedRef.current[cacheKey] = { url: d.url, kind: d.kind || 'embed' }
        if (pickIdRef.current === myId) {
          setSelected({ ...s, url: d.url, kind: d.kind || 'embed', needsResolve: false })
        }
      } else if (pickIdRef.current === myId) {
        setResolveError(`El servidor “${s.server}” no devolvió video. Probá con otro servidor.`)
      }
    } catch (e) {
      if (pickIdRef.current === myId) {
        setResolveError(
          `No se pudo resolver “${s.server}”: ${e.message || 'error de red'}. Probá con otro servidor.`
        )
      }
    } finally {
      setResolvingToken((t) => (t === s.token ? null : t))
    }
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
      const inGroup = (s, g) => (s.group || 'S1') === g
      const g = list.some((s) => inGroup(s, 'S1')) ? 'S1' : 'S2'
      setSources(list)
      setGrupo(g)
      pickSource(list.find((s) => inGroup(s, g)) || list[0])
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

  // Recomendados reales: secuelas, misma saga y similares (TMDB).
  useEffect(() => {
    const p = type === 'movie' ? api.movieRecs(id) : api.tvRecs(id)
    p.then((d) =>
      setRecs(
        (d.items || []).filter((t) => String(t.id) !== String(id)).slice(0, 12)
      )
    ).catch(() => {})
  }, [type, id])

  // Fuentes del grupo activo (S1/S2) agrupadas por idioma para los selects.
  const groupSources = useMemo(
    () => sources.filter((s) => (s.group || 'S1') === grupo),
    [sources, grupo]
  )
  const s1Count = useMemo(
    () => sources.filter((s) => (s.group || 'S1') === 'S1').length,
    [sources]
  )
  const s2Count = useMemo(
    () => sources.filter((s) => s.group === 'S2').length,
    [sources]
  )
  const switchGrupo = (g) => {
    setGrupo(g)
    setResolveError('')
    const first = sources.find((s) => (s.group || 'S1') === g)
    if (first) pickSource(first)
  }

  const byLanguage = useMemo(() => {
    const map = new Map()
    for (const s of groupSources) {
      const key = s.language || 'server'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return map
  }, [groupSources])

  const activeSelected =
    selected && (selected.group || 'S1') === grupo ? selected : null
  // Solo se reproduce lo que ya tiene URL (las S2 se resuelven al elegir).
  const effective = activeSelected && activeSelected.url ? activeSelected : null

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
        <div className="mb-5 rounded-[10px] border border-red-900 bg-red-950/40 p-4 text-red-300">
          {error}
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
              {prettyLang(selected.language)}
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
        ) : resolvingToken ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-4">
            <div className="flex h-[82px] w-[82px] items-center justify-center rounded-full border border-spectral-dim bg-spectral-dim/20">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#7FE7D4" className="ml-1 animate-pulse">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <p className="text-[0.85rem] text-dimtext">Resolviendo servidor S2…</p>
          </div>
        ) : effective ? (
          <Player source={effective} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-[0.9rem] text-dimtext">
            Sin fuentes en {grupo === 'S2' ? 'S2 · NasriPlay' : 'S1 · UnlimPlay'} para
            este título.
          </div>
        )}
      </div>

      {/* ---------- META + SELECTORES ---------- */}
      {!loading && !error && selected && (
        <div className="mt-7">
          <p className="mb-2 text-[0.85rem] font-semibold text-spectral">
            {type === 'movie' ? 'Película' : meta.title || 'Serie'}
          </p>
          <h1 className="mb-1.5 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight max-md:text-[1.4rem]">
            {type === 'movie'
              ? meta.title || 'Reproduciendo'
              : `Temporada ${seasonParam} · Episodio ${episodeParam}${currentEpisode?.name ? ` — "${currentEpisode.name}"` : ''}`}
          </h1>
          {sub && <p className="mb-[22px] text-[0.95rem] text-dimtext">{sub}</p>}

          {/* Tabs S1 / S2 */}
          <div className="mb-4 flex gap-2">
            {[
              { id: 'S1', label: 'S1 · UnlimPlay', count: s1Count },
              { id: 'S2', label: 'S2 · NasriPlay', count: s2Count },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => switchGrupo(t.id)}
                className={`rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition ${
                  grupo === t.id
                    ? 'border-spectral-dim bg-spectral-dim/20 text-spectral'
                    : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {groupSources.length === 0 ? (
            <div className="mb-6 rounded-[10px] border border-white/10 bg-surface-2 p-4 text-[0.9rem] text-dimtext">
              {grupo === 'S2'
                ? 'S2 no devolvió fuentes para este título (sin match o sin key configurada).'
                : 'S1 no devolvió fuentes para este título.'}{' '}
              <button
                onClick={() => switchGrupo(grupo === 'S2' ? 'S1' : 'S2')}
                className="font-semibold text-spectral hover:underline"
              >
                Usar {grupo === 'S2' ? 'S1' : 'S2'}
              </button>
            </div>
          ) : null}

          <div className="mb-6 flex flex-wrap gap-4">
            <div className="flex flex-col gap-[7px]">
              <label className="text-[0.75rem] text-dimtext">Idioma / audio</label>
              <div className="relative flex min-w-[160px] items-center gap-2.5 rounded-[10px] border border-white/10 bg-surface-2 px-4 py-2.5 text-[0.9rem] transition hover:border-spectral/30 hover:bg-[#1c212a]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-spectral" />
                <select
                  value={activeSelected?.language || 'server'}
                  onChange={(e) => {
                    const group = byLanguage.get(e.target.value)
                    if (group && group.length > 0) pickSource(group[0])
                  }}
                  className="w-full cursor-pointer appearance-none bg-transparent pr-6 font-sans text-[0.9rem] text-white outline-none [&>option]:bg-surface-2"
                >
                  {[...byLanguage.keys()].map((lang) => (
                    <option key={lang} value={lang}>
                      {prettyLang(lang)}
                    </option>
                  ))}
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-[14px] text-dimtext">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>

            <div className="flex flex-col gap-[7px]">
              <label className="text-[0.75rem] text-dimtext">Servidor</label>
              <div className="relative flex min-w-[160px] items-center gap-2.5 rounded-[10px] border border-white/10 bg-surface-2 px-4 py-2.5 text-[0.9rem] transition hover:border-spectral/30 hover:bg-[#1c212a]">
                <select
                  value={activeSelected?.token || activeSelected?.url || ''}
                  onChange={(e) => {
                    const s = groupSources.find(
                      (x) => (x.token || x.url) === e.target.value
                    )
                    if (s) pickSource(s)
                  }}
                  className="w-full cursor-pointer appearance-none bg-transparent pr-6 font-sans text-[0.9rem] text-white outline-none [&>option]:bg-surface-2"
                >
                  {(byLanguage.get(activeSelected?.language || 'server') || []).map((s, i) => (
                    <option key={`${s.server || s.name}-${s.token || s.url}-${i}`} value={s.token || s.url}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-[14px] text-dimtext">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          {(currentEpisode?.overview || (type === 'movie' && meta.overview)) && (
            <p className="max-w-[760px] text-[0.95rem] leading-relaxed text-[#C7CBD4]">
              {type === 'movie' ? meta.overview : currentEpisode?.overview || meta.overview}
            </p>
          )}

          {showNext && (
            <Link
              to={`/watch/tv/${id}?season=${seasonNum}&episode=${nextEpisode.episode_number}`}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-spectral-dim px-5 py-2.5 text-[0.9rem] font-semibold text-spectral transition hover:bg-spectral-dim"
            >
              Siguiente episodio: E{nextEpisode.episode_number}
              {nextEpisode.name ? ` — ${nextEpisode.name}` : ''}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
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
