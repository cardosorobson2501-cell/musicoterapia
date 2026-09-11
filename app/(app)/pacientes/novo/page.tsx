'use client'

import { PatientForm } from '@/components/PatientForm'
import { PageHeader } from '@/components/ui'

export default function NewPatientPage() {
  return (
    <>
      <PageHeader title="Novo paciente" />
      <PatientForm />
    </>
  )
}
