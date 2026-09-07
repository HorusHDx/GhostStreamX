import { Link } from 'react-router-dom'

// 404: cualquier ruta desconocida cae acá (ver route "*" en App.jsx).
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-[4rem] font-extrabold leading-none text-spectral">
        404
      </p>
      <p className="text-[1rem] text-dimtext">
        Esta página no existe o fue movida.
      </p>
      <div className="flex gap-3">
        <Link
          to="/"
          className="rounded-full border border-spectral-dim bg-spectral-dim/20 px-6 py-2.5 text-[0.9rem] font-semibold text-spectral transition hover:bg-spectral-dim/30"
        >
          Ir al inicio
        </Link>
        <Link
          to="/anime"
          className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-[0.9rem] font-semibold text-dimtext transition hover:text-white"
        >
          Ver anime
        </Link>
      </div>
    </div>
  )
}
