'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { usePatient } from '@/lib/db/queries'
import { remove } from '@/lib/db/repo'
import { PatientForm } from '@/components/PatientForm'
import { Button, EmptyState, PageHeader, Spinner } from '@/components/ui'

export default function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const patient = usePatient(id)

  if (patient === undefined) return <Spinner />
  if (patient === null) {
    return (
      <EmptyState
        title="Paciente não encontrado"
        description="Ele pode ter sido removido."
      />
    )
  }

  return (
    <>
      <PageHeader title="Editar paciente" subtitle={patient.full_name} />
      <PatientForm patient={patient} />

      <Button
        variant="ghost"
        full
        className="mt-2 text-danger"
        onClick={() => {
          if (
            confirm(
              `Remover "${patient.full_name}"? Os prontuários já registrados continuam guardados, mas o paciente some da lista.`,
            )
          ) {
            void remove('patients', id).then(() => router.replace('/pacientes'))
          }
        }}
      >
        Remover paciente
      </Button>
    </>
  )
}
