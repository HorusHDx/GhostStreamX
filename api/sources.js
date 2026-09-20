// Api/sources.js — Orquestador de fuentes de reproducción (pelis y series).
//
// Prioridad (una placa = un proveedor):
//   P1  PelisPlus HD  -> scraping directo de pelisplushd.bz
//   P2  Poseidon      -> por TMDB ID (poseidonhd2.co), player.php -> embed
//
// Ambos corren en paralelo y son independientes: si uno falla o no tiene el
// título, el otro sigue devolviendo sus fuentes con su `group`.

import { tmdb } from './tmdb.js'
import { isAllowed } from './hosts.js'
import { resolvePelisPlus } from './scrapers/pelisplus.js'
import { resolvePoseidon } from './scrapers/poseidon.js'

export async function resolveSources({ type, tmdbId, season = 1, episode = 1 }) {
  // Metadata mínima (título + original + año) para buscar el slug en los
  // sitios. Poseidon igual funciona aunque esto falle (usa solo el tmdbId).
  let title = ''
  let originalTitle = ''
  let year = ''
  try {
    const meta = type === 'movie' ? await tmdb.movie(tmdbId) : await tmdb.tv(tmdbId)
    title = meta.title || meta.name || ''
    originalTitle = meta.original_title || meta.original_name || ''
    year = (meta.release_date || meta.first_air_date || '').slice(0, 4)
  } catch {
    // Sin metadata no hay búsqueda por título; Poseidon aún puede responder.
  }

  const [p1, p2] = await Promise.allSettled([
    resolvePelisPlus({ type, tmdbId, title, originalTitle, year, season, episode }),
    resolvePoseidon({ type, tmdbId, title, season, episode }),
  ])

  const pelis = p1.status === 'fulfilled' ? p1.value : []
  const poseidon = p2.status === 'fulfilled' ? p2.value : []

  const combined = [
    ...pelis.map((s) => ({ ...s, group: 'P1' })),
    ...poseidon.map((s) => ({ ...s, group: 'P2' })),
  ]

  // Red de seguridad final: solo fuentes de hosts permitidos.
  return combined.filter((s) => isAllowed(s.url))
}