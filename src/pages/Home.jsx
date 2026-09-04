import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Hero from '../components/Hero.jsx'
import TopRow from '../components/TopRow.jsx'
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
      <div className="pt-24">
        <p className="px-6 text-red-400">
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

  const sections = data.sections || []

  return (
    <div className="pb-16">
      <Hero items={data.hero} />

      {sections.map((row) =>
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
  )
}
