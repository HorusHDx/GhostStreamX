# GhostStreamX · Plan de arquitectura

Streaming propio tipo Netflix que **no aloja contenido**. Metadata vía **TMDB**.
Reproducción vía **scrapers propios** (server-side) que resuelven embeds/players
de los sitios. Frontend en la nube (Vercel) para que **no sea necesario tener la
PC encendida** y **toda la familia acceda con un solo enlace**. Uso personal y
familiar, sin fines de lucro.

---

## 1. Objetivo

- Interfaz tipo Netflix: filas (tendencias/populares), búsqueda, detalles,
  reproductor, series con temporadas/episodios, historial / "continuar viendo".
- NO alojar ni almacenar ningún video. Solo resolver y redirigir a las fuentes.
- Accesible desde cualquier dispositivo conectado a internet.
- Sección **Anime** aislada (fuente AnimeAV1), independiente del resto.

---

## 2. Decisión de arquitectura

| Capa            | ¿Dónde corre?           | ¿Necesitas tu PC? |
|-----------------|-------------------------|-------------------|
| Frontend (React) | Vercel (CDN)           | No                |
| Proxy/scrapers   | Vercel Serverless `/api` | No (con límites) |
| El video         | Embeds externos resueltos | No               |

Los scrapers corren en el serverless: pueden hacer fetch de los sitios,
parsear HTML/JSON y devolver solo las URLs finales al navegador. Así el front
nunca ve el "detrás de escena" ni arriesga keys.

---

## 3. Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + React Router.
- **Reproductor:** iframe para embeds, `hls.js` para `.m3u8`, `<video>` para `.mp4`.
- **Backend:** Node.js + Express (serverless en Vercel).
  - TMDB para metadata, scrapers propios para fuentes, caché en memoria.
- **Despliegue:** git + GitHub + Vercel (push a `main` = deploy automático).

---

## 4. Fuentes de contenido

### Metadata — TMDB (requiere API key gratis)
- `/movie/popular`, `/tv/popular`, `/search/multi`, `/movie/{id}`, `/tv/{id}`,
  `/tv/{id}/season/{n}`.
- Key en `.env` local y en Vercel → Env Vars. Nunca al repo ni al front.

### Reproducción — scrapers propios con lista blanca de hosts

| Fuente | Cómo resuelve |
|--------|---------------|
| **PelisPlus HD** (`server/scrapers/pelisplus.js`) | Busca el título en `pelisplushd.bz/search?s=...`, matchea por título+año, y extrae los servidores `video[N] = 'https://...'` de la página de detalle (película o `temporada/{n}/capitulo/{m}`). |
| **Poseidon** (`server/scrapers/poseidon.js`) | Va directo por TMDB ID (`/pelicula/{id}` o `/serie/{id}/temporada/{n}/episodio/{m}`), lee los `player.php?h=...` del HTML y resuelve cada uno a la URL final del hoster. |

**Seguridad (`server/hosts.js`):** solo se reproducen URLs cuyo hosting esté en la
lista blanca (streamwish, filemoon, VOE, doodstream, streamtape, uqload,
mixdrop, embed69, etc.). Todo lo demás se descarta. Las dos fuentes corren en
paralelo en `server/sources.js` y el front muestra una pestaña por fuente.

---

## 5. Estructura del proyecto

```
GhostStreamX/
├── PLAN.md                  # Este documento
├── .env.example             # Variables (TMDB key, etc.)
├── vercel.json              # Serverless function + rewrites (SPA y /api)
├── package.json
├── api/
│   └── index.js             # Único archivo en /api: re-exporta server/index.js (la función de Vercel)
├── server/
│   ├── index.js             # Express + rutas + edge cache
│   ├── handlers.js          # Handlers de cada endpoint
│   ├── sources.js           # Orquestador de fuentes (P1 PelisPlus, P2 Poseidon)
│   ├── tmdb.js              # Cliente TMDB (metadata)
│   ├── anime.js             # Scraper AnimeAV1 (sección anime, aislada)
│   ├── hosts.js             # Lista blanca de hosts de reproducción
│   ├── cache.js             # Caché en memoria compartida
│   └── scrapers/
│       ├── pelisplus.js     # Scraper PelisPlus HD
│       └── poseidon.js      # Scraper Poseidon HD
└── src/
    ├── api.js               # Cliente fetch del front
    ├── pages/               # Home, Detail, Watch, Buscar, Plataforma, Historial, Anime*
    └── components/          # Player, AnimePlayer, PosterCard, Hero, etc.
```

---

## 6. API — endpoints del proxy

| Método | Ruta                          | Qué hace |
|--------|-------------------------------|----------|
| GET    | `/api/home`                   | Hero + filas (top hoy, géneros) |
| GET    | `/api/platforms`, `/api/plataforma/:id` | Series por red (TMDB) |
| GET    | `/api/search?q=...`           | Búsqueda multi (TMDB) |
| GET    | `/api/movie/:id`, `/api/tv/:id` | Detalles + temporadas |
| GET    | `/api/tv/:id/season/:s`       | Episodios de una temporada |
| GET    | `/api/movie/:id/recommendations` | Recomendados reales |
| GET    | `/api/watch/movie/:id`        | Fuentes de película (P1+P2, filtradas) |
| GET    | `/api/watch/tv/:id/:s/:e`     | Fuentes de episodio |
| GET    | `/api/anime/*`                | Sección anime (aislada) |
| GET    | `/api/health`                 | Healthcheck |

`/api/watch/*` devuelve `{ sources: [{ name, label, provider, language,
kind, url, group }] }`. `group` marca la fuente: `P1` (PelisPlus HD) o `P2`
(Poseidon). El front renderiza una pestaña por grupo.

---

## 7. Seguridad y privacidad

- **Lista blanca de hosts:** el reproductor solo muestra iframes/URLs de hosts
  conocidos y confiables (nada de ventanas raras ni sitios dudosos).
- **Keys nunca en el repo:** solo en `.env` local y Env Vars de Vercel.
- **Historial limpio:** el repo mantiene un historial corto sin referencias a
  implementaciones previas ni a proveedores de terceros.
- **Uso personal/familiar:** no vender ni abrir a gran escala; las fuentes son
  frágiles y suelen tener términos restrictivos.

---

## 8. Hoja de ruta

1. Configurar `TMDB_API_KEY` en `.env` y en Vercel.
2. Probar local: `npm install` → `npm run dev` (API en :3001, web en :5173).
3. Probar reproducción: `/api/watch/movie/{id}` y `/api/watch/tv/{id}/{s}/{e}`.
4. Push a GitHub → Vercel despliega automáticamente.
5. Compartir el enlace con la familia.