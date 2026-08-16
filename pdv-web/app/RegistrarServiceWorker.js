'use client';

import { useEffect } from 'react';

export default function RegistrarServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const prefixo = process.env.NEXT_PUBLIC_BASE_PATH || '';
      navigator.serviceWorker.register(`${prefixo}/sw.js`, { scope: `${prefixo}/` }).catch(() => {
        // Se falhar, o site continua funcionando normal -- só não
        // ganha o botão de instalar automático do Chrome.
      });
    }
  }, []);

  return null;
}
