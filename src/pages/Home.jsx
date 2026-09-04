import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api.js'
import Hero from '../components/Hero.jsx'
import ContinuarViendo from '../components/ContinuarViendo.jsx'
import TopRow from '../components/TopRow.jsx'
import TopPorPlataforma from '../components/TopPorPlataforma.jsx'
import Row from '../components/Row.jsx'

export default function Home() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const location = useLocation()

  useEffect(() => {
    api
      .home()
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
  }, [])

  // Navegación por anclas del menú (/#top-peliculas, /#top-series, /#generos).
  useEffect(() => {
    if (!location.hash || !data) return
    const t = setTimeout(() => {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    return () => clearTimeout(t)
  }, [location.hash, data])

  if (error) {
    return (
      <div className="px-6 pt-28">
        <p className="text-red-400">
          Error al cargar. Asegúrate de que el backend esté corriendo: {error}
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Cargando contenido…
      </div>
    )
  }

  const rows = data.sections || []
  const topRows = rows.filter((r) => r.top)
  const genreRows = rows.filter((r) => !r.top)

  return (
    <div className="pb-20">
      <Hero items={data.hero} />

      <div className="relative z-10 -mt-16">
        <ContinuarViendo />

        <TopPorPlataforma />

        {topRows.map((row) => (
          <TopRow
            key={row.title}
            id={row.type === 'movie' ? 'top-peliculas' : 'top-series'}
            title={row.title}
            items={row.items}
            type={row.type}
          />
        ))}

        <div id="generos" className="scroll-mt-20">
          {genreRows.map((row) => (
            <Row key={row.title} title={row.title} items={row.items} />
          ))}
        </div>
      </div>
    </div>
  )
}
