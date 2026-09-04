import { Link } from 'react-router-dom'

const IMG_BASE = 'https://image.tmdb.org/t/p/w500'

export default function PosterCard({ item }) {
  const isMovie = item.media_type ? item.media_type === 'movie' : item.title
  const type = isMovie ? 'movie' : 'tv'
  const id = item.id
  const title = item.title || item.name
  const poster = item.poster_path
    ? `${IMG_BASE}${item.poster_path}`
    : null
  const year = (item.release_date || item.first_air_date || '').slice(0, 4)

  return (
    <Link
      to={`/${type}/${id}`}
      className="group w-40 shrink-0 overflow-hidden rounded-md bg-surface transition-transform hover:scale-105 hover:z-10"
    >
      <div className="relative aspect-[2/3] w-full">
        {poster ? (
          <img
            src={poster}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-sm text-gray-500">
            {title}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-medium">{title}</p>
        {year && <p className="text-xs text-gray-500">{year}</p>}
      </div>
    </Link>
  )
}
