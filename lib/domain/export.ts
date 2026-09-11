import type {
  Activity,
  ActivityRecord,
  Institution,
  Patient,
  Session,
} from '@/lib/db/types'
import { db } from '@/lib/db/local'
import {
  applyMap,
  buildMap,
  scanForNames,
  type AnonymizationMap,
  type NameCandidate,
} from './anonymize'
import { summarizeRecord } from './performance'
import { ageBracket, ageLabel, formatDateBR } from '@/lib/format'

/**
 * Exportação dos dados de um período.
 *
 * O material é destinado a análise e produção de relatórios, inclusive com
 * ferramentas de IA — por isso a anonimização acontece aqui, antes de
 * qualquer arquivo existir, e por padrão está ligada.
 */

export interface ExportOptions {
  from: string // ISO date
  to: string // ISO date
  patientIds: string[] | 'all'
  includePersonalData: boolean
  includeSessions: boolean
  includeActivityData: boolean
  anonymize: boolean
  anonymizeAge: boolean
  anonymizeInstitution: boolean
  /** Trechos que o terapeuta confirmou como nomes, por paciente. */
  confirmedRedactions: Record<string, string[]>
  format: 'markdown' | 'csv' | 'json'
}

export interface PatientBundle {
  patient: Patient
  institution: Institution | null
  sessions: Array<{ session: Session; records: ActivityRecord[] }>
}

/** Junta tudo que entra na exportação, já filtrado pelo período. */
export async function collectData(
  opts: Pick<ExportOptions, 'from' | 'to' | 'patientIds'>,
): Promise<PatientBundle[]> {
  const local = db()
  const [allPatients, allInstitutions, allSessions, allRecords] =
    await Promise.all([
      local.patients.toArray(),
      local.institutions.toArray(),
      local.sessions.toArray(),
      local.activity_records.toArray(),
    ])

  const wanted =
    opts.patientIds === 'all'
      ? new Set(allPatients.filter((p) => !p.deleted_at).map((p) => p.id))
      : new Set(opts.patientIds)

  const bundles: PatientBundle[] = []

  for (const patient of allPatients) {
    if (patient.deleted_at || !wanted.has(patient.id)) continue

    const sessions = allSessions
      .filter(
        (s) =>
          !s.deleted_at &&
          s.patient_id === patient.id &&
          s.session_date >= opts.from &&
          s.session_date <= opts.to,
      )
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .map((session) => ({
        session,
        records: allRecords.filter(
          (r) => !r.deleted_at && r.session_id === session.id,
        ),
      }))

    if (sessions.length === 0 && opts.patientIds === 'all') continue

    bundles.push({
      patient,
      institution:
        allInstitutions.find((i) => i.id === patient.institution_id) ?? null,
      sessions,
    })
  }

  return bundles
}

/** Nomes candidatos no texto livre de todos os prontuários de um paciente. */
export function scanBundle(
  bundle: PatientBundle,
  map: AnonymizationMap,
): NameCandidate[] {
  const seen = new Map<string, NameCandidate>()
  for (const { session, records } of bundle.sessions) {
    const blocks = [
      session.objectives,
      session.resources,
      session.description,
      session.patient_response,
      session.incidents,
      session.conduct,
      ...records.map((r) => r.notes),
    ]
    for (const block of blocks) {
      // Varre o texto já sem os nomes conhecidos.
      for (const c of scanForNames(applyMap(block, map))) {
        const key = c.text.toLowerCase()
        if (!seen.has(key)) seen.set(key, c)
      }
    }
  }
  return [...seen.values()]
}

function mapFor(bundle: PatientBundle, opts: ExportOptions): AnonymizationMap {
  const map = buildMap(bundle.patient, bundle.institution?.name ?? null, {
    anonymizeInstitution: opts.anonymizeInstitution,
  })
  // Acrescenta o que o terapeuta confirmou na revisão.
  const clean = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  for (const term of opts.confirmedRedactions[bundle.patient.id] ?? []) {
    const parts = term.split(/\s+/).filter((p) => p.length >= 2)
    if (parts.length > 1) map.phrases.set(clean(term), '[nome removido]')
    for (const part of parts) map.words.set(clean(part), '[nome removido]')
  }
  return map
}

