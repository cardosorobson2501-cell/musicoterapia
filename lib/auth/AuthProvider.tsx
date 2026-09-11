'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { wipeLocalData } from '@/lib/db/local'
import { clearPin } from '@/lib/auth/pin'

interface AuthValue {
  user: User | null
  loading: boolean
  configured: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  configured: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const configured = isSupabaseConfigured()

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }

    const sb = supabase()

    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [configured])

  /**
   * Sair apaga os dados deste aparelho. É intencional: um prontuário não deve
   * sobreviver no celular depois que a pessoa saiu da conta. O que estiver
   * sincronizado está seguro no servidor.
   */
  const signOut = useCallback(async () => {
    if (configured) await supabase().auth.signOut()
    await clearPin()
    await wipeLocalData()
    setUser(null)
    router.replace('/login')
  }, [configured, router])

  return (
    <AuthContext.Provider value={{ user, loading, configured, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  return useContext(AuthContext)
}

/** Atalho para os lugares que só rodam com usuário logado. */
export function useTherapistId(): string {
  const { user } = useAuth()
  if (!user) throw new Error('Sem sessão ativa.')
  return user.id
}
