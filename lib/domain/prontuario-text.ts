import type {
  ActivityRecord,
  Institution,
  Patient,
  Session,
  Therapist,
} from '@/lib/db/types'
import { summarizeRecord } from './performance'
import { ageLabel, formatDateBR } from '@/lib/format'

/**
 * Monta o texto do prontuário para leitura e envio.
 *
 * Dois formatos, a partir dos mesmos dados:
 *  - `whatsapp`: enxuto, sem marcação pesada, para colar na conversa;
 *  - `full`: completo, com cabeçalho de identificação, para a Clínica Ágil.
 *
 * A identificação do paciente só entra no formato `full`. O texto de WhatsApp
 * vai para um grupo onde a família já sabe de quem se trata, e evitar repetir
 * nome e diagnóstico ali é boa prática.
 */

interface BuildInput {
  session: Session
  patient: Patient
  records: ActivityRecord[]
  institution?: Institution | null
  therapist?: Therapist | null
}

export function buildProntuarioText(
  input: BuildInput,
  format: 'whatsapp' | 'full',
): string {
  const { session, patient, records, institution, therapist } = input
  const L: string[] = []

  if (format === 'full') {
    L.push('PRONTUÁRIO DE ATENDIMENTO — MUSICOTERAPIA')
    L.push('')
    L.push(`Paciente: ${patient.full_name}`)
    L.push(`Código: ${patient.code}`)
    if (patient.birth_date)
      L.push(`Nascimento: ${formatDateBR(patient.birth_date)} (${ageLabel(patient.birth_date)})`)
    if (patient.diagnosis) L.push(`Diagnóstico: ${patient.diagnosis}`)
    if (institution) L.push(`Instituição: ${institution.name}`)
    L.push('')
  } else {
    L.push(`*Atendimento de musicoterapia — ${formatDateBR(session.session_date)}*`)
    L.push('')
  }

  const horario = [session.start_time, session.end_time]
    .filter(Boolean)
    .join(' às ')
  L.push(`Data: ${formatDateBR(session.session_date)}${horario ? ` · ${horario}` : ''}`)
  L.push('')

  section(L, 'Objetivos da sessão', session.objectives)
  section(L, 'Recursos utilizados', session.resources)
  section(L, 'Descrição do atendimento', session.description)

  const withData = records.filter(hasData)
  if (withData.length > 0) {
    L.push('Desempenho nas atividades estruturadas:')
    for (const r of withData) {
      L.push(`- ${r.activity_name}: ${summarizeRecord(r)}`)
      if (r.notes.trim()) L.push(`  Obs.: ${r.notes.trim()}`)
    }
    L.push('')
  }

  section(L, 'Resposta do paciente', session.patient_response)
  section(L, 'Intercorrências', session.incidents)
  section(L, 'Conduta / plano para a próxima sessão', session.conduct)

  if (format === 'full' && therapist?.full_name) {
    L.push('')
    L.push(
      `${therapist.full_name}${therapist.council_id ? ` — ${therapist.council_id}` : ''}`,
    )
  }

  // Remove linhas em branco duplicadas e espaço nas pontas.
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function section(lines: string[], title: string, body: string) {
  if (!body?.trim()) return
  lines.push(`${title}:`)
  lines.push(body.trim())
  lines.push('')
}

function hasData(r: ActivityRecord): boolean {
  return (
    r.trials.length > 0 ||
    r.score !== null ||
    r.count_value !== null ||
    (r.duration_seconds ?? 0) > 0 ||
    r.notes.trim().length > 0
  )
}
