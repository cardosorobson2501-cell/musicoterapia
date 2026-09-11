'use client'

import { useCallback, useEffect, useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import {
  hasPin,
  isUnlocked,
  markUnlocked,
  setPin,
  verifyPin,
  lock,
} from '@/lib/auth/pin'
import { cx } from './ui'

const PIN_LENGTH = 4

/**
 * Tela de bloqueio.
 *
 * Aparece na abertura do app e sempre que ele volta do segundo plano depois
 * do tempo limite. O teclado é desenhado aqui em vez de usar o do sistema:
 * teclas grandes, alcançáveis com o polegar, e sem risco de o teclado nativo
 * sugerir o PIN em outro campo depois.
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [locked, setLocked] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [entry, setEntry] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const exists = await hasPin()
      setNeedsSetup(!exists)
      setLocked(exists ? !(await isUnlocked()) : true)
      setChecking(false)
    })()
  }, [])

  // Ao voltar do segundo plano, o tempo decorrido pode ter expirado a sessão.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      if (await hasPin()) setLocked(!(await isUnlocked()))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Renova a contagem enquanto o app está em uso ativo.
  useEffect(() => {
    if (locked) return
    const timer = setInterval(() => void markUnlocked(), 30_000)
    return () => clearInterval(timer)
  }, [locked])

  const submit = useCallback(
    async (value: string) => {
      if (needsSetup) {
        if (confirm === null) {
          setConfirm(value)
          setEntry('')
          return
        }
        if (confirm !== value) {
          setError('Os PINs não coincidem. Comece de novo.')
          setConfirm(null)
          setEntry('')
          return
        }
        await setPin(value)
        setNeedsSetup(false)
        setLocked(false)
        setEntry('')
        return
      }

      if (await verifyPin(value)) {
        await markUnlocked()
        setLocked(false)
        setEntry('')
        setError(null)
      } else {
        setError('PIN incorreto.')
        setEntry('')
        if (navigator.vibrate) navigator.vibrate(120)
      }
    },
    [needsSetup, confirm],
  )

  const press = useCallback(
    (digit: string) => {
      setError(null)
      const next = (entry + digit).slice(0, PIN_LENGTH)
      setEntry(next)
      if (next.length === PIN_LENGTH) void submit(next)
    },
    [entry, submit],
  )

  if (checking) return null

  if (!locked && !needsSetup) {
    return (
      <>
        {children}
        <LockButton onLock={async () => {
          await lock()
          setLocked(true)
        }} />
      </>
    )
  }

  const title = needsSetup
    ? confirm === null
      ? 'Crie um PIN de acesso'
      : 'Repita o PIN'
    : 'Digite seu PIN'

  const subtitle = needsSetup
    ? 'Quatro dígitos. Ele protege os dados dos pacientes caso o celular fique destravado com outra pessoa.'
    : null

  return (
    <div className="safe-top safe-bottom flex min-h-dvh flex-col items-center justify-center px-8">
      <Lock className="size-7 text-brand" aria-hidden />
      <h1 className="mt-4 text-center text-lg font-semibold">{title}</h1>
      {subtitle && (
        <p className="mt-2 max-w-xs text-center text-sm text-ink-soft">
          {subtitle}
        </p>
      )}

      <div className="mt-8 flex gap-4" aria-label={`${entry.length} de ${PIN_LENGTH} dígitos`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={cx(
              'size-3.5 rounded-full border-2 transition-colors',
              i < entry.length
                ? 'border-brand bg-brand'
                : 'border-border bg-transparent',
            )}
          />
        ))}
      </div>

      <p
        className="mt-4 h-5 text-sm text-danger"
        role="alert"
        aria-live="assertive"
      >
        {error}
      </p>

      <div className="mt-4 grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        <span />
        <Key onClick={() => press('0')}>0</Key>
        <Key
          onClick={() => {
            setError(null)
            setEntry((e) => e.slice(0, -1))
          }}
          aria-label="Apagar"
        >
          <Delete className="size-5" aria-hidden />
        </Key>
      </div>
    </div>
  )
}

function Key({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="flex h-16 items-center justify-center rounded-2xl bg-surface-2 text-xl font-medium active:bg-border"
      {...props}
    >
      {children}
    </button>
  )
}

/** Cadeado flutuante para travar o app na hora — útil ao entregar o celular. */
function LockButton({ onLock }: { onLock: () => void }) {
  return (
    <button
      type="button"
      onClick={onLock}
      aria-label="Bloquear agora"
      className="fixed bottom-24 right-4 z-40 flex size-11 items-center justify-center rounded-full border border-border bg-surface/90 text-ink-soft shadow-sm backdrop-blur"
    >
      <Lock className="size-4" aria-hidden />
    </button>
  )
}
