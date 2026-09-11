'use client'

import { ActivityForm } from '@/components/ActivityForm'
import { PageHeader } from '@/components/ui'

export default function NewActivityPage() {
  return (
    <>
      <PageHeader title="Nova atividade" />
      <ActivityForm />
    </>
  )
}
