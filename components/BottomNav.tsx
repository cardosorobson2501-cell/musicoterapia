'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  Users,
  ListMusic,
  Download,
  Settings,
} from 'lucide-react'
import { cx } from './ui'

/**
 * Navegação principal, fixada no rodapé — é onde o polegar alcança sem
 * reposicionar o aparelho na mão.
 */
const TABS = [
  { href: '/hoje', label: 'Hoje', icon: CalendarDays },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/atividades', label: 'Atividades', icon: ListMusic },
  { href: '/exportar', label: 'Exportar', icon: Download },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                  active ? 'text-brand' : 'text-ink-soft',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
