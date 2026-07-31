'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function LoginClientePage() {
  const [modo, setModo] = useState('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    if (modo === 'cadastrar') {
      const { error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
      setCarregando(false);
      if (error) return setErro(error.message);
      router.push('/loja');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) return setErro(error.message);
    router.push('/loja');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 380, width: '90%', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
          {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </h1>
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {modo === 'cadastrar' && (
            <input type="text" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          )}
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
          {erro && <p style={{ color: 'var(--vermelho)', fontSize: 13, margin: 0 }}>{erro}</p>}
          <button type="submit" disabled={carregando} style={{ marginTop: 8 }}>
            {carregando ? 'Enviando...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <p style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setModo(modo === 'entrar' ? 'cadastrar' : 'entrar'); }} style={{ color: 'var(--azul)' }}>
            {modo === 'entrar' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </a>
        </p>
      </div>
    </div>
  );
}
