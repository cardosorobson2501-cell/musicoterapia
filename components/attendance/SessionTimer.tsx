'use client'

import { useEffect, useState } from 'react'

/**
 * Tempo decorrido desde o início do atendimento, mostrado no cabeçalho.
 * Baseado em start_time (hora de parede) para sobreviver a recarregar a
 * página ou bloquear a tela.
 */
export function SessionTimer({
  sessionDate,
  startTime,
}: {
  sessionDate: string
  startTime: string
}) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!startTime) return
    const start = new Date(`${sessionDate}T${startTime}:00`).getTime()
    const tick = () => {
      const mins = Math.max(0, Math.floor((Date.now() - start) / 60000))
      const h = Math.floor(mins / 60)
      const m = mins % 60
      setLabel(h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`)
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [sessionDate, startTime])

  if (!label) return null
  return <span className="text-sm tabular-nums text-ink-soft">{label}</span>
}
