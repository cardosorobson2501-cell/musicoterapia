'use client'

import { Card } from './ui'

/**
 * Mostrado quando as variáveis do Supabase não estão definidas. Sem isto o app
 * quebraria com um erro técnico; aqui ele explica o que falta fazer.
 */
export function SetupNotice() {
  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <h1 className="text-xl font-semibold">Falta conectar o banco de dados</h1>
      <p className="mt-2 text-sm text-ink-soft">
        O app está instalado, mas ainda não sabe onde guardar os dados.
      </p>

      <Card className="mt-6 text-sm leading-relaxed">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Crie um projeto em <strong>supabase.com</strong>, escolhendo a
            região <strong>South America (São Paulo)</strong>.
          </li>
          <li>
            No projeto, abra <strong>SQL Editor</strong> e execute o conteúdo de{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
              supabase/migrations/0001_init.sql
            </code>
            .
          </li>
          <li>
            Em <strong>Project Settings → API</strong>, copie a{' '}
            <em>Project URL</em> e a chave <em>anon public</em>.
          </li>
          <li>
            Coloque as duas nas variáveis de ambiente da Vercel (ou no arquivo{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
              .env.local
            </code>
            , se estiver rodando no computador):
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">
              {'NEXT_PUBLIC_SUPABASE_URL=…\nNEXT_PUBLIC_SUPABASE_ANON_KEY=…'}
            </pre>
          </li>
        </ol>
      </Card>
    </div>
  )
}
