'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker depois que a página carrega, para não competir
 * com o primeiro render. Em desenvolvimento fica desligado: cache de app
 * shell atrapalha a edição.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Sem service worker o app ainda funciona — só perde a abertura offline.
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