function redact(text: string, map: AnonymizationMap, on: boolean): string {
  return on ? applyMap(text, map) : text
}

// --------------------------------------------------------------------------
// Formatos
// --------------------------------------------------------------------------

export function toMarkdown(
  bundles: PatientBundle[],
  opts: ExportOptions,
): string {
  const L: string[] = []
  L.push(`# Exportação — Musicoterapia`)
  L.push('')
  L.push(
    `Período: ${formatDateBR(opts.from)} a ${formatDateBR(opts.to)}  `,
  )
  L.push(
    `Dados ${opts.anonymize ? 'anonimizados' : 'identificados'} · gerado em ${formatDateBR(new Date().toISOString())}`,
  )
  L.push('')

  for (const bundle of bundles) {
    const map = mapFor(bundle, opts)
    const on = opts.anonymize
    const id = on ? bundle.patient.code : bundle.patient.full_name

    L.push(`---`)
    L.push('')
    L.push(`## ${id}`)
    L.push('')

    if (opts.includePersonalData) {
      L.push(`- Código: ${bundle.patient.code}`)
      L.push(
        `- Idade: ${on && opts.anonymizeAge ? ageBracket(bundle.patient.birth_date) : ageLabel(bundle.patient.birth_date)}`,
      )
      if (bundle.institution) {
        L.push(
          `- Instituição: ${on && opts.anonymizeInstitution ? 'Instituição' : bundle.institution.name}`,
        )
      }
      if (bundle.patient.diagnosis) {
        L.push(`- Diagnóstico: ${redact(bundle.patient.diagnosis, map, on)}`)
      }
      if (bundle.patient.main_demand) {
        L.push(
          `- Demanda principal: ${redact(bundle.patient.main_demand, map, on)}`,
        )
      }
      if (bundle.patient.initial_condition) {
        L.push(
          `- Condição inicial: ${redact(bundle.patient.initial_condition, map, on)}`,
        )
      }
      L.push('')
    }

    if (opts.includeSessions) {
      for (const { session, records } of bundle.sessions) {
        L.push(`### Atendimento — ${formatDateBR(session.session_date)}`)
        L.push('')
        pushField(L, 'Objetivos', redact(session.objectives, map, on))
        pushField(L, 'Recursos', redact(session.resources, map, on))
        pushField(L, 'Descrição', redact(session.description, map, on))
        pushField(
          L,
          'Resposta do paciente',
          redact(session.patient_response, map, on),
        )
        pushField(L, 'Intercorrências', redact(session.incidents, map, on))
        pushField(L, 'Conduta', redact(session.conduct, map, on))

        if (opts.includeActivityData && records.length > 0) {
          L.push(`**Atividades estruturadas:**`)
          L.push('')
          for (const r of records) {
            L.push(`- ${r.activity_name}: ${summarizeRecord(r)}`)
            if (r.notes.trim()) {
              L.push(`  - Obs.: ${redact(r.notes, map, on)}`)
            }
          }
          L.push('')
        }
      }
    }

    if (opts.includeActivityData && !opts.includeSessions) {
      L.push(`### Evolução por atividade`)
      L.push('')
      for (const line of activityTimeline(bundle)) L.push(`- ${line}`)
      L.push('')
    }
  }

  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function pushField(lines: string[], label: string, body: string) {
  if (!body?.trim()) return
  lines.push(`**${label}:** ${body.trim()}`)
  lines.push('')
}

function activityTimeline(bundle: PatientBundle): string[] {
  const byActivity = new Map<string, ActivityRecord[]>()
  for (const { records } of bundle.sessions) {
    for (const r of records) {
      const arr = byActivity.get(r.activity_name) ?? []
      arr.push(r)
      byActivity.set(r.activity_name, arr)
    }
  }
  const out: string[] = []
  for (const [name, records] of byActivity) {
    const pts = records
      .filter((r) => r.computed_percent !== null)
      .map((r) => `${r.computed_percent}%`)
    out.push(
      `${name}: ${records.length} registro(s)${pts.length ? ` — ${pts.join(' → ')}` : ''}`,
    )
  }
  return out
}

export function toCSV(bundles: PatientBundle[], opts: ExportOptions): string {
  const rows: string[][] = [
    [
      'paciente',
      'data',
      'atividade',
      'tipo_medicao',
      'percentual',
      'resumo',
      'observacao',
    ],
  ]

  for (const bundle of bundles) {
    const map = mapFor(bundle, opts)
    const on = opts.anonymize
    const id = on ? bundle.patient.code : bundle.patient.full_name

    for (const { session, records } of bundle.sessions) {
      if (records.length === 0) {
        rows.push([id, session.session_date, '', '', '', '', ''])
        continue
      }
      for (const r of records) {
        rows.push([
          id,
          session.session_date,
          r.activity_name,
          r.measurement_type,
          r.computed_percent === null ? '' : String(r.computed_percent),
          summarizeRecord(r),
          redact(r.notes, map, on),
        ])
      }
    }
  }

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell ?? ''
          return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
        })
        .join(','),
    )
    .join('\r\n')
}

