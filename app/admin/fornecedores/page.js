'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novo, setNovo] = useState({ cnpj: '', razao_social: '', nome_fantasia: '', telefone: '', email: '' });
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  async function carregar() {
    const { data, error } = await supabase.from('fornecedores').select('*').order('razao_social');
    if (error) setErro(error.message);
    else setFornecedores(data || []);
    setCarregando(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregar();
    });
  }, []);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');

    const { error } = await supabase.from('fornecedores').insert(novo);

    setSalvando(false);
    if (error) { setErro(error.message); return; }

    setNovo({ cnpj: '', razao_social: '', nome_fantasia: '', telefone: '', email: '' });
    setMostrarForm(false);
    carregar();
  }

  if (carregando) return <p style={{ padding: 24 }}>Carregando...</p>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Fornecedores</h1>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--azul)' }}>← Retaguarda</Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 16 }}>
        Normalmente você não precisa cadastrar aqui — ao importar o XML de uma compra, o fornecedor é
        criado automaticamente. Use esta tela só pra ver a lista ou cadastrar manualmente antes de comprar.
      </p>

      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14 }}>{erro}</p>}

      <button onClick={() => setMostrarForm(!mostrarForm)} style={{ marginBottom: 16 }}>
        {mostrarForm ? 'Cancelar' : '+ Novo fornecedor'}
      </button>

      {mostrarForm && (
        <form onSubmit={salvar} className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="CNPJ" value={novo.cnpj} onChange={(e) => setNovo({ ...novo, cnpj: e.target.value })} required />
          <input placeholder="Razão social" value={novo.razao_social} onChange={(e) => setNovo({ ...novo, razao_social: e.target.value })} required />
          <input placeholder="Nome fantasia (opcional)" value={novo.nome_fantasia} onChange={(e) => setNovo({ ...novo, nome_fantasia: e.target.value })} />
          <input placeholder="Telefone (opcional)" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
          <input placeholder="E-mail (opcional)" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
          <button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar fornecedor'}</button>
        </form>
      )}

      <div className="card">
        {fornecedores.length === 0 && (
          <p style={{ padding: 20, color: 'var(--texto-suave)', fontSize: 14 }}>Nenhum fornecedor cadastrado ainda.</p>
        )}
        {fornecedores.map((f) => (
          <div key={f.id} style={{ padding: 14, borderBottom: '1px solid var(--borda)' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{f.razao_social}</div>
            <div style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
              {f.cnpj} {f.nome_fantasia && `· ${f.nome_fantasia}`} {f.telefone && `· ${f.telefone}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
