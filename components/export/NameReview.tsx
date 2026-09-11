'use client'

import type { NameCandidate } from '@/lib/domain/anonymize'
import { Card } from '@/components/ui'

/**
 * Revisão dos nomes encontrados no texto livre.
 *
 * A varredura automática nunca decide sozinha: cada trecho aparece aqui em
 * contexto e o terapeuta marca o que é nome de pessoa. Só o que for marcado
 * é removido do material exportado.
 */
export function NameReview({
  candidatesByPatient,
  confirmed,
  onToggle,
}: {
  candidatesByPatient: Array<{
    patientId: string
    patientLabel: string
    candidates: NameCandidate[]
  }>
  confirmed: Record<string, string[]>
  onToggle: (patientId: string, text: string, on: boolean) => void
}) {
  const total = candidatesByPatient.reduce(
    (n, p) => n + p.candidates.length,
    0,
  )

  if (total === 0) {
    return (
      <Card className="text-sm text-ink-soft">
        Nenhum outro nome foi encontrado no texto dos prontuários deste período.
        Os nomes cadastrados (paciente e responsáveis) já são removidos
        automaticamente.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        A varredura destacou {total} trecho(s) que podem ser nomes de pessoas.
        Marque os que forem — só esses são removidos. O que ficar desmarcado
        sai como está.
      </p>

      {candidatesByPatient.map(
        ({ patientId, patientLabel, candidates }) =>
          candidates.length > 0 && (
            <div key={patientId}>
              <h3 className="mb-2 text-sm font-semibold">{patientLabel}</h3>
              <ul className="space-y-2">
                {candidates.map((c) => {
                  const on = (confirmed[patientId] ?? []).includes(c.text)
                  return (
                    <li key={c.text}>
                      <label className="flex gap-3 rounded-xl border border-border p-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]"
                          checked={on}
                          onChange={(e) =>
                            onToggle(patientId, c.text, e.target.checked)
                          }
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{c.text}</span>
                          <span className="mt-0.5 block text-xs text-ink-soft">
                            “…{c.context}…” · {c.reason}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ),
      )}
    </div>
  )
}
