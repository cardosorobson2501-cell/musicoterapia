'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { useInstitutions } from '@/lib/db/queries'
import { nextPatientCode } from '@/lib/db/queries'
import { baseFields, save } from '@/lib/db/repo'
import { useTherapistId } from '@/lib/auth/AuthProvider'
import type {
  Guardian,
  Patient,
  PatientStatus,
  ScheduleSlot,
  WhatsAppMode,
} from '@/lib/db/types'
import { WEEKDAYS } from '@/lib/format'
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui'

/**
 * Cadastro e edição de paciente.
 *
 * Dividido em blocos curtos porque o formulário é longo e o preenchimento
 * acontece no celular — rolar uma tela inteira de campos soltos é pior do que
 * atravessar seções nomeadas.
 */
export function PatientForm({ patient }: { patient?: Patient }) {
  const therapistId = useTherapistId()
  const router = useRouter()
  const institutions = useInstitutions()
  const editing = Boolean(patient)

  const [code, setCode] = useState(patient?.code ?? '')
  const [fullName, setFullName] = useState(patient?.full_name ?? '')
  const [nickname, setNickname] = useState(patient?.nickname ?? '')
  const [birthDate, setBirthDate] = useState(patient?.birth_date ?? '')
  const [guardians, setGuardians] = useState<Guardian[]>(
    patient?.guardians ?? [],
  )
  const [diagnosis, setDiagnosis] = useState(patient?.diagnosis ?? '')
  const [allergies, setAllergies] = useState(patient?.allergies ?? '')
  const [initialCondition, setInitialCondition] = useState(
    patient?.initial_condition ?? '',
  )
  const [mainDemand, setMainDemand] = useState(patient?.main_demand ?? '')
  const [institutionId, setInstitutionId] = useState(
    patient?.institution_id ?? '',
  )
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(
    patient?.schedule ?? [],
  )
  const [waMode, setWaMode] = useState<WhatsAppMode>(
    patient?.whatsapp_target?.mode ?? 'none',
  )
  const [waPhone, setWaPhone] = useState(patient?.whatsapp_target?.phone ?? '')
  const [waLabel, setWaLabel] = useState(patient?.whatsapp_target?.label ?? '')
  const [status, setStatus] = useState<PatientStatus>(
    patient?.status ?? 'active',
  )
  const [notes, setNotes] = useState(patient?.notes ?? '')
  const [busy, setBusy] = useState(false)

  // O código é o pseudônimo permanente do paciente: sugerido no cadastro,
  // nunca recalculado depois.
  useEffect(() => {
    if (!editing && !code) nextPatientCode().then(setCode)
  }, [editing, code])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const base = patient ?? (baseFields(therapistId) as Patient)
      const row: Patient = {
        ...base,
        code: code.trim() || (await nextPatientCode()),
        full_name: fullName.trim(),
        nickname: nickname.trim(),
        birth_date: birthDate || null,
        guardians: guardians.filter((g) => g.name.trim()),
        diagnosis,
        allergies,
        initial_condition: initialCondition,
        main_demand: mainDemand,
        institution_id: institutionId || null,
        schedule,
        whatsapp_target:
          waMode === 'none'
            ? { mode: 'none' }
            : { mode: waMode, phone: waPhone, label: waLabel },
        status,
        notes,
      }
      const saved = await save('patients', row)
      router.replace(`/pacientes/${saved.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-4">
      <Section title="Identificação">
        <Field label="Nome completo">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="off"
          />
        </Field>

        <Field
          label="Como é chamado"
          hint="Apelido usado no dia a dia. Também é substituído na exportação anonimizada."
        >
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="off"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de nascimento">
            <Input
              type="date"
              value={birthDate ?? ''}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
          <Field label="Código" hint="Usado na anonimização.">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              readOnly={editing}
              className={editing ? 'opacity-60' : undefined}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Filiação e responsáveis"
        hint="Quem aparece aqui vira “Responsável 1”, “Responsável 2” na exportação anonimizada."
      >
        {guardians.map((g, i) => (
          <Card key={i} className="space-y-3 bg-surface-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-soft">
                Responsável {i + 1}
              </span>
              <button
                type="button"
                aria-label={`Remover responsável ${i + 1}`}
                className="tap px-2 text-danger"
                onClick={() =>
                  setGuardians(guardians.filter((_, idx) => idx !== i))
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>

            <Field label="Nome">
              <Input
                value={g.name}
                onChange={(e) => updateGuardian(i, { name: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Parentesco">
                <Input
                  value={g.relationship}
                  placeholder="mãe, pai, avó…"
                  onChange={(e) =>
                    updateGuardian(i, { relationship: e.target.value })
                  }
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={g.phone}
                  inputMode="tel"
                  placeholder="(11) 98888-7777"
                  onChange={(e) => updateGuardian(i, { phone: e.target.value })}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-[var(--color-brand)]"
                checked={g.is_whatsapp_contact}
                onChange={(e) =>
                  updateGuardian(i, { is_whatsapp_contact: e.target.checked })
                }
              />
              Recebe os prontuários pelo WhatsApp
            </label>
          </Card>
        ))}

        <Button
          type="button"
          variant="secondary"
          full
          onClick={() =>
            setGuardians([
              ...guardians,
              {
                name: '',
                relationship: '',
                phone: '',
                is_whatsapp_contact: false,
              },
            ])
          }
        >
          <Plus className="size-4" aria-hidden /> Adicionar responsável
        </Button>
      </Section>

      <Section title="Quadro clínico">
        <Field label="Diagnóstico">
          <Textarea
            rows={2}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
        </Field>

        <Field label="Alergias" hint="Deixe explícito se não houver.">
          <Textarea
            rows={2}
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
          />
        </Field>

        <Field
          label="Condição inicial"
          hint="Como o paciente chegou. É a linha de base para comparar a evolução."
        >
          <Textarea
            value={initialCondition}
            onChange={(e) => setInitialCondition(e.target.value)}
          />
        </Field>

        <Field label="Demanda principal">
          <Textarea
            value={mainDemand}
            onChange={(e) => setMainDemand(e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Atendimento">
        <Field label="Instituição">
          <Select
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
          >
            <option value="">Não informada</option>
            {(institutions ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        {institutions?.length === 0 && (
          <p className="-mt-2 text-xs text-ink-soft">
            Nenhuma instituição cadastrada ainda — você pode cadastrar em
            Ajustes.
          </p>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">
            Dia e horário
          </legend>
          <div className="space-y-2">
            {schedule.map((slot, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  aria-label="Dia da semana"
                  value={slot.weekday}
                  onChange={(e) =>
                    updateSlot(i, { weekday: Number(e.target.value) })
                  }
                  className="flex-1"
                >
                  {WEEKDAYS.map((d, idx) => (
                    <option key={d} value={idx}>
                      {d}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label="Horário"
                  type="time"
                  value={slot.start_time}
                  onChange={(e) =>
                    updateSlot(i, { start_time: e.target.value })
                  }
                  className="w-32"
                />
                <button
                  type="button"
                  aria-label="Remover horário"
                  className="tap px-2 text-danger"
                  onClick={() =>
                    setSchedule(schedule.filter((_, idx) => idx !== i))
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            full
            className="mt-2"
            onClick={() =>
              setSchedule([
                ...schedule,
                { weekday: 1, start_time: '14:00', duration_min: 50 },
              ])
            }
          >
            <Plus className="size-4" aria-hidden /> Adicionar horário
          </Button>
        </fieldset>

        <Field label="Situação">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as PatientStatus)}
          >
            <option value="active">Em atendimento</option>
            <option value="paused">Pausado</option>
            <option value="discharged">Alta</option>
          </Select>
        </Field>
      </Section>

      <Section
        title="Envio do prontuário"
        hint="Define para onde o app abre o WhatsApp ao final do atendimento."
      >
        <Field label="Destino">
          <Select
            value={waMode}
            onChange={(e) => setWaMode(e.target.value as WhatsAppMode)}
          >
            <option value="none">Não enviar por WhatsApp</option>
            <option value="contact">Número do responsável</option>
            <option value="group">Grupo do paciente</option>
          </Select>
        </Field>

        {waMode === 'contact' && (
          <Field
            label="Número"
            hint="Com DDD. O app abre a conversa já com o texto pronto."
          >
            <Input
              value={waPhone}
              inputMode="tel"
              placeholder="(11) 98888-7777"
              onChange={(e) => setWaPhone(e.target.value)}
            />
          </Field>
        )}

        {waMode === 'group' && (
          <>
            <Field label="Nome do grupo" hint="Só para você identificar.">
              <Input
                value={waLabel}
                placeholder="Grupo do João"
                onChange={(e) => setWaLabel(e.target.value)}
              />
            </Field>
            <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-soft">
              O WhatsApp não permite abrir um grupo específico por link. Ao
              enviar, o app abre a lista de compartilhamento do celular com o
              texto pronto e você escolhe o grupo.
            </p>
          </>
        )}
      </Section>

      <Section title="Observações">
        <Field label="Anotações gerais">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Section>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={busy || !fullName.trim()}>
          {busy ? 'Salvando…' : editing ? 'Salvar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  )

  function updateGuardian(index: number, patch: Partial<Guardian>) {
    setGuardians((gs) =>
      gs.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    )
  }

  function updateSlot(index: number, patch: Partial<ScheduleSlot>) {
    setSchedule((ss) =>
      ss.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    )
  }
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </h2>
      {hint && <p className="mb-3 text-xs text-ink-soft">{hint}</p>}
      <div className={hint ? 'space-y-3' : 'mt-3 space-y-3'}>{children}</div>
    </section>
  )
}
