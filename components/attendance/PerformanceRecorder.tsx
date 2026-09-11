'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, X, HandHelping, Undo2, Minus, Plus, Play, Square } from 'lucide-react'
import type { ActivityRecord } from '@/lib/db/types'
import {
  addTrial,
  removeLastTrial,
  setCount,
  setDuration,
  setScore,
} from '@/lib/domain/session'
import {
  TRIAL_RESULT_LABELS,
  promptLevels,
  summarizeRecord,
} from '@/lib/domain/performance'
import { formatDuration } from '@/lib/format'
import { cx } from '@/components/ui'

/**
 * O registro de desempenho durante o atendimento.
 *
 * Premissas de desenho, todas vindas de "isto é usado com o celular numa mão
 * enquanto se conduz a sessão":
 *  - os botões de lançar ocupam a largura toda e ficam embaixo;
 *  - um toque = um dado; sem confirmação, sem diálogo;
 *  - desfazer sempre à vista;
 *  - resultado numérico ao vivo, grande o suficiente para ler de relance;
 *  - feedback tátil leve a cada toque.
 */
export function PerformanceRecorder({
  record,
  disabled,
}: {
  record: ActivityRecord
  disabled?: boolean
}) {
  const tap = () => {
    if (navigator.vibrate) navigator.vibrate(15)
  }

  return (
    <div className="space-y-3">
      <LiveResult record={record} />

      {record.measurement_type === 'trials' && (
        <TrialsControls record={record} disabled={disabled} onTap={tap} />
      )}
      {record.measurement_type === 'prompt_levels' && (
        <PromptLevelControls record={record} disabled={disabled} onTap={tap} />
      )}
      {record.measurement_type === 'scale' && (
        <ScaleControls record={record} disabled={disabled} onTap={tap} />
      )}
      {record.measurement_type === 'count' && (
        <CountControls record={record} disabled={disabled} onTap={tap} />
      )}
      {record.measurement_type === 'duration' && (
        <DurationControls record={record} disabled={disabled} onTap={tap} />
      )}
    </div>
  )
}

function LiveResult({ record }: { record: ActivityRecord }) {
  const pct = record.computed_percent
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm text-ink-soft">{summarizeRecord(record)}</p>
      {pct !== null && (
        <span className="shrink-0 text-2xl font-semibold tabular-nums">
          {pct}
          <span className="text-base font-normal text-ink-soft">%</span>
        </span>
      )}
    </div>
  )
}

/** Botão largo de lançamento — o alvo de toque principal da tela. */
function BigButton({
  onClick,
  disabled,
  tone,
  icon: Icon,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  tone: 'ok' | 'danger' | 'warn' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  const tones = {
    ok: 'bg-ok/15 text-ok active:bg-ok/25',
    danger: 'bg-danger/15 text-danger active:bg-danger/25',
    warn: 'bg-warn/20 text-warn active:bg-warn/30',
    neutral: 'bg-surface-2 text-ink active:bg-border',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex h-14 flex-1 items-center justify-center gap-2 rounded-xl text-base font-semibold disabled:opacity-40',
        tones[tone],
      )}
    >
      <Icon className="size-5" />
      {children}
    </button>
  )
}

function UndoButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border text-ink-soft disabled:opacity-30"
      aria-label="Desfazer último registro"
    >
      <Undo2 className="size-5" />
    </button>
  )
}

function TrialsControls({
  record,
  disabled,
  onTap,
}: {
  record: ActivityRecord
  disabled?: boolean
  onTap: () => void
}) {
  const act = (result: 'correct' | 'incorrect' | 'prompted') => {
    onTap()
    void addTrial(record, { result })
  }
  return (
    <div className="flex gap-2">
      <BigButton
        tone="ok"
        icon={Check}
        disabled={disabled}
        onClick={() => act('correct')}
      >
        {TRIAL_RESULT_LABELS.correct}
      </BigButton>
      <BigButton
        tone="warn"
        icon={HandHelping}
        disabled={disabled}
        onClick={() => act('prompted')}
      >
        Ajuda
      </BigButton>
      <BigButton
        tone="danger"
        icon={X}
        disabled={disabled}
        onClick={() => act('incorrect')}
      >
        {TRIAL_RESULT_LABELS.incorrect}
      </BigButton>
      <UndoButton
        disabled={disabled || record.trials.length === 0}
        onClick={() => void removeLastTrial(record)}
      />
    </div>
  )
}

