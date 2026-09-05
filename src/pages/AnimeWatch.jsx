import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import AnimePlayer from '../components/AnimePlayer.jsx'

// Página de reproducción de anime: reproductor propio + navegación de episodios.
// Aislada del Watch de pelis/series (fuente AnimeAV1, iframes directos).

const VARIANTS = ['SUB', 'DUB']

export default function AnimeWatch() {
  const { slug, ep } = useParams()
  const navigate = useNavigate()
  const num = parseInt(ep, 10) || 1

  const [data, setData] = useState(null)
  const [variant, setVariant] = useState('SUB')
  const [error, setError] = useState('')
  const [jump, setJump] = useState('')

  useEffect(() => {
    setData(null)
    setError('')
    setVariant('SUB')
    api
      .anime.episode(slug, num)
      .then((d) => {
        setData(d)
        if (!d.variants.SUB && d.variants.DUB) setVariant('DUB')
      })
      .catch((e) => setError(e.message))
  }, [slug, num])

  function goJump(e) {
    e.preventDefault()
    const n = parseInt(jump, 10)
    if (n && n >= 1) navigate(`/anime/${slug}/${n}`)
  }

  if (error) {
    return (
      <div className="px-6 pt-28">
        <p className="text-red-400">Error al cargar el episodio: {error}</p>
        <div className="mt-3 flex gap-4">
          <Link to={`/anime/${slug}`} className="font-semibold text-spectral hover:underline">
            ← Volver a la ficha
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Cargando episodio…
      </div>
    )
  }

  const available = VARIANTS.filter((v) => data.variants[v]?.length)
  const servers = data.variants[variant] || []

  return (
    <div className="px-6 pb-20 pt-24 md:px-12">
      <Link
        to={`/anime/${slug}`}
        className="mb-2 inline-block text-[0.85rem] text-dimtext hover:text-white"
      >
        ← {data.animeTitle}
      </Link>
      <h1 className="mb-1.5 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight max-md:text-[1.4rem]">
        Episodio {data.episode}
      </h1>
      <p className="mb-6 text-[0.95rem] text-dimtext">{data.animeTitle}</p>

      {/* Idioma (si el episodio trae más de una variante) */}
      {available.length > 1 && (
        <div className="mb-4 flex gap-2">
          {available.map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={`rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition ${
                variant === v
                  ? 'border-spectral-dim bg-spectral-dim/20 text-spectral'
                  : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
              }`}
            >
              {v === 'SUB' ? 'Subtitulado' : 'Doblado'}
            </button>
          ))}
        </div>
      )}

      <AnimePlayer
        key={`${slug}-${num}-${variant}`}
        servers={servers}
        title={`${data.animeTitle} Episodio ${data.episode}`}
      />

      {/* Navegación de episodios */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {data.prev ? (
          <Link
            to={`/anime/${slug}/${data.prev}`}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-[0.85rem] font-semibold text-dimtext transition hover:text-white"
          >
            ← Episodio {data.prev}
          </Link>
        ) : null}
        {data.next ? (
          <Link
            to={`/anime/${slug}/${data.next}`}
            className="rounded-full border border-spectral-dim bg-spectral-dim/20 px-5 py-2 text-[0.85rem] font-semibold text-spectral transition hover:bg-spectral-dim/30"
          >
            Episodio {data.next} →
          </Link>
        ) : null}
        <form onSubmit={goJump} className="flex gap-2">
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="N.º ep."
            inputMode="numeric"
            className="w-24 rounded-[10px] border border-white/10 bg-surface-2 px-3 py-2 text-[0.85rem] text-white outline-none placeholder:text-dimtext focus:border-spectral-dim"
          />
          <button
            type="submit"
            className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-2 text-[0.85rem] font-semibold text-dimtext transition hover:text-white"
          >
            Ir
          </button>
        </form>
      </div>
    </div>
  )
}
