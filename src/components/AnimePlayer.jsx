import { useEffect, useRef, useState } from 'react'

// Reproductor propio de la sección Anime (aislado del Player de pelis/series).
// Reproduce los embeds del episodio en <iframe> con selector de servidor.
// El `key={url}` fuerza a recrear el frame al cambiar (corta el audio anterior).
// Botón propio de pantalla completa a nivel contenedor (respaldo del botón
// interno del servidor).

export default function AnimePlayer({ servers, title }) {
  const [idx, setIdx] = useState(0)
  const wrapRef = useRef(null)
  const [isFs, setIsFs] = useState(false)

  useEffect(() => {
    setIdx(0)
  }, [servers])

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFs() {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen()
    } else if (el.requestFullscreen) {
      el.requestFullscreen()
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen()
    }
  }

  if (!servers?.length) return null
  const active = Math.min(idx, servers.length - 1)
  const current = servers[active]

  return (
    <div>
      <div ref={wrapRef} className="group relative overflow-hidden rounded-[12px] border border-white/10 bg-black">
        <iframe
          key={current.url}
          src={current.url}
          title={title || current.server}
          className="aspect-video w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
        <button
          onClick={toggleFs}
          aria-label={isFs ? 'Salir de pantalla completa' : 'Pantalla completa'}
          title={isFs ? 'Salir de pantalla completa' : 'Pantalla completa'}
          className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isFs ? (
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            ) : (
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            )}
          </svg>
        </button>
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
