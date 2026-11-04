import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72 // distância (px) para soltar e atualizar
const MAX = 120

/**
 * "Puxar para atualizar": com a página no topo, puxe para baixo e solte.
 * Funciona também no app instalado na tela inicial do iPhone, que não tem isso nativo.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef<{ y: number; x: number } | null>(null)
  const active = useRef(false)
  const pullRef = useRef(0)
  const set = (v: number) => {
    pullRef.current = v
    setPull(v)
  }

  useEffect(() => {
    const blocked = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      // Não atrapalha janelas abertas, arrastar oportunidades nem campos de texto.
      return (
        !!el?.closest?.('.sheet-bg, .handle, input, textarea, select, .hymn-results') ||
        document.body.style.overflow === 'hidden' ||
        !!document.querySelector('.dragging')
      )
    }
    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1 || window.scrollY > 0 || blocked(e.target)) {
        start.current = null
        return
      }
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX }
      active.current = false
    }
    const onMove = (e: TouchEvent) => {
      if (!start.current) return
      const dy = e.touches[0].clientY - start.current.y
      const dx = Math.abs(e.touches[0].clientX - start.current.x)
      if (!active.current) {
        if (dy > 8 && dy > dx && window.scrollY <= 0) active.current = true
        else if (dy < -4 || dx > 12) {
          start.current = null
          return
        } else return
      }
      if (document.querySelector('.dragging')) {
        start.current = null
        set(0)
        return
      }
      e.preventDefault()
      set(Math.min(MAX, Math.max(0, dy) * 0.5))
    }
    const onEnd = () => {
      if (!start.current) return
      start.current = null
      if (active.current && pullRef.current >= THRESHOLD * 0.75) {
        set(THRESHOLD * 0.75)
        setRefreshing(true)
        setTimeout(() => window.location.reload(), 250)
      } else set(0)
      active.current = false
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [refreshing])

  if (!pull && !refreshing) return null
  const ready = pull >= THRESHOLD * 0.75
  return (
    <div className="ptr" style={{ transform: `translate(-50%, ${pull - 44}px)` }} aria-live="polite">
      <div className={`ptr-ball ${refreshing ? 'spin' : ''}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / 40) }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" />
        </svg>
      </div>
      <span className="sr-only">{refreshing ? 'Atualizando' : ready ? 'Solte para atualizar' : 'Puxe para atualizar'}</span>
    </div>
  )
}
