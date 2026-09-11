'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { baseFields, save } from '@/lib/db/repo'
import { useTherapistId } from '@/lib/auth/AuthProvider'
import type { Activity, ActivityConfig, MeasurementType } from '@/lib/db/types'
import {
  MEASUREMENT_LABELS,
  defaultConfig,
  promptLevels,
} from '@/lib/domain/performance'
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui'

/**
 * Criação e edição de atividade estruturada.
 *
 * O tipo de medição define quais controles aparecem na tela de atendimento,
 * então a escolha vem primeiro e o resto do formulário se ajusta a ela.
 */
export function ActivityForm({ activity }: { activity?: Activity }) {
  const therapistId = useTherapistId()
  const router = useRouter()
  const editing = Boolean(activity)

  const [name, setName] = useState(activity?.name ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [objective, setObjective] = useState(activity?.objective ?? '')
  const [type, setType] = useState<MeasurementType>(
    activity?.measurement_type ?? 'trials',
  )
  const [config, setConfig] = useState<ActivityConfig>(
    activity?.config ?? defaultConfig('trials'),
  )
  const [mastery, setMastery] = useState(activity?.mastery_criteria ?? '')
  const [isActive, setIsActive] = useState(activity?.is_active ?? true)
  const [busy, setBusy] = useState(false)

  function changeType(next: MeasurementType) {
    setType(next)
    // Troca de tipo recomeça a config: os campos não são compatíveis entre si.
    setConfig(defaultConfig(next))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const base = activity ?? (baseFields(therapistId) as Activity)
      const row: Activity = {
        ...base,
        name: name.trim(),
        description: description.trim(),
        objective: objective.trim(),
        measurement_type: type,
        config,
        mastery_criteria: mastery.trim(),
        is_active: isActive,
      }
      await save('activities', row)
      router.replace('/atividades')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-4">
      <Field label="Nome da atividade">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Imitação rítmica com tambor"
          required
        />
      </Field>

      <Field label="Objetivo" hint="O que a atividade pretende desenvolver.">
        <Textarea
          rows={2}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
      </Field>

      <Field label="Descrição / como aplicar">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field
        label="Como o desempenho é medido"
        hint="Define os botões que aparecem durante o atendimento."
      >
        <Select
          value={type}
          onChange={(e) => changeType(e.target.value as MeasurementType)}
        >
          {(Object.keys(MEASUREMENT_LABELS) as MeasurementType[]).map((t) => (
            <option key={t} value={t}>
              {MEASUREMENT_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Card className="space-y-3 bg-surface-2">
        <TypeConfig type={type} config={config} onChange={setConfig} />
      </Card>

      <Field
        label="Critério de domínio"
        hint="Opcional. Ex.: 80% de independência em 3 sessões seguidas."
      >
        <Input
          value={mastery}
          onChange={(e) => setMastery(e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-[var(--color-brand)]"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Atividade disponível para uso
      </label>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={busy || !name.trim()}
        >
          {busy ? 'Salvando…' : editing ? 'Salvar' : 'Criar atividade'}
        </Button>
      </div>
    </form>
  )
}

function TypeConfig({
  type,
  config,
  onChange,
}: {
  type: MeasurementType
  config: ActivityConfig
  onChange: (c: ActivityConfig) => void
}) {
  const patch = (p: Partial<ActivityConfig>) => onChange({ ...config, ...p })

  if (type === 'trials') {
    return (
      <Field
        label="Nº de tentativas previsto"
        hint="Só uma referência — você pode registrar mais ou menos no dia."
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          value={config.target_trials ?? 10}
          onChange={(e) =>
            patch({ target_trials: Number(e.target.value) || undefined })
          }
        />
      </Field>
    )
  }

  if (type === 'prompt_levels') {
    const levels = promptLevels(config)
    return (
      <>
        <p className="text-sm font-medium text-ink-soft">
          Níveis de ajuda — do mais independente para o mais assistido
        </p>
        <div className="space-y-2">
          {levels.map((lvl, i) => (
            <div key={i} className="flex gap-2">
              <span className="flex w-7 shrink-0 items-center justify-center text-sm text-ink-soft">
                {i + 1}
              </span>
              <Input
                value={lvl}
                onChange={(e) => {
                  const next = [...levels]
                  next[i] = e.target.value
                  patch({ levels: next })
                }}
              />
              <button
                type="button"
                aria-label={`Remover nível ${i + 1}`}
                className="tap px-2 text-danger disabled:opacity-30"
                disabled={levels.length <= 2}
                onClick={() =>
                  patch({ levels: levels.filter((_, idx) => idx !== i) })
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
          onClick={() => patch({ levels: [...levels, ''] })}
        >
          <Plus className="size-4" aria-hidden /> Adicionar nível
        </Button>
      </>
    )
  }

  if (type === 'scale') {
    const min = config.min ?? 0
    const max = config.max ?? 5
    const labels = config.labels ?? {}
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nota mínima">
            <Input
              type="number"
              inputMode="numeric"
              value={min}
              onChange={(e) => patch({ min: Number(e.target.value) })}
            />
          </Field>
          <Field label="Nota máxima">
            <Input
              type="number"
              inputMode="numeric"
              value={max}
              onChange={(e) => patch({ max: Number(e.target.value) })}
            />
          </Field>
        </div>
        <p className="text-sm font-medium text-ink-soft">
          Rótulos (opcional)
        </p>
        <div className="space-y-2">
          {range(min, max).map((n) => (
            <div key={n} className="flex items-center gap-2">
              <span className="flex w-7 shrink-0 items-center justify-center text-sm text-ink-soft">
                {n}
              </span>
              <Input
                value={labels[String(n)] ?? ''}
                placeholder="descrição desta nota"
                onChange={(e) =>
                  patch({
                    labels: { ...labels, [String(n)]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
      </>
    )
  }

  if (type === 'count') {
    return (
      <Field label="O que está sendo contado" hint="Aparece junto do número.">
        <Input
          value={config.unit ?? ''}
          placeholder="vocalizações, iniciativas de contato…"
          onChange={(e) => patch({ unit: e.target.value })}
        />
      </Field>
    )
  }

  return (
    <p className="text-sm text-ink-soft">
      O cronômetro não precisa de configuração. Durante o atendimento você
      inicia e para a contagem.
    </p>
  )
}

function range(a: number, b: number): number[] {
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  if (hi - lo > 20) return [] // evita renderizar centenas de campos
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}
