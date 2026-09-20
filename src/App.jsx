import { lazy, Suspense, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import { useSpatialNav } from './hooks/useSpatialNav.js'

// Carga diferida de páginas: el home carga rápido y el resto llega bajo demanda.
const Home = lazy(() => import('./pages/Home.jsx'))
const Search = lazy(() => import('./pages/Search.jsx'))
const Detail = lazy(() => import('./pages/Detail.jsx'))
const Watch = lazy(() => import('./pages/Watch.jsx'))
const Plataforma = lazy(() => import('./pages/Plataforma.jsx'))
const Historial = lazy(() => import('./pages/Historial.jsx'))
// Sección Anime (aislada): catálogo, ficha y reproductor propios.
const Anime = lazy(() => import('./pages/Anime.jsx'))
const AnimeDetail = lazy(() => import('./pages/AnimeDetail.jsx'))
const AnimeWatch = lazy(() => import('./pages/AnimeWatch.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

export default function App() {
  // Navegación espacial con flechas (control remoto Smart TV) en toda la app.
  const contentRef = useRef(null)
  useSpatialNav(contentRef)

  return (
    <div ref={contentRef} className="flex min-h-screen flex-col bg-bg">
      <Navbar />
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center py-32">
            <span className="font-display text-lg text-dimtext">Cargando…</span>
          </div>
        }
      >
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/plataforma/:id" element={<Plataforma />} />
            <Route path="/movie/:id" element={<Detail type="movie" />} />
            <Route path="/tv/:id" element={<Detail type="tv" />} />
            <Route path="/watch/movie/:id" element={<Watch type="movie" />} />
            <Route path="/watch/tv/:id" element={<Watch type="tv" />} />
            <Route path="/anime" element={<Anime />} />
            <Route path="/anime/:slug" element={<AnimeDetail />} />
            <Route path="/anime/:slug/:ep" element={<AnimeWatch />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Suspense>

      {/* Pie de página */}
      <footer className="border-t border-white/10 px-5 py-8 md:px-12">
        <span className="text-[0.85rem] text-dimtext">
          GhostStreamX — No alojamos videos
        </span>
      </footer>
    </div>
  )
}
