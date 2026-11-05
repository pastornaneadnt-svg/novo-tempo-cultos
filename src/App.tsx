import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { api } from './lib/api'
import { isConfigured, supabase } from './lib/supabase'
import { Spinner, ToastProvider } from './components/ui'
import { PullToRefresh } from './components/PullToRefresh'
import { LoginPage, ResetPasswordPage } from './pages/Login'
import { HomePage } from './pages/Home'
import { EventPage, DirectorPage } from './pages/EventPage'
import { InvitePage } from './pages/Invite'
import { ContactsPage } from './pages/Contacts'

function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [admin, setAdmin] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setAdmin(undefined)
    api.claimAdmin().then(setAdmin).catch(() => setAdmin(false))
  }, [session])

  if (session === undefined || (session && admin === undefined)) return <Spinner />
  if (!session) return <LoginPage />
  if (!admin)
    return (
      <div className="center-screen">
        <div className="card stack" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div className="h2">Acesso restrito</div>
          <p className="muted">Esta conta não é a do administrador. Quem organiza o culto é o pastor; se você é dirigente ou tem uma oportunidade, use o link que recebeu pelo WhatsApp.</p>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </div>
    )
  return <>{children}</>
}

function NotConfigured() {
  return (
    <div className="center-screen">
      <div className="card stack" style={{ maxWidth: 460 }}>
        <img src="/logo-cor-t.png" alt="AD Novo Tempo" style={{ width: 140, alignSelf: 'center' }} />
        <div className="h2">Falta configurar o banco</div>
        <p className="muted small">Defina as variáveis <b>VITE_SUPABASE_URL</b> e <b>VITE_SUPABASE_ANON_KEY</b> no Netlify (ou no arquivo .env) e publique de novo.</p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return (
    <ToastProvider>
      <PullToRefresh />
      <BrowserRouter>
        <Routes>
          <Route path="/c/:token" element={<InvitePage />} />
          <Route path="/d/:token" element={<DirectorPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/" element={<AdminGate><HomePage /></AdminGate>} />
          <Route path="/culto/:id" element={<AdminGate><EventPage /></AdminGate>} />
          <Route path="/contatos" element={<AdminGate><ContactsPage /></AdminGate>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
