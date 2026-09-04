// Resolvedores de fuentes de reproducción.
// Reciben un { type, tmdbId, season, episode } y devuelven un array de
// `sources`. Cada source es un embed de iframe (UnlimPlay).
//
// Actualmente solo usamos UnlimPlay (agregador de embeds). Su URL se construye
// a partir del TMDB id, sin necesidad de API key ni scraping pesado.

// --- UnlimPlay (agregador de embeds; acepta tmdb id o imdb tt) ---
function unlimplaySource({ type, tmdbId, season, episode }) {
  if (type === 'movie') {
    return {
      name: 'UnlimPlay',
      kind: 'embed',
      url: `https://unlimplay.com/f/embed/movie/${tmdbId}`,
    }
  }
  return {
    name: 'UnlimPlay',
    kind: 'embed',
    url: `https://unlimplay.com/f/embed/tv/${tmdbId}/${season}/${episode}`,
  }
}

// --- Resolución: solo UnlimPlay ---
export async function resolveSources({ type, tmdbId, season = 1, episode = 1 }) {
  const sources = []

  // UnlimPlay (embed directo, siempre construible)
  sources.push(unlimplaySource({ type, tmdbId, season, episode }))

  return sources
}
