'use client'

import { use } from 'react'
import Link from 'next/link'
import { ChevronLeft, Pencil, Play } from 'lucide-react'
import {
  usePatient,
  usePatientSessions,
  useInstitutions,
} from '@/lib/db/queries'
import {
  ageLabel,
  formatDateBR,
  formatSchedule,
} from '@/lib/format'
import { Badge, Card, EmptyState, Spinner } from '@/components/ui'

export default function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const patient = usePatient(id)
  const sessions = usePatientSessions(id)
  const institutions = useInstitutions()

  if (patient === undefined) return <Spinner />
  if (patient === null) {
    return (
      <EmptyState
        title="Paciente não encontrado"
        description="Ele pode ter sido removido neste ou em outro aparelho."
        action={
          <Link href="/pacientes" className="text-brand underline">
            Voltar para a lista
          </Link>
        }
      />
    )
  }

  const institution = institutions?.find((i) => i.id === patient.institution_id)

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/pacientes"
          className="tap -ml-2 inline-flex items-center gap-1 pr-2 text-sm text-ink-soft"
        >
          <ChevronLeft className="size-4" aria-hidden /> Pacientes
        </Link>
        <Link
          href={`/pacientes/${id}/editar`}
          className="tap inline-flex items-center gap-1.5 rounded-xl border border-border px-3 text-sm"
        >
          <Pencil className="size-4" aria-hidden /> Editar
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {patient.full_name}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <Badge tone="brand">{patient.code}</Badge>
          <span>{ageLabel(patient.birth_date)}</span>
          {patient.status !== 'active' && (
            <Badge tone="warn">
              {patient.status === 'paused' ? 'Pausado' : 'Alta'}
            </Badge>
          )}
        </p>
      </header>

      <Link
        href={`/atendimento/novo?paciente=${id}`}
        className="tap mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand font-medium text-brand-ink active:brightness-90"
      >
        <Play className="size-4" aria-hidden /> Iniciar atendimento
      </Link>

      <Card className="mb-4 space-y-3 text-sm">
        <Row label="Instituição" value={institution?.name ?? '—'} />
        <Row label="Horário" value={formatSchedule(patient.schedule)} />
        <Row
          label="Nascimento"
          value={formatDateBR(patient.birth_date)}
        />
        {patient.guardians.length > 0 && (
          <Row
            label="Responsáveis"
            value={patient.guardians
              .map((g) =>
                [g.name, g.relationship && `(${g.relationship})`]
                  .filter(Boolean)
                  .join(' '),
              )
              .join(', ')}
          />
        )}
      </Card>

      <div className="mb-5 space-y-3">
        <Block title="Diagnóstico" text={patient.diagnosis} />
        <Block
          title="Alergias"
          text={patient.allergies}
          tone={patient.allergies.trim() ? 'warn' : undefined}
        />
        <Block title="Condição inicial" text={patient.initial_condition} />
        <Block title="Demanda principal" text={patient.main_demand} />
        <Block title="Observações" text={patient.notes} />
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        Prontuários
      </h2>

      {sessions === undefined ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Nenhum atendimento registrado"
          description="Os prontuários aparecem aqui assim que você registrar o primeiro."
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/atendimento/${s.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5 active:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {formatDateBR(s.session_date)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">
                    {s.description.trim()
                      ? s.description.slice(0, 70)
                      : 'Sem descrição'}
                  </span>
                </span>
                {s.status === 'draft' ? (
                  <Badge tone="warn">Rascunho</Badge>
                ) : !s.sent_whatsapp_at || !s.sent_clinica_at ? (
                  <Badge tone="brand">A enviar</Badge>
                ) : (
                  <Badge tone="ok">Enviado</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-ink-soft">{label}</span>
      <span className="min-w-0 flex-1">{value}</span>
    </div>
  )
}

function Block({
  title,
  text,
  tone,
}: {
  title: string
  text: string
  tone?: 'warn'
}) {
  if (!text.trim()) return null
  return (
    <Card className={tone === 'warn' ? 'border-warn/40 bg-warn/5' : undefined}>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </Card>
  )
}
