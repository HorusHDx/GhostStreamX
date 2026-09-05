import { useEffect, useState } from 'react'

// Reproductor propio de la sección Anime (aislado del Player de pelis/series).
// Reproduce los embeds del episodio en <iframe> con selector de servidor.
// El `key={url}` fuerza a recrear el frame al cambiar (corta el audio anterior).

export default function AnimePlayer({ servers, title }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [servers])

  if (!servers?.length) return null
  const active = Math.min(idx, servers.length - 1)
  const current = servers[active]

  return (
    <div>
      <div className="overflow-hidden rounded-[12px] border border-white/10 bg-black">
        <iframe
          key={current.url}
          src={current.url}
          title={title || current.server}
          className="aspect-video w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Acciones: cambiar servidor o abrirlo en pestaña nueva */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {servers.map((s, i) => (
          <button
            key={`${s.server}-${i}`}
            onClick={() => setIdx(i)}
            title={s.frame === 'blocked' ? 'Este servidor suele bloquear el reproductor embebido' : s.server}
            className={`rounded-full border px-4 py-1.5 text-[0.82rem] font-semibold transition ${
              i === active
                ? 'border-spectral-dim bg-spectral-dim/20 text-spectral'
                : s.frame === 'blocked'
                  ? 'border-red-400/20 bg-white/5 text-dimtext/60 hover:text-white'
                  : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
            }`}
          >
            {s.server}
          </button>
        ))}
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[0.82rem] font-semibold text-dimtext transition hover:text-white"
        >
          Abrir externo ↗
        </a>
      </div>

      {current.frame === 'blocked' && (
        <p className="mt-3 rounded-[10px] border border-yellow-400/20 bg-yellow-400/10 p-3 text-[0.85rem] text-yellow-200/90">
          {current.server} bloquea la reproducción embebida. Probá con otro
          servidor de la lista o abrilo en pestaña nueva.
        </p>
      )}
    </div>
  )
}
