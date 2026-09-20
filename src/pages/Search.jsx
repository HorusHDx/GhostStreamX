import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import PosterCard from '../components/PosterCard.jsx'

export default function Search() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [results, setResults] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!q) {
      setResults([])
      return
    }
    setResults([])
    setError('')
    api
      .search(q)
      .then((data) => setResults(data.results || []))
      .catch((e) => setError(e.message))
  }, [q])

  return (
    <div className="pt-20 px-6">
      <h1 className="mb-6 text-2xl font-bold">
        Resultados para “{q}”
      </h1>

      {error && <p className="text-red-400">{error}</p>}

      {!error && results.length === 0 && (
        <p className="text-gray-500">Sin resultados.</p>
      )}

      <div className="grid grid-cols-3 gap-x-3 gap-y-7 pb-20 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {results.map((item) => (
          <PosterCard key={`${item.media_type}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  )
}