export function toJSON(bundles: PatientBundle[], opts: ExportOptions): string {
  const on = opts.anonymize
  const payload = {
    generated_at: new Date().toISOString(),
    period: { from: opts.from, to: opts.to },
    anonymized: on,
    patients: bundles.map((bundle) => {
      const map = mapFor(bundle, opts)
      return {
        id: bundle.patient.code,
        ...(on
          ? {}
          : { full_name: bundle.patient.full_name }),
        age: on && opts.anonymizeAge
          ? ageBracket(bundle.patient.birth_date)
          : ageLabel(bundle.patient.birth_date),
        institution:
          on && opts.anonymizeInstitution
            ? 'Instituição'
            : (bundle.institution?.name ?? null),
        ...(opts.includePersonalData
          ? {
              diagnosis: redact(bundle.patient.diagnosis, map, on),
              main_demand: redact(bundle.patient.main_demand, map, on),
              initial_condition: redact(
                bundle.patient.initial_condition,
                map,
                on,
              ),
            }
          : {}),
        sessions: opts.includeSessions
          ? bundle.sessions.map(({ session, records }) => ({
              date: session.session_date,
              objectives: redact(session.objectives, map, on),
              resources: redact(session.resources, map, on),
              description: redact(session.description, map, on),
              patient_response: redact(session.patient_response, map, on),
              incidents: redact(session.incidents, map, on),
              conduct: redact(session.conduct, map, on),
              activities: opts.includeActivityData
                ? records.map((r) => ({
                    activity: r.activity_name,
                    measurement_type: r.measurement_type,
                    percent: r.computed_percent,
                    summary: summarizeRecord(r),
                    trials: r.trials,
                    score: r.score,
                    duration_seconds: r.duration_seconds,
                    count_value: r.count_value,
                    notes: redact(r.notes, map, on),
                  }))
                : undefined,
            }))
          : undefined,
      }
    }),
  }
  return JSON.stringify(payload, null, 2)
}

export function render(bundles: PatientBundle[], opts: ExportOptions): {
  content: string
  filename: string
  mime: string
} {
  const stamp = new Date().toISOString().slice(0, 10)
  const tag = opts.anonymize ? 'anon' : 'ident'
  if (opts.format === 'csv') {
    return {
      content: toCSV(bundles, opts),
      filename: `musicoterapia_${tag}_${stamp}.csv`,
      mime: 'text/csv;charset=utf-8',
    }
  }
  if (opts.format === 'json') {
    return {
      content: toJSON(bundles, opts),
      filename: `musicoterapia_${tag}_${stamp}.json`,
      mime: 'application/json',
    }
  }
  return {
    content: toMarkdown(bundles, opts),
    filename: `musicoterapia_${tag}_${stamp}.md`,
    mime: 'text/markdown;charset=utf-8',
  }
}
