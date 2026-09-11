'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ListPlus, Lock, LockOpen, Send } from 'lucide-react'
import {
  usePatient,
  usePatientActivities,
  useSession,
  useSessionRecords,
} from '@/lib/db/queries'
import { db } from '@/lib/db/local'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTherapistId } from '@/lib/auth/AuthProvider'
import {
  ensureRecord,
  finalizeSession,
  reopenSession,
  setRecordNotes,
} from '@/lib/domain/session'
import { formatDateBR } from '@/lib/format'
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui'
import { SyncBadge } from '@/components/SyncProvider'
import { SessionTimer } from '@/components/attendance/SessionTimer'
import { PerformanceRecorder } from '@/components/attendance/PerformanceRecorder'
import { ProntuarioForm } from '@/components/attendance/ProntuarioForm'
import { ActivityPicker } from '@/components/attendance/ActivityPicker'
import { AutosaveField } from '@/components/AutosaveField'

type Tab = 'desempenho' | 'prontuario'

export default function AttendancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const therapistId = useTherapistId()
  const router = useRouter()
  const session = useSession(id)
  const patient = usePatient(session?.patient_id)
  const assigned = usePatientActivities(session?.patient_id)
  const records = useSessionRecords(id)
  const [tab, setTab] = useState<Tab>('desempenho')
  const [picking, setPicking] = useState(false)

  const locked = session?.status === 'final'

  // Garante um registro (vazio) para cada atividade atribuída, assim que a
  // tela abre. É o que permite o primeiro toque já ter onde gravar.
  useEffect(() => {
    if (!session || !assigned || locked) return
    for (const { activity } of assigned) {
      const has = records?.some((r) => r.activity_id === activity.id)
      if (!has) void ensureRecord(therapistId, session, activity)
    }
  }, [session, assigned, records, therapistId, locked])

  const attachedIds = useMemo(
    () => new Set((assigned ?? []).map((a) => a.activity.id)),
    [assigned],
  )

  if (session === undefined) return <Spinner />
  if (session === null) {
    return (
      <EmptyState
        title="Atendimento não encontrado"
        description="Ele pode ter sido removido."
        action={
          <Link href="/hoje" className="text-brand underline">
            Voltar
          </Link>
        }
      />
    )
  }

  const recordByActivity = new Map((records ?? []).map((r) => [r.activity_id, r]))

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="tap -ml-2 inline-flex items-center gap-1 pr-2 text-sm text-ink-soft"
        >
          <ChevronLeft className="size-4" aria-hidden /> Voltar
        </button>
        <SyncBadge />
      </div>

      <header className="mb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {patient?.full_name ?? 'Paciente'}
          </h1>
          {locked && <Badge tone="ok">Finalizado</Badge>}
        </div>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-soft">
          <span>{formatDateBR(session.session_date)}</span>
          {!locked && (
            <SessionTimer
              sessionDate={session.session_date}
              startTime={session.start_time}
            />
          )}
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {(['desempenho', 'prontuario'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'tap rounded-lg bg-surface font-medium shadow-sm'
                : 'tap rounded-lg text-ink-soft'
            }
          >
            {t === 'desempenho' ? 'Desempenho' : 'Prontuário'}
          </button>
        ))}
      </div>

      {tab === 'desempenho' ? (
        <div className="space-y-3">
          {assigned === undefined ? (
            <Spinner />
          ) : assigned.length === 0 ? (
            <EmptyState
              title="Nenhuma atividade atribuída"
              description="Escolha as atividades estruturadas que este paciente realiza para registrar o desempenho."
              action={
                <Button onClick={() => setPicking(true)}>
                  <ListPlus className="size-4" aria-hidden /> Escolher atividades
                </Button>
              }
            />
          ) : (
            <>
              {assigned.map(({ activity, link }) => {
                const record = recordByActivity.get(activity.id)
                return (
                  <Card key={activity.id} className="space-y-3">
                    <div>
                      <h2 className="font-semibold">{activity.name}</h2>
                      {link.target && (
                        <p className="text-xs text-ink-soft">
                          Alvo: {link.target}
                        </p>
                      )}
                    </div>

                    {record ? (
                      <>
                        <PerformanceRecorder
                          record={record}
                          disabled={locked}
                        />
                        <AutosaveField
                          label="Observação desta atividade"
                          value={record.notes}
                          disabled={locked}
                          rows={2}
                          onSave={(v) => setRecordNotes(record, v)}
                        />
                      </>
                    ) : (
                      <p className="text-sm text-ink-soft">Preparando…</p>
                    )}
                  </Card>
                )
              })}

              {!locked && (
                <Button
                  variant="secondary"
                  full
                  onClick={() => setPicking(true)}
                >
                  <ListPlus className="size-4" aria-hidden /> Ajustar atividades
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <ProntuarioForm session={session} disabled={locked} />
      )}

      <div className="mt-6">
        {locked ? (
          <div className="space-y-2">
            <Link
              href={`/atendimento/${session.id}/enviar`}
              className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand font-medium text-brand-ink active:brightness-90"
            >
              <Send className="size-4" aria-hidden /> Enviar prontuário
            </Link>
            <Button
              variant="ghost"
              full
              onClick={() => void reopenSession(session)}
            >
              <LockOpen className="size-4" aria-hidden /> Reabrir para editar
            </Button>
          </div>
        ) : (
          <Button
            full
            onClick={async () => {
              await finalizeSession(session)
              router.push(`/atendimento/${session.id}/enviar`)
            }}
          >
            <Lock className="size-4" aria-hidden /> Finalizar atendimento
          </Button>
        )}
      </div>

      {picking && session.patient_id && (
        <ActivityPicker
          patientId={session.patient_id}
          attachedIds={attachedIds}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
