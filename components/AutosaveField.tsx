'use client'

import { useEffect, useRef, useState } from 'react'
import { Textarea, Field } from '@/components/ui'

/**
 * Campo de texto que salva sozinho enquanto se digita.
 *
 * Durante o atendimento não há momento para apertar "salvar" — e se o app
 * fechar, o texto já registrado não pode sumir. Grava depois de uma pausa
 * curta na digitação, e também ao sair do campo.
 */
export function AutosaveField({
  label,
  hint,
  value,
  onSave,
  rows,
  disabled,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  onSave: (next: string) => unknown
  rows?: number
  disabled?: boolean
  placeholder?: string
}) {
  const [local, setLocal] = useState(value)
  const [saved, setSaved] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(value)

  // Atualização vinda de fora (sincronização) só entra se o campo não estiver
  // sendo editado, para não apagar o que está sendo digitado.
  useEffect(() => {
    if (saved && value !== local) {
      setLocal(value)
      latest.current = value
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    if (latest.current !== value) {
      void onSave(latest.current)
    }
    setSaved(true)
  }

  const onChange = (next: string) => {
    setLocal(next)
    latest.current = next
    setSaved(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 800)
  }

  // O efeito de desmontagem só roda uma vez, então precisa chamar sempre a
  // versão mais recente de flush (via ref) — senão, ao sair da tela logo
  // após digitar, ele usaria o "value"/"onSave" capturados lá no início.
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => flushRef.current(), [])

  return (
    <Field label={label} hint={hint}>
      <Textarea
        value={local}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
      />
      <span
        className="mt-1 block text-right text-[11px] text-ink-soft"
        aria-live="polite"
      >
        {saved ? 'salvo' : 'salvando…'}
      </span>
    </Field>
  )
}
