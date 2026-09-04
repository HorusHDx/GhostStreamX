import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Hero from '../components/Hero.jsx'
import ContinuarViendo from '../components/ContinuarViendo.jsx'
import TopRow from '../components/TopRow.jsx'
import TopPorPlataforma from '../components/TopPorPlataforma.jsx'
import Row from '../components/Row.jsx'

export default function Home() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .home()
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
  }, [])

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

  const rows = (data.sections || []).filter((s) => !s.title.startsWith('Series de'))

  return (
    <div className="pb-20">
      <Hero items={data.hero} />

      <div className="relative z-10 -mt-16">
        <ContinuarViendo />

        <TopPorPlataforma />

        {rows.map((row) =>
          row.top ? (
            <TopRow
              key={row.title}
              title={row.title}
              items={row.items}
              type={row.type}
            />
          ) : (
            <Row key={row.title} title={row.title} items={row.items} />
          )
        )}
      </div>
    </div>
  )
}
