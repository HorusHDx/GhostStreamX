// Helpers del historial local ("Continuar viendo" / página Historial).
// Forma de cada entrada: { t, position, mediaType, id, season, episode, title, poster }

export const HISTORY_KEY = 'ghoststreamx_history'

function readMap() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

// Lista ordenada (recientes primero) con su `key` incluida.
export function loadHistory() {
  const map = readMap()
  return Object.entries(map)
    .filter(([, e]) => e && e.mediaType && e.title)
    .map(([key, e]) => ({ key, ...e }))
    .sort((a, b) => (b.t || 0) - (a.t || 0))
}

// Borra las entradas indicadas.
export function removeHistoryKeys(keys) {
  const map = readMap()
  for (const k of keys) delete map[k]
  writeMap(map)
}

// Borra todo el historial.
export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    /* ignore */
  }
}

// Ruta de reproducción para retomar una entrada.
export function watchPathFor(it) {
  if (it.mediaType === 'movie') return `/watch/movie/${it.id}`
  return `/watch/tv/${it.id}?season=${it.season || 1}&episode=${it.episode || 1}`
}
