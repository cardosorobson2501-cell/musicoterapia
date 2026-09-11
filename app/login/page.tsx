'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/AuthProvider'
import { initialLoad } from '@/lib/sync/engine'
import { loadTherapistProfile } from '@/lib/db/therapist'
import { SetupNotice } from '@/components/SetupNotice'
import { Button, Card, Field, Input, Spinner } from '@/components/ui'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const { user, loading, configured } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) router.replace('/hoje')
  }, [loading, user, router])

  if (!configured) return <SetupNotice />
  if (loading) return <Spinner label="Abrindo…" />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const sb = supabase()

      if (mode === 'signup') {
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        setMessage(
          'Conta criada. Se o projeto pedir confirmação, verifique seu e-mail e depois entre.',
        )
        setMode('signin')
        return
      }

      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Primeira carga: traz tudo para o aparelho, para que o próximo
      // atendimento funcione mesmo sem sinal.
      await initialLoad().catch(() => {})
      if (data.user) await loadTherapistProfile(data.user.id).catch(() => {})
      router.replace('/hoje')
    } catch (e) {
      setError(traduzErro(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Musicoterapia</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Prontuários e desempenho em atividades estruturadas.
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <Field label="Seu nome">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </Field>
          )}

          <Field label="E-mail">
            <Input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              required
            />
          </Field>

          <Field
            label="Senha"
            hint={mode === 'signup' ? 'Mínimo de 8 caracteres.' : undefined}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              minLength={8}
              required
            />
          </Field>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          {message && <p className="text-sm text-ok">{message}</p>}

          <Button type="submit" full disabled={busy}>
            {busy
              ? 'Aguarde…'
              : mode === 'signin'
                ? 'Entrar'
                : 'Criar conta'}
          </Button>
        </form>

        <button
          type="button"
          className="tap mt-2 w-full text-sm text-ink-soft"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setMessage(null)
          }}
        >
          {mode === 'signin'
            ? 'Ainda não tenho conta'
            : 'Já tenho conta, quero entrar'}
        </button>
      </Card>

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-soft">
        Os dados ficam protegidos por conta e só são visíveis para você.
        Este aparelho também pedirá um PIN a cada retomada.
      </p>
    </main>
  )
}

function traduzErro(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  if (/Invalid login credentials/i.test(raw)) return 'E-mail ou senha incorretos.'
  if (/User already registered/i.test(raw)) return 'Já existe conta com este e-mail.'
  if (/Password should be/i.test(raw)) return 'A senha precisa de ao menos 8 caracteres.'
  if (/Email not confirmed/i.test(raw))
    return 'Confirme o e-mail antes de entrar (veja sua caixa de entrada).'
  if (/fetch|network/i.test(raw))
    return 'Sem conexão com o servidor. Verifique a internet.'
  return raw
}
