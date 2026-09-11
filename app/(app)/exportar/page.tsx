'use client'

import { useMemo, useState } from 'react'
import { Check, Download, FileText, ShieldCheck } from 'lucide-react'
import { usePatients } from '@/lib/db/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import { supabase } from '@/lib/supabase/client'
import { newId } from '@/lib/db/repo'
import {
  collectData,
  render,
  scanBundle,
  type ExportOptions,
  type PatientBundle,
} from '@/lib/domain/export'
import { buildMap } from '@/lib/domain/anonymize'
import { saveOrShareFile } from '@/lib/domain/save-file'
import { copyToClipboard } from '@/lib/domain/delivery'
import { todayISO } from '@/lib/format'
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui'
import { NameReview } from '@/components/export/NameReview'

type Step = 'filtros' | 'revisao' | 'pronto'

export default function ExportPage() {
  const { user } = useAuth()
  const patients = usePatients(true)

  const [step, setStep] = useState<Step>('filtros')
  const today = todayISO()

  const [from, setFrom] = useState(firstOfMonth(today))
  const [to, setTo] = useState(today)
  const [scope, setScope] = useState<'all' | 'some'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [includePersonal, setIncludePersonal] = useState(true)
  const [includeSessions, setIncludeSessions] = useState(true)
  const [includeActivities, setIncludeActivities] = useState(true)
  const [anonymize, setAnonymize] = useState(true)
  const [anonAge, setAnonAge] = useState(false)
  const [anonInstitution, setAnonInstitution] = useState(true)
  const [format, setFormat] = useState<ExportOptions['format']>('markdown')

  const [bundles, setBundles] = useState<PatientBundle[] | null>(null)
  const [confirmed, setConfirmed] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{
    content: string
    filename: string
    mime: string
  } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const options = (): ExportOptions => ({
    from,
    to,
    patientIds: scope === 'all' ? 'all' : [...selected],
    includePersonalData: includePersonal,
    includeSessions,
    includeActivityData: includeActivities,
    anonymize,
    anonymizeAge: anonAge,
    anonymizeInstitution: anonInstitution,
    confirmedRedactions: confirmed,
    format,
  })

  const candidatesByPatient = useMemo(() => {
    if (!bundles) return []
    return bundles.map((b) => {
      const map = buildMap(b.patient, b.institution?.name ?? null, {
        anonymizeInstitution: anonInstitution,
      })
      return {
        patientId: b.patient.id,
        patientLabel: `${b.patient.code} — ${b.patient.full_name}`,
        candidates: scanBundle(b, map),
      }
    })
  }, [bundles, anonInstitution])

  async function proceed() {
    setBusy(true)
    try {
      const data = await collectData({
        from,
        to,
        patientIds: scope === 'all' ? 'all' : [...selected],
      })
      setBundles(data)
      // Sem anonimização não há o que revisar.
      setStep(anonymize ? 'revisao' : 'pronto')
      if (!anonymize) await generate(data)
    } finally {
      setBusy(false)
    }
  }

  async function generate(data = bundles) {
    if (!data) return
    setBusy(true)
    try {
      const opts = options()
      const out = render(data, opts)
      setResult(out)
      setStep('pronto')

      // Registro da exportação (rastreabilidade). Silencioso se offline.
      try {
        await supabase()
          .from('export_logs')
          .insert({
            id: newId(),
            therapist_id: user!.id,
            period_start: from,
            period_end: to,
            patient_count: data.length,
            anonymized: opts.anonymize,
            format: opts.format,
            contents: [
              opts.includePersonalData && 'dados pessoais',
              opts.includeSessions && 'prontuários',
              opts.includeActivityData && 'atividades',
            ]
              .filter(Boolean)
              .join(', '),
          })
      } catch {
        /* sem rede: o log fica para uma próxima; não bloqueia a exportação */
      }
    } finally {
      setBusy(false)
    }
  }

  const flash = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <>
      <PageHeader
        title="Exportar"
        subtitle={
          step === 'filtros'
            ? 'Escolha o período e o conteúdo'
            : step === 'revisao'
              ? 'Revise os nomes antes de gerar'
              : 'Arquivo pronto'
        }
      />

      {step === 'filtros' && (
        <div className="space-y-5">
          <section className="space-y-3">
            <SectionTitle>Período</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <Preset onClick={() => setRange(setFrom, setTo, 'month', today)}>
                Mês atual
              </Preset>
              <Preset onClick={() => setRange(setFrom, setTo, '3m', today)}>
                Últimos 3 meses
              </Preset>
              <Preset onClick={() => setRange(setFrom, setTo, 'year', today)}>
                Ano
              </Preset>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="De">
                <Input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="Até">
                <Input
                  type="date"
                  value={to}
                  min={from}
                  max={today}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Pacientes</SectionTitle>
            <Select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'all' | 'some')}
            >
              <option value="all">Todos com atendimento no período</option>
              <option value="some">Escolher pacientes</option>
            </Select>
            {scope === 'some' && (
              <Card className="max-h-64 space-y-1 overflow-y-auto bg-surface-2">
                {(patients ?? []).map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2.5 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-brand)]"
                      checked={selected.has(p.id)}
                      onChange={(e) => {
                        const next = new Set(selected)
                        e.target.checked ? next.add(p.id) : next.delete(p.id)
                        setSelected(next)
                      }}
                    />
                    {p.code} — {p.full_name}
                  </label>
                ))}
              </Card>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle>O que incluir</SectionTitle>
            <Toggle
              checked={includePersonal}
              onChange={setIncludePersonal}
              label="Dados do paciente"
              hint="Diagnóstico, demanda, condição inicial."
            />
            <Toggle
              checked={includeSessions}
              onChange={setIncludeSessions}
              label="Prontuários completos"
            />
            <Toggle
              checked={includeActivities}
              onChange={setIncludeActivities}
              label="Dados de desempenho nas atividades"
            />
          </section>

          <section className="space-y-2">
            <SectionTitle>Anonimização</SectionTitle>
            <Toggle
              checked={anonymize}
              onChange={setAnonymize}
              label="Anonimizar o material exportado"
              hint="Recomendado para uso com ferramentas de IA. O paciente vira o código (P001…); nomes de responsáveis viram rótulos."
              emphasis
            />
            {anonymize && (
              <div className="ml-1 space-y-2 border-l-2 border-border pl-3">
                <Toggle
                  checked={anonInstitution}
                  onChange={setAnonInstitution}
                  label="Trocar o nome da instituição"
                />
                <Toggle
                  checked={anonAge}
                  onChange={setAnonAge}
                  label="Idade como faixa etária"
                  hint="Ex.: “6-8 anos” em vez de 7."
                />
              </div>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle>Formato</SectionTitle>
            <Select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as ExportOptions['format'])
              }
            >
              <option value="markdown">Markdown (melhor para colar em IA)</option>
              <option value="csv">CSV (planilha)</option>
              <option value="json">JSON (dados completos)</option>
            </Select>
          </section>

          <Button
            full
            disabled={busy || (scope === 'some' && selected.size === 0)}
            onClick={proceed}
          >
            {busy ? 'Reunindo dados…' : anonymize ? 'Revisar nomes' : 'Gerar arquivo'}
          </Button>
        </div>
      )}

      {step === 'revisao' && (
        <div className="space-y-5">
          {bundles === null ? (
            <Spinner />
          ) : bundles.length === 0 ? (
            <Card className="text-sm text-ink-soft">
              Nenhum paciente com dados no período escolhido.
            </Card>
          ) : (
            <NameReview
              candidatesByPatient={candidatesByPatient}
              confirmed={confirmed}
              onToggle={(pid, text, on) =>
                setConfirmed((prev) => {
                  const list = new Set(prev[pid] ?? [])
                  on ? list.add(text) : list.delete(text)
                  return { ...prev, [pid]: [...list] }
                })
              }
            />
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setStep('filtros')}
            >
              Voltar
            </Button>
            <Button
              className="flex-1"
              disabled={busy || bundles?.length === 0}
              onClick={() => generate()}
            >
              {busy ? 'Gerando…' : 'Gerar arquivo'}
            </Button>
          </div>
        </div>
      )}

      {step === 'pronto' && result && (
        <div className="space-y-4">
          <Card className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
              {anonymize ? (
                <ShieldCheck className="size-5" />
              ) : (
                <FileText className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{result.filename}</p>
              <p className="text-xs text-ink-soft">
                {bundles?.length ?? 0} paciente(s) ·{' '}
                {anonymize ? 'anonimizado' : 'identificado'} ·{' '}
                {(result.content.length / 1024).toFixed(0)} KB
              </p>
            </div>
          </Card>

          {anonymize && (
            <p className="rounded-xl bg-warn/15 p-3 text-xs leading-relaxed text-warn">
              Antes de usar: abra o arquivo e leia rapidamente procurando
              qualquer nome real que tenha escapado. A troca automática cobre o
              que o app conhece e o que você marcou, mas a conferência final é
              sua.
            </p>
          )}

          <Button
            full
            disabled={busy}
            onClick={async () => {
              const outcome = await saveOrShareFile(
                result.content,
                result.filename,
                result.mime,
              )
              flash(
                outcome === 'shared'
                  ? 'Compartilhado.'
                  : outcome === 'downloaded'
                    ? 'Arquivo baixado.'
                    : outcome === 'copied'
                      ? 'Conteúdo copiado.'
                      : '',
              )
            }}
          >
            <Download className="size-4" aria-hidden /> Salvar / compartilhar
            arquivo
          </Button>

          <Button
            variant="secondary"
            full
            onClick={async () => {
              const ok = await copyToClipboard(result.content)
              flash(ok ? 'Copiado.' : 'Não foi possível copiar.')
            }}
          >
            Copiar tudo
          </Button>

          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Pré-visualizar
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
              {result.content.slice(0, 8000)}
              {result.content.length > 8000 && '\n\n… (arquivo maior)'}
            </pre>
          </details>

          <Button variant="ghost" full onClick={() => setStep('filtros')}>
            Nova exportação
          </Button>
        </div>
      )}

      {toast && (
        <div
          className="safe-bottom fixed inset-x-0 bottom-20 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-[var(--color-bg)] shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
      {children}
    </h2>
  )
}

function Preset({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border px-3 py-1.5 text-sm active:bg-surface-2"
    >
      {children}
    </button>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  emphasis,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  emphasis?: boolean
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        emphasis && checked
          ? 'border-brand/40 bg-brand/5'
          : 'border-border'
      }`}
    >
      <span
        className={
          checked
            ? 'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-brand-ink'
            : 'mt-0.5 size-6 shrink-0 rounded-md border border-border'
        }
      >
        {checked && <Check className="size-4" />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>
        )}
      </span>
    </label>
  )
}

function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function setRange(
  setFrom: (v: string) => void,
  setTo: (v: string) => void,
  preset: 'month' | '3m' | 'year',
  today: string,
) {
  setTo(today)
  const d = new Date(`${today}T12:00:00`)
  if (preset === 'month') setFrom(firstOfMonth(today))
  else if (preset === '3m') {
    d.setMonth(d.getMonth() - 3)
    setFrom(d.toISOString().slice(0, 10))
  } else {
    d.setFullYear(d.getFullYear() - 1)
    setFrom(d.toISOString().slice(0, 10))
  }
}
