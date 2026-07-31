'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);

    if (error) { setErro(error.message); return; }
    router.push('/pdv');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 380, width: '90%', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>PDV do mercado</h1>
        <p style={{ fontSize: 14, color: 'var(--texto-suave)', marginBottom: 24 }}>Login do operador</p>
        <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          {erro && <p style={{ color: 'var(--vermelho)', fontSize: 13, margin: 0 }}>{erro}</p>}
          <button type="submit" disabled={carregando} style={{ marginTop: 8 }}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
