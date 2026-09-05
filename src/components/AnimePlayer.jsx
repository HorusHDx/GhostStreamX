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
  const current = servers[Math.min(idx, servers.length - 1)]

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

      {servers.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-[0.75rem] text-dimtext">Servidor</p>
          <div className="flex flex-wrap gap-2">
            {servers.map((s, i) => (
              <button
                key={`${s.server}-${i}`}
                onClick={() => setIdx(i)}
                className={`rounded-full border px-4 py-1.5 text-[0.82rem] font-semibold transition ${
                  i === Math.min(idx, servers.length - 1)
                    ? 'border-spectral-dim bg-spectral-dim/20 text-spectral'
                    : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
                }`}
              >
                {s.server}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
