'use client';

import { useEffect } from 'react';

export default function RegistrarServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Se falhar, o site continua funcionando normal -- só não
        // ganha o botão de instalar automático do Chrome.
      });
    }
  }, []);

  return null;
}
