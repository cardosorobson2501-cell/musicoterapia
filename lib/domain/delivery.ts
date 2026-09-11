'use client'

import type { WhatsAppTarget } from '@/lib/db/types'
import { normalizePhone } from '@/lib/format'

/**
 * Entrega do prontuário nos canais externos.
 *
 * Nenhum envio é feito pelo servidor. O app leva o texto até o ponto em que
 * o terapeuta confirma com um toque — isso mantém o número de WhatsApp fora
 * de risco e não exige nenhuma infraestrutura adicional.
 */

export type DeliveryOutcome = 'opened' | 'shared' | 'copied' | 'cancelled'

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback para navegadores sem a API de clipboard.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/**
 * Leva o texto ao WhatsApp da melhor forma possível para o destino:
 *
 *  - contato com número  → link wa.me: abre a conversa certa já preenchida;
 *  - grupo               → navigator.share: o WhatsApp aparece na lista e o
 *                          terapeuta escolhe o grupo (não há link direto para
 *                          um grupo específico);
 *  - sem destino / falha → copia o texto e avisa.
 */
export async function sendToWhatsApp(
  target: WhatsAppTarget,
  text: string,
): Promise<DeliveryOutcome> {
  if (target.mode === 'contact' && target.phone) {
    const phone = normalizePhone(target.phone)
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener')
    return 'opened'
  }

  if (target.mode === 'group') {
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return 'shared'
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
      }
    }
    const copied = await copyToClipboard(text)
    return copied ? 'copied' : 'cancelled'
  }

  // Sem destino configurado: o melhor que dá é deixar copiado.
  const copied = await copyToClipboard(text)
  return copied ? 'copied' : 'cancelled'
}

const CLINICA_AGIL_URL = 'https://app.clinicaagil.com.br'

/**
 * Clínica Ágil.
 *
 * Enquanto não sabemos se o sistema deles oferece API, o fluxo é assistido:
 * copia o prontuário no formato completo e abre o site numa nova aba para o
 * terapeuta colar na evolução do paciente.
 *
 * Se surgir uma API, este é o único ponto que muda.
 */
export async function sendToClinicaAgil(text: string): Promise<DeliveryOutcome> {
  const copied = await copyToClipboard(text)
  window.open(CLINICA_AGIL_URL, '_blank', 'noopener')
  return copied ? 'copied' : 'opened'
}
