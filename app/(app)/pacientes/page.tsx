'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { usePatients } from '@/lib/db/queries'
import { ageLabel, formatSchedule } from '@/lib/format'
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { SyncBadge } from '@/components/SyncProvider'

export default function PatientsPage() {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const patients = usePatients(showAll)

  const filtered = useMemo(() => {
    if (!patients) return undefined
    const q = query.trim().toLowerCase()
    if (!q) return patients
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q),
    )
  }, [patients, query])

  return (
    <>
      <PageHeader title="Pacientes" action={<SyncBadge />} />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
            className="pl-9"
            type="search"
            aria-label="Buscar paciente"
          />
        </div>
        <Link
          href="/pacientes/novo"
          aria-label="Novo paciente"
          className="tap flex items-center justify-center rounded-xl bg-brand px-4 text-brand-ink active:brightness-90"
        >
          <Plus className="size-5" aria-hidden />
        </Link>
      </div>

      {filtered === undefined ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? 'Nenhum paciente encontrado' : 'Nenhum paciente ainda'}
          description={
            query
              ? 'Tente outro nome ou código.'
              : 'Cadastre o primeiro paciente para começar a registrar atendimentos.'
          }
          action={
            !query && (
              <Link href="/pacientes/novo">
                <Button>Cadastrar paciente</Button>
              </Link>
            )
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pacientes/${p.id}`}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5 active:bg-surface-2"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
                  {initials(p.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.full_name}</span>
                    {p.status !== 'active' && (
                      <Badge tone="neutral">
                        {p.status === 'paused' ? 'Pausado' : 'Alta'}
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">
                    {p.code} · {ageLabel(p.birth_date)} ·{' '}
                    {formatSchedule(p.schedule)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="tap mt-6 w-full text-sm text-ink-soft"
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll
          ? 'Mostrar apenas pacientes ativos'
          : 'Mostrar também pausados e com alta'}
      </button>
    </>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}
