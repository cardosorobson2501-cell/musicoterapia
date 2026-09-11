'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePatient } from '@/lib/db/queries'
import { openTodaySession } from '@/lib/domain/session'
import { useTherapistId } from '@/lib/auth/AuthProvider'
import { EmptyState, Spinner } from '@/components/ui'

/**
 * Rota de entrada do atendimento. Abre (ou reaproveita) o prontuário de hoje
 * do paciente e substitui a URL pela da sessão — sem deixar esta tela no
 * histórico do navegador.
 */
function Starter() {
  const therapistId = useTherapistId()
  const router = useRouter()
  const params = useSearchParams()
  const patientId = params.get('paciente') ?? undefined
  const patient = usePatient(patientId)
  const started = useRef(false)

  useEffect(() => {
    if (!patient || started.current) return
    started.current = true
    openTodaySession(therapistId, patient).then((session) => {
      router.replace(`/atendimento/${session.id}`)
    })
  }, [patient, therapistId, router])

  if (patient === null) {
    return (
      <EmptyState
        title="Paciente não encontrado"
        description="Volte e tente de novo pela ficha do paciente."
      />
    )
  }

  return <Spinner label="Abrindo atendimento…" />
}

export default function NewAttendancePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Starter />
    </Suspense>
  )
}
