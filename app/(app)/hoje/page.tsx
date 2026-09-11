'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Play, Send, FileText } from 'lucide-react'
import {
  usePatients,
  usePatientSessions,
  usePendingDeliveries,
} from '@/lib/db/queries'
import { db } from '@/lib/db/local'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatDateBR, todayISO, WEEKDAYS } from '@/lib/format'
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { SyncBadge } from '@/components/SyncProvider'

/**
 * Tela inicial: o que acontece hoje.
 *
 * Em ordem de urgência — rascunho aberto (atendimento interrompido), depois
 * a agenda do dia, depois o que está finalizado mas ainda não foi enviado.
 */
export default function TodayPage() {
  const today = todayISO()
  const weekday = new Date(`${today}T12:00:00`).getDay()
  const patients = usePatients()
  const pending = usePendingDeliveries()

  const drafts = useLiveQuery(async () =>
    (await db().sessions.toArray()).filter(
      (s) => !s.deleted_at && s.status === 'draft',
    ),
  )

  const scheduled = useMemo(() => {
    if (!patients) return undefined
    return patients
      .flatMap((p) =>
        p.schedule
          .filter((s) => s.weekday === weekday)
          .map((s) => ({ patient: p, slot: s })),
      )
      .sort((a, b) => a.slot.start_time.localeCompare(b.slot.start_time))
  }, [patients, weekday])

  const dateLabel = `${WEEKDAYS[weekday]}, ${formatDateBR(today)}`

  return (
    <>
      <PageHeader title="Hoje" subtitle={dateLabel} action={<SyncBadge />} />

      {drafts && drafts.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Atendimento em aberto</SectionTitle>
          <ul className="space-y-2">
            {drafts.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/atendimento/${s.id}`}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] border border-warn/40 bg-warn/10 p-3.5"
                >
                  <FileText className="size-5 shrink-0 text-warn" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {patients?.find((p) => p.id === s.patient_id)?.full_name ??
                        'Paciente'}
                    </span>
                    <span className="text-xs text-ink-soft">
                      Rascunho de {formatDateBR(s.session_date)} — continuar
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <SectionTitle>Agenda</SectionTitle>
        {scheduled === undefined ? (
          <Spinner />
        ) : scheduled.length === 0 ? (
          <EmptyState
            title="Nada agendado para hoje"
            description="Você pode iniciar um atendimento avulso a partir da ficha de qualquer paciente."
            action={
              <Link href="/pacientes" className="text-brand underline">
                Ver pacientes
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {scheduled.map(({ patient, slot }, i) => (
              <li key={`${patient.id}-${i}`}>
                <ScheduledRow patientId={patient.id} name={patient.full_name} time={slot.start_time} date={today} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending && pending.length > 0 && (
        <section>
          <SectionTitle>Aguardando envio</SectionTitle>
          <ul className="space-y-2">
            {pending.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/atendimento/${s.id}/enviar`}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5 active:bg-surface-2"
                >
                  <Send className="size-4 shrink-0 text-brand" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {patients?.find((p) => p.id === s.patient_id)?.full_name ??
                        'Paciente'}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {formatDateBR(s.session_date)} ·{' '}
                      {[
                        !s.sent_whatsapp_at && 'WhatsApp',
                        !s.sent_clinica_at && 'Clínica Ágil',
                      ]
                        .filter(Boolean)
                        .join(' e ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** Uma linha da agenda, já sabendo se aquele atendimento de hoje foi feito. */
function ScheduledRow({
  patientId,
  name,
  time,
  date,
}: {
  patientId: string
  name: string
  time: string
  date: string
}) {
  const sessions = usePatientSessions(patientId)
  const todaySession = sessions?.find((s) => s.session_date === date)

  const href = todaySession
    ? `/atendimento/${todaySession.id}`
    : `/atendimento/novo?paciente=${patientId}`

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5 active:bg-surface-2"
    >
      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink-soft">
        {time}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      {todaySession ? (
        todaySession.status === 'draft' ? (
          <Badge tone="warn">Em aberto</Badge>
        ) : (
          <Badge tone="ok">Registrado</Badge>
        )
      ) : (
        <Play className="size-5 shrink-0 text-brand" aria-hidden />
      )}
    </Link>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
      {children}
    </h2>
  )
}
