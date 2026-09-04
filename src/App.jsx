import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Search from './pages/Search.jsx'
import Detail from './pages/Detail.jsx'
import Watch from './pages/Watch.jsx'

export default function App() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/movie/:id" element={<Detail type="movie" />} />
        <Route path="/tv/:id" element={<Detail type="tv" />} />
        <Route path="/watch/movie/:id" element={<Watch type="movie" />} />
        <Route
          path="/watch/tv/:id"
          element={<Watch type="tv" />}
        />
      </Routes>
    </div>
  )
}
