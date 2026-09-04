import { useEffect, useRef, useState } from 'react'

/**
 * Reproductor universal.
 * - Si `src` es un embed (iframe html), lo renderiza en un iframe (Embeds tipo UnlimPlay/nsrplay).
 * - Si `src` apunta a un .m3u8, usa hls.js (cargado bajo demanda).
 * - Si `src` es un .mp4 directo, usa el <video> nativo.
 */
export default function Player({ source }) {
  const videoRef = useRef(null)
  const [hls, setHls] = useState(null)

  // Normaliza: acepta `url` (nueva estructura) o `src` (estructura antigua).
  const src = source?.url || source?.src
  const kind = source?.kind === 'direct' && src?.includes('.m3u8') ? 'direct' : source?.kind

  useEffect(() => {
    if (!source) return
    // Restablece
    setHls(null)
    const video = videoRef.current

    if (!video) return

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
          setHls(h)
        })
      }
    } else if (!isEmbed && src) {
      video.src = src
      video.load()
    }

    return () => {
      if (hls) hls.destroy()
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
