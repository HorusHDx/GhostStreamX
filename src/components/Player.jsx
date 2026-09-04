import { useEffect, useRef } from 'react'

/**
 * Reproductor universal.
 * - Si `src` es un embed (iframe html), lo renderiza en un iframe (Embeds tipo UnlimPlay/nsrplay).
 * - Si `src` apunta a un .m3u8, usa hls.js (cargado bajo demanda).
 * - Si `src` es un .mp4 directo, usa el <video> nativo.
 */
export default function Player({ source }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const errRef = useRef(null)

  // Normaliza: acepta `url` (nueva estructura) o `src` (estructura antigua).
  const src = source?.url || source?.src
  const kind = source?.kind === 'direct' && src?.includes('.m3u8') ? 'direct' : source?.kind

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
    const isEmbed = kind === 'embed' || (src && src.startsWith('http') === false)

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
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <iframe
          src={src}
          className="absolute inset-0 h-full w-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          title="Reproductor"
        />
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="aspect-video w-full rounded-md bg-black"
    />
  )
}
