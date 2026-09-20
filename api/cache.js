// Caché en memoria compartida para los scrapers.
// Útil en local y en instancias serverless "calientes" (evita volver a
// golpear los sitios si el mismo título se pide varias veces).
const store = new Map()

export async function cached(key, ttlMs, fn) {
  const hit = store.get(key)
  if (hit && Date.now() - hit.t < ttlMs) return hit.v
  const v = await fn()
  if (store.size > 800) store.clear()
  store.set(key, { t: Date.now(), v })
  return v
}