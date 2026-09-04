# GhostStreamX · Plan de arquitectura

Streaming propio tipo Netflix que **solo consume APIs** (no aloja contenido).
Metadata vía **TMDB**. Reproducción vía **agregadores** (UnlimPlay, nsrplay) que
devuelven embeds/player listos. Frontend en la nube (Vercel) para que **no sea
necesario tener la PC encendida** y **toda la familia acceda con un solo enlace**.

---

## 1. Objetivo

- Interfaz tipo Netflix: filas (tendencias/populares), búsqueda, detalles,
  reproductor, series con temporadas/episodios, historial / "continuar viendo".
- NO alojar / almacenar ningún video. Solo redirigir a las fuentes.
- Accesible desde cualquier dispositivo en casa **sin depender de la IP local**
  (resuelve el problema del repetidor separado).

---

## 2. Decisión clave de arquitectura (retícala bien)

Tu amigo tiene **parte** de razón: con Vercel no necesitas tu PC encendida.
Pero hay un matiz:

| Capa           | ¿Dónde corre?     | ¿Necesitas tu PC? |
|----------------|-------------------|-------------------|
| Frontend (React)| Vercel (CDN)      | No                |
| Proxy/scraper   | Vercel Serverless `(/api)` | No (con límites) |
| El video        | Embeds/APIs externas (UnlimPlay, nsrplay, etc.) | No |

**Conclusión:** Vercel (o cualquier host estático+serverless) cubre el 100% de
tu uso si las fuentes son **embeds/agregadores** (que es tu caso). No necesitas
la PC ni Backend local pesado.

> Si más adelante usas scrapers que requieren browser real (Playwright/Chromium),
> los serverless de Vercel tienen timeouts (~60s) y bloquean browser. Para eso
> migrarías el backend a un VPS pequeño (Railway/Fly.io/Render) o túnel local.
> Pero para empezar con UnlimPlay/nsrplay no lo necesitas.

---

## 3. Stack recomendado

- **Frontend:** React 18 + Vite + Tailwind CSS + React Router.
- **Reproductor:** video.js + hls.js (según el formato .m3u8) / iframe para embeds.
- **Backend proxy:** Node.js + Express (funciones serverless en Vercel).
  - Consume TMDB (metadata) y resuelve fuentes de los agregadores.
  - Cache ligera en memoria para no golpear las APIs por cada click.
- **Despliegue:** git + GitHub + Vercel.
  - Frontend → deploy estático.
  - `api/` → serverless functions (mismo repo, ver `vercel.json`).

Por qué **Node y no Python**: no has usado Python, y Node + Vercel tiene el
camino más directo y la mayor cantidad de ejemplos de la comunidad (vidsrc,
movie-scraper, etc.). Si luego prefieres Python, el diseño es el mismo; solo
cambia el proxy.

---

## 4. Fuentes de contenido (tu caso real)

### Metadata — TMDB (requiere API key gratis)
- `https://api.themoviedb.org/3/movie/popular?api_key=KEY`
- `https://api.themoviedb.org/3/tv/popular?api_key=KEY`
- `GET /search/multi?query=...` → búsqueda de películas y series
- `GET /movie/{id}` y `GET /tv/{id}` → detalles, cast, trailers
- `GET /tv/{id}/season/{n}` → episodios
- Obtén la key en https://www.themoviedb.org/settings/api

### Fuentes de reproducción (agregadores)
Estos mapcan un **TMDB/IMDB id** a un player/embed. No alojas ni almacenas nada.

- **UnlimPlay:** `https://unlimplay.com/f/embed/movie/{tmdb_id}` y
  `https://unlimplay.com/f/embed/tv/{tmdb_id}/{season}/{episode}`
  (acepta id numérico de TMDB o `tt...` de IMDB). Devuelve un embed/iframe.
- **nsrplay.space:** API REST estilo:
  - `GET /api/v1/embed/sources/movie/:tmdbId`
  - `GET /api/v1/embed/sources/tv/:tmdbId/:season/:episode`
  - `GET /embed/movie/:tmdbId` (player HTML)
  - `GET /api/v1/content/search?q=titulo`
  Devuelve JSON con las fuentes resueltas en cascada.

