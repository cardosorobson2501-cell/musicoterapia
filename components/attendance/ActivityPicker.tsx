'use client'

import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { useActivities } from '@/lib/db/queries'
import { attachActivity, detachActivity } from '@/lib/domain/session'
import { useTherapistId } from '@/lib/auth/AuthProvider'
import { MEASUREMENT_LABELS } from '@/lib/domain/performance'
import { Spinner } from '@/components/ui'

/**
 * Folha para escolher quais atividades este paciente faz. O que for marcado
 * aqui aparece como cartão na tela de atendimento.
 */
export function ActivityPicker({
  patientId,
  attachedIds,
  onClose,
}: {
  patientId: string
  attachedIds: Set<string>
  onClose: () => void
}) {
  const therapistId = useTherapistId()
  const activities = useActivities()

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" role="dialog" aria-modal>
      <button
        type="button"
        aria-label="Fechar"
        className="flex-1"
        onClick={onClose}
      />
      <div className="safe-bottom max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atividades do paciente</h2>
          <button
            type="button"
            onClick={onClose}
            className="tap px-2 text-ink-soft"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        {activities === undefined ? (
          <Spinner />
        ) : activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">
            Nenhuma atividade cadastrada.{' '}
            <Link href="/atividades/nova" className="text-brand underline">
              Criar a primeira
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {activities.map((a) => {
              const on = attachedIds.has(a.id)
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (on) void detachActivity(patientId, a.id)
                      else void attachActivity(therapistId, patientId, a.id)
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left active:bg-surface-2"
                  >
                    <span
                      className={
                        on
                          ? 'flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-brand-ink'
                          : 'size-6 shrink-0 rounded-md border border-border'
                      }
                    >
                      {on && <Check className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="text-xs text-ink-soft">
                        {MEASUREMENT_LABELS[a.measurement_type]}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <Link
          href="/atividades/nova"
          className="tap mt-3 flex w-full items-center justify-center rounded-xl border border-border text-sm font-medium text-ink-soft"
        >
          Cadastrar nova atividade
        </Link>
      </div>
    </div>
  )
}
