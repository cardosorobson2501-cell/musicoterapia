'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Check, Copy, MessageCircle, Building2 } from 'lucide-react'
import {
  useInstitutions,
  usePatient,
  useSession,
  useSessionRecords,
} from '@/lib/db/queries'
import { useTherapistProfile } from '@/lib/db/therapist'
import { useProntuarioLayout } from '@/lib/db/preferences'
import { patchSession } from '@/lib/domain/session'
import { buildProntuarioText } from '@/lib/domain/prontuario-text'
import {
  copyToClipboard,
  sendToClinicaAgil,
  sendToWhatsApp,
} from '@/lib/domain/delivery'
import { formatDateBR } from '@/lib/format'
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui'

export default function SendPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const session = useSession(id)
  const patient = usePatient(session?.patient_id)
  const records = useSessionRecords(id)
  const institutions = useInstitutions()
  const therapist = useTherapistProfile()
  const layout = useProntuarioLayout()

  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<'whatsapp' | 'full'>('whatsapp')

  const institution = institutions?.find((i) => i.id === session?.institution_id)

  const texts = useMemo(() => {
    if (!session || !patient || !records) return null
    const base = { session, patient, records, institution, therapist }
    return {
      whatsapp: buildProntuarioText(base, 'whatsapp', layout),
      full: buildProntuarioText(base, 'full', layout),
    }
  }, [session, patient, records, institution, therapist, layout])

  if (session === undefined || !texts) return <Spinner />
  if (session === null || patient === null) {
    return (
      <EmptyState
        title="Atendimento não encontrado"
        description="Ele pode ter sido removido."
      />
    )
  }

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function doWhatsApp() {
    const outcome = await sendToWhatsApp(
      patient!.whatsapp_target,
      texts!.whatsapp,
    )
    if (outcome === 'cancelled') return
    await patchSession(session!, { sent_whatsapp_at: new Date().toISOString() })
    flash(
      outcome === 'opened'
        ? 'WhatsApp aberto com o texto pronto.'
        : outcome === 'shared'
          ? 'Compartilhado.'
          : 'Texto copiado — cole no grupo.',
    )
  }

  async function doClinica() {
    await sendToClinicaAgil(texts!.full)
    await patchSession(session!, { sent_clinica_at: new Date().toISOString() })
    flash('Prontuário copiado e Clínica Ágil aberta — cole na evolução.')
  }

  const waConfigured = patient?.whatsapp_target?.mode !== 'none'

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={`/atendimento/${id}`}
          className="tap -ml-2 inline-flex items-center gap-1 pr-2 text-sm text-ink-soft"
        >
          <ChevronLeft className="size-4" aria-hidden /> Atendimento
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Enviar prontuário
        </h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          {patient?.full_name} · {formatDateBR(session.session_date)}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <DeliveryChip done={Boolean(session.sent_whatsapp_at)} label="WhatsApp" />
        <DeliveryChip
          done={Boolean(session.sent_clinica_at)}
          label="Clínica Ágil"
        />
      </div>

      <div className="space-y-2">
        <Button full onClick={doWhatsApp} disabled={!waConfigured}>
          <MessageCircle className="size-4" aria-hidden />
          {session.sent_whatsapp_at ? 'Enviar de novo no WhatsApp' : 'Enviar no WhatsApp'}
        </Button>
        {!waConfigured && (
          <p className="text-xs text-ink-soft">
            Nenhum destino de WhatsApp definido na ficha do paciente.
          </p>
        )}
        {patient?.whatsapp_target?.mode === 'group' && (
          <p className="text-xs text-ink-soft">
            Como é um grupo, o app abre a lista de compartilhamento do celular
            para você escolher{' '}
            {patient.whatsapp_target.label
              ? `"${patient.whatsapp_target.label}"`
              : 'o grupo certo'}
            .
          </p>
        )}

        <Button variant="secondary" full onClick={doClinica}>
          <Building2 className="size-4" aria-hidden />
          {session.sent_clinica_at
            ? 'Copiar de novo para a Clínica Ágil'
            : 'Copiar para a Clínica Ágil'}
        </Button>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
            <button
              type="button"
              onClick={() => setView('whatsapp')}
              className={
                view === 'whatsapp'
                  ? 'rounded-md bg-surface px-3 py-1 font-medium shadow-sm'
                  : 'px-3 py-1 text-ink-soft'
              }
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setView('full')}
              className={
                view === 'full'
                  ? 'rounded-md bg-surface px-3 py-1 font-medium shadow-sm'
                  : 'px-3 py-1 text-ink-soft'
              }
            >
              Completo
            </button>
          </div>
          <button
            type="button"
            className="tap inline-flex items-center gap-1.5 text-sm text-ink-soft"
            onClick={async () => {
              const ok = await copyToClipboard(texts[view])
              flash(ok ? 'Copiado.' : 'Não foi possível copiar.')
            }}
          >
            <Copy className="size-4" aria-hidden /> Copiar
          </button>
        </div>

        <Card className="bg-surface-2">
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
            {texts[view]}
          </pre>
        </Card>
      </div>

      <Link
        href={`/pacientes/${session.patient_id}`}
        className="tap mt-6 flex w-full items-center justify-center text-sm text-ink-soft"
      >
        Concluir e ir para a ficha do paciente
      </Link>

      {toast && (
        <div
          className="safe-bottom fixed inset-x-0 bottom-20 z-50 mx-auto w-fit max-w-[90%] rounded-full bg-ink px-4 py-2 text-sm text-[var(--color-bg)] shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function DeliveryChip({ done, label }: { done: boolean; label: string }) {
  return done ? (
    <Badge tone="ok">
      <Check className="mr-1 size-3" aria-hidden /> {label} enviado
    </Badge>
  ) : (
    <Badge tone="warn">{label} pendente</Badge>
  )
}
