import PosterCard from './PosterCard.jsx'

export default function Row({ title, items }) {
  if (!items || items.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="mb-3 px-6 text-xl font-bold">{title}</h2>
      <div className="flex gap-3 overflow-x-auto px-6 pb-2 no-scrollbar">
        {items.map((item) => (
          <PosterCard key={`${item.media_type}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  )
}
