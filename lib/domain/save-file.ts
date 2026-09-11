'use client'

import { copyToClipboard } from './delivery'

/**
 * Entrega um arquivo gerado ao usuário, no celular.
 *
 * Ordem de preferência:
 *  1. Compartilhar como arquivo (navigator.share) — no celular abre "Salvar em
 *     Arquivos", enviar por e-mail, mandar pro WhatsApp etc.;
 *  2. Baixar via link temporário — funciona na maioria dos navegadores;
 *  3. Copiar o conteúdo — último recurso, sempre disponível.
 */
export async function saveOrShareFile(
  content: string,
  filename: string,
  mime: string,
): Promise<'shared' | 'downloaded' | 'copied' | 'cancelled'> {
  const blob = new Blob([content], { type: mime })
  const file = new File([blob], filename, { type: mime })

  if (
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    }
  }

  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'downloaded'
  } catch {
    const ok = await copyToClipboard(content)
    return ok ? 'copied' : 'cancelled'
  }
}