function PromptLevelControls({
  record,
  disabled,
  onTap,
}: {
  record: ActivityRecord
  disabled?: boolean
  onTap: () => void
}) {
  const levels = promptLevels(record.config_snapshot)
  return (
    <div className="space-y-2">
      {levels.map((label, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => {
            onTap()
            void addTrial(record, { prompt_level: i })
          }}
          className="flex h-12 w-full items-center gap-3 rounded-xl bg-surface-2 px-4 text-left font-medium active:bg-border disabled:opacity-40"
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{
              // Verde no mais independente, âmbar no mais assistido.
              background: `oklch(0.65 0.15 ${150 - (i / Math.max(levels.length - 1, 1)) * 90})`,
            }}
          />
          <span className="flex-1">{label}</span>
          <span className="text-sm tabular-nums text-ink-soft">
            {record.trials.filter((t) => t.prompt_level === i).length || ''}
          </span>
        </button>
      ))}
      <UndoButton
        disabled={disabled || record.trials.length === 0}
        onClick={() => void removeLastTrial(record)}
      />
    </div>
  )
}

function ScaleControls({
  record,
  disabled,
  onTap,
}: {
  record: ActivityRecord
  disabled?: boolean
  onTap: () => void
}) {
  const min = record.config_snapshot.min ?? 0
  const max = record.config_snapshot.max ?? 5
  const labels = record.config_snapshot.labels ?? {}
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const selected = labels[String(record.score)]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => {
              onTap()
              void setScore(record, record.score === v ? null : v)
            }}
            className={cx(
              'h-14 min-w-14 flex-1 rounded-xl text-lg font-semibold tabular-nums disabled:opacity-40',
              record.score === v
                ? 'bg-brand text-brand-ink'
                : 'bg-surface-2 text-ink active:bg-border',
            )}
          >
            {v}
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-center text-sm text-ink-soft">{selected}</p>
      )}
    </div>
  )
}

function CountControls({
  record,
  disabled,
  onTap,
}: {
  record: ActivityRecord
  disabled?: boolean
  onTap: () => void
}) {
  const value = record.count_value ?? 0
  const unit = record.config_snapshot.unit?.trim() || 'ocorrências'
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled || value === 0}
        onClick={() => {
          onTap()
          void setCount(record, value - 1)
        }}
        className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border disabled:opacity-30"
        aria-label="Diminuir"
      >
        <Minus className="size-5" />
      </button>
      <div className="flex-1 text-center">
        <span className="block text-3xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-ink-soft">{unit}</span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onTap()
          void setCount(record, value + 1)
        }}
        className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink disabled:opacity-40"
        aria-label="Aumentar"
      >
        <Plus className="size-6" />
      </button>
    </div>
  )
}

function DurationControls({
  record,
  disabled,
  onTap,
}: {
  record: ActivityRecord
  disabled?: boolean
  onTap: () => void
}) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(record.duration_seconds ?? 0)
  const startRef = useRef<number>(0)

  // Cronômetro tolerante a bloqueio de tela: guarda o instante de início e
  // recalcula a diferença, em vez de contar ticks (que pausam com a tela).
  useEffect(() => {
    if (!running) return
    startRef.current = Date.now() - elapsed * 1000
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    setRunning(false)
    onTap()
    void setDuration(record, elapsed)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-3xl font-semibold tabular-nums">
        {formatDuration(elapsed)}
      </span>
      {running ? (
        <button
          type="button"
          onClick={stop}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-danger/15 font-semibold text-danger"
        >
          <Square className="size-5" /> Parar
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onTap()
              setRunning(true)
            }}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-ok/15 font-semibold text-ok disabled:opacity-40"
          >
            <Play className="size-5" /> {elapsed > 0 ? 'Retomar' : 'Iniciar'}
          </button>
          {elapsed > 0 && (
            <button
              type="button"
              onClick={() => {
                setElapsed(0)
                void setDuration(record, 0)
              }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border text-ink-soft"
              aria-label="Zerar"
            >
              <Undo2 className="size-5" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
