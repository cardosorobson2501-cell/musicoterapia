'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useActivities } from '@/lib/db/queries'
import { MEASUREMENT_LABELS } from '@/lib/domain/performance'
import {
  Badge,
  EmptyState,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { SyncBadge } from '@/components/SyncProvider'

export default function ActivitiesPage() {
  const [showAll, setShowAll] = useState(false)
  const activities = useActivities(showAll)

  return (
    <>
      <PageHeader
        title="Atividades"
        subtitle="Modelos reaproveitados em todos os pacientes"
        action={<SyncBadge />}
      />

      <Link
        href="/atividades/nova"
        className="tap mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand font-medium text-brand-ink active:brightness-90"
      >
        <Plus className="size-5" aria-hidden /> Nova atividade
      </Link>

      {activities === undefined ? (
        <Spinner />
      ) : activities.length === 0 ? (
        <EmptyState
          title="Nenhuma atividade cadastrada"
          description="Cadastre as atividades estruturadas que você aplica. Depois é só atribuí-las a cada paciente e registrar o desempenho durante o atendimento."
        />
      ) : (
        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id}>
              <Link
                href={`/atividades/${a.id}`}
                className="block rounded-[var(--radius-card)] border border-border bg-surface p-3.5 active:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{a.name}</span>
                  {!a.is_active && <Badge tone="neutral">Inativa</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {MEASUREMENT_LABELS[a.measurement_type]}
                </p>
                {a.objective && (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
                    {a.objective}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="tap mt-6 w-full text-sm text-ink-soft"
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? 'Mostrar apenas ativas' : 'Mostrar também as inativas'}
      </button>
    </>
  )
}