**Estrategia:** el proxy intenta varias fuentes en orden (fallback en cascada).
Si UnlimPlay falla, prueba nsrplay, etc. Así el player nunca se queda vacío.

> ⚠️ Estas APIs de agregadores cambian con frecuencia y pueden requerir headers
> o dominios permitidos. La capa de proxy existe precisamente para centralizar
> esos cambios en un solo sitio.

---

## 5. Estructura del proyecto

```
GhostStreamX/
├── PLAN.md                  # Este documento
├── README.md                # Cómo levantar y desplegar
├── vercel.json              # Config de rutas API + SPA
├── .gitignore
├── .env.example             # Variables de entorno (TMDB key, etc.)
├── package.json             # Workspaces (root)
├── frontend/                # React + Vite + Tailwind
│   └── (...)
└── api/                     # Backend serverless (proxy + TMDB)
    └── index.js
```

---

## 6. Backend (api/) — endpoints del proxy

| Método | Ruta                          | Qué hace |
|--------|-------------------------------|----------|
| GET    | `/api/trending`               | Filas para el home (películas y series populares) |
| GET    | `/api/search?q=...`           | Búsqueda vía TMDB `/search/multi` |
| GET    | `/api/movie/:id`              | Detalles de película |
| GET    | `/api/tv/:id`                 | Detalles de serie + temporadas |
| GET    | `/api/tv/:id/season/:s`       | Episodios de una temporada |
| GET    | `/api/watch/movie/:id`        | Resuelve fuente de película (fallback en cascada) |
| GET    | `/api/watch/tv/:id/:s/:e`     | Resuelve fuente de episodio |

Cada endpoint de `watch` recibe un objeto:
```js
{ type, tmdbId, season, episode, sources: ["unlimplay", "nsrplay"] }
```
y devuelve una **URL de embed** o **m3u8/subtítulos** lista para el player.

---

## 7. Frontend (frontend/) — páginas

- **Home:** filas horizontales (Tendencias, Populares, Series…).
- **Buscar:** input + resultados.
- **Detalle:** póster, sinopsis, rating, cast, botón "Reproducir".
- **Reproductor:** video.js / hls.js o iframe del embed.
- **Serie:** selector de temporada + lista de episodios.
- **Historial / Continuar viendo:** guardado en `localStorage` (progreso).

---

## 8. La parte de red (tu caso del repetidor)

Porque el frontend y el proxy viven en **Vercel**, la red local es irrelevante:
- Tú y tu familia abren `https://tusitio.vercel.app` desde cualquier dispositivo
  conectado a internet (móvil de la familia también).
- No dependes de la IP del repetidor ni de abrir puertos.
- Si quieres privacidad, añade un login simple (env clave compartida) y/o
  restringe por dominio en las APIs.

---

## 9. Pasos de implementación (hoja de ruta)

1. **Instalar herramientas:** Node.js LTS (https://nodejs.org) + git.
2. **Clonar/crear** este repo y `npm install`.
3. **Configurar** `TMDB_API_KEY` en `.env`.
4. **Probar el proxy** localmente: `npm run dev` → probar `/api/trending`.
5. **Probar reproducción** con un id real (película popular).
6. **Pulir frontend** (filas, detalles, reproductor, historial).
7. **Subir a GitHub** y conectar **Vercel** (frontend + `api/`).
8. **Compartir el enlace** con la familia / agregar login si se desea.

---

## 10. Consideraciones legales / de uso

- Esto es un **agregador**: apunta a embeds que ya existen en la red, no aloja
  archivos. Aun así, revisa los términos de TMDB y de cada agregador.
- Las API de agregadores pueden caer o bloquear. Mantén varias fuentes.
- Protégete con un login o restricción de dominios si lo harás público.
- No vendas ni hagas público el acceso a gran escala con estas fuentes; son
  frágiles y suelen tener términos restrictivos.
