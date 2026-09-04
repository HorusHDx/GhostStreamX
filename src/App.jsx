import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Search from './pages/Search.jsx'
import Detail from './pages/Detail.jsx'
import Watch from './pages/Watch.jsx'
import Plataforma from './pages/Plataforma.jsx'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/plataforma/:id" element={<Plataforma />} />
          <Route path="/movie/:id" element={<Detail type="movie" />} />
          <Route path="/tv/:id" element={<Detail type="tv" />} />
          <Route path="/watch/movie/:id" element={<Watch type="movie" />} />
          <Route
            path="/watch/tv/:id"
            element={<Watch type="tv" />}
          />
        </Routes>
      </div>

      {/* Pie de página */}
      <footer className="border-t border-white/10 px-5 py-8 md:px-12">
        <span className="text-[0.85rem] text-dimtext">
          GhostStreamX — No alojamos videos
        </span>
      </footer>
    </div>
  )
}
