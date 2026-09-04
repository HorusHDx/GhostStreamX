import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Row from '../components/Row.jsx'

export default function Home() {
  const [sections, setSections] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .trending()
      .then((data) => setSections(data.sections || []))
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div className="pt-20">
      <div className="px-6 pb-8">
        <h1 className="text-3xl font-bold">Inicio</h1>
      </div>

      {error && (
        <p className="px-6 text-red-400">
          Error al cargar. Asegúrate de que el backend esté corriendo: {error}
        </p>
      )}

      {!error && sections.length === 0 && (
        <p className="px-6 text-gray-500">Cargando contenido…</p>
      )}

      {sections.map((row) => (
        <Row key={row.title} title={row.title} items={row.items} />
      ))}
    </div>
  )
}
