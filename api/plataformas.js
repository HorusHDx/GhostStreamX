// Catálogo de plataformas de streaming con su ID de red en TMDB.
// Se usa en el home (top por plataforma) y en la página /plataforma/:id
// para resolver nombre/color/URL de "ver más".

export const PLATAFORMAS = {
  netflix: { id: 213, name: 'Netflix', color: '#C24A4A' },
  prime: { id: 1024, name: 'Prime Video', color: '#4FA3D1' },
  hbo: { id: 49, name: 'HBO Max', color: '#8A6FD6' },
  disney: { id: 2739, name: 'Disney+', color: '#4C6FD0' },
  apple: { id: 2552, name: 'Apple TV+', color: '#C7CBD4' },
  paramount: { id: 158, name: 'Paramount+', color: '#5BA8D6' },
}

export const PLATAFORMAS_BY_ID = Object.fromEntries(
  Object.entries(PLATAFORMAS).map(([key, v]) => [v.id, { key, ...v }])
)
