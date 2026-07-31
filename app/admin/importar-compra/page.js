'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function ImportarCompraPage() {
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login');
    });
  }, []);

  async function enviar(e) {
    e.preventDefault();
    if (!arquivo) return;

    setEnviando(true);
    setErro('');
    setResultado(null);

    const formData = new FormData();
    formData.append('xml', arquivo);

    try {
      const resposta = await fetch(`${process.env.NEXT_PUBLIC_MICROSSERVICO_URL}/importar-compra.php`, {
        method: 'POST',
        headers: { 'X-Microservico-Token': process.env.NEXT_PUBLIC_MICROSSERVICO_TOKEN },
        body: formData,
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro || 'Falha ao importar');
      } else {
        setResultado(dados);
        setArquivo(null);
      }
    } catch (e) {
      setErro('Não consegui falar com o microsserviço fiscal. Ele está rodando? Confira NEXT_PUBLIC_MICROSSERVICO_URL no .env.local.');
    }

    setEnviando(false);
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Importar XML de compra</h1>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--azul)' }}>← Retaguarda</Link>
      </div>

      <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 20 }}>
        Sobe o arquivo XML da NF-e que o fornecedor te mandou. O sistema cadastra o fornecedor
        automaticamente (se for novo), registra os itens comprados, e gera as parcelas de contas a
        pagar se a compra for a prazo.
      </p>

      <form onSubmit={enviar} className="card" style={{ padding: 20 }}>
        <input
          type="file"
          accept=".xml"
          onChange={(e) => setArquivo(e.target.files[0])}
          style={{ marginBottom: 14, width: '100%' }}
        />
        <button type="submit" disabled={!arquivo || enviando} style={{ width: '100%' }}>
          {enviando ? 'Importando...' : 'Importar nota'}
        </button>
      </form>

      {erro && (
        <div className="card" style={{ padding: 16, marginTop: 16, borderColor: 'var(--vermelho)', color: 'var(--vermelho)', fontSize: 14 }}>
          {erro}
        </div>
      )}

      {resultado && (
        <div className="card" style={{ padding: 16, marginTop: 16, background: 'var(--verde-claro)', fontSize: 14 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>✓ Nota importada!</p>
          <p style={{ margin: '6px 0 0' }}>Fornecedor: {resultado.fornecedor}</p>
          <p style={{ margin: '2px 0 0' }}>Itens: {resultado.quantidade_itens}</p>
          <p style={{ margin: '2px 0 0' }}>
            Forma de pagamento: {resultado.forma_pagamento === 'a_prazo' ? 'A prazo' : 'À vista'}
            {resultado.forma_pagamento === 'a_prazo' && ` (${resultado.parcelas_geradas} parcela(s) geradas)`}
          </p>
        </div>
      )}
    </div>
  );
}
