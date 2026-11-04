import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'

function translate(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail primeiro (veja sua caixa de entrada).'
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/already registered/i.test(msg)) return 'Este e-mail já tem conta. Use “Entrar”.'
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos.'
  return msg
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="center-screen" style={{ background: '#fff' }}>
      <div className="stack" style={{ width: '100%', maxWidth: 400, gap: 20 }}>
        <img src="/logo-cor-t.png" alt="AD Novo Tempo · Igreja Evangélica" style={{ width: 170, alignSelf: 'center' }} />
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Programação de cultos</div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [firstAccess, setFirstAccess] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    api.hasAdmin().then((has) => {
      if (!has) {
        setFirstAccess(true)
        setMode('signup')
      }
    }).catch(() => {})
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) {
          setInfo('Conta criada! Enviamos um e-mail de confirmação. Abra o e-mail, confirme e depois entre aqui.')
          setMode('login')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` })
        if (error) throw error
        setInfo('Enviamos um link para redefinir a senha no seu e-mail.')
        setMode('login')
      }
    } catch (err) {
      setError(translate((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <form className="card stack" onSubmit={submit}>
        <div className="h2">{mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Primeiro acesso' : 'Esqueci a senha'}</div>
        {mode === 'signup' && firstAccess && <p className="small muted" style={{ margin: 0 }}>Crie a conta do administrador (pastor). Só a primeira conta criada terá acesso de administrador.</p>}
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'forgot' && (
          <label className="field">
            <span>Senha</span>
            <input className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {error && <div className="error-box">{error}</div>}
        {info && <div className="card small" style={{ background: 'var(--green-bg)', color: 'var(--green)', boxShadow: 'none', fontWeight: 600 }}>{info}</div>}
        <button className="btn block" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}</button>
        <div className="row between small">
          {mode !== 'login' ? (
            <button type="button" className="btn ghost sm" onClick={() => setMode('login')}>Já tenho conta</button>
          ) : (
            <>
              <button type="button" className="btn ghost sm" onClick={() => setMode('forgot')}>Esqueci a senha</button>
              {firstAccess && <button type="button" className="btn ghost sm" onClick={() => setMode('signup')}>Primeiro acesso</button>}
            </>
          )}
        </div>
      </form>
      <p className="tiny muted" style={{ textAlign: 'center' }}>Dirigentes e quem tem oportunidade não precisam de conta: usem o link recebido pelo WhatsApp.</p>
    </Shell>
  )
}

export function ResetPasswordPage() {
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(translate(error.message))
    nav('/')
  }
  return (
    <Shell>
      <form className="card stack" onSubmit={submit}>
        <div className="h2">Nova senha</div>
        <label className="field">
          <span>Nova senha</span>
          <input className="input" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error-box">{error}</div>}
        <button className="btn block" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>
    </Shell>
  )
}
