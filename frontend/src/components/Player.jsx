import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

/**
 * Reproductor universal.
 * - Si `src` es un embed (iframe html), lo renderiza en un iframe (Embeds tipo UnlimPlay/nsrplay).
 * - Si `src` apunta a un .m3u8, usa hls.js.
 * - Si `src` es un .mp4 directo, usa el <video> nativo.
 */
export default function Player({ source }) {
  const videoRef = useRef(null)
  const [hls, setHls] = useState(null)

  useEffect(() => {
    if (!source) return
    // Restablece
    setHls(null)
    const video = videoRef.current

    if (!video) return

    const isM3u8 = source.src?.includes('.m3u8')
    const isEmbed = source.kind === 'embed' || source.src?.startsWith('http') === false

    if (isM3u8) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = source.src // Safari
      } else if (Hls.isSupported()) {
        const h = new Hls()
        h.loadSource(source.src)
        h.attachMedia(video)
        setHls(h)
      }
    } else if (!isEmbed && source.src) {
      video.src = source.src
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

  // Embeds (UnlimPlay / nsrplay player HTML)
  if (source.kind === 'embed' && !source.src?.includes('.m3u8')) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <iframe
          src={source.src}
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
