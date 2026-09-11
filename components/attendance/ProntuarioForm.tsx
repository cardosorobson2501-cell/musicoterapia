'use client'

import type { Session } from '@/lib/db/types'
import { patchSession } from '@/lib/domain/session'
import { AutosaveField } from '@/components/AutosaveField'
import { Field, Input } from '@/components/ui'

/**
 * Os blocos de texto do prontuário. Todos com autosave — durante o
 * atendimento ninguém aperta "salvar".
 */
export function ProntuarioForm({
  session,
  disabled,
}: {
  session: Session
  disabled?: boolean
}) {
  const patch = (p: Partial<Session>) => patchSession(session, p)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início">
          <Input
            type="time"
            defaultValue={session.start_time}
            disabled={disabled}
            onBlur={(e) => void patch({ start_time: e.target.value })}
          />
        </Field>
        <Field label="Término">
          <Input
            type="time"
            defaultValue={session.end_time}
            disabled={disabled}
            onBlur={(e) => void patch({ end_time: e.target.value })}
          />
        </Field>
      </div>

      <AutosaveField
        label="Objetivos da sessão"
        value={session.objectives}
        disabled={disabled}
        rows={2}
        onSave={(v) => patch({ objectives: v })}
      />
      <AutosaveField
        label="Recursos utilizados"
        hint="Instrumentos, canções, materiais."
        value={session.resources}
        disabled={disabled}
        rows={2}
        onSave={(v) => patch({ resources: v })}
      />
      <AutosaveField
        label="Descrição do atendimento"
        value={session.description}
        disabled={disabled}
        rows={5}
        onSave={(v) => patch({ description: v })}
      />
      <AutosaveField
        label="Resposta do paciente"
        value={session.patient_response}
        disabled={disabled}
        rows={4}
        onSave={(v) => patch({ patient_response: v })}
      />
      <AutosaveField
        label="Intercorrências"
        hint="Deixe claro quando não houver."
        value={session.incidents}
        disabled={disabled}
        rows={2}
        onSave={(v) => patch({ incidents: v })}
      />
      <AutosaveField
        label="Conduta / plano para a próxima sessão"
        value={session.conduct}
        disabled={disabled}
        rows={3}
        onSave={(v) => patch({ conduct: v })}
      />
    </div>
  )
}
