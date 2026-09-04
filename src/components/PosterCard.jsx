import { Link } from 'react-router-dom'

const IMG_BASE = 'https://image.tmdb.org/t/p/w500'

export default function PosterCard({ item }) {
  const isMovie = item.media_type ? item.media_type === 'movie' : item.title
  const type = isMovie ? 'movie' : 'tv'
  const id = item.id
  const title = item.title || item.name
  const poster = item.poster_path ? `${IMG_BASE}${item.poster_path}` : null
  const year = (item.release_date || item.first_air_date || '').slice(0, 4)

  return (
    <Link
      to={`/${type}/${id}`}
      className="group w-[170px] shrink-0 cursor-pointer"
    >
      <div
        className="mb-2.5 aspect-[2/3] w-full overflow-hidden rounded-[10px] bg-cover bg-center transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:scale-[1.02] group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.5),0_0_0_1px_rgba(127,231,212,0.35)]"
        style={{
          backgroundImage: poster ? `url(${poster})` : undefined,
          backgroundColor: poster ? undefined : '#101319',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <p className="truncate text-[0.87rem] font-medium text-dimtext transition group-hover:text-white">
        {title}
      </p>
      {year && <p className="text-xs text-dimtext/70">{year}</p>}
    </Link>
  )
}
