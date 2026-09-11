'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CloudOff, RefreshCw, Check, TriangleAlert } from 'lucide-react'
import { syncNow } from '@/lib/sync/engine'
import { pendingCount } from '@/lib/db/repo'
import { useAuth } from '@/lib/auth/AuthProvider'
import { cx } from './ui'

type State = 'idle' | 'syncing' | 'offline' | 'error'

interface SyncValue {
  state: State
  pending: number
  lastSyncAt: number | null
  error: string | null
  sync: () => void
}

const SyncContext = createContext<SyncValue>({
  state: 'idle',
  pending: 0,
  lastSyncAt: null,
  error: null,
  sync: () => {},
})

/** De quanto em quanto tempo tenta sincronizar sozinho, estando online. */
const INTERVAL_MS = 60_000

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<State>('idle')
  const [pending, setPending] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)

  const refreshPending = useCallback(async () => {
    try {
      setPending(await pendingCount())
    } catch {
      /* banco local ainda não pronto */
    }
  }, [])

  const sync = useCallback(async () => {
    if (!user || running.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState('offline')
      await refreshPending()
      return
    }

    running.current = true
    setState('syncing')
    try {
      const report = await syncNow()
      if (report.error === 'offline') {
        setState('offline')
      } else if (report.error) {
        setState('error')
        setError(report.error)
      } else {
        setState('idle')
        setError(null)
        setLastSyncAt(Date.now())
      }
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : 'Falha ao sincronizar.')
    } finally {
      running.current = false
      await refreshPending()
    }
  }, [user, refreshPending])

  useEffect(() => {
    if (!user) return
    sync()

    const timer = setInterval(sync, INTERVAL_MS)
    const onOnline = () => sync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    const onOffline = () => setState('offline')

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, sync])

  // Mantém o contador de pendências vivo enquanto o terapeuta digita offline.
  useEffect(() => {
    const timer = setInterval(refreshPending, 4000)
    return () => clearInterval(timer)
  }, [refreshPending])

  return (
    <SyncContext.Provider
      value={{ state, pending, lastSyncAt, error, sync: () => void sync() }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync(): SyncValue {
  return useContext(SyncContext)
}

/**
 * Indicador de sincronização.
 *
 * Fica sempre visível de propósito: quem registra atendimento numa sala sem
 * sinal precisa saber, sem procurar, que o trabalho está guardado no aparelho
 * e ainda não subiu.
 */
export function SyncBadge() {
  const { state, pending, sync } = useSync()

  const view = {
    offline: {
      icon: CloudOff,
      text: pending > 0 ? `${pending} para enviar` : 'Sem conexão',
      tone: 'text-warn',
    },
    syncing: { icon: RefreshCw, text: 'Sincronizando', tone: 'text-ink-soft' },
    error: {
      icon: TriangleAlert,
      text: pending > 0 ? `${pending} pendente(s)` : 'Erro ao sincronizar',
      tone: 'text-danger',
    },
    idle: {
      icon: pending > 0 ? RefreshCw : Check,
      text: pending > 0 ? `${pending} para enviar` : 'Tudo salvo',
      tone: pending > 0 ? 'text-ink-soft' : 'text-ok',
    },
  }[state]

  const Icon = view.icon

  return (
    <button
      type="button"
      onClick={sync}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium',
        view.tone,
      )}
      aria-live="polite"
    >
      <Icon
        className={cx('size-3.5', state === 'syncing' && 'animate-spin')}
        aria-hidden
      />
      {view.text}
    </button>
  )
}
