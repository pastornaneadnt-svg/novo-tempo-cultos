import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Status } from '../lib/types'

// ---------- Ícones (traço simples) ----------
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
export const Icon = {
  back: () => <svg viewBox="0 0 24 24" {...P}><path d="M15 18l-6-6 6-6" /></svg>,
  next: () => <svg viewBox="0 0 24 24" {...P}><path d="M9 18l6-6-6-6" /></svg>,
  close: () => <svg viewBox="0 0 24 24" {...P}><path d="M18 6L6 18M6 6l12 12" /></svg>,
  plus: () => <svg viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>,
  more: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></svg>,
  grip: () => <svg viewBox="0 0 24 24" {...P}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></svg>,
  pdf: () => <svg viewBox="0 0 24 24" {...P}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3" /></svg>,
  link: () => <svg viewBox="0 0 24 24" {...P}><path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5" /></svg>,
  copy: () => <svg viewBox="0 0 24 24" {...P}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>,
  edit: () => <svg viewBox="0 0 24 24" {...P}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>,
  trash: () => <svg viewBox="0 0 24 24" {...P}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>,
  logout: () => <svg viewBox="0 0 24 24" {...P}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  check: () => <svg viewBox="0 0 24 24" {...P}><path d="M20 6L9 17l-5-5" /></svg>,
  refresh: () => <svg viewBox="0 0 24 24" {...P}><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" /></svg>,
  whats: () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" /></svg>
  ),
}

// ---------- Folha inferior ----------
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div className="sheet-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <div className="h2">{title}</div>
          <button className="icon-btn plain" onClick={onClose} aria-label="Fechar"><Icon.close /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Avisos rápidos ----------
const ToastCtx = createContext<(msg: string) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  const show = useCallback((m: string) => setMsg(m), [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---------- Status ----------
const STATUS_LABEL: Record<Status, string> = { aceito: 'Confirmado', pendente: 'Aguardando', recusado: 'Recusou' }
export function StatusBadge({ status, hasPerson }: { status: Status; hasPerson: boolean }) {
  if (!hasPerson) return <span className="badge vazio">Sem responsável</span>
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
}

export function Spinner() {
  return (
    <div className="center-screen">
      <div className="spinner" aria-label="Carregando" />
    </div>
  )
}

export function initials(name?: string | null) {
  const parts = (name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Atualiza os dados de tempos em tempos enquanto a página está aberta (tempo real simples). */
export function usePolling(fn: () => void, ms: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const tick = () => document.visibilityState === 'visible' && fn()
    const t = setInterval(tick, ms)
    const onVis = () => document.visibilityState === 'visible' && fn()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [fn, ms, enabled])
}
