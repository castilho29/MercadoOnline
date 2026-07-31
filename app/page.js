'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Exportação estática (GitHub Pages) não suporta redirect() de servidor,
// então fazemos isso no navegador mesmo.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, []);

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center' }}>
      <p>Redirecionando...</p>
      <p style={{ fontSize: 13 }}>
        <Link href="/login">Entrar como operador (PDV)</Link><br />
        <Link href="/loja/login">Entrar como cliente (Loja)</Link><br />
        <Link href="/entregador/login">Entrar como entregador</Link>
      </p>
    </div>
  );
}
