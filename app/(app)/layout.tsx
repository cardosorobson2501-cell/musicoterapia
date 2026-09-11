'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { SyncProvider } from '@/components/SyncProvider'
import { PinGate } from '@/components/PinGate'
import { BottomNav } from '@/components/BottomNav'
import { Spinner } from '@/components/ui'
import { SetupNotice } from '@/components/SetupNotice'

/**
 * Camadas de acesso, de fora para dentro:
 *   1. Supabase configurado? (senão mostra o passo a passo de instalação)
 *   2. Sessão ativa? (senão manda para o login)
 *   3. Aparelho destravado? (senão pede o PIN)
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, configured } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && configured && !user) router.replace('/login')
  }, [loading, configured, user, router])

  if (!configured) return <SetupNotice />
  if (loading) return <Spinner label="Abrindo…" />
  if (!user) return <Spinner label="Redirecionando…" />

  return (
    <SyncProvider>
      <PinGate>
        {/* pb-24 abre espaço para a navegação fixa não cobrir o conteúdo. */}
        <div className="safe-top mx-auto min-h-dvh max-w-lg px-4 pb-24 pt-4">
          {children}
        </div>
        <BottomNav />
      </PinGate>
    </SyncProvider>
  )
}
