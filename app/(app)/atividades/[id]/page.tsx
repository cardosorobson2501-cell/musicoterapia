'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useActivity } from '@/lib/db/queries'
import { remove } from '@/lib/db/repo'
import { ActivityForm } from '@/components/ActivityForm'
import { Button, EmptyState, PageHeader, Spinner } from '@/components/ui'

export default function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const activity = useActivity(id)

  if (activity === undefined) return <Spinner />
  if (activity === null) {
    return (
      <EmptyState
        title="Atividade não encontrada"
        description="Ela pode ter sido removida."
      />
    )
  }

  return (
    <>
      <PageHeader title="Editar atividade" subtitle={activity.name} />
      <ActivityForm activity={activity} />

      <Button
        variant="ghost"
        full
        className="mt-2 text-danger"
        onClick={() => {
          if (
            confirm(
              'Remover esta atividade? Os registros de desempenho já feitos continuam guardados — eles não dependem da atividade seguir existindo.',
            )
          ) {
            void remove('activities', id).then(() => router.replace('/atividades'))
          }
        }}
      >
        Remover atividade
      </Button>
    </>
  )
}
