import { Link } from 'react-router-dom'

// Logo GhostStreamX: marca SVG del fantasma + texto, estilo del diseño del amigo.
export default function Logo({ onClick }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className="flex items-center gap-2.5 font-display font-bold text-[1.4rem] tracking-tight text-[#E9ECF1]"
    >
      <span className="block h-7 w-7 shrink-0">
        <svg
          viewBox="0 0 26 26"
          fill="none"
          className="h-full w-full drop-shadow-[0_0_6px_rgba(127,231,212,0.35)]"
        >
          <path
            d="M13 2C7.5 2 3.5 6.2 3.5 11.5V21c0 .9 1 1.4 1.7.8l1.9-1.6 1.9 1.6c.5.4 1.2.4 1.7 0l1.9-1.6 1.9 1.6c.5.4 1.2.4 1.7 0l1.9-1.6 1.9 1.6c.7.6 1.7.1 1.7-.8v-9.5C22.5 6.2 18.5 2 13 2z"
            fill="#E9ECF1"
            fillOpacity="0.94"
          />
          <circle cx="9.3" cy="11" r="1.5" fill="#08090C" />
          <circle cx="16.7" cy="11" r="1.5" fill="#08090C" />
        </svg>
      </span>
      <span>GhostStreamX</span>
    </Link>
  )
}
