'use client'

import { use } from 'react'
import { usePatient } from '@/lib/db/queries'
import { PatientForm } from '@/components/PatientForm'
import { EmptyState, PageHeader, Spinner } from '@/components/ui'

export default function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
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
    </>
  )
}
