import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  loadHistory,
  removeHistoryKeys,
  clearHistory,
  watchPathFor,
} from '../history.js'

const IMG = 'https://image.tmdb.org/t/p/w500'

function timeAgo(t) {
  if (!t) return ''
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'ahora mismo'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return new Date(t).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Página Historial: ver todo lo empezado, seleccionar y borrar,
// o borrar el historial completo (limpia "Continuar viendo").
export default function Historial() {
  const [items, setItems] = useState([])
  const [selecting, setSelecting] = useState(false)
  const [checked, setChecked] = useState(() => new Set())

  const refresh = () => {
    setItems(loadHistory())
    setChecked(new Set())
  }

  useEffect(refresh, [])

  const toggle = (key) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAll = () => setChecked(new Set(items.map((it) => it.key)))

  const deleteSelected = () => {
    if (checked.size === 0) return
    removeHistoryKeys([...checked])
    setSelecting(false)
    refresh()
  }

  const deleteAll = () => {
    if (items.length === 0) return
    if (window.confirm('¿Borrar todo el historial? Se vaciará "Continuar viendo".')) {
      clearHistory()
      setSelecting(false)
      refresh()
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-28 md:px-12">
      <Link
        to="/"
        className="mb-6 inline-block text-sm text-dimtext transition hover:text-white"
      >
        ← Volver al inicio
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Historial
          </h1>
          {items.length > 0 && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[0.72rem] text-dimtext">
              {items.length} {items.length === 1 ? 'título' : 'títulos'}
            </span>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {selecting ? (
              <>
                <button
                  onClick={selectAll}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.85rem] text-dimtext transition hover:text-white"
                >
                  Todos
                </button>
                <button
                  onClick={deleteSelected}
                  disabled={checked.size === 0}
                  className="rounded-full border border-red-900/60 bg-red-950/40 px-4 py-2 text-[0.85rem] font-semibold text-red-300 transition enabled:hover:bg-red-900/40 disabled:opacity-40"
                >
                  Eliminar ({checked.size})
                </button>
                <button
                  onClick={() => {
                    setSelecting(false)
                    setChecked(new Set())
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.85rem] text-dimtext transition hover:text-white"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelecting(true)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.85rem] text-dimtext transition hover:text-white"
                >
                  Seleccionar
                </button>
                <button
                  onClick={deleteAll}
                  className="rounded-full border border-red-900/60 bg-red-950/40 px-4 py-2 text-[0.85rem] font-semibold text-red-300 transition hover:bg-red-900/40"
                >
                  Borrar todo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-[14px] border border-white/10 bg-surface/60 px-6 py-16 text-center">
          <p className="mb-2 font-display text-xl font-bold">Sin historial todavía</p>
          <p className="mb-6 text-[0.9rem] text-dimtext">
            Lo que empieces a ver aparecerá aquí y en "Continuar viendo".
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-spectral px-6 py-2.5 text-[0.9rem] font-semibold text-bg transition hover:brightness-110"
          >
            Explorar el catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {items.map((it) => {
            const poster = it.poster ? `${IMG}${it.poster}` : null
            const epLabel =
              it.mediaType === 'tv' && (it.season || it.episode)
                ? ` · T${it.season || 1}:E${it.episode || 1}`
                : ''
            const isChecked = checked.has(it.key)
            return (
              <div
                key={it.key}
                onClick={selecting ? () => toggle(it.key) : undefined}
                className={`relative ${selecting ? 'cursor-pointer' : ''}`}
              >
                <Link
                  to={watchPathFor(it)}
                  onClick={selecting ? (e) => e.preventDefault() : undefined}
                  className="group block"
                >
                  <div
                    className={`aspect-[2/3] w-full overflow-hidden rounded-[10px] bg-cover bg-center transition group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.5),0_0_0_1px_rgba(127,231,212,0.35)] ${
                      selecting && isChecked ? 'shadow-[0_0_0_2px_rgba(127,231,212,0.7)]' : ''
                    }`}
                    style={{
                      backgroundImage: poster ? `url(${poster})` : undefined,
                      backgroundColor: poster ? undefined : '#101319',
                    }}
                  />
                </Link>

                {selecting && (
                  <span
                    className={`pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur transition ${
                      isChecked
                        ? 'border-transparent bg-spectral text-bg'
                        : 'border-white/40 bg-black/55 text-transparent'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}

                <p className="mt-2 truncate text-[0.87rem] font-medium text-dimtext group-hover:text-white">
                  {it.title}
                  {epLabel}
                </p>
                <p className="text-xs text-dimtext/70">{timeAgo(it.t)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
