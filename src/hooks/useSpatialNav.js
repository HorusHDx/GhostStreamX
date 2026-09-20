import { useEffect } from 'react'

// Navegación espacial con flechas para control remoto de Smart TV.
// Mueve el foco al elemento enfocable más cercano en la dirección pulsada
// (geometría real: sirve para grillas, rieles horizontales y botones).
// - No interfiere con mouse/táctil (solo actúa ante teclas de flecha).
// - No roba las flechas al escribir (input/textarea/select se respetan).
// - En modo TV (.tv) pone el foco inicial para que las flechas funcionen
//   desde el arranque; en desktop/móvil no cambia nada.

const DIRS = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function visibleItems(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0
  )
}

function isTyping(el) {
  return (
    el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  )
}

export function useSpatialNav(ref) {
  // Foco inicial solo en teles (el usuario de control no tiene Tab).
  useEffect(() => {
    if (!document.documentElement.classList.contains('tv')) return undefined
    const root = ref.current
    if (!root) return undefined
    const t = setTimeout(() => {
      visibleItems(root)[0]?.focus({ preventScroll: true })
    }, 400)
    return () => clearTimeout(t)
  }, [ref])

  useEffect(() => {
    const root = ref.current
    if (!root) return undefined

    function onKey(e) {
      const d = DIRS[e.key]
      if (!d) return
      const cur = document.activeElement
      if (isTyping(cur)) return // escribiendo: flechas nativas
      if (!root.contains(cur)) return
      const items = visibleItems(root)
      const from = items.indexOf(cur)
      if (from === -1) return

      const r = cur.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      let best = null
      let bestScore = Infinity
      items.forEach((el, i) => {
        if (i === from) return
        const b = el.getBoundingClientRect()
        const dx = b.left + b.width / 2 - cx
        const dy = b.top + b.height / 2 - cy
        const forward = dx * d[0] + dy * d[1]
        if (forward <= 4) return // no está en esa dirección
        const dist = Math.hypot(dx, dy)
        const offAxis = Math.abs(dx * d[1] - dy * d[0])
        const score = dist + offAxis * 2.5
        if (score < bestScore) {
          bestScore = score
          best = el
        }
      })
      if (best) {
        e.preventDefault()
        best.focus({ preventScroll: true })
        best.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }

    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [ref])
}
