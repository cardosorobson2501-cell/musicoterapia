'use client'

import {
  DEFAULT_DETECTOR_SETTINGS,
  DETECTOR_LIMITS,
  type DetectorSettings,
  levelOf,
  rmsOfLevel,
} from '@/lib/domain/notes'
import { Button } from '@/components/ui'

/**
 * Calibração do microfone: cada ajuste tem uma frase dizendo quando mexer.
 * O medidor mostra o volume que está entrando e onde fica o mínimo para
 * contar, que é o jeito mais fácil de acertar o primeiro ajuste.
 */
export function CalibrationPanel({
  settings,
  onChange,
  level,
  listening,
}: {
  settings: DetectorSettings
  onChange: (next: DetectorSettings) => void
  level: number
  listening: boolean
}) {
  const set = (patch: Partial<DetectorSettings>) => onChange({ ...settings, ...patch })
  const threshold = levelOf(settings.minRms)
  const L = DETECTOR_LIMITS

  return (
    <details className="rounded-xl border border-border bg-surface-2/50 px-3 py-2">
      <summary className="tap flex cursor-pointer items-center text-sm font-medium">
        Ajustar calibração do microfone
      </summary>

      <div className="space-y-4 pb-2 pt-2">
        <div>
          <div
            className="relative h-3 overflow-hidden rounded-full bg-border"
            role="meter"
            aria-label="Volume que entra pelo microfone"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level)}
          >
            <div
              className={
                'h-full ' + (level >= threshold ? 'bg-ok' : 'bg-ink-soft/50')
              }
              style={{ width: `${level}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-danger"
              style={{ left: `${threshold}%` }}
              aria-hidden
            />
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {listening
              ? 'Toque uma nota: a barra deve passar da marca vermelha. Ruído de fundo deve ficar antes dela.'
              : 'Ligue o microfone para ver o volume em tempo real.'}
          </p>
        </div>

        <Slider
          label="Volume mínimo"
          hint="Aumente se o aparelho conta notas que você não tocou (ruído). Diminua se ele não percebe notas suaves ou distantes."
          min={0}
          max={100}
          step={1}
          value={levelOf(settings.minRms)}
          show={(v) => String(Math.round(v))}
          onChange={(v) => set({ minRms: rmsOfLevel(v) })}
        />
        <Slider
          label="Sensibilidade ao golpe"
          hint="Diminua se repetições rápidas da mesma nota não aparecem. Aumente se uma nota só gera bolinhas repetidas."
          min={L.attackRatio.min}
          max={L.attackRatio.max}
          step={L.attackRatio.step}
          value={settings.attackRatio}
          show={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => set({ attackRatio: v })}
        />
        <Slider
          label="Sensibilidade ao “estalo”"
          hint="Ajuda a pegar golpes sobre uma nota que ainda está soando. Diminua se ainda faltam repetições; aumente se sobram bolinhas."
          min={L.hfRatio.min}
          max={L.hfRatio.max}
          step={L.hfRatio.step}
          value={settings.hfRatio}
          show={(v) => `${v.toFixed(1)}×`}
          onChange={(v) => set({ hfRatio: v })}
        />
        <Slider
          label="Intervalo mínimo entre notas"
          hint="Duas notas mais próximas que isso contam como uma. Diminua para toques muito rápidos; aumente se sobram bolinhas duplicadas."
          min={L.minGapMs.min}
          max={L.minGapMs.max}
          step={L.minGapMs.step}
          value={settings.minGapMs}
          show={(v) => `${Math.round(v)} ms`}
          onChange={(v) => set({ minGapMs: v })}
        />

        <Button
          variant="secondary"
          full
          onClick={() => onChange(DEFAULT_DETECTOR_SETTINGS)}
        >
          Restaurar ajustes padrão
        </Button>
      </div>
    </details>
  )
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  show,
  onChange,
}: {
  label: string
  hint: string
  min: number
  max: number
  step: number
  value: number
  show: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-sm font-medium">
        {label}
        <span className="tabular-nums text-ink-soft">{show(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tap mt-1 w-full accent-[var(--color-brand)]"
      />
      <span className="block text-xs text-ink-soft">{hint}</span>
    </label>
  )
}
