import { useEffect, useRef, useState } from 'react'

/**
 * Reproductor universal.
 * - Si `src` es un embed (iframe html), lo renderiza en un iframe.
 * - Si `src` apunta a un .m3u8, usa hls.js (cargado bajo demanda).
 * - Si `src` es un .mp4 directo, usa el <video> nativo.
 * - Botón propio de pantalla completa a nivel contenedor: funciona aunque el
 *   reproductor interno del servidor traiga su botón roto o ausente.
 */
export default function Player({ source }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const errRef = useRef(null)
  const wrapRef = useRef(null)
  const [isFs, setIsFs] = useState(false)

  // Normaliza: acepta `url` (nueva estructura) o `src` (estructura antigua).
  const src = source?.url || source?.src
  const kind = source?.kind || 'embed'

  // Pantalla completa a nivel contenedor (con fallbacks webkit).
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

  function FsButton() {
    return (
      <button
        onClick={toggleFs}
        aria-label={isFs ? 'Salir de pantalla completa' : 'Pantalla completa'}
        title={isFs ? 'Salir de pantalla completa' : 'Pantalla completa'}
        className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        {isFs ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        )}
      </button>
    )
  }

  useEffect(() => {
    if (!source) return
    // Restablece la instancia anterior antes de crear una nueva.
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    const video = videoRef.current

    if (!video) return
    if (errRef.current) {
      video.removeEventListener('error', errRef.current)
      errRef.current = null
    }

    const isM3u8 = src?.includes('.m3u8')
    const isEmbed = kind === 'embed'

    if (isM3u8) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src // Safari
      } else {
        // Carga hls.js solo cuando hace falta reproducir un .m3u8 directo.
        import('hls.js').then(({ default: Hls }) => {
          if (!Hls.isSupported()) return
          const h = new Hls()
          h.loadSource(src)
          h.attachMedia(video)
          hlsRef.current = h
        })
      }
    } else if (!isEmbed && src) {
      video.src = src
      video.load()
      // Si el nativo falla (p. ej. un proxy HLS sin extensión .m3u8 como el
      // de S2), reintenta una sola vez con hls.js antes de rendirse.
      const onErr = () => {
        video.removeEventListener('error', onErr)
        errRef.current = null
        import('hls.js').then(({ default: Hls }) => {
          if (!Hls.isSupported()) return
          try {
            const h = new Hls()
            h.loadSource(src)
            h.attachMedia(video)
            hlsRef.current = h
          } catch {
            /* roto igual: el usuario puede cambiar de servidor */
          }
        })
      }
      errRef.current = onErr
      video.addEventListener('error', onErr)
    }

    return () => {
      if (errRef.current && videoRef.current) {
        videoRef.current.removeEventListener('error', errRef.current)
        errRef.current = null
      }
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [source])

  if (!source) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-black text-gray-500">
        Cargando reproductor…
      </div>
    )
  }

  // Embeds (iframe)
  if (kind === 'embed' && !src?.includes('.m3u8')) {
    return (
      <div ref={wrapRef} className="group player-frame relative w-full overflow-hidden bg-black">
        <iframe
          key={src}
          src={src}
          className="player-media absolute inset-0 h-full w-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          title="Reproductor"
        />
        <FsButton />
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="group player-frame relative w-full bg-black">
      <video
        ref={videoRef}
        controls
        playsInline
        className="player-media aspect-video w-full rounded-md bg-black"
      />
      <FsButton />
    </div>
  )
}
