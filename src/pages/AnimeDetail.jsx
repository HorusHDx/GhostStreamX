import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

// Ficha del anime: portada, sinopsis, géneros y lista de episodios.
// Aislada del flujo pelis/series (fuente AnimeAV1).

export default function AnimeDetail() {
  const { slug } = useParams()
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setInfo(null)
    setError('')
    api
      .anime.info(slug)
      .then(setInfo)
      .catch((e) => setError(e.message))
  }, [slug])

  if (error) {
    return (
      <div className="px-6 pt-28">
        <p className="text-red-400">Error al cargar: {error}</p>
        <Link to="/anime" className="mt-3 inline-block font-semibold text-spectral hover:underline">
          ← Volver al catálogo
        </Link>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Cargando anime…
      </div>
    )
  }

  const meta = [info.type, info.year, info.season, info.status].filter(Boolean).join(' • ')

  return (
    <div className="pb-20">
      {/* Cabecera con backdrop */}
      <div className="relative">
        {info.backdrop && (
          <>
            <div
              className="h-[46vh] min-h-[320px] w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${info.backdrop})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
          </>
        )}
        <div className="relative z-10 -mt-40 flex gap-6 px-6 max-md:-mt-32 max-md:flex-col md:px-12">
          {info.poster && (
            <img
              src={info.poster}
              alt={info.title}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
              className="w-44 shrink-0 rounded-[12px] shadow-[0_16px_40px_rgba(0,0,0,0.6)] max-md:w-32"
            />
          )}
          <div className="flex-1 pb-2 pt-2">
            <Link to="/anime" className="mb-2 inline-block text-[0.85rem] text-dimtext hover:text-white">
              ← Anime
            </Link>
            <h1 className="mb-1.5 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight max-md:text-[1.4rem]">
              {info.title}
            </h1>
            {meta && <p className="mb-3 text-[0.9rem] text-dimtext">{meta}</p>}
            {info.rating && (
              <p className="mb-3 text-[0.9rem] text-dimtext">
                ★ <span className="font-semibold text-white">{info.rating}</span>{' '}
                <span className="text-dimtext/70">/ MAL</span>
              </p>
            )}
            {info.genres?.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {info.genres.map((g) => (
                  <Link
                    key={g.slug}
                    to={`/anime?tab=catalogo&genre=${g.slug}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-[0.8rem] font-semibold text-dimtext transition hover:text-white"
                  >
                    {g.label}
                  </Link>
                ))}
              </div>
            )}
            {info.synopsis && (
              <p className="max-w-3xl text-[0.95rem] leading-relaxed text-dimtext">
                {info.synopsis}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Episodios */}
      <div className="mt-8 px-6 md:px-12">
        <h2 className="mb-4 font-display text-[1.2rem] font-bold">
          Episodios{info.totalEpisodes ? ` (${info.totalEpisodes}${info.episodeListTruncated ? '+' : ''})` : ''}
        </h2>
        {info.episodes?.length === 0 ? (
          <p className="text-gray-500">Sin episodios listados.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {info.episodes.map((ep) => (
                <Link
                  key={ep.number}
                  to={`/anime/${slug}/${ep.number}`}
                  className="group overflow-hidden rounded-[10px] border border-white/10 bg-surface-2 transition hover:border-spectral/30"
                >
                  {ep.screenshot ? (
                    <img
                      src={ep.screenshot}
                      alt={`Episodio ${ep.number}`}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-[#101319] text-[1.4rem] font-bold text-dimtext">
                      {ep.number}
                    </div>
                  )}
                  <p className="px-3 py-2 text-[0.85rem] font-semibold text-dimtext transition group-hover:text-white">
                    Episodio {ep.number}
                  </p>
                </Link>
              ))}
            </div>
            {info.episodeListTruncated && (
              <p className="mt-4 text-[0.85rem] text-dimtext">
                Mostrando los primeros {info.episodes.length} de {info.totalEpisodes}.
                En el reproductor podés avanzar con Anterior/Siguiente o saltar a
                cualquier número de episodio.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
